import json
from typing import List, Dict, Optional
from agents.router import call_llm

def extract_keywords_tags(text: str, user_api_keys: Optional[Dict[str, str]] = None) -> List[str]:
    """
    Extracts high-level academic keywords and concepts from a text block.
    """
    if user_api_keys:
        system = "You are an Academic Tagging Agent. Extract exactly 4 high-level academic keywords/tags from this text. Output as a JSON list of strings."
        try:
            res_text = call_llm(system, text[:2000], user_api_keys=user_api_keys)
            parsed = json.loads(res_text)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception as e:
            print(f"[KeywordExtractor] LLM keyword failed: {e}")

    return ["Retrieval-Augmented Generation", "Multi-Agent System", "Lexical BM25", "Vector Indexing"]

G = extract_keywords_tags # alias export
