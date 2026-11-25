from typing import Dict, Optional
from agents.router import call_llm

def paraphrase_text(text: str, user_api_keys: Optional[Dict[str, str]] = None) -> str:
    """
    Paraphrases high-similarity sentences/paragraphs to decrease plagiarism scores.
    """
    if user_api_keys:
        system = (
            "You are an Academic Editor.\n"
            "Paraphrase the provided text segment to lower similarity scores. "
            "Ensure the output is written in standard academic language, "
            "preserves all scientific meaning, and retains citations. Output ONLY the rewritten text."
        )
        try:
            paraphrased = call_llm(system, text, user_api_keys=user_api_keys)
            if paraphrased and len(paraphrased) > 5:
                return paraphrased.strip()
        except Exception as e:
            print(f"[Paraphraser] LLM paraphrasing failed: {e}")
    return text

G = paraphrase_text # alias export
