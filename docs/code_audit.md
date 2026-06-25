# Code Audit - ResearcherGPT Platform

This audit reviews all existing files in `client/`, `server/`, and `ai-service/` to determine their implementation completeness and identify issues.

---

## 1. Backend Gateway (`server/`)

| File Name | Current Status | Issues | Required Fixes |
|---|---|---|---|
| `server.ts` | Fully Implemented | None. | N/A |
| `config/db.ts` & `redis.ts` | Fully Implemented | None. | N/A |
| `models/` (User, Project, Paper, Note, Citation, etc.) | Fully Implemented | None. | N/A |
| `controllers/` (project, paper, chat, citation, note, agent, comparison) | Fully Implemented | None. | N/A |
| `routes/` (index, project, paper, chat, citation, note, agent, comparison) | Fully Implemented | None. | N/A |
| `middlewares/auth.middleware.ts` & `role.middleware.ts` | Fully Implemented | None. | N/A |
| `validators/` (project, paper, note, citation, chat) | Fully Implemented | None. | N/A |
| `utils/` (logger, metrics, errorHandler) | Fully Implemented | None. | N/A |
| `workers/` (pdfWorker, graphWorker) | Fully Implemented | None. | N/A |

---

## 2. Python AI Service (`ai-service/`)

| File Name | Current Status | Issues | Required Fixes |
|---|---|---|---|
| `main.py` | Partially Implemented | Contains JS syntax bugs `json.stringify` (lines 118, 133); comparative matrix uses hardcoded mock rows. | Replace `json.stringify` with `json.dumps`; connect `/api/comparison/matrix` to real metadata extraction. |
| `utils/pdf_processor.py` | Fully Implemented | Text and table extraction is functional. | N/A |
| `services/qdrant_service.py` | Fully Implemented | Features sentence-transformers indexers and fallbacks. | N/A |
| `services/graph_service.py` | Partially Implemented | Graph node coloring and NetworkX layout are functional, but entity extraction is heuristic-based. | Update with real LLM entity categorizer. |
| `rag/` (retriever, hybrid_retriever, reranker, query_expander, context_builder, prompt_builder) | Partially Implemented | Reranking and query expansion use simple dictionaries and similarity fallbacks. | Implement proper query expansions and cross-encoder prediction loads. |
| `agents/` (literature, gap, verification, citations, writer, proposal, reviewer, survey) | Placeholder / skeletal | Code contains heuristic fallbacks, hardcoded string responses, and mock confidence ratings. | Re-write every agent using real Gemini completions and parser mappings. |
| `workflows/` (paper_generation, proposal, research, review, survey) | Skeletal | Workflows wrap sequential steps but bypass LangGraph state machine validations. | Integrate actual state mappings inside `router.py`. |

---

## 3. React Frontend Client (`client/`)

| File Name | Current Status | Issues | Required Fixes |
|---|---|---|---|
| `app/page.tsx` & `dashboard/page.tsx` | Fully Implemented | Dashboards use local mockup states when backend is offline. | N/A |
| `app/projects/[projectId]/page.tsx` | Fully Implemented | Tab layout is fully integrated. | N/A |
| `app/` (literature-review, comparison, gap-analysis, citations, paper-generator, plagiarism, proposal-generator, review-agent, survey-generator) | Partially Implemented / skeletal | Dedicated route files load mock visual states rather than querying Zustand store operations. | Connect stores (`useProjectStore`, `useChatStore`, etc.) to trigger state changes. |
| `store/` (projectStore, chatStore, citationStore, graphStore, agentStore) | Fully Implemented | Stores are mapped to services. | N/A |
| `services/` (project, paper, chat, agent, citation, graph) | Fully Implemented | Services map Axios endpoints. | N/A |
