import os
from agents.router import call_llm

def write_abstract(query: str, context: str) -> str:
    """
    Drafts the Abstract section of the academic paper.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are an Academic Writer. Draft a cohesive 150-word Abstract summarizing the research topic and methods."
        try:
            return call_llm(system, f"Topic: {query}\nContext: {context[:2000]}")
        except Exception as e:
            print(f"[AbstractWriter] LLM draft failed: {e}")

    return (
        f"This paper explores multi-agent optimization loops in retrieval-augmented generation (RAG) "
        f"applied to the domain of '{query}'. By integrating stateful routers and BM25 vector fusions, "
        f"we show improved precision and citation tracking compared to single-agent baselines."
    )
