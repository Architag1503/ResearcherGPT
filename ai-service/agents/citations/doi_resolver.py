import re
from typing import List, Dict, Any
from .crossref_client import query_crossref

def extract_dois(text: str) -> List[str]:
    """
    Finds all DOIs in a text block using regex.
    """
    doi_pattern = r'\b(10\.\d{4,9}/[-._;()/:A-Z0-9]+)\b'
    matches = re.findall(doi_pattern, text, re.IGNORECASE)
    return list(set(matches))

def resolve_dois_in_text(text: str) -> List[Dict[str, Any]]:
    """
    Extracts all DOIs from text and fetches CrossRef metadata.
    """
    dois = extract_dois(text)
    resolved = []
    
    for doi in dois:
        meta = query_crossref(doi)
        if meta:
            resolved.append({
                "doi": doi,
                "title": meta.get("title", [""])[0],
                "authors": [f"{a.get('given', '')} {a.get('family', '')}".strip() for a in meta.get("author", [])],
                "journal": meta.get("container-title", [""])[0],
                "year": meta.get("created", {}).get("date-parts", [[2024]])[0][0],
                "volume": meta.get("volume"),
                "issue": meta.get("journal-issue", {}).get("issue"),
                "pages": meta.get("page"),
                "publisher": meta.get("publisher")
            })
    return resolved

G = resolve_dois_in_text # alias export
