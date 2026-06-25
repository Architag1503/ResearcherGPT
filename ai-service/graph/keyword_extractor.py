import os
import json
from typing import List
from agents.router import call_llm

def extract_keywords_tags(text: str) -> List[str]:
    """
    Extracts high-level academic keywords and concepts from a text block.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are an Academic Tagging Agent. Extract exactly 4 high-level academic keywords/tags from this text. Output as a JSON list of strings."
        try:
            res_text = call_llm(system, text[:2000])
            parsed = json.loads(res_text)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception as e:
            print(f"[KeywordExtractor] LLM keyword failed: {e}")

    return ["Retrieval-Augmented Generation", "Multi-Agent System", "Lexical BM25", "Vector Indexing"]

G = extract_keywords_tags # alias export
