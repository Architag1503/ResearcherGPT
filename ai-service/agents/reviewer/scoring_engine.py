import os
import json
from typing import Dict, Any
from agents.router import call_llm

def score_paper(text: str) -> Dict[str, Any]:
    """
    Evaluates paper text and outputs scores (0-10) for Novelty, Methodology, Evaluation, and Presentation.
    """
    scores = {
        "novelty": 5.0,
        "methodology": 5.0,
        "evaluation": 5.0,
        "presentation": 5.0,
        "overall_score": 5.0
    }

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = (
            "You are a Peer Review Scoring Engine.\n"
            "Score the research paper text from 0 to 10 (float values) across:\n"
            "- novelty\n"
            "- methodology\n"
            "- evaluation\n"
            "- presentation\n"
            "- overall_score\n\n"
            "Output as a JSON object."
        )
        try:
            res_text = call_llm(system, f"Manuscript:\n{text[:3000]}")
            parsed = json.loads(res_text)
            if isinstance(parsed, dict):
                scores.update(parsed)
                return scores
        except Exception as e:
            print(f"[ScoringEngine] LLM scoring failed: {e}")

    return scores
