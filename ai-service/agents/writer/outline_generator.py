import os
import json
from typing import List
from agents.router import call_llm

def generate_outline(query: str, context: str) -> List[str]:
    """
    Generates a list of outline section titles tailored to the research topic.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = (
            "You are an Academic Editor preparing an IEEE Transactions style paper. "
            "Design a publication-grade section outline with uppercase Roman numerals for body sections "
            "(e.g. 'I. INTRODUCTION', 'II. RELATED WORK', etc.), with unnumbered 'Abstract', 'Keywords', "
            "and 'REFERENCES'. Output as a JSON list of strings."
        )
        try:
            res_text = call_llm(system, f"Topic: {query}\nContext: {context[:2000]}")
            parsed = json.loads(res_text)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception as e:
            print(f"[OutlineGenerator] LLM outline failed: {e}")

    # Fallback standard IEEE outline structure
    return [
        "Abstract",
        "Keywords",
        "I. INTRODUCTION",
        "II. RELATED WORK & BACKGROUND",
        "III. PROPOSED FRAMEWORK & ARCHITECTURE",
        "IV. METHODOLOGY",
        "V. EXPERIMENTAL EVALUATION & RESULTS",
        "VI. DISCUSSION & LIMITATIONS",
        "VII. CONCLUSION & FUTURE WORK",
        "REFERENCES"
    ]
