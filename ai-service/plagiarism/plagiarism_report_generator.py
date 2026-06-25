from typing import List, Dict, Any
from .semantic_similarity import calculate_jaccard_similarity
from .embedding_similarity import calculate_embedding_similarity
from .citation_checker import audit_sentence_citations

def generate_plagiarism_report(
    project_id: str,
    paper_text: str,
    source_papers: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Scans a generated manuscript, checks similarities against all library sources,
    audits missing reference citations, and outputs a detailed similarity report.
    """
    total_jaccard = 0.0
    total_embedding = 0.0
    matches = []
    
    paragraphs = [p.strip() for p in paper_text.split("\n\n") if len(p.strip()) > 30]
    
    for para in paragraphs:
        for p in source_papers:
            p_title = p.get("title", "Source Paper")
            p_id = str(p.get("_id", "Unknown"))
            
            p_text = p.get("abstract", "")
            if not p_text and "chunks" in p:
                p_text = " ".join([c.get("textContent", "") for c in p.get("chunks", [])])

            # Check overlap
            jac = calculate_jaccard_similarity(para, p_text)
            emb = calculate_embedding_similarity(para, p_text)
            
            # If significant overlap, record match details
            if jac > 0.15 or emb > 0.65:
                matches.append({
                    "text": para[:150] + "...",
                    "sourcePaperId": p_id,
                    "sourceTitle": p_title,
                    "similarityPercentage": int(max(jac, emb) * 100)
                })
                total_jaccard = max(total_jaccard, jac)
                total_embedding = max(total_embedding, emb)

    # Compute composite metrics
    similarity_percentage = int(max(total_jaccard, total_embedding) * 100)
    
    # Audit citation issues
    citation_warnings = audit_sentence_citations(paper_text)
    
    # Calculate risk score (0-100) based on similarity and citation problems
    risk_score = min(100, similarity_percentage + len(citation_warnings) * 5)
    
    # Formulate suggestions
    suggestions = []
    if similarity_percentage > 20:
        suggestions.append("High similarity detected in some paragraphs. Consider paraphrasing these sections.")
    if citation_warnings:
        suggestions.append(f"Detected {len(citation_warnings)} statistics/claims lacking inline citations. Please add references.")

    return {
        "projectId": project_id,
        "similarityPercentage": similarity_percentage,
        "riskScore": risk_score,
        "matches": matches,
        "warnings": citation_warnings,
        "suggestions": suggestions
    }
