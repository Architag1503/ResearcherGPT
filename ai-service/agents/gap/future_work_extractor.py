import os
import json
import re
from typing import List
from agents.router import call_llm

def extract_future_work(text: str) -> List[str]:
    """
    Extracts future work directions, research extensions, and open problems.
    """
    future_directions = []

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are a Future Work Mining Agent. Extract all future works, open problems, and extensions from the text. Output as a JSON list of strings."
        try:
            res_text = call_llm(system, f"Future work snippet:\n{text[:4000]}")
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
