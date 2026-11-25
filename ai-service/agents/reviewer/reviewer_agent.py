from typing import Dict, Any, Optional
from .scoring_engine import score_paper
from .review_generator import generate_review_text

def run_reviewer_agent(paper_text: str, style: str = "IEEE", user_api_keys: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Coordinates scoring and textual peer-review reports for academic drafts.
    """
    scores = score_paper(paper_text, user_api_keys=user_api_keys)
    review = generate_review_text(paper_text, style, user_api_keys=user_api_keys)
    
    return {
        "style": style,
        "scores": scores,
        "review": review
    }
