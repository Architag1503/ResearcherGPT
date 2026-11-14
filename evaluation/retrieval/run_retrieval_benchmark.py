import csv
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any, List

os.environ.setdefault("QDRANT_HOST", "127.0.0.1")
os.environ.setdefault("QDRANT_PORT", "63999")
os.environ.setdefault("NEO4J_URI", "bolt://127.0.0.1:63998")
os.environ.setdefault("EXPRESS_API_URL", "http://127.0.0.1:59999")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ["GEMINI_API_KEY"] = "your_gemini_api_key"

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
AI_DIR = ROOT_DIR / "ai-service"
EVAL_DIR = ROOT_DIR / "evaluation"
for p in (str(AI_DIR), str(EVAL_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from datasets.retrieval_benchmark import save_manifest
from stats.stats_utils import (
    recall_at_k,
    hit_at_k,
    reciprocal_rank,
    ndcg_at_k,
    bootstrap_ci,
    paired_significance,
)
from services import qdrant_service
from services.graph_service import neo4j_client
from rag.hybrid_retriever import bm25_search, reciprocal_rank_fusion, retrieve_hybrid


def run_prefix_buggy_hybrid(project_id: str, query: str, dense_top: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
    """
    Reproduces exact pre-fix CR-1 logic from baseline hybrid_retriever.py:
      - BM25 runs ONLY over vector_res (top 2*limit) instead of full project corpus
      - Inconsistent DF substring check vs word.count TF
      - RRF with no corpus expansion
    """
    query_terms = [t.lower() for t in query.split() if len(t) > 1]
    if query_terms and dense_top:
        doc_count = len(dense_top)
        df = {t: sum(1 for c in dense_top if t in c["text_content"].lower()) for t in query_terms}
        avg_len = sum(len(c["text_content"].split()) for c in dense_top) / doc_count
        scored = []
        import math
        for c in dense_top:
            words = c["text_content"].lower().split()
            doc_len = len(words)
            s = 0.0
            for t in query_terms:
                if df.get(t, 0) == 0 or avg_len == 0:
                    continue
                tf = words.count(t)
                idf = math.log((doc_count - df[t] + 0.5) / (df[t] + 0.5) + 1.0)
                s += idf * (tf * 2.5) / (tf + 1.5 * (0.25 + 0.75 * (doc_len / avg_len)))
            cc = dict(c)
            cc["keyword_score"] = s
            scored.append((s, cc))
        scored.sort(key=lambda x: x[0], reverse=True)
        keyword_res = [x[1] for x in scored]
    else:
        keyword_res = dense_top

    fused = reciprocal_rank_fusion(dense_top, keyword_res, [], k=60, kg_boost=1.0)
    return fused[:limit]


def index_manifest_with_provider(manifest: Dict[str, Any], provider: str) -> float:
    os.environ["EMBEDDING_PROVIDER"] = provider
    qdrant_service.fallback_store.clear()
    neo4j_client.in_memory_graphs.clear()

    t0 = time.perf_counter()
    by_paper: Dict[str, List[Dict[str, Any]]] = {}
    for ch in manifest["chunks"]:
        by_paper.setdefault(ch["paper_id"], []).append(ch)
    for paper_id, p_chunks in by_paper.items():
        qdrant_service.index_chunks(manifest["project_id"], paper_id, p_chunks)

    kg = manifest["knowledge_graph"]
    neo4j_client.sync_graph(manifest["project_id"], kg["nodes"], kg["links"])
    return time.perf_counter() - t0


def evaluate_config(
    config_name: str,
    manifest: Dict[str, Any],
    mode: str,
    kg_boost: float = 1.0,
    kg_inject_weight: float = 0.0,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    project_id = manifest["project_id"]
    rows: List[Dict[str, Any]] = []

    for q in manifest["queries"]:
        rel_chunks = set(q["relevant_chunk_ids"])
        t0 = time.perf_counter()

        if mode == "dense_only":
            res = retrieve_hybrid(project_id, q["query"], limit=top_k, kg_boost=1.0, dense_weight=1.0, bm25_weight=0.0, kg_inject_weight=0.0)
        elif mode == "bm25_only":
            res = retrieve_hybrid(project_id, q["query"], limit=top_k, kg_boost=1.0, dense_weight=0.0, bm25_weight=1.0, kg_inject_weight=0.0)
        elif mode == "buggy_cr1":
            dense_top = retrieve_hybrid(project_id, q["query"], limit=top_k * 2, kg_boost=1.0, dense_weight=1.0, bm25_weight=0.0, kg_inject_weight=0.0)
            res = run_prefix_buggy_hybrid(project_id, q["query"], dense_top, limit=top_k)
        elif mode == "fixed_hybrid":
            res = retrieve_hybrid(
                project_id,
                q["query"],
                limit=top_k,
                kg_boost=kg_boost,
                dense_weight=1.0,
                bm25_weight=1.0,
                kg_inject_weight=kg_inject_weight,
            )
        else:
            raise ValueError(mode)

        latency_ms = (time.perf_counter() - t0) * 1000.0
        ranked_chunk_ids = [f"{r['paper_id']}_{r.get('chunk_index', 0)}" for r in res]

        rows.append({
            "config": config_name,
            "query_id": q["query_id"],
            "stratum": q["stratum"],
            "recall_at_5": recall_at_k(ranked_chunk_ids, rel_chunks, 5),
            "hit_at_1": hit_at_k(ranked_chunk_ids, rel_chunks, 1),
            "hit_at_5": hit_at_k(ranked_chunk_ids, rel_chunks, 5),
            "mrr": reciprocal_rank(ranked_chunk_ids, rel_chunks),
            "ndcg_at_5": ndcg_at_k(ranked_chunk_ids, rel_chunks, 5),
            "latency_ms": latency_ms,
        })
    return rows


def main():
    manifest_path = EVAL_DIR / "manifests" / "retrieval_manifest.json"
    save_manifest(manifest_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    all_rows: List[Dict[str, Any]] = []
    index_timings: Dict[str, float] = {}

    # 1. Hash fallback indexing & dense retrieval check
    index_timings["hash_index_s"] = round(index_manifest_with_provider(manifest, "hash"), 4)
    all_rows.extend(evaluate_config("M0_HashDenseOnly", manifest, "dense_only"))

    # 2. Real MiniLM-L6-v2 indexing & full evaluation suite
    index_timings["minilm_index_s"] = round(index_manifest_with_provider(manifest, "local"), 4)
    configs = [
        ("M1_MiniLMDenseOnly", "dense_only", 1.0, 0.0),
        ("M2_BM25FullCorpus", "bm25_only", 1.0, 0.0),
        ("M3_PreFixBuggyHybrid_CR1", "buggy_cr1", 1.0, 0.0),
        ("M4_FixedHybrid_NoKG_beta1.0", "fixed_hybrid", 1.0, 0.0),
        ("M5_FixedHybrid_KG_MultOnly_beta1.30", "fixed_hybrid", 1.30, 0.0),
        ("M6_FixedHybrid_KG_Channel_w0.50", "fixed_hybrid", 1.30, 0.50),
        ("M7_FixedHybrid_KG_Channel_w0.75", "fixed_hybrid", 1.30, 0.75),
        ("M8_FixedHybrid_KG_Channel_w1.00", "fixed_hybrid", 1.30, 1.00),
    ]
    for name, mode, beta, inj_w in configs:
        all_rows.extend(evaluate_config(name, manifest, mode, kg_boost=beta, kg_inject_weight=inj_w))

    results_dir = EVAL_DIR / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    csv_path = results_dir / "retrieval_per_query.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(all_rows[0].keys()))
        writer.writeheader()
        writer.writerows(all_rows)

    # Aggregate summary with bootstrap CIs & paired Wilcoxon vs M3_PreFixBuggyHybrid_CR1 and M1_MiniLMDenseOnly
    by_cfg: Dict[str, List[Dict[str, Any]]] = {}
    for r in all_rows:
        by_cfg.setdefault(r["config"], []).append(r)

    summary_configs: Dict[str, Any] = {}
    baseline_buggy = by_cfg["M3_PreFixBuggyHybrid_CR1"]
    baseline_dense = by_cfg["M1_MiniLMDenseOnly"]

    for cfg_name, cfg_rows in by_cfg.items():
        strata_metrics = {}
        for stratum in ("lexical_identifier", "semantic_paraphrase", "multihop_kg"):
            sub = [r for r in cfg_rows if r["stratum"] == stratum]
            strata_metrics[stratum] = {
                "recall_at_5": bootstrap_ci([r["recall_at_5"] for r in sub]),
                "mrr": bootstrap_ci([r["mrr"] for r in sub]),
            }

        summary_configs[cfg_name] = {
            "n_queries": len(cfg_rows),
            "recall_at_5": bootstrap_ci([r["recall_at_5"] for r in cfg_rows]),
            "hit_at_1": bootstrap_ci([r["hit_at_1"] for r in cfg_rows]),
            "mrr": bootstrap_ci([r["mrr"] for r in cfg_rows]),
            "ndcg_at_5": bootstrap_ci([r["ndcg_at_5"] for r in cfg_rows]),
            "latency_ms": bootstrap_ci([r["latency_ms"] for r in cfg_rows]),
            "by_stratum": strata_metrics,
            "sig_vs_buggy_cr1_recall5": paired_significance(
                [r["recall_at_5"] for r in cfg_rows],
                [r["recall_at_5"] for r in baseline_buggy],
            ),
            "sig_vs_dense_only_mrr": paired_significance(
                [r["mrr"] for r in cfg_rows],
                [r["mrr"] for r in baseline_dense],
            ),
        }

    summary = {
        "benchmark": "retrieval_ablation_v1",
        "num_papers": manifest["num_papers"],
        "num_chunks": manifest["num_chunks"],
        "num_queries": manifest["num_queries"],
        "embedding_model": "all-MiniLM-L6-v2 (384d)",
        "index_timings": index_timings,
        "configs": summary_configs,
    }
    json_path = results_dir / "retrieval_summary.json"
    json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {csv_path} and {json_path}")


if __name__ == "__main__":
    main()
