# Experimental Methodology

**Branch:** `research-validation`  
**Statistical Helpers:** [`stats_utils.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/stats/stats_utils.py)  
**Hardware / Software Environment:** Windows workstation (local Python 3.12+ with `sentence-transformers` / `all-MiniLM-L6-v2`, `PyMuPDF`, `pdfplumber`, `NetworkX`, `SciPy`, `NumPy`; Node.js v20+ TypeScript runtime).

---

## 1. Offline Reproducibility Controls

To prevent network variability, rate limiting, and non-deterministic external LLM responses from biasing systems comparisons:
- **Vector Store Isolation:** Qdrant falls back deterministically to the identical cosine-similarity in-memory vector store when unreachable (`[WinError 10013]` in sandbox).
- **Knowledge Graph Isolation:** Neo4j falls back to `Neo4jClient.in_memory_graphs` keyed by `project_id`, executing the same case-insensitive entity/title/summary query logic as Cypher `query_papers_by_terms`.
- **External API Isolation:** Claim verification runs under `allow_llm=False` (`score_claim_against_evidence`), plagiarism detection runs under `{ skipExternalLookup: true }`, and orchestration latency measures graph routing + post-draft verification overhead under deterministic mocked LLM nodes.
- **Fixed Seeds:** Bootstrap resampling, permutation shuffling, and dataset generators fix `random.seed(42)` / `np.random.default_rng(42)`.

---

## 2. Evaluation Metrics

### 2.1 Retrieval Metrics (at cutoff $K = 5$)
Let $G_q$ be the relevant document set for query $q$ and $R_q = (d_1, \dots, d_5)$ be the top-5 unique ranked document IDs returned after chunk deduplication:
- **Recall@5:** $\frac{|R_q \cap G_q|}{|G_q|}$ (fractional document recall within top 5 results).
- **Hit@1:** $\mathbb{I}[d_1 \in G_q]$.
- **MRR:** $\max_{k \le 5, d_k \in G_q} \frac{1}{k}$ (or $0$ if none in top 5).
- **nDCG@5:** $\frac{\sum_{k=1}^{5} \frac{\mathbb{I}[d_k \in G_q]}{\log_2(k+1)}}{\sum_{k=1}^{\min(5, |G_q|)} \frac{1}{\log_2(k+1)}}$.
- **Latency (ms):** End-to-end per-query retrieval wall-clock latency measured via `time.perf_counter()`.

### 2.2 Classification & Extraction Metrics
- **Claim Grounding:** Binary support classification (`SUPPORTED` vs. `NON-SUPPORTED`: Precision, Recall, F1, Accuracy, False Positive Rate on refuted/unverified pairs), strict `3-way Accuracy` (`SUPPORTED` / `REFUTED` / `UNVERIFIED`), and Citation Reference Recall (`ref_recall`).
- **Plagiarism & AI Detection:** Binary Precision, Recall, F1, Accuracy, FPR at cutoff $\ge 0.25$ / `overallScore >= 15` (and per-stratum detection rates); AI detection evaluated both at default `50%` threshold and by mean `aiProbability` distribution separation (`35.0%` vs `0.0%`).
- **PDF Extraction:** Planted token recall, exact DOI regex match rate, table recall (`>= 1` table extracted on single-table PDFs), exact 2D cell-row match rate, and `PaperValidator.sanitize_paper_structure` normalization/deduplication invariants.

---

## 3. Statistical Inference Protocol

Implemented in [`stats_utils.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/stats/stats_utils.py):
1. **Non-Parametric Bootstrap Confidence Intervals:** Every mean metric reports two-sided **95% percentile bootstrap confidence intervals** using $B = 2,000$ resamples with replacement (`bootstrap_ci(values, n_boot=2000, seed=42)`).
2. **Paired Significance Testing:** Because all retrieval configurations (`M0`–`M8`) run on the exact same `75` queries, paired comparisons report both:
   - Two-sided **Wilcoxon signed-rank test** $p$-value (computed via `scipy.stats.wilcoxon` when non-zero differences exist).
   - Two-sided **exact/Monte-Carlo paired permutation test** ($5,000$ sign-flip resamples, `perm_p`) to remain valid in the presence of ties and binary/discrete bounded per-query scores.
3. **Pre- vs. Post-Fix Integrity Comparison:** Evaluated on the exact same `60` pairs (`paired_overall`), reporting both aggregate F1/Recall deltas and stratum-by-stratum detection rates (`localized_patchwrite`, `structure_formula_code`, `semantic_paraphrase`, `clean_negative_control`).

---

## 4. Retrieval Ablation Configuration Matrix (`M0`–`M8`)

| Config ID | Retrieval Mode | Vector Encoder | BM25 Corpus | KG Multiplier ($\beta$) | KG Channel Weight ($w$) | Purpose |
|---|---|---|---|---|---|---|
| `M0` | Dense only | 384-d `blake2b` signed hash | Disabled | `1.0` | `0.0` | Legacy non-semantic hash baseline |
| `M1` | Dense only | `all-MiniLM-L6-v2` (384-d) | Disabled | `1.0` | `0.0` | Pure neural dense baseline |
| `M2` | Sparse only | Disabled | Full 180 chunks | `1.0` | `0.0` | Pure lexical BM25 baseline |
| `M3` | `buggy_cr1` | `all-MiniLM-L6-v2` | Re-scored top-$2k$ only | `1.0` | `0.0` | Pre-fix CR-1 bug reproduction |
| `M4` | Fixed Hybrid | `all-MiniLM-L6-v2` | Full 180 chunks | `1.0` | `0.0` | CR-1 fixed without KG boosting |
| `M5` | Fixed Hybrid + KG Mult | `all-MiniLM-L6-v2` | Full 180 chunks | `1.30` | `0.0` | Multiplicative-only KG boost |
| `M6` | Fixed Hybrid + KG Channel | `all-MiniLM-L6-v2` | Full 180 chunks | `1.30` | `0.50` | KG channel weight sensitivity |
| `M7` | **Fixed Hybrid + KG Channel (Default)** | `all-MiniLM-L6-v2` | Full 180 chunks | `1.30` | `0.75` | Production default (`retrieve_hybrid`) |
| `M8` | Fixed Hybrid + KG Channel | `all-MiniLM-L6-v2` | Full 180 chunks | `1.30` | `1.00` | Full equal-rank KG channel |

---

## 5. Exact Reproduction Commands

All five suites can be regenerated from repository root (`a:\Antigravity\ResearcherGPT`) with:
```powershell
python evaluation/datasets/retrieval_benchmark.py
python evaluation/retrieval/run_retrieval_benchmark.py
python evaluation/grounding/run_grounding_benchmark.py
node evaluation/integrity/run_integrity_benchmark.mjs
python evaluation/document_extraction/run_extraction_benchmark.py
python evaluation/agent_workflow/run_orchestration_benchmark.py
```
