import os
import json
from typing import Dict, Any
from agents.router import call_llm

def generate_research_proposal(query: str, context: str) -> Dict[str, Any]:
    """
    Generates a structured research proposal from a given topic and context.
    """
    proposal = {
        "title": f"Research Proposal: {query}",
        "problem_statement": "",
        "objectives": [],
        "research_questions": [],
        "methodology": "",
        "expected_outcomes": [],
        "timeline": []
    }

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = (
            "You are a Research Proposal Writer.\n"
            "Analyze the query and context, and write a detailed scientific proposal. "
            "Output as a JSON object containing keys:\n"
            "- problem_statement (string)\n"
            "- objectives (list of strings)\n"
            "- research_questions (list of strings)\n"
            "- methodology (string)\n"
            "- expected_outcomes (list of strings)\n"
            "- timeline (list of strings mapping tasks to months)"
        )
        try:
            res_text = call_llm(system, f"Topic: {query}\nContext: {context[:2500]}")
            parsed = json.loads(res_text)
            if isinstance(parsed, dict):
                proposal.update(parsed)
                return proposal
        except Exception as e:
            print(f"[ProposalGenerator] LLM proposal failed: {e}")

    # Heuristic fallback proposal
    proposal.update({
        "problem_statement": f"Current research in '{query}' is bottlenecked by a lack of coordinated, state-guided evaluations and circular references.",
        "objectives": [
            f"Establish a stateful coordination workflow to resolve query ambiguity in '{query}'.",
            "Synthesize peer validations to reduce cascading errors."
        ],
        "research_questions": [
            "How does stateful routing affect semantic precision?",
            "Can hybrid BM25 and vector fusion mitigate vocabulary mismatch?"
        ],
        "methodology": "We propose a stateful LangGraph router executing modular task agents.",
        "expected_outcomes": [
            "A consolidated academic manuscript draft.",
            "Verified claim records referencing specific page numbers."
        ],
        "timeline": [
            "Month 1-2: Literature analysis and collection setup.",
            "Month 3-4: Stateful graph workflow implementation.",
            "Month 5-6: Evaluation on benchmark datasets and writing."
        ]
    })
    return proposal
