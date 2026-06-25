from typing import List, Set

def tokenize(text: str) -> Set[str]:
    # Basic lower tokenizer
    return set(w.strip("?,.:;!") for w in text.lower().split() if len(w) > 2)

def calculate_jaccard_similarity(text1: str, text2: str) -> float:
    """
    Computes Jaccard word-overlap similarity coefficient.
    """
    set1 = tokenize(text1)
    set2 = tokenize(text2)
    
    if not set1 or not set2:
        return 0.0
        
    intersection = set1.intersection(set2)
    union = set1.union(set2)
    return len(intersection) / len(union)

def calculate_ngram_overlap(text1: str, text2: str, n: int = 3) -> float:
    """
    Computes exact sequence N-gram matching percentage.
    """
    words1 = text1.lower().split()
    words2 = text2.lower().split()
    
    def get_ngrams(words):
        return set(" ".join(words[i:i+n]) for i in range(len(words)-n+1))
        
    ngrams1 = get_ngrams(words1)
    ngrams2 = get_ngrams(words2)
    
    if not ngrams1 or not ngrams2:
        return 0.0
        
    intersection = ngrams1.intersection(ngrams2)
    return len(intersection) / len(ngrams1)
