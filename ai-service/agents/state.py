from typing import TypedDict, List, Dict, Any

class AgentWorkflowState(TypedDict):
    project_id: str
    run_id: str
    query: str
    format: str
    pages: int

    
    # Retrieved chunks from vector search
    research_context: List[Dict[str, Any]]
    
    # Structured literature summaries (Author, Method, Dataset, Results, Limitations)
    literature_reviews: List[Dict[str, Any]]
    
    # Expanded properties for the 13-agent workflow
    methodologies: List[Dict[str, Any]]
    comparison_matrix: List[Dict[str, Any]]
    trends: List[Dict[str, Any]]
    contradictions: List[Dict[str, Any]]
    critique: str
    
    # Discovered research gaps (Future work, dataset limitations)
    research_gaps: List[Dict[str, Any]]
    
    # Formatted bibliography citations
    citations: List[Dict[str, Any]]
    
    # Fact checking claims and page verifications
    fact_checks: List[Dict[str, Any]]
    
    # Generated manuscript sections
    paper_sections: List[Dict[str, Any]]
    
    # Final response markdown/content
    final_output: Dict[str, Any]
    
    # Logs/Progress
    current_agent: str
    logs: List[str]
