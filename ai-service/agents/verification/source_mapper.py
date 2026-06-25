from typing import List, Dict, Any

def map_sources(
    project_id: str,
    claims: List[str],
    evidences: Dict[str, List[Dict[str, Any]]],
    verifications: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Combines extracted claims, fetched vectors, and verification states into
    Mongoose FactCheck database models.
    """
    mapped_checks = []

    for claim in claims:
        evidence_list = evidences.get(claim, [])
        verify_data = verifications.get(claim, {"status": "unverified", "analysis": "", "score": 0.0})

        mapped_sources = []
        for e in evidence_list:
            mapped_sources.append({
                "paperId": e.get("paper_id"),
                "paperTitle": e.get("paper_title") or f"Source Paper {e.get('paper_id')}",
                "pageNumber": e.get("page_number"),
                "snippet": e.get("text_content", ""),
                "confidenceScore": e.get("confidence_score", 1.0)
            })

        mapped_checks.append({
            "projectId": project_id,
            "claim": claim,
            "status": verify_data.get("status", "unverified"),
            "confidenceScore": verify_data.get("score", 0.0),
            "analysis": verify_data.get("analysis", ""),
            "sources": mapped_sources
        })

    return mapped_checks
