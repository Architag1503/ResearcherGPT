from typing import List, Dict, Any

def analyze_trends(papers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Groups papers chronologically and matches topic shifting trajectories over time.
    """
    year_map: Dict[int, List[str]] = {}
    methods_freq: Dict[str, int] = {}
    
    for p in papers:
        year = p.get("year") or 2024
        title = p.get("title", "Untitled")
        
        # Chronological Grouping
        if year not in year_map:
            year_map[year] = []
        year_map[year].append(title)
        
        # Methods frequency tracking
        meta = p.get("metadata", {})
        for m in meta.get("methods", []):
            methods_freq[m] = methods_freq.get(m, 0) + 1

    # Sort chronological map
    sorted_timeline = [{"year": y, "papers": year_map[y]} for y in sorted(year_map.keys())]
    
    # Get top active paradigms
    top_paradigms = sorted(methods_freq.keys(), key=lambda x: methods_freq[x], reverse=True)[:5]

    return {
        "timeline": sorted_timeline,
        "active_paradigms": top_paradigms,
        "total_analyzed": len(papers)
    }
