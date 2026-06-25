from typing import Dict, Any, List
import requests
import os
from rag.hybrid_retriever import retrieve_hybrid
from agents.literature.literature_synthesizer import synthesize_literature

EXPRESS_API_URL = os.getenv("EXPRESS_API_URL", "http://localhost:5000")

def execute_research_flow(project_id: str, query: str) -> Dict[str, Any]:
    """
    RAG Research workflow: executes hybrid searches and synthesizes literature.
    """
    # 1. Fetch relevant vector chunks
    chunks = retrieve_hybrid(project_id, query, limit=5)
    
    # 2. Fetch processed papers from MongoDB via API Gateway
    try:
        res = requests.get(f"{EXPRESS_API_URL}/api/papers?projectId={project_id}", timeout=5)
        papers = res.json() if res.status_code == 200 else []
    except Exception as e:
        print(f"[ResearchFlow] Express connection failed: {e}")
        papers = []

    # 3. Synthesize Literature Review
    reviews = synthesize_literature(papers)
    
    return {
        "query": query,
        "chunks": chunks,
        "reviews": reviews
    }
