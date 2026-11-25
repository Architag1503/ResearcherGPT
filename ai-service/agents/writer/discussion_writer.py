import json
from typing import List, Dict, Any, Optional
from agents.router import call_llm

def write_discussion(query: str, gaps: List[Dict[str, Any]], user_api_keys: Optional[Dict[str, Any]] = None) -> str:
    """
    Drafts the Discussion & Future Scope section.
    """
    if user_api_keys:
        system = "You are an Academic Writer. Draft a formal Discussion & Future Scope section focusing on open limitations."
        try:
            return call_llm(system, f"Topic: {query}\nGaps Mined: {json.dumps(gaps)}", user_api_keys=user_api_keys)
        except Exception as e:
            print(f"[DiscussionWriter] LLM draft failed: {e}")

    # Heuristic fallback discussion text
    gaps_str = " ".join([f"Specifically, we address the gap in '{g.get('title')}' ({g.get('description')})." for g in gaps])
    return (
        f"The findings suggest significant advantages. However, boundaries exist. "
        f"{gaps_str} Future work must focus on consolidating loop redundant tasks."
    )
