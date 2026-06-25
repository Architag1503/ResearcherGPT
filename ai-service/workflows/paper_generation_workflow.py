import os
import requests
from typing import Dict, Any, List
from agents.writer.outline_generator import generate_outline
from agents.writer.abstract_writer import write_abstract
from agents.writer.introduction_writer import write_introduction
from agents.writer.literature_writer import write_literature_review
from agents.writer.methodology_writer import write_methodology
from agents.writer.results_writer import write_results
from agents.writer.discussion_writer import write_discussion
from agents.writer.conclusion_writer import write_conclusion
from agents.writer.reference_builder import build_references_section
from plagiarism.plagiarism_report_generator import generate_plagiarism_report

EXPRESS_API_URL = os.getenv("EXPRESS_API_URL", "http://localhost:5000")

def execute_paper_generation_flow(project_id: str, query: str) -> Dict[str, Any]:
    """
    Paper generation workflow: drafts paper outlines, sections, formats bibliographies,
    runs plagiarism audits, and saves the output in MongoDB.
    """
    # 1. Fetch papers from project to compile text contexts
    try:
        res = requests.get(f"{EXPRESS_API_URL}/api/papers?projectId={project_id}", timeout=5)
        papers = res.json() if res.status_code == 200 else []
    except:
        papers = []

    context_str = " ".join([p.get("abstract", "") for p in papers])
    
    # 2. Outline
    outline = generate_outline(query, context_str)
    
    # 3. Draft Sections
    abstract = write_abstract(query, context_str)
    intro = write_introduction(query, context_str)
    
    reviews = []
    for p in papers:
        reviews.append({
            "author": p.get("authors", ["Author"])[0] if p.get("authors") else "Author",
            "year": p.get("year", 2024),
            "method": p.get("title", "")
        })
    lit_review = write_literature_review(query, reviews)
    methodology = write_methodology(query, context_str)
    results = write_results(query, context_str)
    discussion = write_discussion(query, [])
    conclusion = write_conclusion(query, context_str)
    
    # Fetch citations to compile references section
    try:
        cite_res = requests.get(f"{EXPRESS_API_URL}/api/citations?projectId={project_id}", timeout=5)
        citations = cite_res.json() if cite_res.status_code == 200 else []
    except:
        citations = []
        
    ref_block = build_references_section(citations)

    # 4. Formulate final section mapping
    sections = [
        {"title": "Abstract", "heading": "Abstract", "content": abstract},
        {"title": "Introduction", "heading": "1. Introduction", "content": intro},
        {"title": "Literature Review", "heading": "2. Literature Review", "content": lit_review},
        {"title": "Methodology", "heading": "3. Methodology & Design", "content": methodology},
        {"title": "Results", "heading": "4. Experimental Results", "content": results},
        {"title": "Discussion", "heading": "5. Discussion & Future Scope", "content": discussion},
        {"title": "Conclusion", "heading": "6. Conclusion", "content": conclusion},
        {"title": "References", "heading": "References", "content": ref_block}
    ]

    full_paper_text = "\n\n".join([f"{s['heading']}\n{s['content']}" for s in sections])

    # 5. Run Plagiarism Check
    plag_report = generate_plagiarism_report(project_id, full_paper_text, papers)

    return {
        "title": f"Optimizing Research: {query}",
        "outline": outline,
        "sections": sections,
        "plagiarismReport": plag_report
    }
