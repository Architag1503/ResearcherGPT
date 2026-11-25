import os
from typing import Dict, Any, Optional
from agents.reviewer.reviewer_agent import run_reviewer_agent

def execute_review_flow(paper_text: str, reviewer_style: str = "IEEE", user_api_keys: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Reviewer agent workflow: scores and evaluates manuscripts.
    """
    review_output = run_reviewer_agent(paper_text, reviewer_style, user_api_keys=user_api_keys)
    return {
        "review": review_output
    }
