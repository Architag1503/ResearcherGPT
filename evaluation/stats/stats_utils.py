import math
import random
from typing import List, Dict, Any, Sequence, Tuple


def recall_at_k(ranked_ids: Sequence[str], relevant_ids: set[str], k: int) -> float:
    if not relevant_ids:
        return 0.0
    hits = sum(1 for item in ranked_ids[:k] if item in relevant_ids)
    return hits / len(relevant_ids)


def hit_at_k(ranked_ids: Sequence[str], relevant_ids: set[str], k: int) -> float:
    return 1.0 if any(item in relevant_ids for item in ranked_ids[:k]) else 0.0


def reciprocal_rank(ranked_ids: Sequence[str], relevant_ids: set[str]) -> float:
    for idx, item in enumerate(ranked_ids):
        if item in relevant_ids:
            return 1.0 / (idx + 1)
    return 0.0


def ndcg_at_k(ranked_ids: Sequence[str], relevant_ids: set[str], k: int) -> float:
    if not relevant_ids:
        return 0.0
    dcg = 0.0
    for idx, item in enumerate(ranked_ids[:k]):
        if item in relevant_ids:
            dcg += 1.0 / math.log2(idx + 2)
    ideal_hits = min(len(relevant_ids), k)
    idcg = sum(1.0 / math.log2(i + 2) for i in range(ideal_hits))
    return dcg / idcg if idcg > 0 else 0.0


def bootstrap_ci(
    values: Sequence[float],
    n_resamples: int = 2000,
    seed: int = 42,
    alpha: float = 0.05,
) -> Dict[str, float]:
    n = len(values)
    if n == 0:
        return {"mean": 0.0, "std": 0.0, "ci_low": 0.0, "ci_high": 0.0}
    mean_val = sum(values) / n
    var = sum((v - mean_val) ** 2 for v in values) / max(n - 1, 1)
    std_val = math.sqrt(var)
    if n == 1:
        return {"mean": mean_val, "std": 0.0, "ci_low": mean_val, "ci_high": mean_val}

    rng = random.Random(seed)
    boot_means: List[float] = []
    for _ in range(n_resamples):
        sample_sum = sum(values[rng.randrange(n)] for _ in range(n))
        boot_means.append(sample_sum / n)
    boot_means.sort()
    low_idx = int((alpha / 2.0) * n_resamples)
    high_idx = min(n_resamples - 1, int((1.0 - alpha / 2.0) * n_resamples))
    return {
        "mean": round(mean_val, 4),
        "std": round(std_val, 4),
        "ci_low": round(boot_means[low_idx], 4),
        "ci_high": round(boot_means[high_idx], 4),
    }


def paired_significance(
    a_scores: Sequence[float],
    b_scores: Sequence[float],
    n_perm: int = 5000,
    seed: int = 42,
) -> Dict[str, Any]:
    """
    Paired significance comparison between system A and baseline B (positive delta = A > B).
    Uses scipy.stats.wilcoxon when available alongside a paired sign-flip permutation p-value.
    """
    assert len(a_scores) == len(b_scores)
    diffs = [a - b for a, b in zip(a_scores, b_scores)]
    mean_diff = sum(diffs) / len(diffs) if diffs else 0.0

    wilcoxon_p = None
    try:
        from scipy.stats import wilcoxon
        if any(abs(d) > 1e-12 for d in diffs):
            _, wilcoxon_p = wilcoxon(diffs)
            wilcoxon_p = float(wilcoxon_p)
        else:
            wilcoxon_p = 1.0
    except Exception:
        pass

    rng = random.Random(seed)
    extreme = 0
    obs = abs(mean_diff)
    if diffs:
        for _ in range(n_perm):
            perm_sum = sum(d if rng.random() < 0.5 else -d for d in diffs)
            if abs(perm_sum / len(diffs)) >= obs - 1e-12:
                extreme += 1
        perm_p = (extreme + 1) / (n_perm + 1)
    else:
        perm_p = 1.0

    return {
        "mean_delta": round(mean_diff, 4),
        "wilcoxon_p": round(wilcoxon_p, 6) if wilcoxon_p is not None else None,
        "perm_p": round(perm_p, 6),
    }


def classification_metrics(y_true: Sequence[int], y_pred: Sequence[int]) -> Dict[str, float]:
    tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
    fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
    fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)
    tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    acc = (tp + tn) / len(y_true) if y_true else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "accuracy": round(acc, 4),
        "fpr": round(fpr, 4),
    }
