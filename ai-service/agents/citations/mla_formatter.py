from typing import Dict, Any

def format_mla(meta: Dict[str, Any]) -> str:
    """
    Format metadata dictionary into MLA reference style.
    """
    authors = meta.get("authors", [])
    if not authors:
        author_str = "Unknown Author"
    elif len(authors) == 1:
        author_str = authors[0]
    elif len(authors) == 2:
        author_str = f"{authors[0]}, and {authors[1]}"
    else:
        author_str = f"{authors[0]}, et al."

    title = f'"{meta.get("title", "Untitled Work")}."'
    journal = f" *{meta.get('journal')}*" if meta.get("journal") else ""
    volume = f", vol. {meta.get('volume')}" if meta.get("volume") else ""
    number = f", no. {meta.get('issue')}" if meta.get("issue") else ""
    year = f", {meta.get('year')}" if meta.get("year") else ""
    pages = f", pp. {meta.get('pages')}" if meta.get("pages") else ""
    return f"{author_str}. {title}{journal}{volume}{number}{year}{pages}."

G = format_mla # alias export
