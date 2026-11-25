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
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient

# Default to 384d local embedding dimension; never read server .env GEMINI_API_KEY at startup.
VECTOR_DIMENSION = 384


def _extract_user_key(user_api_keys: Optional[Dict[str, str]], *names: str) -> Optional[str]:
    if not user_api_keys or not isinstance(user_api_keys, dict):
        return None
    for name in names:
        val = user_api_keys.get(name)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None

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

def get_gemini_embedding_single(text: str, api_key: Optional[str] = None) -> List[float]:
    gemini_key = api_key.strip() if isinstance(api_key, str) and api_key.strip() else None
    if not gemini_key or "your_gemini_api_key" in gemini_key:
        raise ValueError("User Google Gemini API key not provided")
        
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

def get_gemini_embeddings_batch(texts: List[str], api_key: Optional[str] = None) -> List[List[float]]:
    gemini_key = api_key.strip() if isinstance(api_key, str) and api_key.strip() else None
    if not gemini_key or "your_gemini_api_key" in gemini_key:
        return []
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={gemini_key}"
    headers = {"Content-Type": "application/json"}
    
    # Process in sub-batches of 40 to avoid Google Gemini request payload limits and timeouts
    SUB_BATCH_SIZE = 40
    all_embeddings = []
    
    import random
    import time

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
        max_attempts = 4
        for attempt in range(max_attempts):
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=25)
                if res.status_code == 200:
                    res_data = res.json()
                    break
                if res.status_code == 429:
                    if attempt < max_attempts - 1:
                        delay = min(25, 3 * (2 ** attempt) + random.uniform(0.5, 2.0))
                        print(f"[qdrant_service] Gemini 429 rate limit on batch {i//SUB_BATCH_SIZE + 1}. Retrying in {delay:.1f}s (attempt {attempt + 1}/{max_attempts})...")
                        time.sleep(delay)
                        continue
                    else:
                        print(f"[qdrant_service] Gemini 429 rate limit exceeded all retries. Gracefully falling back to alternative embedding provider.")
                        return []
                print(f"[qdrant_service] Gemini Embeddings API returned status {res.status_code}: {res.text[:120]}")
                break
            except Exception as req_err:
                if attempt < max_attempts - 1:
                    time.sleep(2)
                    continue
                print(f"[qdrant_service] Gemini batch request error: {req_err}")
                return []
        
        if res_data:
            for emb in res_data.get("embeddings", []):
                all_embeddings.append(emb.get("values", []))
        else:
            # If any batch failed to obtain embeddings, return empty list to trigger fallback provider
            return []
            
    return all_embeddings

def get_mistral_embeddings_batch(texts: List[str], api_key: Optional[str] = None) -> List[List[float]]:
    mistral_key = api_key.strip() if isinstance(api_key, str) and api_key.strip() else None
    if not mistral_key:
        return []
    
    url = "https://api.mistral.ai/v1/embeddings"
    headers = {"Authorization": f"Bearer {mistral_key}", "Content-Type": "application/json"}
    
    import random
    import time

    BATCH = 64
    all_embeddings = []
    for i in range(0, len(texts), BATCH):
        batch_texts = texts[i:i + BATCH]
        payload = {"model": "mistral-embed", "input": batch_texts}
        max_attempts = 3
        batch_success = False
        for attempt in range(max_attempts):
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=20)
                if res.status_code == 200:
                    data = res.json().get("data", [])
                    for item in data:
                        all_embeddings.append(item.get("embedding", []))
                    batch_success = True
                    break
                if res.status_code == 429:
                    if attempt < max_attempts - 1:
                        delay = min(20, 2.5 * (2 ** attempt) + random.uniform(0.5, 1.5))
                        print(f"[qdrant_service] Mistral 429 rate limit. Retrying in {delay:.1f}s...")
                        time.sleep(delay)
                        continue
                    else:
                        print("[qdrant_service] Mistral 429 quota exhausted. Falling back to Cohere/local.")
                        return []
                print(f"[qdrant_service] Mistral error {res.status_code}: {res.text[:120]}")
                break
            except Exception as e:
                if attempt < max_attempts - 1:
                    time.sleep(2)
                    continue
                print(f"[qdrant_service] Mistral batch exception: {e}")
                return []
        if not batch_success:
            return []
    return all_embeddings

def get_cohere_embeddings_batch(texts: List[str], api_key: Optional[str] = None) -> List[List[float]]:
    cohere_key = api_key.strip() if isinstance(api_key, str) and api_key.strip() else None
    if not cohere_key:
        return []
        
    url = "https://api.cohere.com/v2/embed"
    headers = {"Authorization": f"Bearer {cohere_key}", "Content-Type": "application/json"}
    
    import random
    import time

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
        max_attempts = 3
        batch_success = False
        for attempt in range(max_attempts):
            try:
                res = requests.post(url, headers=headers, json=payload, timeout=20)
                if res.status_code == 200:
                    embs = res.json().get("embeddings", {}).get("float", [])
                    all_embeddings.extend(embs)
                    batch_success = True
                    break
                if res.status_code == 429:
                    if attempt < max_attempts - 1:
                        delay = min(20, 2.5 * (2 ** attempt) + random.uniform(0.5, 1.5))
                        print(f"[qdrant_service] Cohere 429 rate limit. Retrying in {delay:.1f}s...")
                        time.sleep(delay)
                        continue
                    else:
                        print("[qdrant_service] Cohere 429 quota exhausted. Falling back to local hash projection.")
                        return []
                print(f"[qdrant_service] Cohere error {res.status_code}: {res.text[:120]}")
                break
            except Exception as e:
                if attempt < max_attempts - 1:
                    time.sleep(2)
                    continue
                print(f"[qdrant_service] Cohere batch exception: {e}")
                return []
        if not batch_success:
            return []
    return all_embeddings

def get_fast_fallback_embedding(text: str, dim: int = 384) -> List[float]:
    """
    Deterministic zero-RAM feature-hashing bag-of-ngrams embedding.
    Preserves lexical cosine similarity without requiring PyTorch/API access.
    """
    import hashlib
    import re

    tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
    vec = np.zeros(dim, dtype=np.float32)
    if not tokens:
        return vec.tolist()

    features = list(tokens) + [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]
    for idx_offset, feat in enumerate(features):
        weight = 1.0 if idx_offset < len(tokens) else 0.7
        digest = hashlib.blake2b(feat.encode("utf-8"), digest_size=8).digest()
        bucket = int.from_bytes(digest[:4], "little") % dim
        sign = 1.0 if (digest[4] & 1) == 0 else -1.0
        vec[bucket] += sign * weight

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
                if os.getenv("QDRANT_RECREATE_ON_MISMATCH", "false").lower() == "true":
                    print(f"Recreating collection {COLLECTION_NAME} because dimension changed from {current_size} to {vector_size}")
                    client.delete_collection(COLLECTION_NAME)
                    exists = False
                else:
                    raise ValueError(
                        f"Qdrant collection '{COLLECTION_NAME}' expects {current_size}d vectors, got {vector_size}d. "
                        "Set QDRANT_RECREATE_ON_MISMATCH=true or align EMBEDDING_PROVIDER."
                    )

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

def _resolve_embedding_provider(target_dim: int, user_api_keys: Optional[Dict[str, str]] = None) -> str:
    explicit = os.getenv("EMBEDDING_PROVIDER", "auto").lower().strip()
    if explicit in {"local", "gemini", "mistral", "cohere", "hash"}:
        return explicit
    gemini_key = _extract_user_key(user_api_keys, "gemini", "geminiApiKey", "GEMINI_API_KEY")
    if target_dim == 3072 and gemini_key and "your_gemini_api_key" not in gemini_key:
        return "gemini"
    return "local"

def get_embedding_with_meta(text: str, user_api_keys: Optional[Dict[str, str]] = None) -> tuple[List[float], str]:
    target_dim = get_current_collection_size()
    provider = _resolve_embedding_provider(target_dim, user_api_keys=user_api_keys)
    user_gemini = _extract_user_key(user_api_keys, "gemini", "geminiApiKey", "GEMINI_API_KEY")

    if provider == "hash":
        return get_fast_fallback_embedding(text, target_dim), f"feature-hash-{target_dim}"

    if (provider == "gemini" or target_dim == 3072) and user_gemini:
        try:
            vec = get_gemini_embedding_single(text, api_key=user_gemini)
            if len(vec) == target_dim:
                return vec, "gemini-embedding-001"
        except Exception as e:
            print(f"[qdrant_service] User Gemini embedding failed: {e}.")
            if target_dim == 3072:
                # Never silently mix alien embedding spaces into 3072d Gemini collection
                return get_fast_fallback_embedding(text, target_dim), f"feature-hash-{target_dim}"

    if target_dim == 3072:
        return get_fast_fallback_embedding(text, target_dim), f"feature-hash-{target_dim}"

    if provider in {"local", "auto"} and target_dim == 384:
        try:
            model = get_local_model()
            vec = model.encode(text, normalize_embeddings=True).tolist()
            return vec, "all-MiniLM-L6-v2"
        except Exception as e:
            print(f"[qdrant_service] Local SentenceTransformer failed: {e}.")

    if provider == "mistral":
        user_mistral = _extract_user_key(user_api_keys, "mistral", "mistralApiKey", "MISTRAL_API_KEY")
        if user_mistral:
            try:
                embs = get_mistral_embeddings_batch([text], api_key=user_mistral)
                if embs and len(embs[0]) == target_dim:
                    return embs[0], "mistral-embed"
            except Exception as e:
                print(f"[qdrant_service] Mistral embedding failed: {e}.")

    if provider == "cohere":
        user_cohere = _extract_user_key(user_api_keys, "cohere", "cohereApiKey", "COHERE_API_KEY")
        if user_cohere:
            try:
                embs = get_cohere_embeddings_batch([text], api_key=user_cohere)
                if embs and len(embs[0]) == target_dim:
                    return embs[0], "embed-english-v3.0"
            except Exception as e:
                print(f"[qdrant_service] Cohere embedding failed: {e}.")

    return get_fast_fallback_embedding(text, target_dim), f"feature-hash-{target_dim}"

def get_embedding(text: str, user_api_keys: Optional[Dict[str, str]] = None) -> List[float]:
    vec, _ = get_embedding_with_meta(text, user_api_keys=user_api_keys)
    return vec

def index_chunks(
    project_id: str,
    paper_id: str,
    chunks: List[Dict[str, Any]],
    user_api_keys: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    target_dim = get_current_collection_size()
    provider = _resolve_embedding_provider(target_dim, user_api_keys=user_api_keys)
    user_gemini = _extract_user_key(user_api_keys, "gemini", "geminiApiKey", "GEMINI_API_KEY")
    texts = [c["text_content"] for c in chunks]
    vectors: List[List[float]] = []
    embedding_model_used = f"feature-hash-{target_dim}"
    points = []
    indexed_results = []

    if texts:
        if provider == "gemini" and user_gemini:
            try:
                print("Generating embeddings using user Gemini API key in batch...")
                candidate = get_gemini_embeddings_batch(texts, api_key=user_gemini)
                if candidate and len(candidate[0]) == target_dim:
                    vectors = candidate
                    embedding_model_used = "gemini-embedding-001"
            except Exception as e:
                print(f"[qdrant_service] User Gemini batch embedding failed: {e}.")

        if not vectors and provider in {"local", "auto"} and target_dim == 384:
            try:
                model = get_local_model()
                vectors = model.encode(texts, normalize_embeddings=True).tolist()
                embedding_model_used = "all-MiniLM-L6-v2"
            except Exception as e:
                print(f"[qdrant_service] Local SentenceTransformer batch failed: {e}.")

        if not vectors and provider == "mistral":
            user_mistral = _extract_user_key(user_api_keys, "mistral", "mistralApiKey", "MISTRAL_API_KEY")
            if user_mistral:
                try:
                    raw_vectors = get_mistral_embeddings_batch(texts, api_key=user_mistral)
                    if raw_vectors and len(raw_vectors[0]) == target_dim:
                        vectors = raw_vectors
                        embedding_model_used = "mistral-embed"
                except Exception as e:
                    print(f"[qdrant_service] Mistral embed failed: {e}.")

        if not vectors and provider == "cohere":
            user_cohere = _extract_user_key(user_api_keys, "cohere", "cohereApiKey", "COHERE_API_KEY")
            if user_cohere:
                try:
                    raw_vectors = get_cohere_embeddings_batch(texts, api_key=user_cohere)
                    if raw_vectors and len(raw_vectors[0]) == target_dim:
                        vectors = raw_vectors
                        embedding_model_used = "embed-english-v3.0"
                except Exception as e:
                    print(f"[qdrant_service] Cohere embed failed: {e}.")

        if not vectors:
            vectors = [get_fast_fallback_embedding(t, target_dim) for t in texts]
            embedding_model_used = f"feature-hash-{target_dim}"

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

        vector = vectors[idx] if idx < len(vectors) else get_fast_fallback_embedding(text, target_dim)
        point_id = str(uuid.uuid4())

        payload = {
            "project_id": project_id,
            "paper_id": paper_id,
            "chunk_index": chunk_idx,
            "text_content": text,
            "page_number": page_num,
            "embedding_model": embedding_model_used,
            "embedding_dim": len(vector),
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

def scroll_project_chunks(project_id: str, paper_id: str = None, max_chunks: int = 5000) -> List[Dict[str, Any]]:
    """
    Fetch all indexed chunks for a project (and optional paper_id) for full-corpus BM25 scoring.
    """
    chunks: List[Dict[str, Any]] = []
    if client:
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            must = [FieldCondition(key="project_id", match=MatchValue(value=project_id))]
            if paper_id:
                must.append(FieldCondition(key="paper_id", match=MatchValue(value=paper_id)))
            scroll_filter = Filter(must=must)
            offset = None
            while len(chunks) < max_chunks:
                batch_limit = min(500, max_chunks - len(chunks))
                points_batch, next_offset = client.scroll(
                    collection_name=COLLECTION_NAME,
                    scroll_filter=scroll_filter,
                    limit=batch_limit,
                    offset=offset,
                    with_vectors=False,
                )
                for pt in points_batch:
                    payload = pt.payload or {}
                    chunks.append({
                        "paper_id": payload.get("paper_id"),
                        "page_number": payload.get("page_number"),
                        "chunk_index": payload.get("chunk_index"),
                        "text_content": payload.get("text_content", ""),
                    })
                if next_offset is None or not points_batch:
                    break
                offset = next_offset
            return chunks
        except Exception as e:
            print(f"[qdrant_service] Project chunk scroll failed, reading fallback memory: {e}")

    for item in fallback_store:
        payload = item.get("payload", {})
        if payload.get("project_id") != project_id:
            continue
        if paper_id and payload.get("paper_id") != paper_id:
            continue
        chunks.append({
            "paper_id": payload.get("paper_id"),
            "page_number": payload.get("page_number"),
            "chunk_index": payload.get("chunk_index"),
            "text_content": payload.get("text_content", ""),
        })
        if len(chunks) >= max_chunks:
            break
    return chunks

def search_relevant_chunks(
    project_id: str,
    query: str,
    limit: int = 5,
    paper_id: str = None,
    user_api_keys: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    query_vector = get_embedding(query, user_api_keys=user_api_keys)
    results = []

    if client:
        try:
            must = [{"key": "project_id", "match": {"value": project_id}}]
            if paper_id:
                must.append({"key": "paper_id", "match": {"value": paper_id}})
            search_result = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                query_filter={"must": must},
                limit=limit
            )
            for hit in search_result:
                payload = hit.payload or {}
                results.append({
                    "paper_id": payload.get("paper_id"),
                    "page_number": payload.get("page_number"),
                    "chunk_index": payload.get("chunk_index"),
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
        payload = item["payload"]
        if payload["project_id"] == project_id and (not paper_id or payload.get("paper_id") == paper_id):
            i_vec = np.array(item["vector"])
            if q_vec.shape != i_vec.shape:
                continue
            # Cosine similarity
            dot = np.dot(q_vec, i_vec)
            norm_q = np.linalg.norm(q_vec)
            norm_i = np.linalg.norm(i_vec)
            sim = dot / (norm_q * norm_i) if (norm_q * norm_i) > 0 else 0.0
            
            memory_matches.append((sim, payload))
            
    # Sort by similarity descending
    memory_matches.sort(key=lambda x: x[0], reverse=True)
    
    for sim, payload in memory_matches[:limit]:
        results.append({
            "paper_id": payload.get("paper_id"),
            "page_number": payload.get("page_number"),
            "chunk_index": payload.get("chunk_index"),
            "text_content": payload.get("text_content"),
            "confidence_score": float(sim),
        })
        
    return results
