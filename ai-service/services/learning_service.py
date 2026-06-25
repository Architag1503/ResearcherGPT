import json
from typing import Dict, Any, List
from agents.router import call_llm

def parse_json_safely(text: str) -> Any:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    return json.loads(cleaned)

def generate_learning_node_details(
    project_id: str,
    node_id: str,
    label: str,
    node_type: str,
    context_papers: List[Dict[str, Any]],
    connected_nodes: List[Dict[str, Any]],
    connected_links: List[Dict[str, Any]]
) -> Dict[str, Any]:
    # format papers context
    papers_context_str = ""
    for idx, paper in enumerate(context_papers):
        papers_context_str += f"--- Paper {idx+1} ---\n"
        papers_context_str += f"Title: {paper.get('title', 'Unknown')}\n"
        papers_context_str += f"Authors: {', '.join(paper.get('authors', []))}\n"
        papers_context_str += f"Abstract: {paper.get('abstract', 'No abstract')}\n"
        if paper.get('content'):
            papers_context_str += f"Content snippet: {paper.get('content')[:1200]}...\n"
        papers_context_str += "\n"

    # format connected nodes
    connections_str = ""
    for link in connected_links:
        src = next((n["label"] for n in connected_nodes if n["id"] == link["source"]), label if link["source"] == node_id else "Unknown")
        tgt = next((n["label"] for n in connected_nodes if n["id"] == link["target"]), label if link["target"] == node_id else "Unknown")
        connections_str += f"- Node '{src}' is connected to Node '{tgt}' via relation: '{link['label']}'\n"

    system_prompt = (
        "You are an expert Academic Tutor and Research Knowledge Graph Analyzer.\n"
        "Your goal is to explain nodes in a research knowledge graph to make them educational, actionable, and easy for college students to understand.\n"
        "You must output ONLY a valid JSON object. Do not include any explanation outside the JSON. Do not wrap in markdown block wrappers unless it's the raw string."
    )

    user_prompt = f"""
We are generating educational content for the following node in our research project knowledge graph:
- Node Label: {label}
- Node Type: {node_type} (options: paper, author, method, dataset)
- Node ID: {node_id}

Project Context Papers (extracted from user uploaded literature):
{papers_context_str}

Direct Relationships in Graph:
{connections_str}

You must construct a complete educational payload.
Depending on the node type '{node_type}', format the JSON with the following keys and structures:

UNIVERSAL KEYS (Required for all node types):
- "explanations": An object with "beginner" (simple analogy / layperson explanation), "intermediate" (more technical, basic academic concepts), and "research" (academic / math formulation details) explanations.
- "why_seeing_this": Explain why this node is relevant to the student's project and research context (e.g. connections, search topics).
- "connections": An object with:
  - "direct": list of direct connected node labels.
  - "indirect": list of suggested indirect connected node labels (1 hop away).
  - "most_important": list of key nodes this is connected to.
  - "explanation": string explaining WHY this node is connected to them in the context of the papers (e.g. 'Paper A uses Method B to solve problem C').

NODE TYPE SPECIFIC KEYS ("type_specific_data"):
If node_type is "paper":
- "summary": one-sentence paper summary
- "problem_solved": explanation of the research gap or problem addressed
- "main_contribution": what this paper introduces (algorithm, dataset, evaluation, framework)
- "methods_used": list of objects each with "name", "purpose", "why_used"
- "datasets_used": list of objects each with "name", "size" (number of samples/dimensions), "purpose"
- "results": object with "accuracy", "precision", "recall", "f1_score" (numeric/percentage or string if not applicable)
- "key_findings": list of strings (bullet points)
- "future_work": list of strings (future research opportunities)
- "student_notes": object with "important_points" (list of strings), "exam_points" (potential exam questions/topics, list of strings), "interview_points" (list of strings)
- "related_papers": object with "cited" (papers cited by it), "citing" (papers citing it), "similar" (conceptually similar papers)
- "learning_path": list of strings representing the paper steps (Problem -> Method -> Dataset -> Experiment -> Results -> Future Work)

If node_type is "author":
- "profile": object with "name", "affiliation", "domains" (list of strings)
- "expertise_areas": list of strings representing expertise cloud (e.g. NLP, Deep Learning, ML)
- "impact": object with "total_papers", "total_citations", "h_index", "i10_index"
- "top_papers": list of titles of their most influential papers
- "timeline": list of objects each with "year" (integer or string) and "focus" (research topic, e.g. "CNNs", "Transformers")
- "collaborators": list of string names of frequent collaborators
- "student_recommendations": list of strings containing advice on how to study this author's research (e.g. 'Read paper X first')
- "ask_about_author": list of string questions/answers about the author

If node_type is "method":
- "definition": simple plain language definition
- "why_exists": what problem does it solve (e.g. vanishing gradients, context limits)
- "workflow": list of strings representing the step-by-step pipeline (e.g. Input -> Embedding -> Output)
- "prerequisites": list of required background concepts (e.g. Linear Algebra, Probability)
- "difficulty": string badge ("Beginner" | "Intermediate" | "Advanced" | "Research")
- "advantages": list of strings
- "limitations": list of strings
- "applications": list of real-world products using this (e.g. ChatGPT, Google Translate)
- "papers_using": list of research papers using this method
- "resources": object with "beginner" (list of video/article resources), "intermediate" (list of resources), "advanced" (list of resources)
- "ai_tutor": object with "five_minutes" (concise 5-minute explanation script) and "from_scratch" (from scratch conceptual breakdown script)

If node_type is "dataset":
- "overview": object with "name", "domain", "purpose"
- "statistics": object with "samples", "classes", "features", "labels" (detailed count/metrics)
- "data_types": list of data modalities (e.g. Text, Images, Multimodal)
- "sample_records": list of objects/rows representing sample columns & data entries
- "structure": object with "fields" (list of schema columns) and "schema" (description of layout)
- "papers_using": list of research papers using/evaluating on this dataset
- "methods_using": list of methods commonly evaluated on this dataset
- "download_options": list of download links or instructions
- "strengths": list of strings
- "weaknesses": list of strings
- "insights": object with "why_use" (string), "tasks" (list of tasks that can be performed), "projects" (list of student projects that can be built using it)

LEARNING ASSETS KEYS ("learning_assets"):
Generate the following learning assets for this node:
- "summary": comprehensive summary of the node
- "notes": comprehensive student study notes
- "flashcards": list of objects with "question" and "answer" (at least 3 cards)
- "quiz_questions": list of objects with "question", "options" (list of strings), "answer" (correct option letter/text), "explanation" (at least 3 questions)
- "mcqs": list of objects with "question", "options" (list of 4 strings), "answer", "explanation" (at least 3 MCQs)
- "viva_questions": list of objects with "question" and "answer" (potential oral exam prep, at least 3)
- "interview_questions": list of objects with "question" and "answer" (relevant technical interview prep, at least 3)
- "revision_notes": quick summary cheat sheet for revision before exams

Ensure all sections are completely filled out. Be verbose, accurate, and pedagogical in your responses. Base the content on the project context papers provided if they are relevant, otherwise supply general research/domain knowledge.

Generate the JSON payload now:
"""

    response_text = call_llm(system_prompt, user_prompt)
    try:
        parsed_data = parse_json_safely(response_text)
        return {
            "success": True,
            "explanations": parsed_data.get("explanations"),
            "why_seeing_this": parsed_data.get("why_seeing_this"),
            "connections": parsed_data.get("connections"),
            "type_specific_data": parsed_data.get("type_specific_data"),
            "learning_assets": parsed_data.get("learning_assets")
        }
    except Exception as e:
        print(f"[LearningService] JSON parse failure: {e}. Raw response: {response_text[:300]}")
        # fallback payload
        return {
            "success": False,
            "error": f"Failed to parse LLM JSON response: {str(e)}",
            "raw_text": response_text
        }

def answer_learning_node_question(
    label: str,
    node_type: str,
    question: str,
    node_details: Dict[str, Any]
) -> str:
    system_prompt = (
        "You are an expert AI Tutor helping a college student understand academic research.\n"
        "You must answer their question in a clear, educational, and engaging way, tailored to their level.\n"
        "Use formatting (bolding, lists, code blocks, math) to make explanations highly readable."
    )

    user_prompt = f"""
The student is studying the following node:
- Name: {label}
- Type: {node_type}
- Node Details (Explanations & Info): {json.dumps(node_details)}

Student's Question: {question}

Please answer the student's question directly and informatively:
"""
    return call_llm(system_prompt, user_prompt)
