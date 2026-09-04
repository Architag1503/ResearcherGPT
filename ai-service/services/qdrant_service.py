import os
from pathlib import Path
from dotenv import load_dotenv

_root_env = Path(__file__).resolve().parent.parent.parent / ".env"
if _root_env.exists():
    load_dotenv(dotenv_path=_root_env)
else:
    load_dotenv()

import uuid
import numpy as np
import requests
from typing import List, Dict, Any
from qdrant_client import QdrantClient

# Dynamic config based on whether Gemini API is configured
gemini_key = os.getenv("GEMINI_API_KEY")
use_gemini_default = bool(gemini_key and "your_gemini_api_key" not in gemini_key)
VECTOR_DIMENSION = 3072 if use_gemini_default else 384

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
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={gemini_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "model": "models/gemini-embedding-001",
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
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={gemini_key}"
    headers = {"Content-Type": "application/json"}
    
    # Process in sub-batches of 40 to avoid Google Gemini request payload limits and timeouts
    SUB_BATCH_SIZE = 40
    all_embeddings = []
    
    for i in range(0, len(texts), SUB_BATCH_SIZE):
        chunk_batch = texts[i:i + SUB_BATCH_SIZE]
        requests_list = []
        for t in chunk_batch:
            requests_list.append({
                "model": "models/gemini-embedding-001",
                "content": {
                    "parts": [{"text": t}]
                }
            })
            
        payload = {"requests": requests_list}
        res_data = None
        for attempt in range(2):
            res = requests.post(url, headers=headers, json=payload, timeout=25)
            if res.status_code == 200:
                res_data = res.json()
                break
            if res.status_code == 429 and attempt == 0:
                print("[qdrant_service] Gemini 429 rate limit hit, backing off 2s before retry...")
                import time
                time.sleep(2)
                continue
            raise Exception(f"Gemini Embeddings API returned status {res.status_code}: {res.text}")
        
        if res_data:
            for emb in res_data.get("embeddings", []):
                all_embeddings.append(emb.get("values", []))
            
    return all_embeddings

def get_mistral_embeddings_batch(texts: List[str]) -> List[List[float]]:
    mistral_key = os.getenv("MISTRAL_API_KEY")
    if not mistral_key:
        raise ValueError("MISTRAL_API_KEY not configured")
    
    url = "https://api.mistral.ai/v1/embeddings"
    headers = {"Authorization": f"Bearer {mistral_key}", "Content-Type": "application/json"}
    
    BATCH = 64
    all_embeddings = []
    for i in range(0, len(texts), BATCH):
        batch_texts = texts[i:i + BATCH]
        payload = {"model": "mistral-embed", "input": batch_texts}
        res = requests.post(url, headers=headers, json=payload, timeout=20)
        if res.status_code != 200:
            raise Exception(f"Mistral Embeddings API returned status {res.status_code}: {res.text}")
        data = res.json().get("data", [])
        for item in data:
            all_embeddings.append(item.get("embedding", []))
    return all_embeddings

def get_cohere_embeddings_batch(texts: List[str]) -> List[List[float]]:
    cohere_key = os.getenv("COHERE_API_KEY")
    if not cohere_key:
        raise ValueError("COHERE_API_KEY not configured")
        
    url = "https://api.cohere.com/v2/embed"
    headers = {"Authorization": f"Bearer {cohere_key}", "Content-Type": "application/json"}
    
    BATCH = 64
    all_embeddings = []
    for i in range(0, len(texts), BATCH):
        batch_texts = texts[i:i + BATCH]
        payload = {
            "model": "embed-english-v3.0",
            "texts": batch_texts,
            "input_type": "search_document",
            "embedding_types": ["float"]
        }
        res = requests.post(url, headers=headers, json=payload, timeout=20)
        if res.status_code != 200:
            raise Exception(f"Cohere Embeddings API returned status {res.status_code}: {res.text}")
        embs = res.json().get("embeddings", {}).get("float", [])
        all_embeddings.extend(embs)
    return all_embeddings

def get_fast_fallback_embedding(text: str, dim: int = 1024) -> List[float]:
    import hashlib
    h = hashlib.sha256(text.encode('utf-8')).digest()
    np.random.seed(int.from_bytes(h[:4], 'little'))
    vec = np.random.randn(dim).astype(np.float32)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()

def match_vector_dim(vec: List[float], target_dim: int) -> List[float]:
    if len(vec) == target_dim:
        return vec
    if len(vec) < target_dim:
        return vec + [0.0] * (target_dim - len(vec))
    return vec[:target_dim]

def get_current_collection_size() -> int:
    if not client:
        return VECTOR_DIMENSION
    try:
        collections = client.get_collections().collections
        if any(c.name == COLLECTION_NAME for c in collections):
            info = client.get_collection(COLLECTION_NAME)
            return info.config.params.vectors.size
    except Exception:
        pass
    return VECTOR_DIMENSION

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
    target_dim = get_current_collection_size()
    
    # 1. Try Gemini
    if target_dim == 3072:
        try:
            return get_gemini_embedding_single(text)
        except Exception as e:
            print(f"[qdrant_service] Gemini embedding failed: {e}. Trying Mistral fallback.")
            
    # 2. Try Mistral
    try:
        embs = get_mistral_embeddings_batch([text])
        if embs and len(embs[0]) > 0:
            return match_vector_dim(embs[0], target_dim)
    except Exception as e:
        print(f"[qdrant_service] Mistral embedding failed: {e}. Trying Cohere fallback.")
        
    # 3. Try Cohere
    try:
        embs = get_cohere_embeddings_batch([text])
        if embs and len(embs[0]) > 0:
            return match_vector_dim(embs[0], target_dim)
    except Exception as e:
        print(f"[qdrant_service] Cohere embedding failed: {e}. Trying Gemini single fallback.")

    # 4. Fallback Gemini if target_dim != 3072
    try:
        vec = get_gemini_embedding_single(text)
        return match_vector_dim(vec, target_dim)
    except Exception:
        pass
        
    # 5. Lightweight fast zero-RAM fallback (never crash with PyTorch OOM)
    return get_fast_fallback_embedding(text, target_dim)

def index_chunks(project_id: str, paper_id: str, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    target_dim = get_current_collection_size()
    texts = [c["text_content"] for c in chunks]
    vectors = []
    points = []
    indexed_results = []
    
    if texts:
        # Step 1: Attempt Gemini batch embeddings
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key and "your_gemini_api_key" not in gemini_key:
            try:
                print("Generating embeddings using Gemini API in batch...")
                vectors = get_gemini_embeddings_batch(texts)
            except Exception as e:
                print(f"[qdrant_service] Gemini batch embedding failed: {e}. Falling back to Mistral.")
                vectors = []

        # Step 2: Attempt Mistral Embeddings (ultra-fast, zero RAM)
        if not vectors:
            try:
                print("Generating embeddings using Mistral Embed API...")
                raw_vectors = get_mistral_embeddings_batch(texts)
                vectors = [match_vector_dim(v, target_dim) for v in raw_vectors]
            except Exception as e:
                print(f"[qdrant_service] Mistral embed failed: {e}. Falling back to Cohere.")
                vectors = []

        # Step 3: Attempt Cohere Embeddings
        if not vectors:
            try:
                print("Generating embeddings using Cohere Embed API...")
                raw_vectors = get_cohere_embeddings_batch(texts)
                vectors = [match_vector_dim(v, target_dim) for v in raw_vectors]
            except Exception as e:
                print(f"[qdrant_service] Cohere embed failed: {e}. Falling back to zero-RAM hash projection.")
                vectors = []

        # Step 4: Zero-memory deterministic fallback (never loads PyTorch, preventing 512MB container OOM kills)
        if not vectors:
            vectors = [get_fast_fallback_embedding(t, target_dim) for t in texts]
    
    # Ensure collection matches the target vector dimension
    if vectors and len(vectors) > 0:
        actual_dim = len(vectors[0])
        ensure_collection(actual_dim)
    else:
        ensure_collection(target_dim)

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
                
def duplicate_paper_vectors(source_paper_id: str, target_paper_id: str, target_project_id: str) -> List[Dict[str, Any]]:
    ensure_collection()
    
    indexed_results = []
    
    if client:
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue, PointStruct
            # Retrieve all points matching the source_paper_id
            search_filter = Filter(must=[FieldCondition(key="paper_id", match=MatchValue(value=source_paper_id))])
            
            # Scroll points (supports pagination for up to 1000 chunks)
            scroll_result, _ = client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=search_filter,
                limit=1000,
                with_vectors=True
            )
            
            points_to_upsert = []
            for point in scroll_result:
                payload = dict(point.payload)
                payload["paper_id"] = target_paper_id
                payload["project_id"] = target_project_id
                
                new_point_id = str(uuid.uuid4())
                points_to_upsert.append(PointStruct(id=new_point_id, vector=point.vector, payload=payload))
                
                indexed_results.append({
                    "chunk_index": payload.get("chunk_index"),
                    "text_content": payload.get("text_content"),
                    "page_number": payload.get("page_number"),
                    "qdrant_id": new_point_id
                })
            
            if points_to_upsert:
                client.upsert(collection_name=COLLECTION_NAME, points=points_to_upsert)
                print(f"Duplicated {len(points_to_upsert)} vector points from {source_paper_id} to {target_paper_id}.")
            return indexed_results
        except Exception as e:
            print(f"Failed to duplicate Qdrant vectors: {e}")
            
    # Fallback to local memory store copy
    for item in fallback_store:
        payload = item["payload"]
        if payload.get("paper_id") == source_paper_id:
            new_payload = dict(payload)
            new_payload["paper_id"] = target_paper_id
            new_payload["project_id"] = target_project_id
            
            new_point_id = str(uuid.uuid4())
            fallback_store.append({
                "id": new_point_id,
                "vector": item["vector"],
                "payload": new_payload
            })
            indexed_results.append({
                "chunk_index": new_payload.get("chunk_index"),
                "text_content": new_payload.get("text_content"),
                "page_number": new_payload.get("page_number"),
                "qdrant_id": new_point_id
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
