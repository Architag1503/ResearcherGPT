import requests
from typing import Dict, Any, Optional

def query_crossref(doi: str) -> Optional[Dict[str, Any]]:
    """
    Queries the CrossRef API to retrieve work metadata for a specific DOI.
    """
    clean_doi = doi.strip().replace("https://doi.org/", "").replace("http://doi.org/", "")
    url = f"https://api.crossref.org/works/{clean_doi}"
    headers = {
        "User-Agent": "ResearcherGPT/1.0 (mailto:support@researchergpt.io)"
    }
    try:
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            return res.json().get("message")
    except Exception as e:
        print(f"[CrossRefClient] Query failed for DOI {doi}: {e}")
    return None
