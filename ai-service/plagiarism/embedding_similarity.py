import numpy as np
from services.qdrant_service import get_embedding

def calculate_embedding_similarity(text1: str, text2: str) -> float:
    """
    Computes semantic cosine similarity distance between two texts using the local embedding model.
    """
    vec1 = np.array(get_embedding(text1))
    vec2 = np.array(get_embedding(text2))

    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return float(np.dot(vec1, vec2) / (norm1 * norm2))
