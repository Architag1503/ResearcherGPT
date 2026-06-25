from typing import List, Dict, Any
from rag.hybrid_retriever import retrieve_hybrid

def retrieve_evidence(project_id: str, claims: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """
    For each claim, queries the vector database to retrieve the top supporting evidence chunks.
    """
    evidence_map = {}
    for claim in claims:
        # Retrieve top 3 matching chunks
        results = retrieve_hybrid(project_id, claim, limit=3)
        evidence_map[claim] = results
    return evidence_map
