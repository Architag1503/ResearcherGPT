from typing import List, Dict, Any

def build_references_section(citations: List[Dict[str, Any]], style: str = "apa") -> str:
    """
    Assembles a formatted 'References' section block from list citations.
    """
    if not citations:
        return "No references found in bibliography."

    lines = []
    for idx, c in enumerate(citations):
        style_data = c.get("styles", {})
        ref_text = style_data.get(style) or c.get("apa") or f"Reference Key: {c.get('key')}"
        
        if style == "ieee":
            lines.append(ref_text)
        else:
            lines.append(f"- {ref_text}")

    return "\n".join(lines)
