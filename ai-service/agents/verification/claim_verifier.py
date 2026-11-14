import os
import json
import re
from typing import Dict, Any, List, Optional


_STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "are", "was", "were",
    "have", "has", "been", "into", "their", "which", "these", "those", "using",
    "based", "also", "such", "than", "more", "most", "both", "each", "over",
}


def _extract_tokens(text: str) -> List[str]:
    return [
        t for t in re.findall(r"[a-z0-9]+(?:\.[0-9]+)?", (text or "").lower())
        if len(t) > 2 and t not in _STOPWORDS
    ]


def _extract_numbers(text: str) -> List[str]:
    return re.findall(r"\b\d+(?:\.\d+)?%?", text or "")


def score_claim_against_evidence(
    claim: str,
    evidence_text: str,
    semantic_sim: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Compute deterministic lexical, bigram, numeric, and optional semantic overlap between a claim and an evidence passage.
    """
    claim_tokens = _extract_tokens(claim)
    ev_list = _extract_tokens(evidence_text)
    ev_tokens = set(ev_list)
    if not claim_tokens or not ev_tokens:
        return {"score": 0.0, "token_recall": 0.0, "numeric_consistent": True}

    claim_set = set(claim_tokens)
    overlap = len(claim_set & ev_tokens)
    token_recall = overlap / max(len(claim_set), 1)

    claim_bi = {f"{claim_tokens[i]}_{claim_tokens[i+1]}" for i in range(len(claim_tokens) - 1)}
    ev_bi = {f"{ev_list[i]}_{ev_list[i+1]}" for i in range(len(ev_list) - 1)}
    bigram_recall = (len(claim_bi & ev_bi) / len(claim_bi)) if claim_bi else 0.0

    claim_nums = _extract_numbers(claim)
    ev_nums = set(_extract_numbers(evidence_text))
    if claim_nums:
        num_hits = sum(1 for n in claim_nums if n in ev_nums or n.rstrip("%") in ev_nums)
        numeric_ratio = num_hits / len(claim_nums)
        numeric_consistent = numeric_ratio >= 0.5
        lexical_score = 0.55 * token_recall + 0.15 * bigram_recall + 0.30 * numeric_ratio
    else:
        numeric_ratio = 1.0
        numeric_consistent = True
        lexical_score = 0.75 * token_recall + 0.25 * bigram_recall

    if semantic_sim is not None:
        sem_clamped = max(0.0, min(1.0, float(semantic_sim)))
        if claim_nums:
            combined = 0.35 * token_recall + 0.35 * sem_clamped + 0.30 * numeric_ratio
        else:
            combined = 0.50 * token_recall + 0.50 * sem_clamped
    else:
        combined = lexical_score

    return {
        "score": round(min(1.0, combined), 4),
        "token_recall": round(token_recall, 4),
        "numeric_consistent": numeric_consistent,
    }


def verify_claim(
    claim: str,
    evidence: List[Dict[str, Any]],
    use_semantic: bool = False,
    semantic_encoder: Any = None,
    allow_llm: bool = True,
) -> Dict[str, Any]:
    """
    Compares a scientific claim against retrieved source evidence,
    returning a validation status ('verified', 'refuted', 'unverified') and analysis.
    """
    evidence_text = "\n\n".join([
        f"Snippet {idx+1}: {e.get('text_content')}\n(Confidence: {e.get('confidence_score')})"
        for idx, e in enumerate(evidence)
    ])

    gemini_key = os.getenv("GEMINI_API_KEY")
    if allow_llm and gemini_key and "your_gemini_api_key" not in gemini_key:
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
            from agents.router import call_llm
            res_text = call_llm(system, f"Claim: {claim}\n\nEvidence Snippets:\n{evidence_text}")
            parsed = json.loads(res_text)
            if isinstance(parsed, dict):
                return parsed
        except Exception as e:
            print(f"[ClaimVerifier] LLM verification failed: {e}")

    if not evidence:
        return {
            "status": "unverified",
            "analysis": "Insufficient source context to verify this claim.",
            "score": 0.0,
        }

    sem_sims: List[Optional[float]] = [None] * len(evidence)
    if use_semantic and semantic_encoder is not None:
        try:
            import numpy as np
            texts = [claim] + [e.get("text_content", "") for e in evidence]
            embs = semantic_encoder.encode(texts, normalize_embeddings=True)
            c_vec = embs[0]
            sem_sims = [float(np.dot(c_vec, embs[i + 1])) for i in range(len(evidence))]
        except Exception as e:
            print(f"[ClaimVerifier] Semantic scoring failed: {e}")

    best_eval = {"score": 0.0, "token_recall": 0.0, "numeric_consistent": True}
    for idx, e in enumerate(evidence):
        ev_eval = score_claim_against_evidence(
            claim,
            e.get("text_content", ""),
            semantic_sim=sem_sims[idx],
        )
        if ev_eval["score"] > best_eval["score"]:
            best_eval = ev_eval

    score = best_eval["score"]
    claim_nums = _extract_numbers(claim)
    if score >= 0.45 and best_eval["numeric_consistent"]:
        status = "verified"
        analysis = "Claim terms and figures are corroborated by retrieved evidence snippets."
    elif claim_nums and not best_eval["numeric_consistent"] and best_eval["token_recall"] >= 0.40:
        status = "refuted"
        analysis = "Topic overlaps with evidence, but numerical values in the claim diverge from source passages."
    else:
        status = "unverified"
        analysis = "Retrieved passages do not sufficiently corroborate all assertions in the claim."

    return {
        "status": status,
        "analysis": analysis,
        "score": float(score),
    }


def split_claims(text: str) -> List[str]:
    clean = re.sub(r"```[\s\S]*?```", " ", text or "")
    clean = re.sub(r"\$\$[\s\S]*?\$\$", " ", clean)
    clean = re.sub(r"[#*_>`]+", " ", clean)
    candidates = re.split(r"(?<=[.!?])\s+", clean)
    return [c.strip() for c in candidates if len(c.strip()) >= 25]


def verify_section_claims(
    sections: List[Dict[str, Any]],
    context_chunks: List[Dict[str, Any]],
    citations: Optional[List[Dict[str, Any]]] = None,
    support_threshold: float = 0.40,
) -> Dict[str, Any]:
    """
    Post-draft claim-to-evidence attribution and citation index validation across generated sections.
    """
    claim_records: List[Dict[str, Any]] = []
    valid_refs = 0
    invalid_refs = 0
    max_cit = len(citations) if citations else 0
    total_words = 0
    empty_sections = 0

    for sec in sections or []:
        sec_title = sec.get("heading") or sec.get("title") or "Untitled Section"
        content = sec.get("content") or ""
        words = content.split()
        total_words += len(words)
        if not words:
            empty_sections += 1

        for ref_group in re.findall(r"\[(\d+(?:\s*,\s*\d+)*)\]", content):
            for num_str in ref_group.split(","):
                idx = int(num_str.strip())
                if 1900 <= idx <= 2100 and idx > max_cit:
                    continue
                if 1 <= idx <= max_cit:
                    valid_refs += 1
                else:
                    invalid_refs += 1

        for sent in split_claims(content):
            best_score = 0.0
            best_eval = {"score": 0.0, "token_recall": 0.0, "numeric_consistent": True}
            best_chunk = None
            for chunk in context_chunks or []:
                ev_text = chunk.get("text_content", "")
                ev_eval = score_claim_against_evidence(sent, ev_text)
                if ev_eval["score"] > best_score:
                    best_score = ev_eval["score"]
                    best_eval = ev_eval
                    best_chunk = chunk

            if best_score >= support_threshold and best_eval["numeric_consistent"]:
                status = "verified"
            elif _extract_numbers(sent) and not best_eval["numeric_consistent"] and best_eval["token_recall"] >= 0.35:
                status = "refuted"
            else:
                status = "unverified"

            claim_records.append({
                "section": sec_title,
                "claim": sent[:280],
                "status": status,
                "score": best_score,
                "paper_id": best_chunk.get("paper_id") if best_chunk else None,
                "page_number": best_chunk.get("page_number") if best_chunk else None,
            })

    total_claims = len(claim_records)
    verified_count = sum(1 for r in claim_records if r["status"] == "verified")
    refuted_count = sum(1 for r in claim_records if r["status"] == "refuted")
    unverified_count = total_claims - verified_count - refuted_count
    total_refs = valid_refs + invalid_refs

    return {
        "section_count": len(sections or []),
        "empty_sections": empty_sections,
        "total_words": total_words,
        "total_claims": total_claims,
        "verified_claims": verified_count,
        "refuted_claims": refuted_count,
        "unverified_claims": unverified_count,
        "support_rate": round(verified_count / total_claims, 4) if total_claims else 0.0,
        "valid_citation_refs": valid_refs,
        "invalid_citation_refs": invalid_refs,
        "citation_validity_rate": round(valid_refs / total_refs, 4) if total_refs else 1.0,
        "claim_audits": claim_records[:50],
    }
