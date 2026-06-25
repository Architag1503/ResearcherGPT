from typing import Dict, Any

def format_apa(meta: Dict[str, Any]) -> str:
    """
    Format metadata dictionary into APA reference style.
    """
    authors = meta.get("authors", [])
    if not authors:
        author_str = "Unknown Author"
    elif len(authors) == 1:
        author_str = authors[0]
    elif len(authors) == 2:
        author_str = f"{authors[0]} & {authors[1]}"
    else:
        author_str = f"{authors[0]}, et al."

    year = f"({meta.get('year')})" if meta.get("year") else "(n.d.)"
    title = meta.get("title", "Untitled Work")
    journal = meta.get("journal", "")
    volume = meta.get("volume", "")
    issue = f"({meta.get('issue')})" if meta.get("issue") else ""
    pages = f", {meta.get('pages')}" if meta.get("pages") else ""

    journal_block = f". *{journal}*" if journal else ""
    vol_block = f", {volume}{issue}" if volume else ""

    return f"{author_str} {year}. {title}{journal_block}{vol_block}{pages}."
