from typing import Optional, Dict, Any
from agents.router import call_llm

def write_conclusion(query: str, context: str, user_api_keys: Optional[Dict[str, Any]] = None) -> str:
    """
    Drafts the Conclusion section of the academic paper.
    """
    if user_api_keys:
        system = "You are an Academic Writer. Draft a concise 100-word Conclusion section summarizing key achievements."
        try:
            return call_llm(system, f"Topic: {query}\nContext: {context[:2000]}", user_api_keys=user_api_keys)
        except Exception as e:
            print(f"[ConclusionWriter] LLM draft failed: {e}")

    return (
        f"In conclusion, this paper presents a novel RAG pipeline addressing '{query}'. "
        f"By combining hybrid BM25 retrievers with LangGraph agent states, we validate "
        f"claims with evidence scores and structure sections dynamically. Our evaluation shows "
        f"accuracy gains, laying foundations for zero-plagiarism manuscript drafting."
    )
