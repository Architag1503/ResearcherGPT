import math
import re
from typing import List, Dict, Any
from .retriever import retrieve
from services.graph_service import neo4j_client

def query_knowledge_graph(project_id: str, query: str) -> List[str]:
    """
    Finds papers in the Neo4j knowledge graph connected to entities matching query terms.
    Returns a list of matching paper IDs to boost in hybrid retrieval.
    """
    if not neo4j_client or not neo4j_client.driver:
        return []
    
    # Extract query terms
    words = [w.strip().lower() for w in re.split(r'\W+', query) if len(w.strip()) > 3]
    if not words:
        return []
    
    query_cypher = """
    MATCH (e:Entity {projectId: $projectId})
    WHERE toLower(e.label) IN $words AND NOT e.type = 'paper'
    MATCH (e)-[r:RELATION]-(p:Entity {type: 'paper', projectId: $projectId})
    RETURN DISTINCT p.id as paperId
    """
    
    paper_ids = []
    try:
        with neo4j_client.driver.session() as session:
            res = session.run(query_cypher, projectId=project_id, words=words)
            for record in res:
                p_id = record["paperId"]
                if p_id.startswith("paper_"):
                    paper_ids.append(p_id.replace("paper_", ""))
    except Exception as e:
        print(f"[hybrid_retriever] KG search failed: {e}")
    return paper_ids

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

def reciprocal_rank_fusion(vector_results: List[Dict[str, Any]], keyword_results: List[Dict[str, Any]], kg_boost_papers: List[str], k: int = 60) -> List[Dict[str, Any]]:
    """
    Reciprocal Rank Fusion (RRF) with Knowledge Graph paper ID boosting.
    """
    scores: Dict[str, float] = {}
    doc_map: Dict[str, Dict[str, Any]] = {}

    def add_ranks(results):
        for rank, doc in enumerate(results):
            # Unique identifier for chunk
            key = f"{doc['paper_id']}_{doc.get('chunk_index', 0)}"
            if key not in doc_map:
                doc_map[key] = doc
            
            # Standard RRF score
            base_score = 1.0 / (k + (rank + 1))
            
            # Boost score if chunk belongs to a paper highly connected to query entities in Neo4j
            if doc['paper_id'] in kg_boost_papers:
                base_score *= 1.3
                
            scores[key] = scores.get(key, 0.0) + base_score

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
    Query vector DB, BM25 term index, and Neo4j KG, then fuse using Reciprocal Rank Fusion.
    """
    # 1. Fetch vector results (metadata pre-filtered by project_id and paper_id)
    vector_res = retrieve(project_id, query, paper_id=paper_id, limit=limit * 2)
    
    # 2. Compute BM25 keyword rankings
    keyword_res = bm25_search(vector_res, query)
    
    # 3. Query Neo4j Knowledge Graph for connected papers to boost
    kg_boost_papers = query_knowledge_graph(project_id, query)
    
    # 4. Merge vectors and keywords with KG boosts using RRF
    fused = reciprocal_rank_fusion(vector_res, keyword_res, kg_boost_papers)
    
    return fused[:limit]
