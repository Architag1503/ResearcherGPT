# API Reference Documentation

This document lists all active endpoints exposed by the backend services.

## Express Backend Gateway (Port 5000)

All gateway routes are prefixed with `/api`.

### Projects
* **POST `/projects`:** Creates a new project workspace.
* **GET `/projects`:** Lists user project workspaces.
* **GET `/projects/:projectId`:** Fetches specific project configurations.
* **DELETE `/projects/:projectId`:** Deletes a project workspace and all uploaded papers.
* **POST `/projects/:projectId/graph`:** Triggers async knowledge graph generation.
* **GET `/projects/:projectId/gaps`:** Fetches mined research gaps for the project.
* **GET `/projects/:projectId/fact-checks`:** Fetches fact check claims records.
* **GET `/projects/:projectId/plagiarism-reports`:** Fetches plagiarism audits.
* **GET `/projects/:projectId/generated-papers`:** Fetches generated proposals, survey papers, or draft manuscripts.

### Papers & PDF processing
* **GET `/papers?projectId=...`:** Lists all papers uploaded to a project.
* **POST `/papers/upload`:** Uploads a PDF manuscript, queueing it for text extraction and vector embedding.
* **DELETE `/papers/:paperId`:** Deletes a paper.

### Agent runs
* **POST `/agents/run`:** Triggers multi-agent workflows. Accepts body parameter `workflowType` ('paper', 'proposal', 'survey', 'review').
* **GET `/agents?projectId=...`:** Lists execution histories.
* **GET `/agents/:runId`:** Checks step-by-step logs and status.

---

## FastAPI AI Engine Service (Port 8000)

* **POST `/api/pdf/process`:** Chunks PDF text and creates vector mappings.
* **POST `/api/graph/generate`:** Returns nodes and links mapping relations.
* **POST `/api/chat/stream`:** Streams SSE (Server-Sent Events) tokens for the RAG chatbot.
* **POST `/api/agent/run`:** Triggers background LangGraph pipelines.
* **POST `/api/comparison/matrix`:** Compiles comparison tables across specified papers.
