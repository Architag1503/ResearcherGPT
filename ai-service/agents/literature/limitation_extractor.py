import os
import json
from typing import List
from agents.router import call_llm

def extract_limitations(text: str) -> List[str]:
    """
    Parses paper text blocks to extract limitations, boundaries, and validation assumptions.
    """
    limitations = []

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = (
            "You are an Academic Critique Agent. Read the text segment and extract all listed "
            "limitations, computational bottlenecks, model constraints, or threats to validity. "
            "Output as a JSON list of strings."
        )
        try:
            res_text = call_llm(system, f"Paper critique segment:\n{text[:4000]}")
            parsed = json.loads(res_text)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception as e:
            print(f"[LimitationExtractor] LLM extraction failed: {e}")

    # Fallback heuristic rules
    keywords = ["limit", "bottleneck", "assumption", "bound", "threat", "drawback", "constraint"]
    lines = text.split(".")
    for line in lines:
        if any(kw in line.lower() for kw in keywords):
            limitations.append(line.strip())

    return list(set(limitations))[:3]
