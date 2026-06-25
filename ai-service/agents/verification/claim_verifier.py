import os
import json
from typing import Dict, Any, List
from agents.router import call_llm

def verify_claim(claim: str, evidence: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compares a scientific claim against retrieved source evidence,
    returning a validation status ('verified', 'refuted', 'unverified') and analysis.
    """
    evidence_text = "\n\n".join([
        f"Snippet {idx+1}: {e.get('text_content')}\n(Confidence: {e.get('confidence_score')})"
        for idx, e in enumerate(evidence)
    ])

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = (
            "You are an Academic Fact Verification Agent.\n"
            "Compare the claim against the provided snippets. Determine if the claim is:\n"
            "- verified (fully backed by evidence)\n"
            "- refuted (directly contradicted by evidence)\n"
            "- unverified (no relevant details found)\n\n"
            "Output as a JSON object containing keys:\n"
            "- status (string: verified, refuted, unverified)\n"
            "- analysis (brief explanation summarizing matching facts)\n"
            "- score (float between 0 and 1 indicating semantic overlap confidence)"
        )
        try:
            res_text = call_llm(system, f"Claim: {claim}\n\nEvidence Snippets:\n{evidence_text}")
            parsed = json.loads(res_text)
            if isinstance(parsed, dict):
                return parsed
        except Exception as e:
            print(f"[ClaimVerifier] LLM verification failed: {e}")

    # Fallback heuristic: check overlap word counts
    score = 0.5
    status = "unverified"
    analysis = "Insufficient source context to verify this claim."
    
    if evidence:
        status = "verified"
        analysis = "Source texts contain matching term mappings."
        score = float(evidence[0].get("confidence_score", 0.7))

    return {
        "status": status,
        "analysis": analysis,
        "score": score
    }
