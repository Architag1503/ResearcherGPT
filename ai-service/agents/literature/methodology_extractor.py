import os
import json
from typing import Dict, Any
from agents.router import call_llm

def extract_methodology(text: str) -> Dict[str, Any]:
    """
    Extracts experimental methodologies, models, evaluation frameworks, and parameter scopes.
    """
    method_data = {
        "models": [],
        "datasets": [],
        "metrics": [],
        "parameters": {}
    }

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = (
            "You are an Academic Methodology Extractor.\n"
            "Analyze the methodology description and output a JSON object containing:\n"
            "- models (list of strings representing models/algorithms used)\n"
            "- datasets (list of validation datasets used)\n"
            "- metrics (list of evaluation metrics e.g. BLEU, Accuracy, F1)\n"
            "- parameters (dictionary of key-value parameters e.g. learning rate, batch size)"
        )
        try:
            res_text = call_llm(system, f"Methodology text block:\n{text[:4000]}")
            parsed = json.loads(res_text)
            if isinstance(parsed, dict):
                return {
                    "models": parsed.get("models", []),
                    "datasets": parsed.get("datasets", []),
                    "metrics": parsed.get("metrics", []),
                    "parameters": parsed.get("parameters", {})
                }
        except Exception as e:
            print(f"[MethodologyExtractor] LLM extraction failed: {e}")

    # Heuristic fallback rules
    if "transformer" in text.lower():
        method_data["models"].append("Transformer")
    if "accuracy" in text.lower() or "acc" in text.lower():
        method_data["metrics"].append("Accuracy")

    return method_data
