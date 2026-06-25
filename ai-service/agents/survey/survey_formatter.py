from typing import List, Dict, Any

def format_survey_paper(
    query: str,
    taxonomy: Dict[str, Any],
    themes: List[Dict[str, Any]]
) -> str:
    """
    Compiles taxonomy and clustered themes into a cohesive academic Survey report.
    """
    lines = [
        f"# A Comprehensive Survey on {query}\n",
        "## Abstract",
        "This survey provides a structured classification of modern literature. "
        "We establish a hierarchical taxonomy mapping key papers, followed by "
        "an evaluation of critical research paradigms and future scope.",
        "\n## 1. Taxonomy of the Field",
        "We classify the target literature into the following hierarchical categories:\n"
    ]

    # Simple taxonomy printer
    def print_tax(node, indent=0):
        prefix = "  " * indent + "- "
        lines.append(f"{prefix}**{node.get('category_name')}**")
        for p in node.get("papers", []):
            lines.append("  " * (indent + 1) + f"- Paper: *{p}*")
        for sub in node.get("subcategories", []):
            print_tax(sub, indent + 1)

    print_tax(taxonomy)

    lines.append("\n## 2. Emerging Thematic Paradigms")
    for t in themes:
        lines.append(
            f"### {t.get('theme')}\n"
            f"**Description:** {t.get('description')}\n"
            f"**Core Papers:** {', '.join(t.get('papers', []))}\n"
        )

    return "\n".join(lines)
