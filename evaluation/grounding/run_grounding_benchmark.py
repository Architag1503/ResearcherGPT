import csv
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any, List

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ["GEMINI_API_KEY"] = "your_gemini_api_key"

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
AI_DIR = ROOT_DIR / "ai-service"
EVAL_DIR = ROOT_DIR / "evaluation"
for p in (str(AI_DIR), str(EVAL_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from stats.stats_utils import classification_metrics, bootstrap_ci
from agents.verification.claim_verifier import verify_claim, verify_section_claims


def build_grounding_dataset() -> List[Dict[str, Any]]:
    """
    90 labeled scholarly claim-evidence pairs across 4 categories:
      - 30 verbatim/direct supported claims
      - 30 paraphrased supported claims (synonym/syntactic variation preserving factual equivalence)
      - 15 numerically altered / refuted claims (same topic, contradicted number/year)
      - 15 out-of-corpus unsupported claims (hallucinated topic mismatch)
    """
    cases: List[Dict[str, Any]] = []

    base_pairs = [
        (
            "Reciprocal Rank Fusion combined with full-corpus BM25 achieved 84.2% Recall@5 over 75 scholarly queries.",
            "Combining full-corpus BM25 lexical matching with RRF yielded 84.2% Recall@5 across 75 evaluation queries.",
            "Reciprocal Rank Fusion achieved 98.7% Recall@5 across 400 scholarly queries.",
            "Quantum annealing reduced NP-hard protein folding energy by 44.1% on cryogenic qubits.",
        ),
        (
            "The transformer encoder uses 6 stacked self-attention layers with hidden dimension 512 and dropout 0.1.",
            "Our encoder architecture comprises 6 self-attention layers, a 512-unit hidden state, and 0.1 dropout regularization.",
            "The transformer encoder uses 24 stacked self-attention layers with hidden dimension 2048 and dropout 0.5.",
            "Bayesian MCMC sampling converged after 10000 Metropolis steps on paleoclimate ice-core isotopes.",
        ),
        (
            "PyMuPDF extracted clean digital text from 18 out of 20 multi-column manuscripts in under 1.2 seconds.",
            "FitZ digital parsing recovered text from 18 of 20 two-column manuscripts within 1.2 seconds.",
            "PyMuPDF extracted clean digital text from 3 out of 20 manuscripts taking 45.0 seconds.",
            "CRISPR-Cas9 off-target editing frequency dropped below 0.02% in murine hematopoietic stem cells.",
        ),
        (
            "All-MiniLM-L6-v2 maps input sentences into 384-dimensional L2-normalized embedding vectors.",
            "The local MiniLM-L6-v2 encoder projects sentences onto normalized 384-dimensional feature spaces.",
            "All-MiniLM-L6-v2 maps input sentences into 3072-dimensional unnormalized tensor arrays.",
            "Superconducting niobium resonators maintained quality factors exceeding two billion at 20 millikelvin.",
        ),
        (
            "MinHash uses 128 independent hash permutations over overlapping 5-word shingles to estimate Jaccard overlap.",
            "Overlapping 5-token shingles are sketched using 128 hash permutations to approximate Jaccard similarity.",
            "MinHash uses 16 permutations over 12-word shingles to estimate cosine divergence.",
            "Atmospheric aerosol optical depth increased by 18.4% following boreal wildfire smoke transport.",
        ),
        (
            "Winnowing guarantees detection of any shared substring of length at least w + k - 1 tokens within window w=4.",
            "Using window size w=4 and shingle k, Winnowing deterministically captures matching spans of length w + k - 1.",
            "Winnowing only captures substrings longer than 95 tokens when window size is w=64.",
            "Single-cell RNA sequencing revealed three distinct macrophage subpopulations in fibrotic kidney tissue.",
        ),
        (
            "Knowledge graph entity linking connected 25 method nodes to target publications for structural boosting at beta=1.3.",
            "Linking 25 method entities in the graph to corresponding papers enabled a beta=1.3 retrieval multiplier.",
            "Knowledge graph entity linking connected 900 method nodes with a boosting factor beta=4.8.",
            "Adaptive optics compensated wavefront distortion across 64 actuators on the infrared coronagraph.",
        ),
        (
            "Production authentication middleware rejects missing Bearer tokens with HTTP 401 when NODE_ENV is production.",
            "Under production NODE_ENV settings, requests lacking Bearer headers receive an HTTP 401 rejection.",
            "Production authentication middleware returns HTTP 503 with mock administrator privileges.",
            "Electrolysis overpotential decreased to 210 millivolts using cobalt phosphide nanosheet catalysts.",
        ),
        (
            "Unigram Shannon entropy and sentence-length coefficient of variation quantify lexical predictability and burstiness.",
            "Lexical predictability is measured via unigram Shannon entropy alongside sentence-length burstiness variation.",
            "Trigram perplexity across 70B parameters and KL-divergence quantify lexical burstiness.",
            "Autonomous underwater gliders mapped sub-ice shelf melt channels along Pine Island Glacier.",
        ),
        (
            "Structured table extraction via pdfplumber filters blank grid cells and requires at least 2 non-empty rows.",
            "Using pdfplumber, extracted tables retain non-empty grid cells and require a minimum of 2 populated rows.",
            "Structured table extraction via pdfplumber drops all headers and requires 150 rows minimum.",
            "High-entropy refractory alloys exhibited zero brittle fracture at 1400 Kelvin tensile loading.",
        ),
        (
            "Cross-encoder scoring evaluates query-document pairs jointly but requires network access when weights are uncached.",
            "Pairwise CrossEncoder inference needs local cached weights or network access to evaluate query-passage inputs.",
            "Cross-encoder scoring evaluates only document vectors independently without reading query tokens.",
            "Acoustic backscatter telemetry tracked juvenile salmon migration speeds near hydroelectric bypass dams.",
        ),
        (
            "Sparse TF-IDF similarity flags moderate semantic overlap above cosine threshold 0.70 and high overlap above 0.85.",
            "TF-IDF vector cosine flags moderate overlap starting at 0.70 and high similarity beyond 0.85.",
            "Sparse TF-IDF similarity flags moderate overlap at 0.15 and high overlap at 0.25.",
            "Photoemission spectroscopy measured band gap widening across strained monolayer tungsten disulfide.",
        ),
        (
            "Express API gateway exposes 16 Mongoose collections backed by MongoDB 6.0 and BullMQ Redis job queues.",
            "The Express gateway persists 16 MongoDB 6.0 collections while queuing asynchronous workers via BullMQ Redis.",
            "Express API gateway exposes 2 PostgreSQL tables without any Redis background worker queues.",
            "Deep eutectic solvents selective leached lithium and cobalt from spent cathode black mass.",
        ),
        (
            "Citation coverage auditing inspects bracketed numeric citations like [1] to confirm indexes fall within compiled bounds.",
            "Bracketed citation indices such as [1] are checked against the compiled reference count during QA auditing.",
            "Citation coverage auditing rewrites APA author-year references using random DOI suffixes.",
            "Subsurface ground-penetrating radar imaged Pleistocene river channels beneath arid alluvial fans.",
        ),
        (
            "Deterministic feature hashing over word unigrams and bigrams runs with zero PyTorch memory allocation.",
            "Feature hashing of unigram and bigram tokens operates deterministically without allocating PyTorch tensors.",
            "Deterministic feature hashing requires 16 gigabytes of GPU VRAM to initialize token embeddings.",
            "Laser-induced breakdown spectroscopy quantified trace rare earth elements in coal fly ash.",
        ),
    ]

    for idx, (evidence_txt, direct_src, refuted_claim, unsupported_claim) in enumerate(base_pairs):
        # 2 direct supported + 2 paraphrased variations per item = 30 direct + 30 paraphrase
        cases.append({
            "claim_id": f"c_dir_{idx:02d}_a",
            "category": "supported_direct",
            "expected_status": "verified",
            "expected_supported": 1,
            "claim": evidence_txt,
            "evidence": [{"paper_id": f"p_{idx}", "text_content": evidence_txt, "confidence_score": 0.92}],
        })
        cases.append({
            "claim_id": f"c_dir_{idx:02d}_b",
            "category": "supported_direct",
            "expected_status": "verified",
            "expected_supported": 1,
            "claim": direct_src,
            "evidence": [{"paper_id": f"p_{idx}", "text_content": direct_src, "confidence_score": 0.90}],
        })
        cases.append({
            "claim_id": f"c_par_{idx:02d}_a",
            "category": "supported_paraphrase",
            "expected_status": "verified",
            "expected_supported": 1,
            "claim": direct_src,
            "evidence": [{"paper_id": f"p_{idx}", "text_content": evidence_txt, "confidence_score": 0.85}],
        })
        # Second harder paraphrase
        cases.append({
            "claim_id": f"c_par_{idx:02d}_b",
            "category": "supported_paraphrase",
            "expected_status": "verified",
            "expected_supported": 1,
            "claim": evidence_txt,
            "evidence": [{"paper_id": f"p_{idx}", "text_content": direct_src, "confidence_score": 0.84}],
        })
        # Refuted numerical contradiction
        cases.append({
            "claim_id": f"c_ref_{idx:02d}",
            "category": "refuted_numeric",
            "expected_status": "refuted",
            "expected_supported": 0,
            "claim": refuted_claim,
            "evidence": [{"paper_id": f"p_{idx}", "text_content": evidence_txt, "confidence_score": 0.88}],
        })
        # Unsupported out-of-corpus claim
        cases.append({
            "claim_id": f"c_uns_{idx:02d}",
            "category": "unsupported_offtopic",
            "expected_status": "unverified",
            "expected_supported": 0,
            "claim": unsupported_claim,
            "evidence": [{"paper_id": f"p_{idx}", "text_content": evidence_txt, "confidence_score": 0.45}],
        })

    return cases


def legacy_buggy_verify(claim: str, evidence: List[Dict[str, Any]]) -> str:
    # Reproduces exact baseline bug in ai-service/agents/verification/claim_verifier.py lines 42-45
    return "verified" if evidence else "unverified"


def main():
    cases = build_grounding_dataset()
    manifest_dir = EVAL_DIR / "manifests"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    (manifest_dir / "grounding_manifest.json").write_text(json.dumps(cases, indent=2), encoding="utf-8")

    from sentence_transformers import SentenceTransformer
    encoder = SentenceTransformer("all-MiniLM-L6-v2")

    rows: List[Dict[str, Any]] = []
    systems = ["V0_LegacyFallback", "V1_LexicalNumeric", "V2_HybridMiniLMNumeric"]

    for sys_name in systems:
        for c in cases:
            t0 = time.perf_counter()
            if sys_name == "V0_LegacyFallback":
                pred_status = legacy_buggy_verify(c["claim"], c["evidence"])
                score = float(c["evidence"][0]["confidence_score"]) if c["evidence"] else 0.0
            elif sys_name == "V1_LexicalNumeric":
                out = verify_claim(c["claim"], c["evidence"], use_semantic=False, allow_llm=False)
                pred_status = out["status"]
                score = float(out["score"])
            else:
                out = verify_claim(c["claim"], c["evidence"], use_semantic=True, semantic_encoder=encoder, allow_llm=False)
                pred_status = out["status"]
                score = float(out["score"])

            latency_ms = (time.perf_counter() - t0) * 1000.0
            pred_supported = 1 if pred_status == "verified" else 0
            exact_3way = 1 if pred_status == c["expected_status"] else 0

            rows.append({
                "system": sys_name,
                "claim_id": c["claim_id"],
                "category": c["category"],
                "expected_status": c["expected_status"],
                "expected_supported": c["expected_supported"],
                "pred_status": pred_status,
                "pred_supported": pred_supported,
                "exact_3way_match": exact_3way,
                "score": round(score, 4),
                "latency_ms": round(latency_ms, 4),
            })

    # Also test post-draft verify_section_claims on a multi-section draft
    draft_sections = [
        {"heading": "1. Method", "content": f"{cases[0]['claim']} [1]. {cases[6]['claim']} [2]."},
        {"heading": "2. Results", "content": f"{cases[4]['claim']} [1]. {cases[5]['claim']} [99]."},
    ]
    draft_ctx = [cases[0]["evidence"][0], cases[6]["evidence"][0]]
    draft_cits = [{"title": "Ref 1"}, {"title": "Ref 2"}]
    qa_audit = verify_section_claims(draft_sections, draft_ctx, citations=draft_cits)

    results_dir = EVAL_DIR / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    csv_path = results_dir / "grounding_per_claim.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    summary_sys = {}
    for sys_name in systems:
        sub = [r for r in rows if r["system"] == sys_name]
        y_true = [r["expected_supported"] for r in sub]
        y_pred = [r["pred_supported"] for r in sub]
        cls = classification_metrics(y_true, y_pred)
        acc_3way = bootstrap_ci([r["exact_3way_match"] for r in sub])
        ref_sub = [r for r in sub if r["category"] == "refuted_numeric"]
        ref_det = sum(1 for r in ref_sub if r["pred_status"] == "refuted") / len(ref_sub)
        summary_sys[sys_name] = {
            "n_claims": len(sub),
            "binary_support_detection": cls,
            "three_way_accuracy": acc_3way,
            "numeric_refutation_recall": round(ref_det, 4),
            "latency_ms": bootstrap_ci([r["latency_ms"] for r in sub]),
        }

    summary = {
        "benchmark": "claim_grounding_v1",
        "total_claims": len(cases),
        "systems": summary_sys,
        "post_draft_section_audit_sample": {
            "total_claims": qa_audit["total_claims"],
            "verified_claims": qa_audit["verified_claims"],
            "refuted_claims": qa_audit["refuted_claims"],
            "unverified_claims": qa_audit["unverified_claims"],
            "valid_citation_refs": qa_audit["valid_citation_refs"],
            "invalid_citation_refs": qa_audit["invalid_citation_refs"],
            "citation_validity_rate": qa_audit["citation_validity_rate"],
        },
    }
    json_path = results_dir / "grounding_summary.json"
    json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {csv_path} and {json_path}")


if __name__ == "__main__":
    main()
