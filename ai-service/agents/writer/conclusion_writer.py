import os
from agents.router import call_llm

def write_conclusion(query: str, context: str) -> str:
    """
    Drafts the Conclusion section of the academic paper.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are an Academic Writer. Draft a concise 100-word Conclusion section summarizing key achievements."
        try:
            return call_llm(system, f"Topic: {query}\nContext: {context[:2000]}")
        except Exception as e:
            print(f"[ConclusionWriter] LLM draft failed: {e}")

    return (
        f"In conclusion, this paper presents a novel RAG pipeline addressing '{query}'. "
        f"By combining hybrid BM25 retrievers with LangGraph agent states, we validate "
        f"claims with evidence scores and structure sections dynamically. Our evaluation shows "
        f"accuracy gains, laying foundations for zero-plagiarism manuscript drafting."
    )
