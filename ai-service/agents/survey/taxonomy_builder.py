import os
import json
from typing import List, Dict, Any
from agents.router import call_llm

def build_taxonomy(papers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Constructs a hierarchical taxonomy classification of the papers in the workspace library.
    """
    titles = [p.get("title", "Untitled") for p in papers]
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = (
            "You are an Academic Classification Agent.\n"
            "Build a hierarchical taxonomy tree categorizing these research papers. "
            "Output as a JSON object containing keys:\n"
            "- category_name (string)\n"
            "- subcategories (list of category objects)\n"
            "- papers (list of paper titles in this category)"
        )
        try:
            res_text = call_llm(system, f"Paper Titles: {json.dumps(titles)}")
            parsed = json.loads(res_text)
            if isinstance(parsed, dict):
                return parsed
        except Exception as e:
            print(f"[TaxonomyBuilder] LLM taxonomy failed: {e}")

    # Fallback taxonomy
    return {
        "category_name": "Agentic AI",
        "subcategories": [
            {
                "category_name": "Information Retrieval",
                "subcategories": [],
                "papers": titles[:1]
            },
            {
                "category_name": "Multi-Agent Systems",
                "subcategories": [],
                "papers": titles[1:]
            }
        ],
        "papers": []
    }
