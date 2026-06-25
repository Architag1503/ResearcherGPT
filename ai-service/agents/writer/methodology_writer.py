import os
from agents.router import call_llm

def write_methodology(query: str, context: str) -> str:
    """
    Drafts the Methodology section of the academic paper.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are an Academic Writer. Draft a technical, parameter-rich Methodology section specifying models, math formulas, and dataset integrations."
        try:
            return call_llm(system, f"Topic: {query}\nContext: {context[:3000]}")
        except Exception as e:
            print(f"[MethodologyWriter] LLM draft failed: {e}")

    return (
        "Our system proposes a modular, state-guided multi-agent architecture. The retrieval layer "
        "implements BM25 exact term matches integrated with vector cosine distances. Formally:\n"
        "$$\\text{Score}_{RRF}(d) = \\frac{1}{60 + r_{vector}(d)} + \\frac{1}{60 + r_{bm25}(d)}$$\n"
        "Validation models are executed in a sequential pipeline using LangGraph."
    )
