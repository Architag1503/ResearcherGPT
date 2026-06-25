import re
from typing import List, Dict, Any

def validate_citations(text: str, bibliography: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Scans a manuscript text for inline citations (e.g. [Jenkins2024] or [1])
    and verifies that each exists in the project bibliography list.
    """
    # 1. Locate all inline citation keys matching [NameYear] or [Number]
    inline_keys = re.findall(r'\[([A-Za-z0-9]+)\]', text)
    unique_inline = list(set(inline_keys))

    # 2. Extract bibliography keys
    bib_keys = set()
    for item in bibliography:
        if item.get("key"):
            bib_keys.add(item["key"])
        if item.get("index"):
            bib_keys.add(str(item["index"]))

    missing_keys = []
    valid_keys = []

    for key in unique_inline:
        if key in bib_keys:
            valid_keys.append(key)
        else:
            missing_keys.append(key)

    is_valid = len(missing_keys) == 0
    return {
        "isValid": is_valid,
        "totalFound": len(unique_inline),
        "missingKeys": missing_keys,
        "validKeys": valid_keys
    }
