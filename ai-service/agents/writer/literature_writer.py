import os
import json
from typing import List, Dict, Any
from agents.router import call_llm

def write_literature_review(query: str, reviews: List[Dict[str, Any]]) -> str:
    """
    Drafts the Literature Review section, summarizing previous publications.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are an Academic Writer. Draft a formal Literature Review section summarizing previous papers."
        try:
            return call_llm(system, f"Topic: {query}\nPrevious Papers: {json.dumps(reviews)}")
        except Exception as e:
            print(f"[LiteratureWriter] LLM draft failed: {e}")

    # Heuristic fallback review text
    ref_list = [f"{r.get('author', 'Author')} et al. ({r.get('year', '2024')}) utilized {r.get('method', 'ML')} on {r.get('dataset', 'benchmark')} benchmarks." for r in reviews]
    return "Previous publications have heavily analyzed this domain. " + " ".join(ref_list)
