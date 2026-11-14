# Code-to-Manuscript Traceability Matrix

**Baseline Manuscript Audited:** `paper_final.tex` (`ResearcherGPT: A Distributed Multi-Agent Cognitive Framework for Autonomous Academic Literature Synthesis, Layout-Aware Extraction, and Multi-Scale Attribution`)  
**Repository State:** Commit `2374ed0` on `main` (pre-improvement baseline)

---

## 1. Evidence Status Legend

- **VERIFIED**: Directly matches inspected code and executed behavior.
- **PARTIAL**: Concept exists in code, but implementation materially differs from formulas, parameters, or topology described in the manuscript.
- **NOT IMPLEMENTED**: Described algorithm, library, or architectural mechanism does not exist in code.
- **UNVERIFIED (NO EVIDENCE)**: Numerical benchmark metric or runtime claim with no evaluation script, dataset manifest, or raw output in the repository.

---

## 2. Core System & Architectural Claims

| Manuscript Claim / Section | Target File(s) & Symbol(s) | Actual Code Behavior | Status | Action Required |
|---|---|---|---|---|
| **13-agent topology + Supervisor (`Table I`, `Fig. 4`)** | `ai-service/agents/router.py` (`MODEL_REGISTRY`, `workflow`) | `workflow` has 13 linear nodes (`planner -> ... -> writer -> quality_assurance -> END`). `supervisor` is in `MODEL_REGISTRY` only, not a node. | **PARTIAL** | Align `MODEL_REGISTRY`, topology diagram, and manuscript description. |
| **Role-specific model assignment (`Table I`: Writer on Gemini 2.5 Flash, etc., OpenAI `gpt-4o` fallback)** | `ai-service/agents/router.py` (`MODEL_REGISTRY`, fallback cascade) | All 13 `MODEL_REGISTRY` entries map to `"groq/llama-3.3-70b-versatile"`. Fallbacks are Gemini (`GEMINI_MODEL` default `"gemini-3.6-flash"`) -> Groq -> SambaNova -> `gpt-4o-mini` (not `gpt-4o`). | **NOT IMPLEMENTED / CONTRADICTORY** | Fix model defaults/routing and report exact runtime routing in manuscript. |
| **Redis distributed mutex locking & `41.8%` sync latency reduction** | `server/src/config/redis.ts`, `ai-service/agents/router.py` | Redis is only used by Express BullMQ (`pdfWorker`, `graphWorker`). No Redis mutex lock exists in `ai-service/`; `Redis` only appears in `router.py` fallback text templates. | **NOT IMPLEMENTED / UNVERIFIED** | Remove fabricated Redis lock & `41.8%` claim from manuscript or implement & measure actual state coordination. |
| **Quality Assurance (`quality_assurance` node)** | `ai-service/agents/router.py` (`qa_node`) | Calls `generate_fallback_data("qa", ...)` without inspecting draft quality. | **PARTIAL (STUB)** | Implement real structural/citation audit in `qa_node` and test it. |

---

## 3. Retrieval-Augmented Generation (RAG) & Graph Claims

| Manuscript Claim / Section | Target File(s) & Symbol(s) | Actual Code Behavior | Status | Action Required |
|---|---|---|---|---|
| **Hybrid Retrieval Alg. 1: Dense Qdrant + Independent BM25 + RRF + KG Boost** | `ai-service/rag/hybrid_retriever.py` (`retrieve_hybrid`, `bm25_search`, `reciprocal_rank_fusion`), `ai-service/services/qdrant_service.py` | **CR-1 Bug**: `bm25_search(vector_res, query)` runs ONLY over dense top-`2k` results, not full project corpus. DF uses substring `term in text` while TF uses `words.count(term)`. RRF keys on `chunk_index` which `search_relevant_chunks` does not include in output dicts. | **PARTIAL (BUGGY)** | Fix full-corpus BM25, tokenization consistency, and `chunk_index` propagation; run ablation benchmark. |
| **Dense Embeddings (`3072d` Gemini / `384d` local MiniLM)** | `ai-service/services/qdrant_service.py` (`get_embedding`, `get_local_model`, `match_vector_dim`, `ensure_collection`) | `get_local_model()` (`all-MiniLM-L6-v2`) is never called. Fallbacks (`gemini` -> `mistral` -> `cohere` -> random SHA-256 vector) zero-pad/truncate across incompatible vector spaces into one collection. `ensure_collection` wipes collection on dim change. | **PARTIAL (BUGGY)** | Separate collections/models cleanly, wire `all-MiniLM-L6-v2` as real deterministic local encoder, add tests. |
| **Knowledge Graph Extraction (Neo4j + NetworkX)** | `ai-service/services/graph_service.py` | Uses Gemini extraction with heuristic regex/co-occurrence fallback, stores in Neo4j or NetworkX. | **VERIFIED** | Measure KG boost parameter $\beta$ in retrieval experiments. |
| **92.7% Recall@5 over 300 queries & 250 papers** | *(None in repo)* | No dataset, ground-truth qrels, or retrieval evaluation script exists in repo. | **UNVERIFIED** | Build `evaluation/` retrieval benchmark and report actual measured Recall@k / MRR / nDCG@k. |

---

## 4. Document Extraction & LaTeX Typesetting Claims

| Manuscript Claim / Section | Target File(s) & Symbol(s) | Actual Code Behavior | Status | Action Required |
|---|---|---|---|---|
| **Layout-aware PDF extraction (`pdfplumber`, bounding boxes, table & formula extraction)** | `ai-service/utils/pdf_processor.py` (`extract_text_from_pdf`) | Uses PyMuPDF (`fitz`) `get_text()` + OCR only when page chars `< 10`. Never imports `pdfplumber`; returns hardcoded `"tables": []`. | **NOT IMPLEMENTED** | Either integrate genuine `pdfplumber` table extraction with evaluation or describe PyMuPDF + sparse-page OCR accurately. |
| **FormaTeX autonomous manuscript compiler & self-healing** | `ai-service/services/formatex_service.py`, `ai-service/services/paper_validator.py`, `server/src/services/formatex.service.ts` | Converts HTML/Markdown AST/headings/lists/citations to IEEE/ACM/Springer/Elsevier/Harvard/APA LaTeX templates and sends HTTP requests to `https://api.formatex.io/api/v1` with heuristic pre-validation (`paper_validator.py`). | **PARTIAL** | Audit validation & HTML-to-LaTeX fidelity; clearly distinguish local preprocessing from external FormaTeX API compilation. |
| **Local MiKTeX / compilation caveats (Paper Abstract & Sec. V)** | `paper_final.tex` | Original paper contained meta-caveats ("we acknowledge that without direct local verification against MiKTeX/TeX Live compilers..."). | **VERIFIED (DRAFT ARTIFACT)** | Replace meta-caveats with reproducible compilation logs and verified validation counts. |

---

## 5. Fact Verification & Citation Grounding Claims

| Manuscript Claim / Section | Target File(s) & Symbol(s) | Actual Code Behavior | Status | Action Required |
|---|---|---|---|---|
| **Alg. 2 Fact Verification (`Split(T_sec)`, per-claim `QdrantSearch(c, P_i, 3)`, `theta=0.85` prune/rewrite)** | `ai-service/agents/router.py` (`fact_verification_node`), `ai-service/agents/verification/claim_extractor.py`, `claim_verifier.py` | `fact_verification_node` executes *before* `writer_node` over `literature_reviews` + `research_context`. Does not split generated section sentences or prune/rewrite at `theta=0.85`. `agents/verification/` helpers are unused by `workflow`. | **NOT IMPLEMENTED** | Implement post-draft claim verification/attribution module behind clean API and evaluate precision/recall. |
| **96.4% attribution accuracy across 1,200 claims** | *(None in repo)* | No annotated claim dataset or evaluation script exists. | **UNVERIFIED** | Construct annotated claim-grounding benchmark and measure precision, recall, F1, and attribution accuracy. |

---

## 6. Plagiarism & AI-Content Detection Claims

| Manuscript Claim / Section | Target File(s) & Symbol(s) | Actual Code Behavior | Status | Action Required |
|---|---|---|---|---|
| **Multi-scale Plagiarism Engine (MinHash + Winnowing + TF-IDF + Citation + Structure + Formula + Code)** | `server/src/utils/plagiarismEngine.ts` (`runPlagiarismDetection`) vs `ai-service/plagiarism/plagiarism_report_generator.py` | 1. Two disconnected subsystems (TS vs Python) with different schemas.<br>2. TS `hashString` uses 32-bit charCode shift, not FNV-1a.<br>3. `winnowingFingerprint()` is unused.<br>4. `sourceHierarchies`, `sourceFormulas`, `sourceCodeBlocks` are initialized `[]` and never populated (`structureScore=0`, `formulaScore=0`, `codeScore=0` always).<br>5. Formula similarity uses token-set Jaccard (`>0.6`), not Zhang–Shasha TED.<br>6. Structure similarity uses heading LCS, not tree-edit distance. | **PARTIAL (CRITICAL DEFECTS)** | Wire Winnowing + populate source formulas/structures/code safely in TS engine; benchmark against controlled obfuscations; revise equations to match real code. |
| **AI Detection Perplexity & Burstiness** | `server/src/utils/plagiarismEngine.ts` (`detectAIContent`) | Computes unigram word-frequency Shannon entropy ($2^H$) labeled as `"perplexity"`, plus sentence-length CV (`burstiness`), TTR, sentence-start diversity, and connective density. | **PARTIAL (HEURISTIC)** | Document exact unigram-entropy formula honestly and evaluate false positive / false negative rates. |
| **99.8% verbatim / 94.1% structural / 91.5% semantic detection on 150 papers** | *(None in repo)* | No 150-paper plagiarism dataset or benchmark script exists. | **UNVERIFIED** | Build controlled plagiarism & obfuscation evaluation suite and report measured detection metrics with CIs. |

---

## 7. End-to-End Performance & Bibliography Claims

| Manuscript Claim / Section | Actual Status in Codebase | Status | Action Required |
|---|---|---|---|
| **291.4s total pipeline runtime (`Table VII` / runtime breakdown)** | No benchmark timing harness or logged multi-stage telemetry for an end-to-end 250-paper study. | **UNVERIFIED** | Instrument stage timing & measure real local/end-to-end latencies. |
| **Bibliography `[1]`–`[20]`** | `[16]`–`[20]` are listed but uncited in `paper_final.tex` body; entries like `[11]` ("LangChain Inc.") and `[19]` ("Zhang & Shasha") require bibliographic author/title/venue verification; missing key scholarly RAG citations (e.g., PaperQA2, OpenScholar). | **REQUIRES VERIFICATION** | Verify every citation externally in Phase 4, drop uncited/invalid entries, and add accurate peer-reviewed comparisons. |
