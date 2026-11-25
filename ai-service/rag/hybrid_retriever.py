import hashlib
import math
import re
from typing import List, Dict, Any, Optional
from .retriever import retrieve
from services.graph_service import neo4j_client
from services.qdrant_service import scroll_project_chunks


def _tokenize_bm25(text: str) -> List[str]:
    return [t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) > 1]


def query_knowledge_graph(project_id: str, query: str) -> List[str]:
    """
    Finds papers in the knowledge graph (Neo4j or in-memory graph fallback) connected
    to entities matching query terms. Returns matching paper IDs to boost in hybrid retrieval.
    """
    if not neo4j_client:
        return []

    words = [w.strip().lower() for w in re.split(r'\W+', query) if len(w.strip()) > 3]
    if not words:
        return []

    return neo4j_client.query_papers_by_terms(project_id, words)


def bm25_search(chunks: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
    """
    In-memory Okapi BM25 term-frequency ranker with consistent word-level tokenization.
    """
    query_terms = _tokenize_bm25(query)
    if not query_terms or not chunks:
        return chunks

    tokenized_docs = [_tokenize_bm25(c.get("text_content", "")) for c in chunks]
    doc_token_sets = [set(toks) for toks in tokenized_docs]
    doc_count = len(chunks)
    total_len = sum(len(toks) for toks in tokenized_docs)
    avg_len = total_len / doc_count if doc_count > 0 else 0.0

    # Document frequency over normalized token sets (consistent with TF)
    df: Dict[str, int] = {
        term: sum(1 for tok_set in doc_token_sets if term in tok_set)
        for term in set(query_terms)
    }

    scored_chunks = []
    k1 = 1.5
    b = 0.75

    for idx, c in enumerate(chunks):
        words = tokenized_docs[idx]
        doc_len = len(words)
        score = 0.0

        if doc_len > 0 and avg_len > 0:
            for term in query_terms:
                term_df = df.get(term, 0)
                if term_df == 0:
                    continue
                tf = words.count(term)
                if tf == 0:
                    continue
                idf = math.log((doc_count - term_df + 0.5) / (term_df + 0.5) + 1.0)
                score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc_len / avg_len)))

        scored_chunks.append((score, c))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)

    results = []
    for score, chunk in scored_chunks:
        chunk_copy = dict(chunk)
        chunk_copy["keyword_score"] = score
        results.append(chunk_copy)

    return results


def _chunk_key(doc: Dict[str, Any]) -> str:
    chunk_idx = doc.get("chunk_index")
    if chunk_idx is not None:
        return f"{doc.get('paper_id')}_{chunk_idx}"
    digest = hashlib.md5((doc.get("text_content") or "").encode("utf-8")).hexdigest()[:12]
    return f"{doc.get('paper_id')}_{doc.get('page_number', 0)}_{digest}"


def reciprocal_rank_fusion(
    vector_results: List[Dict[str, Any]],
    keyword_results: List[Dict[str, Any]],
    kg_boost_papers: List[str],
    k: int = 60,
    kg_boost: float = 1.3,
    dense_weight: float = 1.0,
    bm25_weight: float = 1.0,
    kg_results: Optional[List[Dict[str, Any]]] = None,
    kg_weight: float = 0.0,
) -> List[Dict[str, Any]]:
    """
    Reciprocal Rank Fusion (RRF) with Knowledge Graph paper ID boosting
    and optional direct KG candidate-channel injection.
    """
    scores: Dict[str, float] = {}
    doc_map: Dict[str, Dict[str, Any]] = {}
    kg_set = set(kg_boost_papers or [])

    def add_ranks(results: List[Dict[str, Any]], weight: float):
        if weight <= 0 or not results:
            return
        for rank, doc in enumerate(results):
            key = _chunk_key(doc)
            if key not in doc_map:
                doc_map[key] = doc

            base_score = weight / (k + (rank + 1))
            if doc.get("paper_id") in kg_set:
                base_score *= kg_boost

            scores[key] = scores.get(key, 0.0) + base_score

    add_ranks(vector_results, dense_weight)
    add_ranks(keyword_results, bm25_weight)
    if kg_results:
        add_ranks(kg_results, kg_weight)

    sorted_keys = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)

    fused_results = []
    for key in sorted_keys:
        doc = dict(doc_map[key])
        doc["confidence_score"] = scores[key]
        fused_results.append(doc)

    return fused_results


def retrieve_hybrid(
    project_id: str,
    query: str,
    paper_id: Optional[str] = None,
    limit: int = 10,
    corpus_chunks: Optional[List[Dict[str, Any]]] = None,
    kg_boost: float = 1.3,
    rrf_k: int = 60,
    dense_weight: float = 1.0,
    bm25_weight: float = 1.0,
    kg_inject_weight: float = 0.75,
    user_api_keys: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    """
    Query dense vector DB, full-corpus BM25 term index, and Knowledge Graph,
    then fuse using Reciprocal Rank Fusion.
    """
    vector_res = retrieve(project_id, query, paper_id=paper_id, limit=max(limit * 2, 20), user_api_keys=user_api_keys) if dense_weight > 0 else []

    if corpus_chunks is None:
        corpus_chunks = scroll_project_chunks(project_id, paper_id=paper_id)
    if not corpus_chunks:
        corpus_chunks = vector_res

    keyword_scored = bm25_search(corpus_chunks, query) if bm25_weight > 0 else []
    keyword_res = [c for c in keyword_scored if c.get("keyword_score", 0.0) > 0.0][:max(limit * 3, 20)]

    kg_boost_papers = query_knowledge_graph(project_id, query) if (kg_boost != 1.0 or kg_inject_weight > 0) else []
    kg_res: List[Dict[str, Any]] = []
    if kg_inject_weight > 0 and kg_boost_papers:
        kg_set = set(kg_boost_papers)
        bm25_score_map = {_chunk_key(c): c.get("keyword_score", 0.0) for c in keyword_scored}
        kg_candidates = [c for c in corpus_chunks if c.get("paper_id") in kg_set]
        kg_candidates.sort(key=lambda c: bm25_score_map.get(_chunk_key(c), 0.0), reverse=True)
        kg_res = kg_candidates[:max(limit * 2, 10)]

    fused = reciprocal_rank_fusion(
        vector_res,
        keyword_res,
        kg_boost_papers,
        k=rrf_k,
        kg_boost=kg_boost,
        dense_weight=dense_weight,
        bm25_weight=bm25_weight,
        kg_results=kg_res,
        kg_weight=kg_inject_weight,
    )

    return fused[:limit]
