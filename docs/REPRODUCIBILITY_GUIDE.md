# Reproducibility Guide

All benchmarks and regression tests run deterministically offline on Windows/Linux using Python 3.12 and Node.js without cloud LLM API keys or live external database containers.

## 1. Environment Prerequisites

- **Python 3.12** with dependencies in `ai-service/requirements.txt` (`numpy`, `scipy`, `scikit-learn`, `sentence-transformers`, `torch`, `pymupdf`, `pdfplumber`, `networkx`, `fastapi`, `qdrant-client`, `neo4j`).
- **Node.js (>= 18)** with `server/` and `client/` `npm install` dependencies.
- **Offline Neural Model Cache**: Local `all-MiniLM-L6-v2` cached in HuggingFace cache (used automatically when `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`).

## 2. Step-by-Step Verification & Benchmark Commands

### A. Build & Regression Unit Tests
```powershell
# Typecheck frontend & backend
cd server; npx tsc --noEmit
cd ../client; npx tsc --noEmit

# Build backend & run offline TS unit suite (PlagiarismEngine + Production Auth Guard)
cd ../server; npm run build; node dist/tests/phase1Regressions.unit.js

# Run Python regression unit tests (Hybrid Retrieval, Feature Hash, Claim Verifier, FormaTeX, pdfplumber)
cd ..
python ai-service/tests/test_phase1_regressions.py
```

### B. Reproducible Experimental Benchmarks (Phase 3)
```powershell
# 1. Retrieval Ablation & KG Channel Sweep (generates retrieval_manifest.json, retrieval_per_query.csv, retrieval_summary.json)
python evaluation/retrieval/run_retrieval_benchmark.py

# 2. Claim Grounding & Post-Draft Attribution (generates grounding_manifest.json, grounding_per_claim.csv, grounding_summary.json)
python evaluation/grounding/run_grounding_benchmark.py

# 3. Plagiarism & AI Integrity Suite (generates integrity_per_case.csv, integrity_summary.json)
node evaluation/integrity/run_integrity_benchmark.mjs

# 4. PDF Structural/Table Extraction & PaperValidator Audit (generates extraction_per_doc.csv, extraction_summary.json)
python evaluation/document_extraction/run_extraction_benchmark.py

# 5. Offline 13-Node LangGraph Orchestration Telemetry (generates orchestration_runs.csv, orchestration_summary.json)
python evaluation/agent_workflow/run_orchestration_benchmark.py
```

All statistical summaries compute 2,000-resample paired bootstrap 95% confidence intervals (`seed=42`) and two-sided paired Wilcoxon signed-rank + 5,000-iteration permutation $p$-values in `evaluation/stats/stats_utils.py`.
