import os
import requests
from typing import Dict, Any
from agents.proposal.proposal_generator import generate_research_proposal

EXPRESS_API_URL = os.getenv("EXPRESS_API_URL", "http://localhost:5000")

def execute_proposal_flow(project_id: str, query: str) -> Dict[str, Any]:
    """
    Research proposal workflow: compiles structured proposal layouts.
    """
    try:
        res = requests.get(f"{EXPRESS_API_URL}/api/papers?projectId={project_id}", timeout=5)
        papers = res.json() if res.status_code == 200 else []
    except:
        papers = []
        
    context_str = " ".join([p.get("abstract", "") for p in papers])
    proposal = generate_research_proposal(query, context_str)
    
    return {
        "proposal": proposal
    }

G = execute_proposal_flow # alias export
