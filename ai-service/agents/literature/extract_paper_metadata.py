import os
import json
import re
from typing import Dict, Any
from agents.router import call_llm

def extract_metadata(title: str, text: str) -> Dict[str, Any]:
    """
    Extracts structured academic metadata (title, authors, year, venue) from paper text.
    """
    meta = {
        "title": title,
        "authors": [],
        "year": None,
        "venue": "Academic Press"
    }

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and "your_gemini_api_key" not in gemini_key:
        system = "You are an Academic Metadata Extractor. Parse the paper content and extract: title, authors (list of strings), year (integer), venue/journal (string). Output as a JSON object."
        try:
            res_text = call_llm(system, f"Paper content snippet:\n{text[:2500]}")
            parsed = json.loads(res_text)
            if isinstance(parsed, dict):
                meta["title"] = parsed.get("title") or meta["title"]
                meta["authors"] = parsed.get("authors") or meta["authors"]
                meta["year"] = parsed.get("year") or meta["year"]
                meta["venue"] = parsed.get("venue") or meta["venue"]
                return meta
        except Exception as e:
            print(f"[MetadataExtractor] LLM extraction failed: {e}")

    # Fallback heuristic rules
    year_match = re.search(r'\b(19\d{2}|20\d{2})\b', text[:2000])
    if year_match:
        meta["year"] = int(year_match.group(1))

    author_candidates = re.findall(r'([A-Z][a-z]+(?:\s[A-Z]\.)?\s[A-Z][a-z]+)', text[:500])
    if author_candidates:
        meta["authors"] = list(set(author_candidates))[:4]

    return meta
