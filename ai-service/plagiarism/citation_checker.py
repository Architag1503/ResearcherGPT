import re
from typing import List, Dict, Any

def audit_sentence_citations(text: str) -> List[Dict[str, Any]]:
    """
    Checks if factual claims or numeric metrics contain adjacent inline citation brackets.
    Returns warnings for potential un-cited claims.
    """
    sentences = text.split(".")
    warnings = []

    numeric_pattern = r'\b\d+(?:\.\d+)?%?\b'
    citation_pattern = r'\[[A-Za-z0-9]+\]'

    for idx, s in enumerate(sentences):
        s_clean = s.strip()
        if not s_clean:
            continue
            
        # If sentence contains numbers (statistics/accuracy) but no citation brackets
        has_numeric = bool(re.search(numeric_pattern, s_clean))
        has_citation = bool(re.search(citation_pattern, s_clean))

        if has_numeric and not has_citation:
            warnings.append({
                "sentence_index": idx,
                "text": s_clean,
                "reason": "Numerical statistic or claim lacks an inline bibliography citation."
            })

    return warnings
