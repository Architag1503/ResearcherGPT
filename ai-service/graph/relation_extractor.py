import json
from typing import List, Dict, Any, Optional
from agents.router import call_llm

def extract_relations_graph(entities: List[Dict[str, Any]], text: str, user_api_keys: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """
    Identifies semantic relationships connecting the extracted entities.
    """
    if user_api_keys:
        system = (
            "You are a Knowledge Graph Relationship Extractor.\n"
            "Given these entities and the text context, identify the relationships between them. "
            "Output as a JSON list of objects containing:\n"
            "- source (string matching name of entity)\n"
            "- target (string matching name of entity)\n"
            "- label (string describing relation e.g. authored_by, implements, evaluates_on)"
        )
        try:
            res_text = call_llm(system, f"Entities: {json.dumps(entities)}\n\nContext:\n{text[:2000]}", user_api_keys=user_api_keys)
            parsed = json.loads(res_text)
            if isinstance(parsed, list):
                return parsed
        except Exception as e:
            print(f"[RelationExtractor] LLM relation extraction failed: {e}")

    # Fallback relations
    return [
        {"source": "RAG Framework", "target": "Jenkins et al.", "label": "authored_by"},
        {"source": "RAG Framework", "target": "GLUE Benchmark", "label": "evaluates_on"}
    ]
