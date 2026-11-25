from typing import Optional, Dict, Any
from agents.router import call_llm

def write_introduction(query: str, context: str, user_api_keys: Optional[Dict[str, Any]] = None) -> str:
    """
    Drafts the Introduction section of the academic paper.
    """
    if user_api_keys:
        system = "You are an Academic Writer. Draft a formal, publication-grade Introduction section introducing the topic, background, and contribution."
        try:
            return call_llm(system, f"Topic: {query}\nContext: {context[:3000]}", user_api_keys=user_api_keys)
        except Exception as e:
            print(f"[IntroductionWriter] LLM draft failed: {e}")

    return (
        f"Retrieval-Augmented Generation (RAG) is crucial in grounding LLMs. However, circular agentic loops "
        f"and query ambiguities remain significant challenges. This paper investigates '{query}' by introducing "
        f"a state-guided multi-agent workflow that validates claims and minimizes plagiarism."
    )
