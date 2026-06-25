from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_home_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"service": "ResearcherGPT AI Engine", "status": "active"}

def test_pdf_processing_validation():
    # Attempt processing on non-existent file
    payload = {
        "paper_id": "mock_paper_id",
        "project_id": "mock_project_id",
        "file_path": "invalid_path.pdf"
    }
    response = client.post("/api/pdf/process", json=payload)
    # The API catches file checks and returns fail status
    assert response.status_code == 404 or response.json()["success"] == False

def test_chat_streaming():
    payload = {
        "query": "What is multi-agent RAG?",
        "project_id": "mock_project_id",
        "session_id": "mock_session_id"
    }
    response = client.post("/api/chat/stream", json=payload)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
