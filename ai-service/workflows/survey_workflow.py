import os
import requests
from typing import Dict, Any
from agents.survey.survey_generator import generate_survey

EXPRESS_API_URL = os.getenv("EXPRESS_API_URL", "http://localhost:5000")

def execute_survey_flow(project_id: str, query: str) -> Dict[str, Any]:
    """
    Survey workflow: generates taxonomy classifications and survey drafts.
    """
    try:
        res = requests.get(f"{EXPRESS_API_URL}/api/papers?projectId={project_id}", timeout=5)
        papers = res.json() if res.status_code == 200 else []
    except:
        papers = []
        
    survey = generate_survey(query, papers)
    return {
        "survey": survey
    }

G = execute_survey_flow # alias export
