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

def ocr_page_with_gemini(page: fitz.Page) -> str:
    """
    Renders a scanned page to PNG and transcribes it using Gemini Flash.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or "your_gemini_api_key" in gemini_key:
        print("[pdf_processor] GEMINI_API_KEY not set. Skipping OCR.")
        return ""

    try:
        # Render page to image bytes (150 DPI is standard for clear text OCR)
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        b64_data = base64.b64encode(img_bytes).decode("utf-8")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "inlineData": {
                                "mimeType": "image/png",
                                "data": b64_data
                            }
                        },
                        {
                            "text": "Transcribe the text in this image page exactly. Keep headings, layout structure, lists, tables, and equations intact."
                        }
                    ]
                }
            ]
        }

        res = requests.post(url, headers=headers, json=payload, timeout=60)
        if res.status_code == 200:
            res_data = res.json()
            return res_data["candidates"][0]["content"]["parts"][0]["text"]
        else:
            print(f"[pdf_processor] Gemini OCR API error: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"[pdf_processor] OCR failed for page {page.number + 1}: {str(e)}")
    return ""

def extract_metadata_with_gemini(first_page_text: str) -> Dict[str, Any]:
    """
    Leverages Gemini Flash to accurately extract Title, Authors, Abstract, Year, and DOI from the first page text.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or "your_gemini_api_key" in gemini_key:
        return {}

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
        headers = {"Content-Type": "application/json"}
        
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

        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        if res.status_code == 200:
            text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            # Clean up potential markdown formatting
            if text.startswith("```json"):
                text = text.replace("```json", "").replace("```", "").strip()
            elif text.startswith("```"):
                text = text.replace("```", "").strip()
            return json.loads(text)
    except Exception as e:
        print(f"[pdf_processor] Failed to parse metadata with Gemini: {str(e)}")
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

    # 1. Parse using PyMuPDF (fitz)
    doc = fitz.open(file_path)
    
    # Try to extract PDF built-in metadata
    doc_meta = doc.metadata or {}
    metadata["title"] = doc_meta.get("title", "")
    if doc_meta.get("author"):
        metadata["authors"] = [a.strip() for a in doc_meta.get("author", "").split(",") if a.strip()]

    # Document Type Detection (Digital vs Scanned)
    scanned_pages_count = 0
    total_pages = len(doc)

    for page_num in range(total_pages):
        page = doc[page_num]
        text = page.get_text().strip()
        
        # Heuristic: If page text is very short, classify as scanned page
        if len(text) < 100:
            scanned_pages_count += 1
            print(f"[pdf_processor] Page {page_num + 1} detected as Scanned (character count: {len(text)})")
            # Multimodal OCR fallback via Gemini
            ocr_text = ocr_page_with_gemini(page)
            if ocr_text:
                text = ocr_text
        
        cleaned = clean_text(text)
        page_texts.append({
            "page_number": page_num + 1,
            "text": cleaned
        })

    # Classify overall document type
    doc_type = "Digital"
    if scanned_pages_count == total_pages:
        doc_type = "Scanned"
    elif scanned_pages_count > 0:
        doc_type = "Mixed"
    metadata["extra_meta"]["document_type"] = doc_type

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

def chunk_text(pages: List[Dict[str, Any]], chunk_size: int = 1200, overlap: int = 200) -> List[Dict[str, Any]]:
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

    return chunks
