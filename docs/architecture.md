# ResearcherGPT System Architecture (Verified)

## 1. Deployment Topology

As configured in [docker-compose.yml](file:///a:/Antigravity/ResearcherGPT/docker-compose.yml), ResearcherGPT runs as a seven-container microservice stack:

1. **Client Tier (`client/`, Next.js 15, Port 3000)**: React/Zustand workspace exposing interactive project views (`/projects/[projectId]`), citation search (`/citations`), comparison tables (`/comparison`), gap inspection (`/gap-analysis`), literature synthesis (`/literature-review`), plagiarism audit (`/plagiarism`), and manuscript/proposal/survey/review generation UIs.
2. **Gateway & Worker Tier (`server/`, Node.js/Express + TypeScript, Port 5000)**:
   - Exposes REST routes under `/api` (`/projects`, `/papers`, `/notes`, `/citations`, `/chat`, `/agents`, `/comparison`, `/dashboard`, `/formatex`).
   - Enqueues background document parsing and knowledge graph jobs into Redis (`redis:7.0-alpine`, Port 6379) via BullMQ (`pdfWorker.ts`, `graphWorker.ts`).
   - Runs the TypeScript 11-phase academic integrity engine (`server/src/utils/plagiarismEngine.ts`) and OpenAlex source discovery.
3. **Persistence Stores**:
   - **MongoDB 6.0 (Port 27017)**: Stores 16 Mongoose collections (`AgentRun`, `ChatSession`, `Citation`, `FactCheck`, `FormaTexMetrics`, `Gap`, `GeneratedPaper`, `Graph`, `LearningNode`, `Message`, `Note`, `Paper`, `PaperChunk`, `PlagiarismReport`, `Project`, `User`).
   - **Qdrant (Ports 6333/6334)**: Stores dense chunk embeddings and payload metadata (`project_id`, `paper_id`, `chunk_index`, `text_content`, `page_number`, `embedding_model`, `embedding_dim`). Falls back to an in-memory store (`fallback_store`) when Qdrant is unreachable.
   - **Neo4j 5.12 (Ports 7474/7687)**: Stores scientific entity-relation subgraphs (`paper`, `author`, `institution`, `method`, `dataset`, `concept`, `technology`, `metric`, `result`). Retains an in-memory copy in `Neo4jClient.in_memory_graphs` so graph traversal remains functional during offline/fallback runs.
4. **AI & Document Intelligence Tier (`ai-service/`, Python 3.12 + FastAPI + LangGraph, Port 8000)**:
   - PDF ingestion via PyMuPDF (`fitz`) + `pdfplumber` table extraction + multimodal vision OCR fallback for sparse pages (`<10` extracted characters).
   - Hybrid retrieval combining dense embeddings, full-corpus BM25, and Knowledge Graph signals via Reciprocal Rank Fusion (`ai-service/rag/hybrid_retriever.py`).
   - Multi-provider LLM router and compiled 13-node sequential LangGraph StateGraph (`ai-service/agents/router.py`).
   - Post-draft claim and citation verification (`ai-service/agents/verification/claim_verifier.py`) invoked inside `qa_node`.
   - Manuscript structure validation (`PaperValidator`) and remote LaTeX typesetting/compilation bridge (`FormaTeXService` -> `https://api.formatex.io/api/v1`).

## 2. Multi-Agent LangGraph Execution Flow

`agent_workflow` in [router.py](file:///a:/Antigravity/ResearcherGPT/ai-service/agents/router.py) compiles a deterministic 13-node directed acyclic linear sequence:

`planner -> retrieval -> literature_review -> methodology_extraction -> comparison -> trend_analysis -> gap_analysis -> contradiction -> citation_verification -> fact_verification -> reviewer -> writer -> quality_assurance -> END`

- All 13 keys in `MODEL_REGISTRY` default to `groq/llama-3.3-70b-versatile`, cascading on failure through Gemini (`GEMINI_MODEL` default `gemini-2.5-flash`), Groq, SambaNova (`Meta-Llama-3.3-70B-Instruct`), and OpenAI (`gpt-4o-mini`), and returning deterministic structured templates if all APIs are unavailable.
- Separate single-purpose workflows (`proposal_workflow.py`, `survey_workflow.py`, `review_workflow.py`, `research_workflow.py`) remain exposed for lightweight endpoint execution.
