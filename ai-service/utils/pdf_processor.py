import re
import fitz  # PyMuPDF
import pdfplumber
from typing import Dict, Any, List

def clean_text(text: str) -> str:
    # Remove excessive newlines and whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove ligatures and strange symbols
    text = text.replace('ﬁ', 'fi').replace('ﬂ', 'fl')
    return text.strip()

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

    full_text = []
    page_texts = []

    # 1. Parse using PyMuPDF (fitz) for fast text extraction
    doc = fitz.open(file_path)
    
    # Try to extract PDF built-in metadata
    doc_meta = doc.metadata or {}
    metadata["title"] = doc_meta.get("title", "")
    if doc_meta.get("author"):
        metadata["authors"] = [a.strip() for a in doc_meta.get("author", "").split(",") if a.strip()]

    # Iterate pages
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        cleaned = clean_text(text)
        page_texts.append({
            "page_number": page_num + 1,
            "text": cleaned
        })
        full_text.append(cleaned)

    # 2. Use pdfplumber for table extraction (if any)
    tables = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                extracted_tables = page.extract_tables()
                for table in extracted_tables:
                    # Clean and format table
                    formatted_table = []
                    for row in table:
                        formatted_table.append([cell or "" for cell in row])
                    tables.append({
                        "page_number": page_idx + 1,
                        "data": formatted_table
                    })
    except Exception as e:
        print(f"pdfplumber table extraction warning: {str(e)}")

    # 3. Simple heuristic rules to extract title, year, abstract, DOI from the first page text
    first_page_text = page_texts[0]["text"] if page_texts else ""
    
    # Extract DOI
    doi_match = re.search(r'(10\.\d{4,9}/[-._;()/:A-Z0-9]+)', first_page_text, re.IGNORECASE)
    if doi_match:
        metadata["doi"] = doi_match.group(1)

    # Extract Year
    year_match = re.search(r'\b(19\d{2}|20\d{2})\b', first_page_text)
    if year_match:
        metadata["year"] = int(year_match.group(1))

    # Extract Abstract
    abstract_match = re.search(r'(?:abstract|summary)[:\-\s]+(.*)', first_page_text, re.IGNORECASE)
    if abstract_match:
        abstract_candidate = abstract_match.group(1)
        # Cap abstract size
        metadata["abstract"] = abstract_candidate[:800] + "..." if len(abstract_candidate) > 800 else abstract_candidate

    # Fallback title extraction if empty: use first line of PDF
    if not metadata["title"] and first_page_text:
        lines = [line.strip() for line in first_page_text.split(".") if len(line.strip()) > 10]
        if lines:
            metadata["title"] = lines[0][:150]

    return {
        "metadata": metadata,
        "pages": page_texts,
        "tables": tables
    }

def chunk_text(pages: List[Dict[str, Any]], chunk_size: int = 1000, overlap: int = 150) -> List[Dict[str, Any]]:
    chunks = []
    chunk_index = 0

    for page in pages:
        text = page["text"]
        page_num = page["page_number"]
        
        # Simple character-based sliding window chunking
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk_content = text[start:end]
            
            chunks.append({
                "chunk_index": chunk_index,
                "text_content": chunk_content,
                "page_number": page_num
            })
            
            chunk_index += 1
            start += chunk_size - overlap

    return chunks
