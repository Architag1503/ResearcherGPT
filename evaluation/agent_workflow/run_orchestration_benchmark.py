import csv
import json
import os
import sys
import time
import tracemalloc
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("QDRANT_HOST", "127.0.0.1")
os.environ.setdefault("QDRANT_PORT", "63999")
os.environ.setdefault("NEO4J_URI", "bolt://127.0.0.1:63998")
os.environ.setdefault("EXPRESS_API_URL", "http://127.0.0.1:59999")
os.environ.setdefault("EMBEDDING_PROVIDER", "hash")
os.environ["GEMINI_API_KEY"] = "your_gemini_api_key"
os.environ.pop("GROQ_API_KEY", None)
os.environ.pop("SAMBANOVA_API_KEY", None)
os.environ.pop("OPENAI_API_KEY", None)

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
AI_DIR = ROOT_DIR / "ai-service"
EVAL_DIR = ROOT_DIR / "evaluation"
for p in (str(AI_DIR), str(EVAL_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from stats.stats_utils import bootstrap_ci
from agents import router as router_mod
from services import qdrant_service


def mock_call_model(role: str, system_prompt: str, user_prompt: str) -> str:
    if role == "planner":
        return json.dumps({
            "research_questions": ["RQ1: Does hybrid retrieval improve recall?"],
            "keywords": ["hybrid retrieval", "BM25", "knowledge graph"],
            "outline": ["Introduction", "Methodology", "Evaluation", "Conclusion"],
        })
    if role == "writer":
        return (
            "## 1. Introduction\n"
            "Hybrid scholarly synthesis combines dense vectors and lexical statistics [1].\n\n"
            "## 2. Methodology\n"
            "Reciprocal rank fusion merges candidate lists over indexed passages [1].\n"
        )
    if "json" in system_prompt.lower() or "list" in user_prompt.lower():
        return json.dumps([{"summary": "Verified offline analytical passage.", "paperTitle": "Study 1", "claim": "Hybrid retrieval combines dense vectors and lexical statistics.", "status": "verified", "confidenceScore": 0.9}])
    return "Structured analytical summary grounded in Study 1."


def main():
    qdrant_service.fallback_store.clear()
    qdrant_service.index_chunks("proj-orch", "paper-1", [
        {"chunk_index": 0, "page_number": 1, "text_content": "Hybrid scholarly synthesis combines dense vectors and lexical statistics across academic repositories."},
        {"chunk_index": 1, "page_number": 2, "text_content": "Reciprocal rank fusion merges candidate lists over indexed passages efficiently."},
    ])

    runs = []
    # Measure 5 repeated runs of the actual compiled LangGraph 13-node StateGraph
    with patch.object(router_mod, "call_model", side_effect=mock_call_model), \
         patch.object(router_mod, "report_progress", return_value=None), \
         patch.object(router_mod, "get_project_papers", return_value=[{"_id": "paper-1", "title": "Study 1", "authors": ["Author A"], "year": 2024, "abstract": "Hybrid scholarly synthesis combines dense vectors."}]), \
         patch.object(router_mod, "replace_diagrams_with_napkin", side_effect=lambda s: s), \
         patch.object(router_mod, "_enhance_sections_content", side_effect=lambda s: s):

        for run_idx in range(5):
            tracemalloc.start()
            t0 = time.perf_counter()
            init_state = {
                "run_id": f"eval_run_{run_idx}",
                "project_id": "proj-orch",
                "query": "Hybrid scholarly literature synthesis",
                "pages": 4,
                "paper_title": "Hybrid Synthesis Evaluation",
                "literature_reviews": [],
                "methodologies": [],
                "comparison_table": {},
                "trends": [],
                "research_gaps": [],
                "contradictions": [],
                "citations": [],
                "fact_checks": [],
                "research_context": [],
                "paper_sections": [],
                "critique": "",
                "final_output": {},
                "logs": [],
            }
            out = router_mod.agent_workflow.invoke(init_state)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            _, peak_bytes = tracemalloc.get_traced_memory()
            tracemalloc.stop()

            qa_summary = out.get("final_output", {}).get("qa_summary", {})
            runs.append({
                "run_idx": run_idx,
                "num_sections": len(out.get("paper_sections", [])),
                "num_logs": len(out.get("logs", [])),
                "qa_total_claims": qa_summary.get("total_claims", 0),
                "qa_support_rate": qa_summary.get("support_rate", 0.0),
                "qa_citation_validity": qa_summary.get("citation_validity_rate", 0.0),
                "elapsed_ms": round(elapsed_ms, 2),
                "peak_traced_mb": round(peak_bytes / (1024 * 1024), 4),
            })

    results_dir = EVAL_DIR / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    csv_path = results_dir / "orchestration_runs.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(runs[0].keys()))
        writer.writeheader()
        writer.writerows(runs)

    summary = {
        "benchmark": "langgraph_offline_orchestration_v1",
        "note": "Offline structural orchestration timing with deterministic mocked LLM callbacks (excludes remote API network latency).",
        "num_nodes_compiled": 13,
        "num_runs": len(runs),
        "completion_rate": 1.0,
        "elapsed_ms": bootstrap_ci([r["elapsed_ms"] for r in runs]),
        "peak_traced_mb": bootstrap_ci([r["peak_traced_mb"] for r in runs]),
        "qa_support_rate": bootstrap_ci([r["qa_support_rate"] for r in runs]),
        "qa_citation_validity": bootstrap_ci([r["qa_citation_validity"] for r in runs]),
    }
    json_path = results_dir / "orchestration_summary.json"
    json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {csv_path} and {json_path}")


if __name__ == "__main__":
    main()
