# Known Limitations and Threats to Validity

**Branch:** `research-validation`  
**Principle:** All limitations listed below are directly observed in source files or measured in offline benchmark logs.

---

## 1. Algorithmic & Modeling Limitations

### 1.1 Sparse TF-IDF Limitation on Heavy Semantic Paraphrasing (`plagiarismEngine.ts`)
- **Observed Behavior:** In [`integrity_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/integrity_summary.json), `semantic_paraphrase` detection rate in Express [`plagiarismEngine.ts`](file:///a:/Antigravity/ResearcherGPT/server/src/utils/plagiarismEngine.ts) is **`0.0` (`0/10`)** both pre-fix and post-fix.
- **Root Cause:** Although TypeScript structural extraction and Winnowing (`detectExactPlagiarism`) now resolve `localized_patchwrite` and `structure_formula_code` (`1.0` detection rate), `detectSemanticPlagiarism` in TypeScript relies solely on sparse bag-of-words TF-IDF cosine similarity rather than neural dense sentence embeddings (`all-MiniLM-L6-v2` resides only in the Python `ai-service`).
- **Mitigation Path:** Forward paraphrased candidate pairs to the Python `ai-service` MiniLM embedding endpoint or load an ONNX sentence encoder in Node.js (behind a compatibility flag so offline fast-path speed `3.44 ms/case` is preserved).

### 1.2 Conservative Calibration of Heuristic AI-Text Detector (`detectAIContent`)
- **Observed Behavior:** Across 30 synthetic samples (`15` AI-style vs. `15` human-style), `detectAIContent` separates `mean_ai_prob_on_ai = 35.0` from `mean_ai_prob_on_human = 0.0`, yet achieves **`0.0` recall** at its hard-coded `50%` AI-flagged cutoff (`acc = 0.50`, `fpr = 0.0`).
- **Root Cause:** Zero-LLM burstiness/lexical-diversity heuristics are intentionally conservative to suppress false accusations against human academic writers, but require empirical ROC threshold recalibration or perplexity-based scoring before deployment as an autonomous classifier.

### 1.3 Cross-Encoder Reranker Unavailable Offline
- **Observed Behavior:** [`reranker.py`](file:///a:/Antigravity/ResearcherGPT/ai-service/rag/reranker.py) uses `cross-encoder/ms-marco-MiniLM-L-6-v2` when cached/online, which was not locally cached in the sandbox and therefore fell back to deterministic pass-through during offline retrieval ablation (`M0`–`M8`).
- **Impact:** Retrieval metrics (`Recall@5 = 0.7600` at default `w=0.75`, `0.8400` at `w=1.00`) isolate dual-channel RRF + KG candidate injection cleanly, without confounding neural reranking gains.

### 1.4 KG Channel Sensitivity Threshold Effect (`w < 0.75`)
- **Observed Behavior:** At `w = 0.50` (`M6`), `multihop_kg Recall@5` remained `0.1800` (identical to multiplicative-only `M5`), whereas increasing rank injection weight to `w = 0.75` (`M7`) and `w = 1.00` (`M8`) raised `multihop_kg Recall@5` to `0.2800` and `0.5200` respectively, while keeping `lexical_identifier` and `semantic_paraphrase` at `1.0000`.
- **Constraint:** Remaining multi-hop misses (`48%` at `w=1.00`) occur when queries phrase indirect relationships using abstract terms that do not match the stored entity surface forms in `Neo4jClient.query_papers_by_terms`.

---

## 2. Systems, Security & Infrastructure Limitations

### 2.1 Auth Token Verification & Clerk Integration Scope
- **Observed Behavior:** [`auth.middleware.ts`](file:///a:/Antigravity/ResearcherGPT/server/src/middlewares/auth.middleware.ts) now enforces fail-closed `401 Unauthorized` in `NODE_ENV=production` unless `ALLOW_DEV_MOCK_AUTH=true`, preventing unauthenticated dev-mock bypasses in production. However, full cryptographic JWKS signature verification against Clerk (`CLERK_JWKS_URL`) vs. decoded header/token lookup depends on runtime Clerk middleware configuration outside offline test harnesses.

### 2.2 In-Process Agent Orchestration vs. Live LLM Quality
- **Observed Behavior:** [`run_orchestration_benchmark.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/agent_workflow/run_orchestration_benchmark.py) executes all `13` compiled LangGraph nodes in `138.10 ms` (`0.295 MB` peak traced memory) using offline deterministic fallbacks (`qa_support_rate = 0.0` on deterministic offline scaffold text because placeholder summaries omit retrieved numeric quantities).
- **Threat to External Validity:** End-to-end wall-clock generation time and prose fluency with live `gemini-2.5-flash` calls depend on network RTT, Google API quotas, and document count, and are not represented by the `138.10 ms` graph-overhead measurement.

### 2.3 Unverified External Dependencies in Offline Sandbox
- **Live Services Not Benchmarked:** External live Qdrant, Neo4j Aura/Bolt, MongoDB Atlas, OpenAlex HTTP discovery, Google Gemini API inference, and remote `api.formatex.io` PDF compilation were blocked or unconfigured in the offline evaluation sandbox and verified via unit mocks and fallback paths.
- **Original Manuscript Metrics (`ResearcherGPT_Research_Paper_Final_v2.pdf`):** Legacy claims (`250 papers`, `1,200 claims`, `92.7% Recall@5`, `96.4% attribution`, `99.8% verbatim`, `41.8%` sync reduction, `291.4s` speedup) remain unsubstantiated in this codebase and are explicitly excluded from the new manuscript except where audited as historical defects.

---

## 3. Threats to Validity

- **Construct & Dataset Scale:** Our reproducible suites evaluate controlled synthetic/curated corpora (`60` papers / `180` chunks / `75` queries; `90` claims; `60` integrity pairs; `15` layout PDFs) rather than multi-thousand-paper noisy field crawls. Results establish exact comparative mechanisms (`CR-1` fix, KG channel injection vs. multiplicative rescoring, Winnowing + structural extraction, numeric refutation sensitivity) under controlled conditions rather than universal in-the-wild accuracy bounds.
- **External PDF Compiler:** Depending on local TeX installation availability, LaTeX typesetting verification uses structural/syntax auditing or MiKTeX/FormaTeX when invoked with network credentials.
