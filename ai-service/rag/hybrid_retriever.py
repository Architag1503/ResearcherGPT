import math
from typing import List, Dict, Any
from .retriever import retrieve

def bm25_search(chunks: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
    """
    Simple in-memory BM25 term frequency match ranker for exact keyword searches.
    """
    query_terms = [t.lower() for t in query.split() if len(t) > 1]
    if not query_terms or not chunks:
        return chunks
    
    # Document frequency
    doc_count = len(chunks)
    df = {}
    for term in query_terms:
        df[term] = sum(1 for c in chunks if term in c["text_content"].lower())

    # Calculate scores
    scored_chunks = []
    avg_len = sum(len(c["text_content"].split()) for c in chunks) / doc_count
    k1 = 1.5
    b = 0.75

    for c in chunks:
        text = c["text_content"].lower()
        words = text.split()
        doc_len = len(words)
        score = 0.0

        for term in query_terms:
            if df.get(term, 0) == 0:
                continue
            # TF-IDF BM25 weight
            tf = words.count(term)
            idf = math.log((doc_count - df[term] + 0.5) / (df[term] + 0.5) + 1.0)
            score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc_len / avg_len)))

        scored_chunks.append((score, c))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    
    results = []
    for rank, (score, chunk) in enumerate(scored_chunks):
        chunk_copy = dict(chunk)
        chunk_copy["keyword_score"] = score
        results.append(chunk_copy)
        
    return results

def reciprocal_rank_fusion(vector_results: List[Dict[str, Any]], keyword_results: List[Dict[str, Any]], k: int = 60) -> List[Dict[str, Any]]:
    """
    Reciprocal Rank Fusion (RRF) to merge BM25 and Vector search listings.
    """
    scores: Dict[str, float] = {}
    doc_map: Dict[str, Dict[str, Any]] = {}

    def add_ranks(results):
        for rank, doc in enumerate(results):
            # Unique identifier for chunk
            key = f"{doc['paper_id']}_{doc['chunk_index']}"
            if key not in doc_map:
                doc_map[key] = doc
            scores[key] = scores.get(key, 0.0) + (1.0 / (k + (rank + 1)))

    add_ranks(vector_results)
    add_ranks(keyword_results)

    # Sort by RRF score descending
    sorted_keys = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    
    fused_results = []
    for key in sorted_keys:
        doc = dict(doc_map[key])
        doc["confidence_score"] = scores[key]
        fused_results.append(doc)
        
    return fused_results

def retrieve_hybrid(project_id: str, query: str, paper_id: str = None, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Query both vector DB and BM25 term frequency index, then fuse the results using RRF.
    """
    # 1. Fetch vector results
    vector_res = retrieve(project_id, query, paper_id=paper_id, limit=limit * 2)
    
    # 2. Extract context pool to compute BM25 keyword rankings (BM25 needs documents pool)
    # We fetch a larger candidate pool of vector chunks as candidates for local keyword scoring
    keyword_res = bm25_search(vector_res, query)
    
    # 3. Merge vectors and keywords
    fused = reciprocal_rank_fusion(vector_res, keyword_res)
    
    return fused[:limit]
