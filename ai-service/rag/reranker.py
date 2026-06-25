from typing import List, Dict, Any

# Optional import of CrossEncoder with fallback
try:
    from sentence_transformers import CrossEncoder
    print("Loading Cross-Encoder model (ms-marco-MiniLM-L-6-v2) for Reranking...")
    rerank_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", max_length=512)
    HAS_RERANKER = True
except Exception as e:
    print(f"CrossEncoder failed to initialize: {e}. Fallback reranker will be used.")
    rerank_model = None
    HAS_RERANKER = False

def rerank(query: str, chunks: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
    """
    Rerank a list of retrieved chunks using Cross-Encoder model.
    """
    if not chunks:
        return []

    # If cross-encoder is active, re-score pairs
    if HAS_RERANKER and rerank_model:
        try:
            pairs = [[query, c["text_content"]] for c in chunks]
            scores = rerank_model.predict(pairs)
            
            # Map scores to chunks
            for i, score in enumerate(scores):
                chunks[i]["confidence_score"] = float(score)
                
            # Sort by new scores descending
            chunks.sort(key=lambda x: x["confidence_score"], reverse=True)
            return chunks[:limit]
        except Exception as e:
            print(f"[Reranker] Model prediction failed: {e}. Returning original order.")

    # Fallback: keep original hybrid rank and return
    return chunks[:limit]
