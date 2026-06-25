from typing import List, Dict, Any

def calculate_overall_confidence(verifications: List[Dict[str, Any]]) -> float:
    """
    Computes the composite confidence score of a validated document segment.
    """
    if not verifications:
        return 0.0
    
    total_score = sum(float(v.get("score", 0.0)) for v in verifications)
    return total_score / len(verifications)
