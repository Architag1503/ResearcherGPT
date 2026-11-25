import re
import os
import json
import random
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

def _extract_user_key(user_api_keys: Optional[Dict[str, str]], *names: str) -> Optional[str]:
    if not user_api_keys or not isinstance(user_api_keys, dict):
        return None
    for name in names:
        val = user_api_keys.get(name)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def ocr_page_multimodal(
    b64_data: str,
    gemini_api_key: Optional[str] = None,
    user_api_keys: Optional[Dict[str, str]] = None,
) -> str:
    """
    Multimodal OCR extraction using ONLY user-uploaded API keys (Gemini Vision -> OpenAI Vision -> Anthropic Vision).
    Never falls back to personal .env server API keys.
    """
    import time
    gemini_key = (gemini_api_key.strip() if isinstance(gemini_api_key, str) and gemini_api_key.strip() else None) or _extract_user_key(
        user_api_keys, "gemini", "geminiApiKey", "GEMINI_API_KEY"
    )
    openai_key = _extract_user_key(user_api_keys, "openai", "openaiApiKey", "OPENAI_API_KEY")
    anthropic_key = _extract_user_key(user_api_keys, "anthropic", "anthropicApiKey", "ANTHROPIC_API_KEY")

    # 1. Try User's Gemini Flash Vision
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        preferred = os.getenv("GEMINI_MODEL")
        models_to_try = [preferred] if preferred else []
        for m in ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash"]:
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
                elif res.status_code == 429:
                    wait = 2 + random.uniform(0, 1.5)
                    print(f"[pdf_processor] User Gemini 429 rate limit on {gemini_model}. Pausing {wait:.1f}s before fallback...")
                    time.sleep(wait)
                else:
                    print(f"[pdf_processor] User Gemini model {gemini_model} returned {res.status_code}. Trying next fallback...")
            except Exception as e:
                print(f"[pdf_processor] User Gemini model {gemini_model} error: {e}. Trying next fallback...")

    # 2. Fallback to User's OpenAI Vision (gpt-4o-mini)
    if openai_key and "your_openai_api_key" not in openai_key:
        try:
            headers = {"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Transcribe all text from this academic paper page. Return only the plain transcribed text."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_data}"}}
                    ]
                }],
                "max_tokens": 2000
            }
            res = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=30)
            if res.status_code == 200:
                text = res.json()["choices"][0]["message"]["content"].strip()
                if text:
                    return text
        except Exception as e:
            print(f"[pdf_processor] User OpenAI Vision OCR fallback error: {e}")

    # 3. Fallback to User's Anthropic Vision
    if anthropic_key and "your_anthropic_api_key" not in anthropic_key:
        try:
            headers = {
                "x-api-key": anthropic_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "claude-3-5-haiku-latest",
                "max_tokens": 2000,
                "messages": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": "image/jpeg", "data": b64_data}
                        },
                        {"type": "text", "text": "Transcribe all text from this academic paper page. Return only the plain transcribed text."}
                    ]
                }]
            }
            res = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload, timeout=30)
            if res.status_code == 200:
                text = res.json()["content"][0]["text"].strip()
                if text:
                    return text
        except Exception as e:
            print(f"[pdf_processor] User Anthropic Vision OCR fallback error: {e}")

    return ""


def _parse_metadata_json(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return json.loads(cleaned.strip())


def extract_metadata_with_gemini(
    first_page_text: str,
    gemini_api_key: Optional[str] = None,
    user_api_keys: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Extracts Title, Authors, Abstract, Year, and DOI from the first page text using ONLY user-uploaded API keys
    (User Groq -> User Gemini -> User OpenAI -> User Anthropic). Never uses personal .env keys.
    """
    groq_key = _extract_user_key(user_api_keys, "groq", "groqApiKey", "GROQ_API_KEY")
    gemini_key = (gemini_api_key.strip() if isinstance(gemini_api_key, str) and gemini_api_key.strip() else None) or _extract_user_key(
        user_api_keys, "gemini", "geminiApiKey", "GEMINI_API_KEY"
    )
    openai_key = _extract_user_key(user_api_keys, "openai", "openaiApiKey", "OPENAI_API_KEY")
    anthropic_key = _extract_user_key(user_api_keys, "anthropic", "anthropicApiKey", "ANTHROPIC_API_KEY")

    if not any([groq_key, gemini_key, openai_key, anthropic_key]):
        return {}

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
    {first_page_text[:6000]}
    """

    # 1. Try User's Groq first (very fast and preserves Gemini quota)
    if groq_key and "your_groq_api_key" not in groq_key:
        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                },
                timeout=15,
            )
            if res.status_code == 200:
                return _parse_metadata_json(res.json()["choices"][0]["message"]["content"])
        except Exception as e:
            print(f"[pdf_processor] User Groq metadata extraction fallback: {e}")

    # 2. Try User's Gemini
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        preferred = os.getenv("GEMINI_MODEL")
        models_to_try = [preferred] if preferred else []
        for m in ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash"]:
            if m not in models_to_try:
                models_to_try.append(m)

        for gemini_model in models_to_try:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
                res = requests.post(
                    url,
                    headers={"Content-Type": "application/json"},
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                    timeout=12,
                )
                if res.status_code == 200:
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return _parse_metadata_json(text)
            except Exception as e:
                print(f"[pdf_processor] User Gemini metadata fallback on {gemini_model}: {e}")

    # 3. Try User's OpenAI
    if openai_key and "your_openai_api_key" not in openai_key:
        try:
            res = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                },
                timeout=15,
            )
            if res.status_code == 200:
                return _parse_metadata_json(res.json()["choices"][0]["message"]["content"])
        except Exception as e:
            print(f"[pdf_processor] User OpenAI metadata fallback: {e}")

    # 4. Try User's Anthropic
    if anthropic_key and "your_anthropic_api_key" not in anthropic_key:
        try:
            res = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "claude-3-5-haiku-latest",
                    "max_tokens": 1024,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=15,
            )
            if res.status_code == 200:
                return _parse_metadata_json(res.json()["content"][0]["text"])
        except Exception as e:
            print(f"[pdf_processor] User Anthropic metadata fallback: {e}")

    return {}

def extract_tables_with_pdfplumber(file_path: str, max_pages: int = 30) -> List[Dict[str, Any]]:
    """
    Extract structured tables per page using pdfplumber with non-empty row filtering.
    """
    extracted_tables: List[Dict[str, Any]] = []
    try:
        import pdfplumber
    except ImportError:
        return extracted_tables

    try:
        with pdfplumber.open(file_path) as pdf:
            for p_idx, page in enumerate(pdf.pages[:max_pages]):
                raw_tables = page.extract_tables() or []
                for t_idx, tbl in enumerate(raw_tables):
                    cleaned_rows = [
                        [("" if cell is None else str(cell).strip()) for cell in row]
                        for row in tbl
                        if row and any(cell is not None and str(cell).strip() for cell in row)
                    ]
                    if len(cleaned_rows) >= 2:
                        extracted_tables.append({
                            "page_number": p_idx + 1,
                            "table_index": t_idx,
                            "row_count": len(cleaned_rows),
                            "col_count": max((len(r) for r in cleaned_rows), default=0),
                            "rows": cleaned_rows,
                        })
    except Exception as e:
        print(f"[pdf_processor] pdfplumber table extraction failed: {e}")

    return extracted_tables


def extract_pdf_content(
    file_path: str,
    gemini_api_key: Optional[str] = None,
    user_api_keys: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
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

        # If scanned pages detected, run sequential multimodal OCR with jitter (up to 12 pages)
        # Sequential (not parallel) to avoid bursting the per-minute Gemini quota.
        if pages_to_ocr:
            import time
            target_ocr_pages = pages_to_ocr[:12]
            print(f"[pdf_processor] {len(target_ocr_pages)} scanned pages detected. Running sequential OCR with rate-limit jitter...")

            for p_idx, p_obj in target_ocr_pages:
                try:
                    pix = p_obj.get_pixmap(dpi=80)
                    jpg_bytes = pix.tobytes("jpeg", jpg_quality=70)
                    del pix
                    b64_img = base64.b64encode(jpg_bytes).decode("utf-8")
                    del jpg_bytes
                    ocr_res = ocr_page_multimodal(b64_img, gemini_api_key=gemini_api_key, user_api_keys=user_api_keys)
                    if ocr_res:
                        page_texts[p_idx]["text"] = clean_text(ocr_res)
                    # Small inter-page delay (1-2s jitter) to stay under per-minute quota
                    time.sleep(1.0 + random.uniform(0, 1.0))
                except Exception as e:
                    print(f"[pdf_processor] OCR failed on page {p_idx+1}: {e}")

        # 2. Extract metadata using user-uploaded LLM keys if available (runs on first page)
        first_page_text = page_texts[0]["text"] if page_texts else ""
        if first_page_text:
            gemini_meta = extract_metadata_with_gemini(
                first_page_text,
                gemini_api_key=gemini_api_key,
                user_api_keys=user_api_keys,
            )
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

        tables = extract_tables_with_pdfplumber(file_path)

        return {
            "metadata": metadata,
            "pages": page_texts,
            "tables": tables
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
