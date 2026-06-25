import os
from agents.router import call_llm

def paraphrase_text(text: str) -> str:
    """
    Paraphrases high-similarity sentences/paragraphs to decrease plagiarism scores.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = (
            "You are an Academic Editor.\n"
            "Paraphrase the provided text segment to lower similarity scores. "
            "Ensure the output is written in standard academic language, "
            "preserves all scientific meaning, and retains citations. Output ONLY the rewritten text."
        )
        try:
            paraphrased = call_llm(system, text)
            if paraphrased and len(paraphrased) > 5:
                return paraphrased.strip()
        except Exception as e:
            print(f"[Paraphraser] LLM paraphrasing failed: {e}")
    return text

G = paraphrase_text # alias export
