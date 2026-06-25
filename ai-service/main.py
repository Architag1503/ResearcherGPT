import os
import json
import asyncio
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests

from utils.pdf_processor import extract_pdf_content, chunk_text
from services.qdrant_service import index_chunks, search_relevant_chunks
from services.graph_service import build_project_graph
from agents.router import agent_workflow, call_llm, report_progress
from services.learning_service import generate_learning_node_details, answer_learning_node_question
from services.formatex_service import FormaTeXService

app = FastAPI(title="ResearcherGPT AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EXPRESS_API_URL = os.getenv("EXPRESS_API_URL", "http://localhost:5000")

# Request Models
class ProcessPDFRequest(BaseModel):
    paper_id: str
    project_id: str
    file_path: str

class GenerateGraphRequest(BaseModel):
    project_id: str

class ChatStreamRequest(BaseModel):
    query: str
    project_id: str
    session_id: str

class AgentRunRequest(BaseModel):
    run_id: str
    project_id: str
    query: str
    workflow_type: str = "paper"
    format: str = "IEEE"
    pages: int = 5


class ComparisonRequest(BaseModel):
    project_id: str
    paper_ids: List[str]

@app.post("/api/pdf/process")
def process_pdf(req: ProcessPDFRequest):
    try:
        # Check if file exists on shared workspace volumes
        file_path = req.file_path
        # Fallback relative to server if folder path varies
        if not os.path.exists(file_path):
            # Try server-side directory relative lookup
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            file_path = os.path.join(base_dir, "server", req.file_path)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"PDF file not found at path: {req.file_path}")

        # 1. Parse PDF
        parsed = extract_pdf_content(file_path)
        
        # 2. Chunk Text
        chunks = chunk_text(parsed["pages"])
        
        # 3. Create Embeddings & Index in Qdrant
        indexed_chunks = index_chunks(req.project_id, req.paper_id, chunks)

        return {
            "success": True,
            "chunks": indexed_chunks,
            "metadata": parsed["metadata"]
        }
    except Exception as e:
        print(f"Error in process_pdf: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/graph/generate")
def generate_graph(req: GenerateGraphRequest):
    try:
        # Fetch papers from Express server
        res = requests.get(f"{EXPRESS_API_URL}/api/papers?projectId={req.project_id}", timeout=15)
        if res.status_code != 200:
            raise Exception("Failed to fetch papers from Express backend")
        
        papers = res.json()
        
        # Build network graph
        graph_data = build_project_graph(req.project_id, papers)
        
        return {
            "success": True,
            "nodes": graph_data["nodes"],
            "links": graph_data["links"]
        }
    except Exception as e:
        print(f"Error in generate_graph: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/chat/stream")
def chat_stream(req: ChatStreamRequest):
    # Retrieve relevant segments from Qdrant
    sources = search_relevant_chunks(req.project_id, req.query, limit=5)
    
    async def event_generator():
        # Yield sources metadata first
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        await asyncio.sleep(0.01)

        # Build prompt
        context_str = "\n\n".join([f"Source Chunk: {s['text_content']}" for s in sources])
        prompt = f"Using these context chunks:\n{context_str}\n\nAnswer the user's question: {req.query}"
        system = "You are a helpful academic RAG chatbot assistant. Synthesize a concise response backed by the contexts. Include citation keys if relevant."

        # Query LLM (either Gemini or fallback)
        # To simulate token-by-token streaming response:
        response_text = call_llm(system, prompt)
        
        # Split into small parts/words to simulate streaming over SSE
        words = response_text.split(" ")
        for word in words:
            yield f"data: {json.dumps({'type': 'token', 'token': word + ' '})}\n\n"
            await asyncio.sleep(0.03)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

def run_agent_workflow_in_background(run_id: str, project_id: str, query: str, workflow_type: str = "paper", format: str = "IEEE", pages: int = 5):
    if workflow_type == "proposal":
        report_progress(run_id, "Proposal Generation", "running", logs="Executing multi-agent proposal flow...")
        try:
            from workflows.proposal_workflow import execute_proposal_flow
            res = execute_proposal_flow(project_id, query)
            report_progress(run_id, "Proposal Generation", "completed", logs="Proposal generated successfully.", overall_status="completed", result=res["proposal"])
        except Exception as e:
            report_progress(run_id, "Proposal Generation", "failed", logs=f"Proposal flow failed: {str(e)}", overall_status="failed", result={"error": str(e)})
    elif workflow_type == "survey":
        report_progress(run_id, "Survey Generation", "running", logs="Executing multi-agent survey flow...")
        try:
            from workflows.survey_workflow import execute_survey_flow
            res = execute_survey_flow(project_id, query)
            report_progress(run_id, "Survey Generation", "completed", logs="Survey generated successfully.", overall_status="completed", result=res["survey"])
        except Exception as e:
            report_progress(run_id, "Survey Generation", "failed", logs=f"Survey flow failed: {str(e)}", overall_status="failed", result={"error": str(e)})
    elif workflow_type == "review":
        report_progress(run_id, "Reviewer Agent", "running", logs="Executing peer review agent flow...")
        try:
            from workflows.review_workflow import execute_review_flow
            # Fetch generated papers for this project to get the text to review
            paper_res = requests.get(f"{EXPRESS_API_URL}/api/projects/{project_id}/generated-papers", timeout=15)
            paper_text = ""
            if paper_res.status_code == 200 and paper_res.json():
                latest_paper = paper_res.json()[0]
                paper_text = "\n\n".join([f"{s['heading']}\n{s['content']}" for s in latest_paper.get("sections", [])])
            if not paper_text:
                paper_text = f"Manuscript draft regarding: {query}"
            
            res = execute_review_flow(paper_text, "IEEE")
            report_progress(run_id, "Reviewer Agent", "completed", logs="Review generated successfully.", overall_status="completed", result=res["review"])
        except Exception as e:
            report_progress(run_id, "Reviewer Agent", "failed", logs=f"Review flow failed: {str(e)}", overall_status="failed", result={"error": str(e)})
    else:
        # Prepare initial LangGraph state
        initial_state = {
            "project_id": project_id,
            "run_id": run_id,
            "query": query,
            "format": format,
            "pages": pages,
            "research_context": [],
            "literature_reviews": [],
            "methodologies": [],
            "comparison_matrix": [],
            "trends": [],
            "contradictions": [],
            "critique": "",
            "research_gaps": [],
            "citations": [],
            "fact_checks": [],
            "paper_sections": [],
            "final_output": {},
            "current_agent": "Research Agent",
            "logs": ["LangGraph initialized."]
        }
        
        try:
            # Run state machine sequentially
            agent_workflow.invoke(initial_state, config={"recursion_limit": 50})
        except Exception as e:
            print(f"Workflow execution failure: {e}")
            # Send failure callback to Express
            try:
                requests.post(
                    f"{EXPRESS_API_URL}/api/agents/{run_id}/step",
                    json={
                        "stepName": "Writing Agent",
                        "status": "failed",
                        "logs": f"Workflow failed: {str(e)}",
                        "overallStatus": "failed",
                        "result": {"error": str(e)}
                    },
                    timeout=30
                )
            except:
                pass

@app.post("/api/agent/run")
def trigger_agent(req: AgentRunRequest, bg_tasks: BackgroundTasks):
    # Execute workflow in background task
    bg_tasks.add_task(run_agent_workflow_in_background, req.run_id, req.project_id, req.query, req.workflow_type, req.format, req.pages)
    return {"status": "running"}

@app.post("/api/comparison/matrix")
def get_comparison_matrix(req: ComparisonRequest):
    try:
        # To construct a comparison matrix, we fetch comparative insights for the specified papers.
        # For each paper, we pull text snippets and prompt the LLM to format comparative rows.
        papers_info = []
        for p_id in req.paper_ids:
            res = requests.get(f"{EXPRESS_API_URL}/api/papers/{p_id}", timeout=15)
            if res.status_code == 200:
                papers_info.append(res.json())

        if not papers_info:
            return {
                "columns": ["Title", "Authors", "Year", "Accuracy", "Method/Models", "Dataset", "Strengths", "Weaknesses"],
                "rows": []
            }

        system = (
            "You are an Academic Literature Comparison Assistant.\n"
            "Compare the list of papers provided in the prompt. "
            "Output exactly a JSON list of objects (one for each paper) containing the keys:\n"
            "- Title (string)\n"
            "- Authors (string)\n"
            "- Year (integer/string)\n"
            "- Accuracy (string, e.g. 94.2% or N/A)\n"
            "- Method/Models (string, name of the model/algorithm used)\n"
            "- Dataset (string, evaluation datasets used)\n"
            "- Strengths (string)\n"
            "- Weaknesses (string)"
        )
        
        user_prompt = "Papers to compare:\n"
        for p in papers_info:
            user_prompt += (
                f"Paper: {p.get('title')}\n"
                f"Authors: {', '.join(p.get('authors', []))}\n"
                f"Year: {p.get('year')}\n"
                f"Abstract: {p.get('abstract', '')}\n\n"
            )
            
        res_text = call_llm(system, user_prompt)
        rows = json.loads(res_text)
        
        return {
            "columns": ["Title", "Authors", "Year", "Accuracy", "Method/Models", "Dataset", "Strengths", "Weaknesses"],
            "rows": rows
        }
    except Exception as e:
        print(f"Error in comparison matrix: {e}")
        rows = []
        for p in papers_info:
            title = p.get("title", "Unknown")
            author_str = ", ".join(p.get("authors", [])) or "N/A"
            year = p.get("year", "N/A")
            rows.append({
                "Title": title,
                "Authors": author_str,
                "Year": year,
                "Accuracy": "N/A",
                "Method/Models": "Heuristic Extraction",
                "Dataset": "N/A",
                "Strengths": "Referenced in bibliography",
                "Weaknesses": "Requires deeper PDF content parsing"
            })
        return {
            "columns": ["Title", "Authors", "Year", "Accuracy", "Method/Models", "Dataset", "Strengths", "Weaknesses"],
            "rows": rows
        }

# Graph Learning Node Models & Routes
class LearningNodeGenerateRequest(BaseModel):
    project_id: str
    node_id: str
    label: str
    node_type: str
    context_papers: List[Dict[str, Any]] = []
    connected_nodes: List[Dict[str, Any]] = []
    connected_links: List[Dict[str, Any]] = []

class LearningNodeAskRequest(BaseModel):
    project_id: str
    node_id: str
    label: str
    node_type: str
    question: str
    node_details: Dict[str, Any]

@app.post("/api/graph/learning-node")
def generate_node_learning(req: LearningNodeGenerateRequest):
    try:
        result = generate_learning_node_details(
            project_id=req.project_id,
            node_id=req.node_id,
            label=req.label,
            node_type=req.node_type,
            context_papers=req.context_papers,
            connected_nodes=req.connected_nodes,
            connected_links=req.connected_links
        )
        return result
    except Exception as e:
        print(f"Error generating learning node: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/graph/learning-node/ask")
def ask_node_learning(req: LearningNodeAskRequest):
    try:
        answer = answer_learning_node_question(
            label=req.label,
            node_type=req.node_type,
            question=req.question,
            node_details=req.node_details
        )
        return {"success": True, "answer": answer}
    except Exception as e:
        print(f"Error answering learning node question: {e}")
        return {"success": False, "error": str(e)}

class DescriptionGenerateRequest(BaseModel):
    name: str

@app.post("/api/project/generate-description")
def generate_project_description(req: DescriptionGenerateRequest):
    try:
        system = (
            "You are an Academic Workspace Description Assistant.\n"
            "Given the name of a research project, generate a concise, professional, and academically sound description of the project's scope, variables, and potential research directions. "
            "Output only the description itself in a single paragraph. Do not include any introductory phrases, bullet points, headers, or quotes. Keep it under 250 characters."
        )
        prompt = f"Generate a project description for the research project named: '{req.name}'"
        description = call_llm(system, prompt).strip()
        description = description.strip("\"'")
        return {"success": True, "description": description}
    except Exception as e:
        print(f"Error generating description: {e}")
        return {"success": False, "error": str(e)}

class GapsGenerateRequest(BaseModel):
    name: str
    description: str

@app.post("/api/project/generate-gaps")
def generate_project_gaps(req: GapsGenerateRequest):
    try:
        system = (
            "You are an Academic Research Gap Assistant.\n"
            "Given the name and description of a research project, generate 3 potential research gaps/directions. "
            "Return the result STRICTLY as a JSON array of objects. Each object MUST have the following keys:\n"
            "- 'title': A short, clear title for the research gap.\n"
            "- 'description': A detailed explanation of the limitation, future work, or gap.\n"
            "- 'category': One of: 'methodological', 'empirical', 'theoretical', 'dataset', 'other'.\n"
            "- 'impactScore': An integer between 1 and 10 representing academic impact.\n"
            "- 'feasibilityScore': An integer between 1 and 10 representing execution feasibility.\n"
            "- 'evidence': A list of string quotes/statements representing hypothetical or extracted reference points (provide 1-2 realistic academic quotes).\n"
            "Do not output markdown code blocks, XML tags, or any text other than the valid JSON array."
        )
        prompt = f"Project Name: {req.name}\nProject Description: {req.description}"
        gaps_json_str = call_llm(system, prompt).strip()
        
        # Clean potential markdown output
        if gaps_json_str.startswith("```json"):
            gaps_json_str = gaps_json_str[7:]
        elif gaps_json_str.startswith("```"):
            gaps_json_str = gaps_json_str[3:]
        if gaps_json_str.endswith("```"):
            gaps_json_str = gaps_json_str[:-3]
        gaps_json_str = gaps_json_str.strip()
        
        import json
        gaps_list = json.loads(gaps_json_str)
        if isinstance(gaps_list, dict):
            if "gaps" in gaps_list:
                gaps_list = gaps_list["gaps"]
            elif "research_gaps" in gaps_list:
                gaps_list = gaps_list["research_gaps"]
            else:
                gaps_list = [gaps_list]
        
        # Normalize categories to match mongoose enums
        for g in gaps_list:
            cat = str(g.get("category", "other")).lower().strip()
            if cat.startswith("methodolog"):
                g["category"] = "methodological"
            elif cat.startswith("theor"):
                g["category"] = "theoretical"
            elif cat.startswith("empiric"):
                g["category"] = "empirical"
            elif cat in ["dataset", "data"]:
                g["category"] = "dataset"
            else:
                g["category"] = "other"

        return {"success": True, "gaps": gaps_list}
    except Exception as e:
        print(f"Error generating gaps: {e}")
        return {"success": False, "error": str(e)}

class SingleGapGenerateRequest(BaseModel):
    name: str
    description: str

@app.post("/api/project/generate-single-gap")
def generate_project_single_gap(req: SingleGapGenerateRequest):
    try:
        system = (
            "You are an Academic Research Gap Assistant.\n"
            "Given the name and description of a research project, generate exactly ONE potential research gap/direction. "
            "Return the result STRICTLY as a JSON object with the following keys:\n"
            "- 'title': A short, clear title for the research gap.\n"
            "- 'description': A detailed explanation of the limitation, future work, or gap.\n"
            "- 'category': One of: 'methodological', 'empirical', 'theoretical', 'dataset', 'other'.\n"
            "- 'impactScore': An integer between 1 and 10 representing academic impact.\n"
            "- 'feasibilityScore': An integer between 1 and 10 representing execution feasibility.\n"
            "- 'evidence': A list of string quotes/statements representing hypothetical or extracted reference points (provide 1-2 realistic academic quotes).\n"
            "Do not output markdown code blocks, XML tags, or any text other than the valid JSON object."
        )
        prompt = f"Project Name: {req.name}\nProject Description: {req.description}"
        gap_json_str = call_llm(system, prompt).strip()
        
        # Clean potential markdown output
        if gap_json_str.startswith("```json"):
            gap_json_str = gap_json_str[7:]
        elif gap_json_str.startswith("```"):
            gap_json_str = gap_json_str[3:]
        if gap_json_str.endswith("```"):
            gap_json_str = gap_json_str[:-3]
        gap_json_str = gap_json_str.strip()
        
        import json
        gap_obj = json.loads(gap_json_str)
        # Normalize category
        cat = str(gap_obj.get("category", "other")).lower().strip()
        if cat.startswith("methodolog"):
            gap_obj["category"] = "methodological"
        elif cat.startswith("theor"):
            gap_obj["category"] = "theoretical"
        elif cat.startswith("empiric"):
            gap_obj["category"] = "empirical"
        elif cat in ["dataset", "data"]:
            gap_obj["category"] = "dataset"
        else:
            gap_obj["category"] = "other"
            
        return {"success": True, "gap": gap_obj}
    except Exception as e:
        print(f"Error generating single gap: {e}")
        return {"success": False, "error": str(e)}

# ==============================================================================
# FORMATEX API INTEGRATION ROUTES
# ==============================================================================

class FormaTexFormatRequest(BaseModel):
    manuscript: Any
    style: str

class FormaTexCompileRequest(BaseModel):
    latex: str
    engine: str = "pdflatex"

class FormaTexValidateRequest(BaseModel):
    latex: str

class FormaTexComplianceRequest(BaseModel):
    latex: str
    style: str

@app.post("/api/formatex/format")
def formatex_format(req: FormaTexFormatRequest):
    try:
        style_methods = {
            "IEEE": FormaTeXService.formatIEEE,
            "SPRINGER": FormaTeXService.formatSpringer,
            "ACM": FormaTeXService.formatACM,
            "ELSEVIER": FormaTeXService.formatElsevier,
            "HARVARD": FormaTeXService.formatHarvard,
            "APA": FormaTeXService.formatAPA
        }
        
        style_upper = req.style.upper() if isinstance(req.style, str) else "IEEE"
        style_fn = style_methods.get(style_upper, FormaTeXService.formatIEEE)
            
        latex = style_fn(req.manuscript)
        return {"success": True, "latex": latex}
    except Exception as e:
        print(f"Error in /api/formatex/format: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/formatex/compile")
def formatex_compile(req: FormaTexCompileRequest):
    try:
        pdf_bytes, errors = FormaTeXService.compile_latex(req.latex, req.engine)
        if not pdf_bytes:
            raise Exception(f"LaTeX compilation failed: {'; '.join(errors)}")
            
        # Save to uploads folder
        uploads_dir = "/usr/src/app/uploads"
        if not os.path.exists(uploads_dir):
            uploads_dir = "uploads"
            os.makedirs(uploads_dir, exist_ok=True)
            
        import uuid
        filename = f"paper_formatex_{uuid.uuid4().hex}.pdf"
        file_path = os.path.join(uploads_dir, filename)
        
        with open(file_path, "wb") as f:
            f.write(pdf_bytes)
            
        return {
            "success": True, 
            "filePath": f"uploads/{filename}",
            "errors": errors
        }
    except Exception as e:
        print(f"Error in /api/formatex/compile: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/formatex/validate")
def formatex_validate(req: FormaTexValidateRequest):
    try:
        result = FormaTeXService.validate_formatting(req.latex)
        return {"success": True, "result": result}
    except Exception as e:
        print(f"Error in /api/formatex/validate: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/formatex/compliance")
def formatex_compliance(req: FormaTexComplianceRequest):
    try:
        result = FormaTeXService.generate_compliance_report(req.latex, req.style)
        return {"success": True, "result": result}
    except Exception as e:
        print(f"Error in /api/formatex/compliance: {e}")
        return {"success": False, "error": str(e)}


class AutoCorrectRequest(BaseModel):
    html_content: str

@app.post("/api/formatex/auto-correct")
def formatex_auto_correct(req: AutoCorrectRequest):
    """
    Applies the content formatting enhancement pass directly to editor HTML content.
    Returns the corrected/formatted HTML content.
    """
    try:
        from agents.router import _enhance_sections_content
        # Wrap the flat HTML content in a single mock section
        sections = [{"title": "Content", "heading": "Content", "content": req.html_content}]
        enhanced = _enhance_sections_content(sections)
        corrected = enhanced[0]["content"] if enhanced else req.html_content
        return {"success": True, "htmlContent": corrected}
    except Exception as e:
        print(f"Error in /api/formatex/auto-correct: {e}")
        return {"success": False, "error": str(e)}

class FormaTexRepairSectionsRequest(BaseModel):
    sections: List[Dict[str, Any]]

class FormaTexRepairPaperRequest(BaseModel):
    paper_id: str
    project_id: str

@app.post("/api/formatex/repair-sections")
def formatex_repair_sections(req: FormaTexRepairSectionsRequest):
    """
    Applies the FormaTeX content enhancement pass to a list of paper sections.
    Returns the enhanced sections. Used by the frontend to re-format existing papers.
    """
    try:
        from agents.router import _enhance_sections_content
        enhanced = _enhance_sections_content(req.sections)
        return {"success": True, "sections": enhanced}
    except Exception as e:
        print(f"Error in /api/formatex/repair-sections: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/formatex/repair-paper")
def formatex_repair_paper(req: FormaTexRepairPaperRequest):
    """
    Fetches a saved paper from Express/MongoDB by paper_id, runs the FormaTeX
    content enhancement pass, and saves the enhanced sections back. 
    """
    try:
        from agents.router import _enhance_sections_content

        # Fetch the paper from Express
        paper_res = requests.get(
            f"{EXPRESS_API_URL}/api/projects/{req.project_id}/generated-papers",
            timeout=15
        )
        if paper_res.status_code != 200:
            return {"success": False, "error": f"Failed to fetch papers: {paper_res.status_code}"}

        papers = paper_res.json()
        target = next((p for p in papers if str(p.get("_id")) == req.paper_id), None)
        if not target:
            return {"success": False, "error": f"Paper {req.paper_id} not found"}

        sections = target.get("sections", [])
        if not sections:
            return {"success": False, "error": "Paper has no sections to repair"}

        # Run enhancement pass
        enhanced_sections = _enhance_sections_content(sections)

        # Save back to Express
        save_res = requests.put(
            f"{EXPRESS_API_URL}/api/projects/{req.project_id}/generated-papers",
            json={
                "paperId": req.paper_id,
                "sections": enhanced_sections,
                "title": target.get("title"),
                "references": target.get("references", []),
                "outline": target.get("outline", [])
            },
            timeout=30
        )

        if save_res.status_code != 200:
            return {"success": False, "error": f"Failed to save repaired paper: {save_res.status_code}"}

        return {
            "success": True,
            "paperId": req.paper_id,
            "sectionsEnhanced": len(enhanced_sections),
            "message": "Paper content successfully enhanced with FormaTeX."
        }
    except Exception as e:
        print(f"Error in /api/formatex/repair-paper: {e}")
        return {"success": False, "error": str(e)}


@app.get("/")
def home():
    return {"service": "ResearcherGPT AI Engine", "status": "active"}
