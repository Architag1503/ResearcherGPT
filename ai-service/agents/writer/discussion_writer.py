import os
import json
from typing import List, Dict, Any
from agents.router import call_llm

def write_discussion(query: str, gaps: List[Dict[str, Any]]) -> str:
    """
    Drafts the Discussion & Future Scope section.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are an Academic Writer. Draft a formal Discussion & Future Scope section focusing on open limitations."
        try:
            return call_llm(system, f"Topic: {query}\nGaps Mined: {json.dumps(gaps)}")
        except Exception as e:
            print(f"[DiscussionWriter] LLM draft failed: {e}")

    # Heuristic fallback discussion text
    gaps_str = " ".join([f"Specifically, we address the gap in '{g.get('title')}' ({g.get('description')})." for g in gaps])
    return (
        f"The findings suggest significant advantages. However, boundaries exist. "
        f"{gaps_str} Future work must focus on consolidating loop redundant tasks."
    )
