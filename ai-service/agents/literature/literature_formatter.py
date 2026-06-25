from typing import List, Dict, Any

def format_review_chronological(items: List[Dict[str, Any]]) -> str:
    sorted_items = sorted(items, key=lambda x: x.get("year", 2024))
    lines = ["# Chronological Literature Review\n"]
    for idx, item in enumerate(sorted_items):
        auth_str = ", ".join(item.get("authors", [])) or "Unknown"
        lines.append(
            f"### {idx+1}. {item.get('title')} ({item.get('year')})\n"
            f"**Authors:** {auth_str}\n"
            f"**Venue:** {item.get('venue')}\n"
            f"**Methodology:** Implements {', '.join(item.get('models', []))} on {', '.join(item.get('datasets', []))}.\n"
            f"**Boundaries:** {'; '.join(item.get('limitations', []))}\n"
        )
    return "\n".join(lines)

def format_review_methodology(items: List[Dict[str, Any]]) -> str:
    lines = ["# Methodological Framework Analysis\n"]
    for item in items:
        lines.append(
            f"### [{item.get('year')}] {item.get('title')}\n"
            f"- **Primary Models:** {', '.join(item.get('models', [])) or 'None specified'}\n"
            f"- **Validation Metrics:** {', '.join(item.get('metrics', []))}\n"
            f"- **Experimental Parameters:** {item.get('parameters', {})}\n"
        )
    return "\n".join(lines)

def format_review_dataset(items: List[Dict[str, Any]]) -> str:
    lines = ["# Dataset Evaluation Mapping\n"]
    for item in items:
        lines.append(
            f"### [{item.get('year')}] {item.get('title')}\n"
            f"- **Target Datasets:** {', '.join(item.get('datasets', [])) or 'Custom collection'}\n"
            f"- **Extracted Metrics:** {', '.join(item.get('metrics', []))}\n"
        )
    return "\n".join(lines)

def format_review_gaps(items: List[Dict[str, Any]]) -> str:
    lines = ["# Critical Review & Open Limitations\n"]
    for item in items:
        limits = item.get("limitations", [])
        if limits:
            lines.append(
                f"### {item.get('title')} ({item.get('year')})\n"
                f"**Extracted Gaps & Constraints:**\n" + 
                "\n".join([f"- {limit}" for limit in limits]) + "\n"
            )
    return "\n".join(lines)
