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
            "You are an Academic Editor. Design a publication-grade section outline (structural titles) "
            "for a research paper based on the query and context. Output as a JSON list of strings."
        )
        try:
            res_text = call_llm(system, f"Topic: {query}\nContext: {context[:2000]}")
            parsed = json.loads(res_text)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception as e:
            print(f"[OutlineGenerator] LLM outline failed: {e}")

    # Fallback standard outline structure
    return [
        "Abstract",
        "1. Introduction",
        "2. Literature Review",
        "3. Methodology & Design",
        "4. Experimental Evaluation & Results",
        "5. Discussion & Future Scope",
        "6. Conclusion",
        "References"
    ]
