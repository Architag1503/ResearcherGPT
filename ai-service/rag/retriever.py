import os
from typing import List, Dict, Any
from qdrant_client.models import Filter, FieldCondition, MatchValue
from services.qdrant_service import client, COLLECTION_NAME, get_embedding, fallback_store

def retrieve(project_id: str, query: str, paper_id: str = None, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Retrieve top-k relevant chunks from Qdrant vector database with metadata filters.
    """
    query_vector = get_embedding(query)
    results = []

    # 1. Build Qdrant filter conditions
    must_conditions = [
        FieldCondition(key="project_id", match=MatchValue(value=project_id))
    ]
    if paper_id:
        must_conditions.append(FieldCondition(key="paper_id", match=MatchValue(value=paper_id)))

    qdrant_filter = Filter(must=must_conditions)

    # 2. Query Qdrant
    if client:
        try:
            search_result = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                query_filter=qdrant_filter,
                limit=limit
            )
            for hit in search_result:
                payload = hit.payload or {}
                results.append({
                    "paper_id": payload.get("paper_id"),
                    "page_number": payload.get("page_number"),
                    "text_content": payload.get("text_content"),
                    "chunk_index": payload.get("chunk_index"),
                    "confidence_score": float(hit.score),
                })
            return results
        except Exception as e:
            print(f"[Retriever] Qdrant search failed, falling back to memory: {e}")

    # 3. Fallback memory search
    import numpy as np
    memory_matches = []
    q_vec = np.array(query_vector)

    for item in fallback_store:
        payload = item["payload"]
        if payload["project_id"] == project_id:
            if paper_id and payload.get("paper_id") != paper_id:
                continue
            i_vec = np.array(item["vector"])
            dot = np.dot(q_vec, i_vec)
            norm_q = np.linalg.norm(q_vec)
            norm_i = np.linalg.norm(i_vec)
            sim = dot / (norm_q * norm_i) if (norm_q * norm_i) > 0 else 0.0
            memory_matches.append((sim, payload))

    memory_matches.sort(key=lambda x: x[0], reverse=True)
    for sim, payload in memory_matches[:limit]:
        results.append({
            "paper_id": payload.get("paper_id"),
            "page_number": payload.get("page_number"),
            "text_content": payload.get("text_content"),
            "chunk_index": payload.get("chunk_index"),
            "confidence_score": float(sim),
        })

    return results
