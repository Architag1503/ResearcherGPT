import re
import os
import json
import base64
import requests
import fitz  # PyMuPDF
from typing import Dict, Any, List, Optional

def clean_text(text: str) -> str:
    # Remove excessive newlines and whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove ligatures and strange symbols
    text = text.replace('ﬁ', 'fi').replace('ﬂ', 'fl')
    return text.strip()

def ocr_page_multimodal(b64_data: str) -> str:
    """
    Robust OCR extraction using Google Gemini Multimodal Vision API, with fallback between fast Flash models.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    # 1. Try Gemini Flash Vision (fast, multimodal)
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        preferred = os.getenv("GEMINI_MODEL")
        models_to_try = [preferred] if preferred else []
        for m in ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.6-flash"]:
            if m not in models_to_try:
                models_to_try.append(m)

        for gemini_model in models_to_try:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {
                                    "inlineData": {
                                        "mimeType": "image/jpeg",
                                        "data": b64_data
                                    }
                                },
                                {
                                    "text": "Transcribe all text from this academic paper page exactly. Keep headings, layout structure, lists, tables, and equations intact."
                                }
                            ]
                        }
                    ]
                }
                res = requests.post(url, headers=headers, json=payload, timeout=30)
                if res.status_code == 200:
                    res_data = res.json()
                    candidates = res_data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            text = parts[0]["text"].strip()
                            if text:
                                return text
                else:
                    print(f"[pdf_processor] Gemini model {gemini_model} returned {res.status_code}. Trying next fallback...")
            except Exception as e:
                print(f"[pdf_processor] Gemini model {gemini_model} error: {e}. Trying next fallback...")

    # 2. Fallback to Mistral Pixtral (if configured)
    mistral_key = os.getenv("MISTRAL_API_KEY")
    if mistral_key and "your_mistral_api_key" not in mistral_key:
        try:
            headers = {"Authorization": f"Bearer {mistral_key}", "Content-Type": "application/json"}
            payload = {
                "model": "pixtral-12b-2409",
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": f"data:image/jpeg;base64,{b64_data}"},
                        {"type": "text", "text": "Transcribe all text from this academic paper page. Return only the plain transcribed text."}
                    ]
                }],
                "max_tokens": 2000
            }
            res = requests.post("https://api.mistral.ai/v1/chat/completions", headers=headers, json=payload, timeout=25)
            if res.status_code == 200:
                text = res.json()["choices"][0]["message"]["content"].strip()
                if text:
                    return text
            else:
                print(f"[pdf_processor] Mistral Pixtral OCR error: {res.status_code} - {res.text[:100]}")
        except Exception as e:
            print(f"[pdf_processor] Mistral Pixtral OCR exception: {e}")

    return ""

def extract_metadata_with_gemini(first_page_text: str) -> Dict[str, Any]:
    """
    Leverages Gemini Flash to accurately extract Title, Authors, Abstract, Year, and DOI from the first page text.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or "your_gemini_api_key" in gemini_key:
        return {}

    preferred = os.getenv("GEMINI_MODEL")
    models_to_try = [preferred] if preferred else []
    for m in ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.6-flash"]:
        if m not in models_to_try:
            models_to_try.append(m)

    prompt = f"""
    Analyze the following first-page text of a research paper and extract:
    - Title
    - Authors (as a list of strings)
    - DOI
    - Publication Year (integer)
    - Abstract
    - Journal name
    
    Format the output strictly as a JSON object with these keys: title, authors, doi, year, abstract, journal.
    Output only the JSON, no markdown code block backticks.
    
    First page text:
    {first_page_text}
    """

    for gemini_model in models_to_try:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            res = requests.post(url, headers=headers, json=payload, timeout=12)
            if res.status_code == 200:
                text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                # Clean up potential markdown formatting
                if text.startswith("```json"):
                    text = text.replace("```json", "").replace("```", "").strip()
                elif text.startswith("```"):
                    text = text.replace("```", "").strip()
                return json.loads(text)
        except Exception as e:
            print(f"[pdf_processor] Fast fallback for metadata on {gemini_model}: {str(e)}")
    return {}

def extract_pdf_content(file_path: str) -> Dict[str, Any]:
    metadata = {
        "title": "",
        "authors": [],
        "doi": "",
        "year": None,
        "abstract": "",
        "journal": "",
        "extra_meta": {}
    }

    page_texts = []
    doc = None

    try:
        # 1. Parse using PyMuPDF (fitz)
        doc = fitz.open(file_path)
        
        # Try to extract PDF built-in metadata
        doc_meta = doc.metadata or {}
        metadata["title"] = doc_meta.get("title", "")
        if doc_meta.get("author"):
            metadata["authors"] = [a.strip() for a in doc_meta.get("author", "").split(",") if a.strip()]

        # Document Type Detection & Fast Text Extraction
        total_pages = len(doc)
        pages_to_ocr = []

        for page_num in range(total_pages):
            page = doc[page_num]
            text = page.get_text().strip()
            cleaned = clean_text(text)
            page_texts.append({
                "page_number": page_num + 1,
                "text": cleaned
            })
            if len(cleaned) < 10:
                pages_to_ocr.append((page_num, page))

        scanned_pages_count = len(pages_to_ocr)
        doc_type = "Digital"
        if scanned_pages_count == total_pages:
            doc_type = "Scanned"
        elif scanned_pages_count > 0:
            doc_type = "Mixed"
        metadata["extra_meta"]["document_type"] = doc_type

        # If scanned pages detected, run parallel multimodal OCR (up to 12 pages)
        if pages_to_ocr:
            from concurrent.futures import ThreadPoolExecutor
            target_ocr_pages = pages_to_ocr[:12]
            print(f"[pdf_processor] {len(target_ocr_pages)} scanned pages detected. Pre-rendering pages for multimodal OCR...")

            # Pre-render JPEG images sequentially in the main thread (thread-safe for PyMuPDF)
            rendered_scanned_pages = []
            for p_idx, p_obj in target_ocr_pages:
                try:
                    pix = p_obj.get_pixmap(dpi=80)
                    jpg_bytes = pix.tobytes("jpeg", jpg_quality=70)
                    del pix
                    b64_img = base64.b64encode(jpg_bytes).decode("utf-8")
                    del jpg_bytes
                    rendered_scanned_pages.append((p_idx, b64_img))
                except Exception as e:
                    print(f"[pdf_processor] OCR pre-render failed on page {p_idx+1}: {e}")

            def process_ocr_request(item):
                p_idx, b64_img = item
                try:
                    ocr_res = ocr_page_multimodal(b64_img)
                    return p_idx, ocr_res
                except Exception as e:
                    print(f"[pdf_processor] OCR request failed on page {p_idx+1}: {e}")
                    return p_idx, ""

            if rendered_scanned_pages:
                with ThreadPoolExecutor(max_workers=min(2, len(rendered_scanned_pages))) as executor:
                    for p_idx, ocr_res in executor.map(process_ocr_request, rendered_scanned_pages):
                        if ocr_res:
                            page_texts[p_idx]["text"] = clean_text(ocr_res)

        # 2. Extract metadata using Gemini if possible (runs on first page)
        first_page_text = page_texts[0]["text"] if page_texts else ""
        if first_page_text:
            gemini_meta = extract_metadata_with_gemini(first_page_text)
            if gemini_meta:
                metadata["title"] = gemini_meta.get("title") or metadata["title"]
                metadata["authors"] = gemini_meta.get("authors") or metadata["authors"]
                metadata["doi"] = gemini_meta.get("doi") or metadata["doi"]
                metadata["year"] = gemini_meta.get("year") or metadata["year"]
                metadata["abstract"] = gemini_meta.get("abstract") or metadata["abstract"]
                metadata["journal"] = gemini_meta.get("journal") or metadata["journal"]

        # Fallback heuristics if Gemini metadata fails or is unavailable
        if not metadata["title"] and first_page_text:
            lines = [line.strip() for line in first_page_text.split(".") if len(line.strip()) > 10]
            if lines:
                metadata["title"] = lines[0][:150]

        # Extract DOI from text if missing
        if not metadata["doi"] and first_page_text:
            doi_match = re.search(r'(10\.\d{4,9}/[-._;()/:A-Z0-9]+)', first_page_text, re.IGNORECASE)
            if doi_match:
                metadata["doi"] = doi_match.group(1)

        return {
            "metadata": metadata,
            "pages": page_texts,
            "tables": []
        }
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass
        import gc
        gc.collect()

def chunk_text(pages: List[Dict[str, Any]], chunk_size: int = 1200, overlap: int = 200, metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Intelligent semantic paragraph chunking. Groups sentences/paragraphs together 
    without breaking equations or text structures, ensuring high semantic coherence.
    """
    chunks = []
    chunk_index = 0

    for page in pages:
        text = page["text"]
        page_num = page["page_number"]
        
        # Split text into paragraphs (common delimiter is double newline or single newline after full stop)
        paragraphs = re.split(r'\n\s*\n|\. \n', text)
        current_chunk = []
        current_length = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If a single paragraph is larger than the chunk size, split it into sentences
            if len(para) > chunk_size:
                sentences = re.split(r'(?<=\.)\s+', para)
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    if current_length + len(sentence) > chunk_size and current_chunk:
                        # Save current chunk
                        chunks.append({
                            "chunk_index": chunk_index,
                            "text_content": " ".join(current_chunk),
                            "page_number": page_num
                        })
                        chunk_index += 1
                        # Retain overlap sentences
                        current_chunk = current_chunk[-2:] if len(current_chunk) >= 2 else current_chunk
                        current_length = sum(len(s) for s in current_chunk) + len(current_chunk)
                    
                    current_chunk.append(sentence)
                    current_length += len(sentence) + 1
            else:
                if current_length + len(para) > chunk_size and current_chunk:
                    chunks.append({
                        "chunk_index": chunk_index,
                        "text_content": " ".join(current_chunk),
                        "page_number": page_num
                    })
                    chunk_index += 1
                    current_chunk = current_chunk[-1:] if len(current_chunk) >= 1 else []
                    current_length = sum(len(s) for s in current_chunk) + len(current_chunk)

                current_chunk.append(para)
                current_length += len(para) + 1

        # Add remaining text in current chunk
        if current_chunk:
            chunks.append({
                "chunk_index": chunk_index,
                "text_content": " ".join(current_chunk),
                "page_number": page_num
            })
            chunk_index += 1

    # Fallback to document metadata if pages produced no text chunks
    if not chunks and metadata:
        title = metadata.get("title", "")
        abstract = metadata.get("abstract", "")
        authors = ", ".join(metadata.get("authors", [])) if isinstance(metadata.get("authors"), list) else ""
        if title or abstract:
            chunks.append({
                "chunk_index": 0,
                "text_content": f"Title: {title}\nAuthors: {authors}\nAbstract: {abstract}".strip(),
                "page_number": 1
            })

    return chunks
