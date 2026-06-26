import os
import uuid
import numpy as np
import requests
from typing import List, Dict, Any
from qdrant_client import QdrantClient

# Dynamic config based on whether Gemini API is configured
gemini_key = os.getenv("GEMINI_API_KEY")
use_gemini_default = bool(gemini_key and "your_gemini_api_key" not in gemini_key)
VECTOR_DIMENSION = 768 if use_gemini_default else 384

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")

# Initialize Qdrant Client with fallback support
client = None
fallback_store: List[Dict[str, Any]] = []

try:
    if QDRANT_HOST.startswith("http://") or QDRANT_HOST.startswith("https://"):
        client = QdrantClient(url=QDRANT_HOST, api_key=QDRANT_API_KEY if QDRANT_API_KEY else None, timeout=5)
    else:
        client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, timeout=5)
    # Check connection
    client.get_collections()
    print("Qdrant database connection successfully established.")
except Exception as e:
    print(f"Qdrant connection failed: {str(e)}. Falling back to in-memory vector search.")
    client = None

COLLECTION_NAME = "research_chunks"

# Lazy-loaded model to save memory
_local_model = None

def get_local_model():
    global _local_model
    if _local_model is None:
        print("Loading local sentence-transformer embedding model lazily...")
        from sentence_transformers import SentenceTransformer
        import torch
        # Minimize resource consumption for PyTorch
        torch.set_num_threads(1)
        _local_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _local_model

def get_gemini_embedding_single(text: str) -> List[float]:
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or "your_gemini_api_key" in gemini_key:
        raise ValueError("GEMINI_API_KEY not configured")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={gemini_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "model": "models/text-embedding-004",
        "content": {
            "parts": [{"text": text}]
        }
    }
    res = requests.post(url, headers=headers, json=payload, timeout=30)
    if res.status_code != 200:
        raise Exception(f"Gemini Embeddings API returned status {res.status_code}: {res.text}")
    res_data = res.json()
    return res_data.get("embedding", {}).get("values", [])

def get_gemini_embeddings_batch(texts: List[str]) -> List[List[float]]:
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or "your_gemini_api_key" in gemini_key:
        raise ValueError("GEMINI_API_KEY not configured")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key={gemini_key}"
    headers = {"Content-Type": "application/json"}
    
    requests_list = []
    for t in texts:
        requests_list.append({
            "model": "models/text-embedding-004",
            "content": {
                "parts": [{"text": t}]
            }
        })
        
    payload = {"requests": requests_list}
    res = requests.post(url, headers=headers, json=payload, timeout=30)
    if res.status_code != 200:
        raise Exception(f"Gemini Embeddings API returned status {res.status_code}: {res.text}")
    
    res_data = res.json()
    embeddings = []
    for emb in res_data.get("embeddings", []):
        embeddings.append(emb.get("values", []))
    return embeddings

def ensure_collection(vector_size: int = VECTOR_DIMENSION):
    if not client:
        return
    try:
        from qdrant_client.models import Distance, VectorParams
        collections = client.get_collections().collections
        exists = any(c.name == COLLECTION_NAME for c in collections)
        if exists:
            info = client.get_collection(COLLECTION_NAME)
            current_size = info.config.params.vectors.size
            if current_size != vector_size:
                print(f"Recreating collection {COLLECTION_NAME} because dimension changed from {current_size} to {vector_size}")
                client.delete_collection(COLLECTION_NAME)
                exists = False
                
        if not exists:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )
            print(f"Created Qdrant collection: {COLLECTION_NAME} with size {vector_size}")
    except Exception as e:
        print(f"Failed to verify/create Qdrant collection: {e}")

# Run initial setup
ensure_collection(VECTOR_DIMENSION)

def get_embedding(text: str) -> List[float]:
    try:
        return get_gemini_embedding_single(text)
    except Exception as e:
        print(f"Gemini embedding API failed: {e}. Falling back to local SentenceTransformer.")
        model = get_local_model()
        embedding = model.encode(text)
        return embedding.tolist()

def index_chunks(project_id: str, paper_id: str, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    gemini_key = os.getenv("GEMINI_API_KEY")
    use_gemini = bool(gemini_key and "your_gemini_api_key" not in gemini_key)
    vector_size = 768 if use_gemini else 384
    
    ensure_collection(vector_size)
    
    indexed_results = []
    points = []
    
    # Batch encode all chunk texts to drastically improve speed
    texts = [c["text_content"] for c in chunks]
    vectors = []
    if texts:
        if use_gemini:
            try:
                print("Generating embeddings using Gemini API in batch...")
                vectors = get_gemini_embeddings_batch(texts)
            except Exception as e:
                print(f"Gemini batch embedding API failed: {e}. Falling back to local model.")
                use_gemini = False
                
        if not use_gemini:
            ensure_collection(384)
            try:
                model = get_local_model()
                encoded_vectors = model.encode(texts, batch_size=16, show_progress_bar=False)
                vectors = encoded_vectors.tolist()
            except Exception as e:
                print(f"Batch encoding failed locally: {e}. Falling back to sequential encoding.")
                vectors = [get_embedding(t) for t in texts]
    
    from qdrant_client.models import PointStruct
    for idx, c in enumerate(chunks):
        text = c["text_content"]
        page_num = c["page_number"]
        chunk_idx = c["chunk_index"]
        
        vector = vectors[idx] if idx < len(vectors) else get_embedding(text)
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
            print(f"Failed to upsert to Qdrant: {e}")
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
