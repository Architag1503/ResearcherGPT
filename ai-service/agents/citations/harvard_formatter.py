from typing import Dict, Any

def format_harvard(meta: Dict[str, Any]) -> str:
    """
    Format metadata dictionary into Harvard reference style.
    """
    authors = meta.get("authors", [])
    if not authors:
        author_str = "Unknown Author"
    elif len(authors) == 1:
        author_str = authors[0]
    elif len(authors) == 2:
        author_str = f"{authors[0]} and {authors[1]}"
    else:
        author_str = f"{authors[0]} et al."

    year = f"{meta.get('year')}" if meta.get("year") else "n.d."
    title = f"'{meta.get('title', 'Untitled Work')}'"
    journal = f" *{meta.get('journal')}*" if meta.get("journal") else ""
    volume = f", {meta.get('volume')}" if meta.get('volume') else ""
    issue = f"({meta.get('issue')})" if meta.get('issue') else ""
    pages = f", pp. {meta.get('pages')}" if meta.get('pages') else ""
    return f"{author_str} {year}, {title},{journal}{volume}{issue}{pages}."

G = format_harvard # alias export
