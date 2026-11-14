# Final Research Readiness Report — ResearcherGPT

**Git Branch:** `research-validation` (`main` preserved untouched)  
**Assessment Scope:** Full codebase audit, backwards-compatible architectural hardening, five deterministic offline evaluation suites, publication-ready IEEE conference paper synthesis, and pre-submission verification.

---

## 1. Executive Summary of Engineering & Research Transformation

Every discrepancy between the legacy prototype codebase and the initial unverified manuscript (`ResearcherGPT_Research_Paper_Final_v2.pdf`) has been audited and either fixed in source code or transparently removed from scientific claims:

| Subsystem | Prior Defect / Gap Audited | Verified Resolution on `research-validation` |
|---|---|---|
| **Hybrid Retrieval (`CR-1`)** | [`hybrid_retriever.py`](file:///a:/Antigravity/ResearcherGPT/ai-service/rag/hybrid_retriever.py) ran BM25 only on top-$2k$ dense results & applied KG boost purely multiplicatively ($\beta{=}1.30$). | Added full-corpus [`scroll_project_chunks`](file:///a:/Antigravity/ResearcherGPT/ai-service/services/qdrant_service.py), consistent `_tokenize_bm25`, positive-score filtering, and **KG candidate-channel injection** ($w \in \{0.75, 1.00\}$) in [`reciprocal_rank_fusion`](file:///a:/Antigravity/ResearcherGPT/ai-service/rag/hybrid_retriever.py). |
| **Vector Fallback & Space Guard** | [`qdrant_service.py`](file:///a:/Antigravity/ResearcherGPT/ai-service/services/qdrant_service.py) hashed whole strings with SHA-256 and risked dimension mixing. | Replaced with deterministic 384-d `blake2b` signed unigram+bigram feature hashing (`get_fast_fallback_embedding`), recorded `embedding_model`/`embedding_dim`, and guarded schema recreation (`QDRANT_RECREATE_ON_MISMATCH=true`). |
| **Claim Grounding & QA Node** | [`claim_verifier.py`](file:///a:/Antigravity/ResearcherGPT/ai-service/agents/verification/claim_verifier.py) marked any non-empty evidence `verified`; [`router.py`](file:///a:/Antigravity/ResearcherGPT/ai-service/agents/router.py) `qa_node` returned mock fallback JSON. | Built [`score_claim_against_evidence`](file:///a:/Antigravity/ResearcherGPT/ai-service/agents/verification/claim_verifier.py) (MiniLM + unigram/bigram + numeric magnitude consistency) and wired post-draft [`verify_section_claims`](file:///a:/Antigravity/ResearcherGPT/ai-service/agents/verification/claim_verifier.py) into `qa_node` (`final_output["qa_summary"]`). |
| **PDF Table Ingestion** | [`pdf_processor.py`](file:///a:/Antigravity/ResearcherGPT/ai-service/utils/pdf_processor.py) emitted empty table arrays. | Added [`extract_tables_with_pdfplumber`](file:///a:/Antigravity/ResearcherGPT/ai-service/utils/pdf_processor.py) populating real 2D cell matrices into `"tables"`. |
| **Plagiarism & Auth Hardening** | [`plagiarismEngine.ts`](file:///a:/Antigravity/ResearcherGPT/server/src/utils/plagiarismEngine.ts) dropped `localPapers` structural/formula/code elements & skipped Winnowing; [`auth.middleware.ts`](file:///a:/Antigravity/ResearcherGPT/server/src/middlewares/auth.middleware.ts) allowed mock user bypass unconditionally; hardcoded FormaTeX key literal. | Shared [`extractStructuralElementsFromText`](file:///a:/Antigravity/ResearcherGPT/server/src/utils/plagiarismEngine.ts), fused `Math.max(minHashSim, winnowSim)` in `detectExactPlagiarism()`, added production `401` guard (`ALLOW_DEV_MOCK_AUTH`), loaded `FORMATEX_API_KEY` from env only, and updated [`plagiarism/page.tsx`](file:///a:/Antigravity/ResearcherGPT/client/src/app/plagiarism/page.tsx) schema handling. |

---

## 2. Reproducible Benchmark Summary (Measured Offline Results)

All five offline evaluation suites use `seed=42`, `B=2000` bootstrap 95% confidence intervals, and paired statistical tests recorded in CSV/JSON artifacts under [`evaluation/results/`](file:///a:/Antigravity/ResearcherGPT/evaluation/results):

1. **Retrieval Ablation (`60` papers / `180` chunks / `75` queries, [`retrieval_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/retrieval_summary.json)):**
   - `M0_HashDenseOnly`: `Recall@5 = 0.3600 [0.2533, 0.4667]`, `MRR = 0.3400`
   - `M1_MiniLMDenseOnly`: `Recall@5 = 0.6533 [0.5467, 0.7600]`, `MRR = 0.5616`, `multihop_kg Recall@5 = 0.0800`
   - `M2_BM25FullCorpus`: `Recall@5 = 0.3333 [0.2267, 0.4400]`, `lexical_identifier MRR = 1.0000`, `semantic_paraphrase Recall@5 = 0.0000`
   - `M3_PreFixBuggyHybrid_CR1`: `Recall@5 = 0.6867 [0.5800, 0.7867]`, `lexical_identifier MRR = 0.6567`, `multihop_kg Recall@5 = 0.0600`
   - `M4_FixedHybrid_NoKG_beta1.0`: `Recall@5 = 0.6733`, `lexical_identifier MRR = 0.8333`
   - `M5_FixedHybrid_KG_MultOnly_beta1.30`: `Recall@5 = 0.7267 [0.6267, 0.8200]`, `multihop_kg Recall@5 = 0.1800`
   - `M7_FixedHybrid_KG_Channel_w0.75` *(Default)*: **`Recall@5 = 0.7600 [0.6733, 0.8467]`**, `Hit@1 = 0.6400`, `MRR = 0.7400`, `multihop_kg Recall@5 = 0.2800` (Wilcoxon `p = 0.000911` vs. `M3`; `p = 0.000526` vs. `M1` MRR), latency `38.13 ms`
   - `M8_FixedHybrid_KG_Channel_w1.00`: **`Recall@5 = 0.8400 [0.7600, 0.9133]`**, `Hit@1 = 0.6800`, `MRR = 0.7822`, `nDCG@5 = 0.7678`, `multihop_kg Recall@5 = 0.5200`, `lexical_identifier Recall@5 = 1.0000` (`MRR = 0.8333`), `semantic_paraphrase Recall@5 = 1.0000` (Wilcoxon `p = 0.000290` vs. `M3`; `p = 8.7e-5` vs. `M1` MRR), latency `38.17 ms`

2. **Claim Grounding & QA Audit (`90` balanced claims, [`grounding_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/grounding_summary.json)):**
   - `V0_LegacyFallback`: `binary acc = 0.6667`, `FPR = 1.0000`, `3-way acc = 0.6667`
   - `V1_LexicalNumeric`: `precision = 1.0000`, `recall = 0.9333`, `F1 = 0.9655`, `FPR = 0.0000`, `3-way acc = 0.9000 [0.8333, 0.9556]`, `lat = 0.0649 ms`
   - `V2_HybridMiniLMNumeric`: `precision = 0.9836`, `recall = 1.0000`, `F1 = 0.9917`, `binary acc = 0.9889`, `FPR = 0.0333`, `3-way acc = 0.9444 [0.8889, 0.9889]`, `numeric_refutation_recall = 0.6667`, `lat = 44.9852 ms`
   - `post_draft_section_audit_sample`: 4 claims audited (`2` verified, `1` refuted, `1` unverified, `3/4` valid citations = `0.7500`)

3. **Academic Integrity (`60` plagiarism pairs + `30` AI/human samples, [`integrity_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/integrity_summary.json)):**
   - Aggregate pre-fix -> post-fix: `precision = 1.000 -> 1.000`, `FPR = 0.000 -> 0.000`, `recall = 0.600 -> 0.800`, `F1 = 0.750 -> 0.8889`, `accuracy = 0.6667 -> 0.8333` (`latency = 3.44 ms`)
   - `structure_formula_code`: detection rate `0.000 -> 1.000` (`mean score 100` across structure, formula, and code)
   - Remaining gaps cleanly reported: `semantic_paraphrase = 0.000` (sparse TF-IDF limitation in TS) and AI heuristic cutoff `50%` yielding `0.000` recall despite mean `35.0` vs `0.0` separation.

4. **PDF Extraction & Orchestration ([`extraction_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/extraction_summary.json), [`orchestration_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/orchestration_summary.json)):**
   - `15` synthetic PDFs: `token_recall = 1.0000`, `doi_exact_match = 1.0000`, baseline `0.0000` -> `pdfplumber` **`1.0000`** (`exact_row = 1.0000`), `74.88 ms/PDF`; 11-page real PDF artifact yielded `61` chunks + `1` table in `2150.63 ms`.
   - `5` offline executions of 13-node `agent_workflow`: `completion_rate = 1.0000`, mean graph latency `138.10 ms`, peak heap `0.295 MB`, `qa_citation_validity = 1.0000`.

---

## 3. Manuscript, Documentation, and Verification Status

- **Conference Manuscript:** [`ResearcherGPT_Conference_Paper.tex`](file:///a:/Antigravity/ResearcherGPT/research-paper/final/ResearcherGPT_Conference_Paper.tex) written in `IEEEtran` conference format (`\documentclass[conference]{IEEEtran}`), embedding three verified figures inspected visually ([`architecture_overview.png`](file:///a:/Antigravity/ResearcherGPT/research-paper/final/figures/architecture_overview.png), [`retrieval_ablation.png`](file:///a:/Antigravity/ResearcherGPT/research-paper/final/figures/retrieval_ablation.png), [`grounding_and_integrity.png`](file:///a:/Antigravity/ResearcherGPT/research-paper/final/figures/grounding_and_integrity.png)), four formal RQs/hypotheses, Algorithm 1 & Algorithm 2 matching implemented code, exact 13-node LangGraph specification, statistical tables, error analysis, future roadmap, and 24 verified bibliography entries.
- **Automated LaTeX Audit ([`validate_latex.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/reports/validate_latex.py)):** **PASSED** (0 syntax, environment, brace, figure-path, `\ref`, or `\cite`/`\bibitem` parity errors).
- **Local PDF Compilation Status:** **Not compiled locally** because neither MiKTeX nor TeX Live (`pdflatex`, `xelatex`, `lualatex`) is installed on this Windows host; ready for one-click upload/compile via Overleaf or live FormaTeX with `FORMATEX_API_KEY`.
- **Supporting Documentation (`docs/`):** Complete suite authored — [`BASELINE_FUNCTIONALITY_AUDIT.md`](file:///a:/Antigravity/ResearcherGPT/docs/BASELINE_FUNCTIONALITY_AUDIT.md), [`CODE_TO_MANUSCRIPT_TRACEABILITY.md`](file:///a:/Antigravity/ResearcherGPT/docs/CODE_TO_MANUSCRIPT_TRACEABILITY.md), [`ARCHITECTURE.md`](file:///a:/Antigravity/ResearcherGPT/docs/ARCHITECTURE.md), [`ALGORITHM_SPECIFICATIONS.md`](file:///a:/Antigravity/ResearcherGPT/docs/ALGORITHM_SPECIFICATIONS.md), [`SECURITY_AND_PRIVACY.md`](file:///a:/Antigravity/ResearcherGPT/docs/SECURITY_AND_PRIVACY.md), [`REPRODUCIBILITY_GUIDE.md`](file:///a:/Antigravity/ResearcherGPT/docs/REPRODUCIBILITY_GUIDE.md), [`DATASET_AND_ANNOTATION_PROTOCOL.md`](file:///a:/Antigravity/ResearcherGPT/docs/DATASET_AND_ANNOTATION_PROTOCOL.md), [`EXPERIMENTAL_METHODOLOGY.md`](file:///a:/Antigravity/ResearcherGPT/docs/EXPERIMENTAL_METHODOLOGY.md), [`KNOWN_LIMITATIONS.md`](file:///a:/Antigravity/ResearcherGPT/docs/KNOWN_LIMITATIONS.md).
- **Python Test Suite ([`test_phase1_regressions.py`](file:///a:/Antigravity/ResearcherGPT/ai-service/tests/test_phase1_regressions.py)):** **8/8 tests PASSED** (`0.598s`).
- **TypeScript & Express Regression Suite ([`phase1Regressions.unit.ts`](file:///a:/Antigravity/ResearcherGPT/server/src/tests/phase1Regressions.unit.ts)):** Server `npx tsc --noEmit` & `npm run build` exited `0`, `node dist/tests/phase1Regressions.unit.js` printed `ALL SERVER PHASE 1 UNIT TESTS PASSED`, and Client `npx tsc --noEmit` exited `0`.
- **Pre-Submission Blockers Before External Conference Submission:**
  1. Compile `ResearcherGPT_Conference_Paper.tex` with `pdflatex` (or Overleaf/FormaTeX) and visually inspect the rendered PDF pages.
  2. Run an external live end-to-end integration run with valid `GEMINI_API_KEY`, `FORMATEX_API_KEY`, Qdrant, and Neo4j instances if full live network timings are desired in camera-ready revisions.
