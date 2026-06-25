import os
import json
from typing import List
from agents.router import call_llm

def extract_challenges(text: str) -> List[str]:
    """
    Extracts explicitly stated open challenges, design flaws, and empirical difficulties.
    """
    challenges = []

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are a Challenge Miner. Identify all open challenges, bottlenecks, design flaws, or difficulties mentioned in the text. Output as a JSON list of strings."
        try:
            res_text = call_llm(system, f"Text block:\n{text[:4000]}")
            parsed = json.loads(res_text)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception as e:
            print(f"[ChallengeExtractor] LLM extraction failed: {e}")

    # Fallback heuristic rules
    keywords = ["challenge", "difficult", "hard to", "bottleneck", "obstacle", "major concern"]
    lines = text.split(".")
    for line in lines:
        if any(kw in line.lower() for kw in keywords):
            challenges.append(line.strip())
    return list(set(challenges))[:3]

G = extract_challenges # alias export
