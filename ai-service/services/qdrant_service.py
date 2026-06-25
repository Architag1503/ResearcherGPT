import os
import uuid
import numpy as np
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# Initialize the embedding model locally (requires no API keys)
print("Loading sentence-transformer embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
VECTOR_DIMENSION = 384  # Dimension of all-MiniLM-L6-v2

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))

# Initialize Qdrant Client with fallback support
client = None
fallback_store: List[Dict[str, Any]] = []

try:
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, timeout=5)
    # Check connection
    client.get_collections()
    print("Qdrant database connection successfully established.")
except Exception as e:
    print(f"Qdrant connection failed: {str(e)}. Falling back to in-memory vector search.")
    client = None

COLLECTION_NAME = "research_chunks"

def ensure_collection():
    if not client:
        return
    try:
        collections = client.get_collections().collections
        exists = any(c.name == COLLECTION_NAME for c in collections)
        if not exists:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=VECTOR_DIMENSION, distance=Distance.COSINE),
            )
            print(f"Created Qdrant collection: {COLLECTION_NAME}")
    except Exception as e:
        print(f"Failed to verify/create Qdrant collection: {e}")

# Run initial setup
ensure_collection()

def get_embedding(text: str) -> List[float]:
    embedding = model.encode(text)
    return embedding.tolist()

def index_chunks(project_id: str, paper_id: str, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    ensure_collection()
    
    indexed_results = []
    points = []
    
    for c in chunks:
        text = c["text_content"]
        page_num = c["page_number"]
        chunk_idx = c["chunk_index"]
        
        vector = get_embedding(text)
        point_id = str(uuid.uuid4())
        
        payload = {
            "project_id": project_id,
            "paper_id": paper_id,
            "chunk_index": chunk_idx,
            "text_content": text,
            "page_number": page_num
        }
        
        if client:
            points.append(PointStruct(id=point_id, vector=vector, payload=payload))
        else:
            # Fallback memory store
            fallback_store.append({
                "id": point_id,
                "vector": vector,
                "payload": payload
            })
            
        indexed_results.append({
            "chunk_index": chunk_idx,
            "text_content": text,
            "page_number": page_num,
            "qdrant_id": point_id
        })

    if client and points:
        try:
            client.upsert(collection_name=COLLECTION_NAME, points=points)
            print(f"Uploaded {len(points)} points to Qdrant.")
        except Exception as e:
            print(f"Qdrant upload failed, writing to fallback memory: {e}")
            for pt in points:
                fallback_store.append({
                    "id": pt.id,
                    "vector": pt.vector,
                    "payload": pt.payload
                })
                
    return indexed_results

def search_relevant_chunks(project_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    query_vector = get_embedding(query)
    results = []

    if client:
        try:
            search_result = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                query_filter={
                    "must": [
                        {"key": "project_id", "match": {"value": project_id}}
                    ]
                },
                limit=limit
            )
            for hit in search_result:
                payload = hit.payload or {}
                results.append({
                    "paper_id": payload.get("paper_id"),
                    "page_number": payload.get("page_number"),
                    "text_content": payload.get("text_content"),
                    "confidence_score": float(hit.score),
                })
            return results
        except Exception as e:
            print(f"Qdrant query failed, querying fallback memory: {e}")
            # fall through to memory search

    # Fallback cosine similarity search in memory
    memory_matches = []
    q_vec = np.array(query_vector)
    
    for item in fallback_store:
        if item["payload"]["project_id"] == project_id:
            i_vec = np.array(item["vector"])
            # Cosine similarity
            dot = np.dot(q_vec, i_vec)
            norm_q = np.linalg.norm(q_vec)
            norm_i = np.linalg.norm(i_vec)
            sim = dot / (norm_q * norm_i) if (norm_q * norm_i) > 0 else 0.0
            
            memory_matches.append((sim, item["payload"]))
            
    # Sort by similarity descending
    memory_matches.sort(key=lambda x: x[0], reverse=True)
    
    for sim, payload in memory_matches[:limit]:
        results.append({
            "paper_id": payload.get("paper_id"),
            "page_number": payload.get("page_number"),
            "text_content": payload.get("text_content"),
            "confidence_score": float(sim),
        })
        
    return results
