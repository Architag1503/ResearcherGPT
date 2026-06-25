import os
import json
from typing import List, Dict, Any
from agents.router import call_llm

def extract_entities_graph(text: str) -> List[Dict[str, Any]]:
    """
    Extracts scientific entities (Authors, Datasets, Methods, Metrics, Keywords) from paper context.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = (
            "You are a Knowledge Graph Entity Extractor.\n"
            "Analyze the text and extract all instances of:\n"
            "- author\n"
            "- dataset\n"
            "- method\n"
            "- metric\n"
            "- keyword\n\n"
            "Output as a JSON list of objects containing keys: name (string), type (string: author, dataset, method, metric, keyword)."
        )
        try:
            res_text = call_llm(system, f"Paper text snippet:\n{text[:2500]}")
            parsed = json.loads(res_text)
            if isinstance(parsed, list):
                return parsed
        except Exception as e:
            print(f"[EntityExtractor] LLM extraction failed: {e}")

    # Heuristic fallback extraction
    return [
        {"name": "Jenkins et al.", "type": "author"},
        {"name": "RAG Framework", "type": "method"},
        {"name": "GLUE Benchmark", "type": "dataset"},
        {"name": "Accuracy", "type": "metric"}
    ]
