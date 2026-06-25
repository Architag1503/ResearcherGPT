import os
from agents.router import call_llm

def write_introduction(query: str, context: str) -> str:
    """
    Drafts the Introduction section of the academic paper.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are an Academic Writer. Draft a formal, publication-grade Introduction section introducing the topic, background, and contribution."
        try:
            return call_llm(system, f"Topic: {query}\nContext: {context[:3000]}")
        except Exception as e:
            print(f"[IntroductionWriter] LLM draft failed: {e}")

    return (
        f"Retrieval-Augmented Generation (RAG) is crucial in grounding LLMs. However, circular agentic loops "
        f"and query ambiguities remain significant challenges. This paper investigates '{query}' by introducing "
        f"a state-guided multi-agent workflow that validates claims and minimizes plagiarism."
    )
