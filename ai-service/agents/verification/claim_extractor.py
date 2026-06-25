import os
import json
from typing import List
from agents.router import call_llm

def extract_claims(paragraph: str) -> List[str]:
    """
    Parses a generated paragraph and extracts specific, testable scientific claims.
    """
    claims = []

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = (
            "You are a Claim Extraction Agent.\n"
            "Extract all testable scientific claims, evaluations, parameters, or accuracy statements "
            "from the paragraph. Output as a JSON list of strings."
        )
        try:
            res_text = call_llm(system, f"Paragraph:\n{paragraph}")
            parsed = json.loads(res_text)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception as e:
            print(f"[ClaimExtractor] LLM extraction failed: {e}")

    # Heuristic fallback: split sentences that have numbers or key comparative words
    sentences = paragraph.split(".")
    for s in sentences:
        s_clean = s.strip()
        if any(w in s_clean.lower() for w in ["achieve", "outperform", "%", "show", "reduce", "increase"]):
            claims.append(s_clean)
            
    return list(set(claims))[:3]
