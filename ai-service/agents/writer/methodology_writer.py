from typing import Optional, Dict, Any
from agents.router import call_llm

def write_methodology(query: str, context: str, user_api_keys: Optional[Dict[str, Any]] = None) -> str:
    """
    Drafts the Methodology section of the academic paper.
    """
    if user_api_keys:
        system = "You are an Academic Writer. Draft a technical, parameter-rich Methodology section specifying models, math formulas, and dataset integrations."
        try:
            return call_llm(system, f"Topic: {query}\nContext: {context[:3000]}", user_api_keys=user_api_keys)
        except Exception as e:
            print(f"[MethodologyWriter] LLM draft failed: {e}")

    return (
        "Our system proposes a modular, state-guided multi-agent architecture. The retrieval layer "
        "implements BM25 exact term matches integrated with vector cosine distances. Formally:\n"
        "$$\\text{Score}_{RRF}(d) = \\frac{1}{60 + r_{vector}(d)} + \\frac{1}{60 + r_{bm25}(d)}$$\n"
        "Validation models are executed in a sequential pipeline using LangGraph."
    )
