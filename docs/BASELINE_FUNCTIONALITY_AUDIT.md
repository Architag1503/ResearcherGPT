# Baseline Functionality Audit — ResearcherGPT

**Audit Date:** 2026-11-11  
**Baseline Git Commit:** `2374ed0` (`main`) — Working branch created: `research-validation`  
**Scope:** Complete pre-modification baseline across `client/` (Next.js 15), `server/` (Node.js/Express + TypeScript), `ai-service/` (Python 3.12 + FastAPI + LangGraph), databases, and integrations.

---

## 1. System Architecture & Services Inventory

As defined in `docker-compose.yml`:
1. **`mongodb` (`mongo:6.0`)**: Primary document store on port `27017` (`MONGO_URI` / `researchergpt`).
2. **`redis` (`redis:7.0-alpine`)**: Queue backend for BullMQ workers on port `6379`.
3. **`qdrant` (`qdrant/qdrant:latest`)**: Vector database on ports `6333` (HTTP) and `6334` (gRPC), storing `research_chunks` with an in-memory Python dictionary fallback (`MEMORY_FALLBACK_STORE`) when Qdrant is unreachable.
4. **`neo4j` (`neo4j:5.12-community`)**: Knowledge graph database on ports `7474` and `7687`, with a NetworkX in-memory fallback when Neo4j is unreachable.
5. **`server` (Express + TypeScript)**: REST API Gateway and BullMQ worker host on port `5000`.
6. **`ai-service` (Python FastAPI)**: AI inference, PDF parsing, Qdrant retrieval, Neo4j extraction, LangGraph agent orchestration, and FormaTeX integration on port `8000`.
7. **`client` (Next.js 15)**: Web UI on port `3000`.

---

## 2. Existing Feature Inventory

### 2.1 Frontend Pages (`client/src/app/`)
- `/` (`page.tsx`): Landing / entry page.
- `/auth/signin`, `/auth/signup`: Authentication UI (integrates Clerk when configured).
- `/dashboard`: Project workspace listing and creation.
- `/projects/[projectId]`: Core workspace view (PDF uploads, paper list, interactive knowledge graph, research gaps, agent runner, manuscript/editor, exports, plagiarism report triggers).
- `/citations`: Literature search and citation manager.
- `/comparison`: Multi-paper comparison matrix UI.
- `/gap-analysis`: Research gap inspection view.
- `/literature-review`: Literature synthesis view.
- `/paper-generator`: Full IEEE/academic manuscript generator UI.
- `/proposal-generator`: Research proposal generator UI.
- `/survey-generator`: Literature survey generator UI.
- `/review-agent`: Automated peer-review critique UI.
- `/plagiarism`: Academic integrity / plagiarism inspection view (expects `similarityPercentage` / `riskScore` schema).
- `/profile`, `/settings`: User profile and service settings UI.

### 2.2 Backend & AI Capabilities
- **Project Management**: CRUD for research workspaces, AI description generation, AI research gap mining (`generate-gaps`, `generate-single-gap`).
- **PDF Ingestion Pipeline**: File upload -> BullMQ `pdfWorker` -> FastAPI `/api/pdf/process` -> PyMuPDF text extraction + page-level `<10` chars multimodal OCR fallback (Gemini/Pixtral) -> Gemini metadata extraction -> 1200-char chunking -> Qdrant indexing -> MongoDB `Paper` & `PaperChunk` persistence.
- **Knowledge Graph & Learning Nodes**: Async `graphWorker` -> FastAPI `/api/graph/generate` (Gemini entity/relation extraction or heuristic fallback + NetworkX + Neo4j) -> MongoDB `Graph` persistence -> interactive node explanations & Q&A (`/api/graph/learning-node`, `/api/graph/learning-node/ask`).
- **RAG Chat**: SSE streaming endpoint `/api/chat/stream` backed by hybrid retrieval and LLM streaming.
- **Multi-Agent Orchestration**: LangGraph 13-node sequential pipeline (`agent_workflow` in `ai-service/agents/router.py`) plus standalone flows (`proposal_workflow.py`, `survey_workflow.py`, `review_workflow.py`, `research_workflow.py`, `paper_generation_workflow.py`).
- **Plagiarism & Academic Integrity**: Two separate implementations:
  1. `server/src/utils/plagiarismEngine.ts` (TypeScript 11-phase engine persisting to `PlagiarismReport` via `/api/projects/:projectId/plagiarism-reports/:paperId/run`).
  2. `ai-service/plagiarism/plagiarism_report_generator.py` (Python module used inside `paper_generation_workflow.py`).
- **LaTeX Typesetting & Validation (`FormaTeX`)**: `ai-service/services/formatex_service.py` and `server/src/services/formatex.service.ts` providing HTML/Markdown-to-LaTeX conversion, validation, formatting, repair, and remote PDF compilation via `https://api.formatex.io/api/v1`.

---

## 3. API Endpoint Inventory

### 3.1 Express Gateway (`server/src/routes/`, mounted under `/api`)
| Prefix | Endpoints |
|---|---|
| `/api/projects` | `POST /`, `POST /generate-description`, `GET /`, `GET /:projectId`, `PUT /:projectId`, `DELETE /:projectId`, `POST /:projectId/graph`, `GET /:projectId/graph`, `GET /:projectId/gaps`, `POST /:projectId/gaps`, `POST /:projectId/gaps/generate`, `POST /:projectId/gaps/generate-single`, `PUT /gaps/:gapId`, `DELETE /gaps/:gapId`, `GET /:projectId/fact-checks`, `GET /:projectId/generated-papers`, `PUT /:projectId/generated-papers`, `DELETE /:projectId/generated-papers/:paperId`, `POST /:projectId/export-pdf`, `POST /:projectId/generate-visual`, `POST /:projectId/plagiarism-reports/:paperId/run`, `GET /:projectId/plagiarism-reports`, `GET /:projectId/plagiarism-reports/:reportId`, `DELETE /:projectId/plagiarism-reports/:reportId`, `GET /:projectId/graph/nodes/:nodeId`, `POST /:projectId/graph/nodes/:nodeId/ask` |
| `/api/papers` | `POST /upload`, `POST /upload-image`, `GET /`, `GET /:paperId`, `GET /:paperId/pdf`, `DELETE /:paperId`, `POST /:paperId/retry` |
| `/api/agents` | `POST /run`, `GET /`, `GET /:runId`, `POST /:runId/step`, `DELETE /:runId` |
| `/api/chat` | `POST /sessions`, `GET /sessions`, `PUT /sessions/:sessionId`, `DELETE /sessions/:sessionId`, `GET /sessions/:sessionId/messages`, `POST /sessions/:sessionId/messages` |
| `/api/citations` | `GET /search`, `POST /`, `GET /`, `PUT /:citationId`, `DELETE /:citationId` |
| `/api/comparison` | `GET /matrix` |
| `/api/dashboard` | `GET /stats` |
| `/api/notes` | `POST /`, `GET /`, `GET /:noteId`, `PUT /:noteId`, `DELETE /:noteId` |
| `/api/formatex` & `/api/projects/:projectId/formatex` | `POST /format`, `POST /compile`, `POST /validate`, `POST /compliance`, `POST /auto-correct`, `POST /repair/:paperId`, `POST /:projectId/repair-all` |

### 3.2 FastAPI AI Engine (`ai-service/main.py`, Port `8000`)
- Health: `GET /`
- PDF & Vectors: `POST /api/pdf/process`, paper chunk indexing/search helpers
- Graph: `POST /api/graph/generate`, `POST /api/graph/learning-node`, `POST /api/graph/learning-node/ask`
- Chat & Comparison: `POST /api/chat/stream`, `POST /api/comparison/matrix`
- Project Metadata / Gaps: `POST /api/project/generate-description`, `POST /api/project/generate-gaps`, `POST /api/project/generate-single-gap`
- Agent Execution: `POST /api/agent/run`
- FormaTeX & Validation: `/api/formatex/format`, `/api/formatex/compile`, `/api/formatex/validate`, `/api/formatex/compliance`, etc.

---

## 4. Agent & Workflow Inventory

### 4.1 Primary LangGraph Pipeline (`ai-service/agents/router.py`)
`workflow` compiles a strictly linear 13-node graph:
1. `planner`
2. `retrieval`
3. `literature_review`
4. `methodology_extraction`
5. `comparison`
6. `trend_analysis`
7. `gap_analysis`
8. `contradiction`
9. `citation_verification`
10. `fact_verification`
11. `reviewer`
12. `writer`
13. `quality_assurance` -> `END`

- **`MODEL_REGISTRY`**: Maps all 13 keys (`supervisor`, `planner`, `researcher`, `literature_review`, `methodology_extraction`, `comparison`, `trend_analysis`, `gap_analysis`, `contradiction_detection`, `fact_verification`, `reviewer`, `writer`, `quality_assurance`) to `"groq/llama-3.3-70b-versatile"`. Note that `supervisor` is in `MODEL_REGISTRY` but is not registered as a node in `workflow`.
- **LLM Fallback Cascade**: Primary configured model (`groq`) -> Gemini (`GEMINI_MODEL`, default `"gemini-3.6-flash"`) -> Groq (`llama-3.3-70b-versatile`) -> SambaNova (`Meta-Llama-3.3-70B-Instruct`) -> OpenAI (`gpt-4o-mini`) -> deterministic template fallback (`generate_fallback_data`).

### 4.2 Standalone Workflows (`ai-service/workflows/`)
- `paper_generation_workflow.py`
- `proposal_workflow.py` (`execute_proposal_flow`)
- `survey_workflow.py` (`execute_survey_flow`)
- `review_workflow.py` (`execute_review_flow`)
- `research_workflow.py` (`execute_research_flow`)

---

## 5. Database & Storage Inventory

### 5.1 MongoDB Collections (`server/src/models/`)
16 Mongoose models: `AgentRun`, `ChatSession`, `Citation`, `FactCheck`, `FormaTexMetrics`, `Gap`, `GeneratedPaper`, `Graph`, `LearningNode`, `Message`, `Note`, `Paper`, `PaperChunk`, `PlagiarismReport`, `Project`, `User`.

### 5.2 Vector, Graph, and Cache Stores
- **Qdrant (`research_chunks`)**: Stores chunk embeddings + payloads (`project_id`, `paper_id`, `page_number`, `text_content`). Default dimension `VECTOR_DIMENSION` is `3072` if Gemini key present else `384`.
- **Neo4j**: Stores paper and entity relationships; falls back to NetworkX on connection error.
- **Redis / BullMQ**: Used only on Express (`pdfWorker`, `graphWorker`). Not imported or used for mutex locking in `ai-service/`.

---

## 6. External Integrations

- **LLMs & Multimodal APIs**: Google Gemini (`google-genai`), Groq, SambaNova, OpenAI, Mistral (OCR/Embeddings), Cohere (Embeddings).
- **Scholarly Metadata APIs**: OpenAlex, arXiv, CrossRef (`ai-service/services/academic_service.py` and `server/src/utils/plagiarismEngine.ts`).
- **LaTeX Compilation**: FormaTeX remote API (`https://api.formatex.io/api/v1`).

---

## 7. Baseline Test & Verification Results

Executed cleanly before any modifications:
- **`server` TypeScript (`cd server && npx tsc --noEmit`)**: **PASS** (exit code 0).
- **`client` TypeScript (`cd client && npx tsc --noEmit`)**: **PASS** (exit code 0).
- **`server` Jest (`npm test`)**: **FAIL / BLOCKED IN SANDBOX** — runs compiled `dist/tests/project.test.js`, which imports `server.ts` -> `start()` -> `connectDB()`, failing on MongoDB Atlas SRV DNS resolution inside sandbox. Also only checks 1 mock test file (`project.test.ts`).
- **`ai-service` pytest (`python -m pytest`)**: **UNAVAILABLE** — `pytest` module not installed in `C:\Python312\python.exe` (`unittest` is available in stdlib).
- **`ai-service` FastAPI `TestClient(app)`**: **HUNG IN WINDOWS SANDBOX** (likely `anyio` socketpair restriction).
- **`ai-service` Direct Python Smoke Test**: **PASS** — `main.home()` returned `{'service': 'ResearcherGPT AI Engine', 'status': 'active'}` and `main.process_pdf(...)` on nonexistent `'invalid.pdf'` returned `{'success': False, 'error': '404: PDF file not found at path: invalid.pdf'}` after clean Qdrant/Neo4j in-memory fallbacks.
- **Local LaTeX Tooling**: **NOT IN PATH** — `pdflatex`, `bibtex`, `xelatex`, `lualatex` not found via `Get-Command`.

---

## 8. Environment Variables & Startup Instructions

Documented variables (values kept private in local `.env` files, never committed):
- Root / Server (`.env.example`): `PORT`, `MONGO_URI`, `REDIS_HOST`, `REDIS_PORT`, `AI_SERVICE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `OPENAI_API_KEY`, `NODE_ENV`, plus client `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- AI Service (`ai-service/.env.example` & `docker-compose.yml`): `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `SAMBANOVA_API_KEY`, `MISTRAL_API_KEY`, `COHERE_API_KEY`, `OPENAI_API_KEY`, `QDRANT_HOST`, `QDRANT_PORT`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `EXPRESS_API_URL`, `FORMATEX_API_KEY`.

**Startup:** `docker-compose up --build` for full stack, or run `server` (`npm run dev`), `ai-service` (`uvicorn main:app --port 8000`), and `client` (`npm run dev`) independently.

---

## 9. Known Baseline Bugs, Security Risks, and Scientific Discrepancies

1. **CR-1 Corpus-Narrowed BM25 (`ai-service/rag/hybrid_retriever.py`)**: `retrieve_hybrid` runs `bm25_search(vector_res, query)` over only the top-`2k` dense results instead of the project corpus, preventing lexical-only matches from entering RRF. Additionally, `bm25_search` mixes substring checks (`term in text`) for DF with word token counts for TF, and `reciprocal_rank_fusion` keys on `chunk_index` which `qdrant_service.search_relevant_chunks` does not return.
2. **Incompatible Embedding Space Mixing (`ai-service/services/qdrant_service.py`)**: Fallbacks across Gemini (`3072d`), Mistral, Cohere, and SHA-256 random noise (`get_fast_fallback_embedding`) zero-pad or truncate mismatched dimensions into the same Qdrant collection. `get_local_model()` (`all-MiniLM-L6-v2`) is defined but never called. `ensure_collection` deletes the entire `research_chunks` collection if dimension mismatches.
3. **LLM Model Registry & Verification Mismatches (`ai-service/agents/router.py`)**: `GEMINI_MODEL` defaults to `"gemini-3.6-flash"`; `qa_node` returns `generate_fallback_data("qa", ...)`; `fact_verification_node` runs *before* `writer_node` rather than verifying and revising claims post-draft; `ai-service/agents/verification/` helpers are not wired into `workflow`.
4. **Disconnected & Partially Wired Plagiarism Subsystems**:
   - `server/src/utils/plagiarismEngine.ts`: `winnowingFingerprint()` is defined but never called; `sourceHierarchies`, `sourceFormulas`, and `sourceCodeBlocks` remain empty `[]` in `runPlagiarismDetection()`, so `structureScore`, `formulaScore`, and `codeScore` always evaluate to `0`.
   - `ai-service/plagiarism/plagiarism_report_generator.py` uses a different output schema (`similarityPercentage`, `riskScore`) than Express (`overallScore`, `exactMatchScore`, etc.).
5. **PDF Extraction Limitations (`ai-service/utils/pdf_processor.py`)**: Uses PyMuPDF `get_text()` (not `pdfplumber`), skips OCR unless page character count `< 10`, and hardcodes `"tables": []`.
6. **Hardcoded Secret & Auth Bypass**:
   - `ai-service/services/formatex_service.py` line 14 contains a hardcoded default string literal for `API_KEY` fallback.
   - `server/src/middlewares/auth.middleware.ts` and `server/src/server.ts` attach a mock user (`clerk_user_id_123`) whenever auth headers are missing or invalid.

---

## 10. Backward Compatibility Contract

All future changes MUST preserve:
- Every Express REST path and HTTP method listed in Section 3.1.
- Existing Mongoose collection names and response fields used by frontend pages.
- All FastAPI endpoints (`/api/pdf/process`, `/api/graph/generate`, `/api/chat/stream`, `/api/agent/run`, `/api/comparison/matrix`, `/api/formatex/*`).
- Function signatures of `retrieve_hybrid`, `process_pdf`, and `runPlagiarismDetection` (new capabilities must use optional/default arguments or additive metadata fields).
