from typing import List, Dict, Any
from .taxonomy_builder import build_taxonomy
from .theme_cluster import cluster_themes
from .survey_formatter import format_survey_paper

def generate_survey(query: str, papers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Orchestrates the taxonomy extraction and thematic mapping to build a survey manuscript.
    """
    taxonomy = build_taxonomy(papers)
    themes = cluster_themes(papers)
    survey_text = format_survey_paper(query, taxonomy, themes)
    
    return {
        "title": f"A Comprehensive Survey on {query}",
        "taxonomy": taxonomy,
        "themes": themes,
        "content": survey_text
    }
