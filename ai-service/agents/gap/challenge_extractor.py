import json
from typing import List, Optional, Dict, Any
from agents.router import call_llm

def extract_challenges(text: str, user_api_keys: Optional[Dict[str, Any]] = None) -> List[str]:
    """
    Extracts explicitly stated open challenges, design flaws, and empirical difficulties.
    """
    challenges = []

    if user_api_keys:
        system = "You are a Challenge Miner. Identify all open challenges, bottlenecks, design flaws, or difficulties mentioned in the text. Output as a JSON list of strings."
        try:
            res_text = call_llm(system, f"Text block:\n{text[:4000]}", user_api_keys=user_api_keys)
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
