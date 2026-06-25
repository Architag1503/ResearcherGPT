from typing import Dict, Any
from .scoring_engine import score_paper
from .review_generator import generate_review_text

def run_reviewer_agent(paper_text: str, style: str = "IEEE") -> Dict[str, Any]:
    """
    Coordinates scoring and textual peer-review reports for academic drafts.
    """
    scores = score_paper(paper_text)
    review = generate_review_text(paper_text, style)
    
    return {
        "style": style,
        "scores": scores,
        "review": review
    }
