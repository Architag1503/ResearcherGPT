from typing import List, Dict, Any

def cluster_themes(papers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Identifies common thematic paradigms (e.g. scalability, reliability)
    and maps them to papers.
    """
    clusters = [
        {
            "theme": "Retrieval Precision & Hybrid Search",
            "description": "Considers RRF fusions of lexical and semantic vector systems.",
            "papers": []
        },
        {
            "theme": "Agentic Loop Redundancy & Coordination",
            "description": "Focuses on stateful router consolidation.",
            "papers": []
        }
    ]

    for p in papers:
        title = p.get("title", "Untitled")
        text = (p.get("title", "") + " " + p.get("abstract", "")).lower()
        
        if any(w in text for w in ["rag", "hybrid", "retrieve", "bm25", "qdrant"]):
            clusters[0]["papers"].append(title)
        if any(w in text for w in ["agent", "loop", "coordinat", "langgraph", "state"]):
            clusters[1]["papers"].append(title)

    # Return only active clusters
    return [c for c in clusters if c["papers"]]
