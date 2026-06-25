import os
import json
from typing import List
from agents.router import call_llm

SYNONYM_DICT = {
    "llm": ["large language models", "generative language models", "transformers"],
    "rag": ["retrieval augmented generation", "dense passage retrieval", "vector search"],
    "agentic": ["multi-agent systems", "autonomous agents", "agentic workflows"],
    "graph": ["knowledge graphs", "neo4j", "semantic network", "entity-relation map"],
    "citation": ["academic bibliography", "reference list", "crossref", "apa ieee"],
    "gap": ["research opportunities", "methodology limitations", "future research scope"]
}

def expand_query(query: str) -> List[str]:
    """
    Expands the user query to include related academic keywords and synonyms.
    Returns a list of query variations including the original query.
    """
    queries = [query]
    
    # 1. Try LLM-based query expansion
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are an Academic Query Expander. Generate exactly 2 distinct search queries that are academic variations, synonyms, or terminology expansions of the user's query. Output as a JSON list of strings."
        try:
            res_text = call_llm(system, f"Original Query: {query}")
            variations = json.loads(res_text)
            if isinstance(variations, list):
                for v in variations:
                    v_str = str(v).strip()
                    if v_str and v_str not in queries:
                        queries.append(v_str)
                return queries
        except Exception as e:
            print(f"[QueryExpander] LLM expansion failed: {e}")

    # 2. Local heuristic fallback expansion
    words = query.lower().split()
    for w in words:
        # Check dictionary matches
        clean_w = w.strip("?,.:;!")
        if clean_w in SYNONYM_DICT:
            for syn in SYNONYM_DICT[clean_w]:
                queries.append(f"{query} {syn}")
                
    return list(set(queries))[:3]
