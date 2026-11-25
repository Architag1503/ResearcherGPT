import json
import re
from typing import List, Optional, Dict, Any
from agents.router import call_llm

def extract_future_work(text: str, user_api_keys: Optional[Dict[str, Any]] = None) -> List[str]:
    """
    Extracts future work directions, research extensions, and open problems.
    """
    future_directions = []

    if user_api_keys:
        system = "You are a Future Work Mining Agent. Extract all future works, open problems, and extensions from the text. Output as a JSON list of strings."
        try:
            res_text = call_llm(system, f"Future work snippet:\n{text[:4000]}", user_api_keys=user_api_keys)
            parsed = json.loads(res_text)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception as e:
            print(f"[FutureWorkExtractor] LLM extraction failed: {e}")

    # Fallback heuristic rules
    keywords = ["future work", "future direction", "remains open", "open question", "could extend", "suggest that future"]
    lines = text.split(".")
    for line in lines:
        if any(kw in line.lower() for kw in keywords):
            future_directions.append(line.strip())

    return list(set(future_directions))[:3]
