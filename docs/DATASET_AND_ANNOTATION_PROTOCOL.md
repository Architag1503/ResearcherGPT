# Dataset and Annotation Protocol

**Repository Branch:** `research-validation`  
**Scope:** Reproducible ground-truth datasets, synthetic generators, stratification design, and contamination controls for all five ResearcherGPT evaluation suites.

---

## 1. Overview of Evaluation Suites

Because the original submitted manuscript reported headline numbers (`250 papers`, `1,200 claims`, `92.7% Recall@5`, `96.4% attribution`, `99.8% verbatim`) without publishing underlying corpora, annotation rubrics, or evaluation scripts, we constructed five self-contained, deterministic, offline-reproducible benchmarks under [`evaluation/`](file:///a:/Antigravity/ResearcherGPT/evaluation).

| Suite | Script | Corpus / Test Items | Primary Ground Truth | Output Artifacts |
|---|---|---|---|---|
| **Retrieval Ablation** | [`run_retrieval_benchmark.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/retrieval/run_retrieval_benchmark.py) | 60 documents, 180 chunks, 75 stratified queries | Analytical relevance sets `qrel` + 1-hop KG triples | [`retrieval_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/retrieval_summary.json), `retrieval_per_query.csv` |
| **Claim Grounding & QA** | [`run_grounding_benchmark.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/grounding/run_grounding_benchmark.py) | 90 claim-evidence pairs (30/30/30 across 3 classes) | Controlled evidence perturbations + cited `ref_id`s | [`grounding_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/grounding_summary.json), `grounding_per_claim.csv` |
| **Academic Integrity** | [`run_integrity_benchmark.mjs`](file:///a:/Antigravity/ResearcherGPT/evaluation/integrity/run_integrity_benchmark.mjs) | 60 plagiarism pairs + 30 AI/human prose samples | Deterministic transformation labels across 6 strata | [`integrity_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/integrity_summary.json), `integrity_per_case.csv` |
| **PDF & Table Extraction** | [`run_extraction_benchmark.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/document_extraction/run_extraction_benchmark.py) | 15 synthetic multi-column/table PDFs + 1 manuscript PDF | Exact planted tokens, DOIs, and 2D table cells | [`extraction_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/extraction_summary.json), `extraction_per_doc.csv` |
| **Agent Orchestration** | [`run_orchestration_benchmark.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/agent_workflow/run_orchestration_benchmark.py) | 5 deterministic runs of 13-node `agent_workflow` | Node completion, memory trace, offline QA counts | [`orchestration_summary.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/results/orchestration_summary.json), `orchestration_runs.csv` |

---

## 2. Retrieval Benchmark (`retrieval_ablation_v1`)

Generated deterministically by [`retrieval_benchmark.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/datasets/retrieval_benchmark.py) into [`retrieval_manifest.json`](file:///a:/Antigravity/ResearcherGPT/evaluation/manifests/retrieval_manifest.json).

- **Corpus Construction:** 60 scholarly document records spanning 3 chunks each (`180` chunks total), indexed with unique project-scoped metadata (`paper_id`, `chunk_index`, domain terminology, and identifier tags) plus knowledge graph entity triples stored in `Neo4jClient.in_memory_graphs`.
- **Query Stratification (`75` queries total, `25` per stratum):**
  1. `lexical_identifier` (25 queries): Queries targeting exact alphanumeric identifiers, dataset codes, or specialized method acronyms that sparse BM25 matching resolves directly.
  2. `semantic_paraphrase` (25 queries): Queries phrased with synonymous terminology avoiding exact surface n-gram overlap, requiring dense `all-MiniLM-L6-v2` (384-d) semantic similarity.
  3. `multihop_kg` (25 queries): Queries linking a named concept/dataset in paper $A$ to a co-occurring method or downstream finding in paper $B$ linked via knowledge graph entity edges, where surface similarity between query and target chunk is low.
- **Ground-Truth Labeling Rule:** A retrieved chunk is marked relevant (`1`) if its `paper_id` is in the query's predetermined gold relevance set defined before indexing; no post-hoc pool curation or annotator overriding was applied.

---

## 3. Claim Grounding & Citation Audit Benchmark

Executed in [`run_grounding_benchmark.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/grounding/run_grounding_benchmark.py) with `90` balanced atomic claims (`30` `SUPPORTED`, `30` `REFUTED`, `30` `UNVERIFIED`):

- **`SUPPORTED` (`30` cases):** Claims whose propositions and numerical values match the paired retrieved chunk (exact paraphrase or minor wording variation with preserved quantities) and include a resolvable citation reference ID.
- **`REFUTED` (`30` cases):** Claims containing systematic numeric contradiction (e.g., inverted improvement direction, altered percentages, swapped metric magnitudes) against the matched evidence chunk.
- **`UNVERIFIED` (`30` cases):** Claims referencing orthogonal concepts, unsupported extrapolation, or unindexed citation identifiers (`ref_recall` checks missing vs present `valid_refs`).
- **Additional End-to-End Check:** A 4-claim post-draft section audit sample (`post_draft_section_audit_sample`) exercises [`verify_section_claims`](file:///a:/Antigravity/ResearcherGPT/ai-service/agents/verification/claim_verifier.py) directly on generated prose containing 2 supported, 1 refuted, 1 unverified claim and 1 dangling reference (`valid_refs=3`, `invalid_refs=1`).

---

## 4. Academic Integrity Benchmark (`60` Plagiarism Pairs + `30` AI/Human Samples)

Executed in [`run_integrity_benchmark.mjs`](file:///a:/Antigravity/ResearcherGPT/evaluation/integrity/run_integrity_benchmark.mjs) against both legacy and updated exports of [`plagiarismEngine.ts`](file:///a:/Antigravity/ResearcherGPT/server/src/utils/plagiarismEngine.ts):

- **Plagiarism Corpus (`60` pairs, `10` per stratum):**
  1. `verbatim_exact` (`10`): Unmodified paragraph copies.
  2. `localized_patchwrite` (`10`): Short verbatim spans embedded inside longer surrounding prose (designed to expose global MinHash dilution fixed by Winnowing).
  3. `structure_formula_code` (`10`): Pairs sharing Markdown headings, LaTeX equations (`$...$`), or fenced code blocks while varying prose words (designed to test the `localPapers` structural/formula/code extraction bug fix).
  4. `citation_overlap` (`10`): Shared scholarly citation keys/DOIs with modified framing text.
  5. `semantic_paraphrase` (`10`): High-level semantic rewrites preserving meaning while replacing nearly all content lemmas (stress test for sparse TF-IDF cosine limits).
  6. `clean_negative_control` (`10`): Unrelated scholarly passages with zero intentional overlap (false-positive rate control).
- **AI vs. Human Writing Corpus (`30` samples, `15` AI-like + `15` human-like):** Synthetic uniform-cadence passages (low sentence-length variance, repetitive formal transitions) vs. bursty human-style passages (mixed sentence lengths, varied discourse markers).

---

## 5. PDF Extraction & Agent Workflow Datasets

- **PDF Extraction (`15` synthetic multi-column PDFs + `1` manuscript artifact):** Generated deterministically in [`run_extraction_benchmark.py`](file:///a:/Antigravity/ResearcherGPT/evaluation/document_extraction/run_extraction_benchmark.py) using PyMuPDF (`fitz`) with two-column text blocks, embedded DOIs (`10.xxxx/...`), and vector-ruled tables containing known cell matrices; supplemented by extracting pages and tables from the supplied `ResearcherGPT_Research_Paper_Final_v2.pdf` artifact plus testing [`PaperValidator.sanitize_paper_structure`](file:///a:/Antigravity/ResearcherGPT/ai-service/services/paper_validator.py).
- **Agent Orchestration (`5` offline runs):** Invokes the compiled 13-node LangGraph [`agent_workflow`](file:///a:/Antigravity/ResearcherGPT/ai-service/agents/router.py) with deterministic offline LLM mocks (`allow_llm=False`) to measure structural graph execution latency, peak Python heap allocation (`tracemalloc`), and post-draft `qa_summary` schema emission without conflating offline latency with external Gemini API latency.

---

## 6. Contamination Controls

1. **Disjoint Test Data:** All 60 retrieval docs, 90 claims, 60 plagiarism pairs, and 15 synthetic PDFs were generated inside [`evaluation/`](file:///a:/Antigravity/ResearcherGPT/evaluation) independently of unit-test fixtures in `ai-service/tests/` and `server/tests/`.
2. **Offline Determinism:** Every stochastic sampler (`bootstrap_ci`, permutation tests, synthetic generators) uses fixed RNG seeds (`seed=42`).
3. **Zero Unseen External Leakage:** All Python benchmarks execute with `skipExternalLookup` / offline local fallbacks verified via socket isolation (`WinError 10013` sandbox guarantees no accidental external API calls).
