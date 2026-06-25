from typing import List, Dict, Any
from .extract_paper_metadata import extract_metadata
from .methodology_extractor import extract_methodology
from .limitation_extractor import extract_limitations

def synthesize_literature(papers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Orchestrates the synthesis of all uploaded papers, extracting metadata,
    methodologies, and limitations to construct a structured database representation.
    """
    synthesized_items = []

    for p in papers:
        title = p.get("title", "Untitled Paper")
        text = p.get("abstract", "")
        if not text and "chunks" in p:
            # aggregate text from chunks
            text = " ".join([c.get("textContent", "") for c in p.get("chunks", [])[:5]])

        # 1. Extract Metadata
        meta = extract_metadata(title, text)
        
        # 2. Extract Methodology
        methods = extract_methodology(text)
        
        # 3. Extract Limitations
        limits = extract_limitations(text)

        synthesized_items.append({
            "paper_id": str(p.get("_id", "Unknown")),
            "title": meta.get("title") or title,
            "authors": meta.get("authors") or p.get("authors", []),
            "year": meta.get("year") or p.get("year", 2024),
            "venue": meta.get("venue", ""),
            "models": methods.get("models", []),
            "datasets": methods.get("datasets", []),
            "metrics": methods.get("metrics", []),
            "parameters": methods.get("parameters", {}),
            "limitations": limits
        })

    return synthesized_items

G = synthesize_literature # alias export
