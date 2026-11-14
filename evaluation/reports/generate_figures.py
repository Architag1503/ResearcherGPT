"""Generate publication-quality IEEE figures strictly from verified evaluation JSON results."""

import json
import os
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path(__file__).resolve().parents[1] / ".mplconfig"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
RESULTS_DIR = ROOT / "evaluation" / "results"
FIG_DIR = ROOT / "research-paper" / "final" / "figures"
FIG_DIR.mkdir(parents=True, exist_ok=True)


def setup_style() -> None:
    plt.rcParams.update({
        "font.family": "serif",
        "font.size": 8.8,
        "axes.titlesize": 9.8,
        "axes.labelsize": 8.8,
        "xtick.labelsize": 7.8,
        "ytick.labelsize": 7.8,
        "legend.fontsize": 7.4,
        "figure.dpi": 300,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "grid.alpha": 0.25,
        "grid.linestyle": "--",
    })


def plot_retrieval_ablation() -> Path:
    data = json.loads((RESULTS_DIR / "retrieval_summary.json").read_text(encoding="utf-8"))
    configs = data["configs"]

    order = [
        ("M0_HashDenseOnly", "M0 Hash"),
        ("M2_BM25FullCorpus", "M2 BM25"),
        ("M1_MiniLMDenseOnly", "M1 MiniLM"),
        ("M3_PreFixBuggyHybrid_CR1", "M3 CR-1"),
        ("M4_FixedHybrid_NoKG_beta1.0", "M4 Hybrid"),
        ("M5_FixedHybrid_KG_MultOnly_beta1.30", "M5 KG-Mult"),
        ("M7_FixedHybrid_KG_Channel_w0.75", "M7 w=0.75"),
        ("M8_FixedHybrid_KG_Channel_w1.00", "M8 w=1.00"),
    ]

    labels = [lbl for _, lbl in order]
    recalls = [configs[k]["recall_at_5"]["mean"] for k, _ in order]
    ci_low = [configs[k]["recall_at_5"]["mean"] - configs[k]["recall_at_5"]["ci_low"] for k, _ in order]
    ci_high = [configs[k]["recall_at_5"]["ci_high"] - configs[k]["recall_at_5"]["mean"] for k, _ in order]
    multihop_r5 = [configs[k]["by_stratum"]["multihop_kg"]["recall_at_5"]["mean"] for k, _ in order]
    lex_mrr = [configs[k]["by_stratum"]["lexical_identifier"]["mrr"]["mean"] for k, _ in order]

    x = np.arange(len(labels))
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(7.6, 3.25), constrained_layout=True)

    colors = ["#9aa0a6", "#9aa0a6", "#6baed6", "#e6550d", "#3182bd", "#756bb1", "#1b9e77", "#006d2c"]
    bars = ax1.bar(x, recalls, yerr=[ci_low, ci_high], capsize=2.5, color=colors, edgecolor="#222222", linewidth=0.5)
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels, rotation=28, ha="right")
    ax1.set_ylim(0, 1.12)
    ax1.set_ylabel("Overall Recall@5 (95% CI)")
    ax1.set_title("(a) Overall Retrieval Recall@5")
    for bar, hi, val in zip(bars, ci_high, recalls):
        ax1.text(bar.get_x() + bar.get_width() / 2, val + hi + 0.025, f"{val:.2f}", ha="center", va="bottom", fontsize=7.0)

    width = 0.36
    b1 = ax2.bar(x - width / 2, multihop_r5, width, label="Multi-hop KG Recall@5", color="#1b9e77", edgecolor="#222222", linewidth=0.5)
    b2 = ax2.bar(x + width / 2, lex_mrr, width, label="Lexical ID MRR", color="#3182bd", edgecolor="#222222", linewidth=0.5)
    ax2.set_xticks(x)
    ax2.set_xticklabels(labels, rotation=28, ha="right")
    ax2.set_ylim(0, 1.24)
    ax2.set_ylabel("Stratum Score")
    ax2.set_title("(b) Multi-hop & Lexical Breakdown")
    ax2.legend(loc="upper center", ncol=2, frameon=True, bbox_to_anchor=(0.5, 1.01))
    for bar, val in zip(b1, multihop_r5):
        if val > 0.01:
            ax2.text(bar.get_x() + bar.get_width() / 2, val + 0.02, f"{val:.2f}", ha="center", va="bottom", fontsize=6.6)

    out = FIG_DIR / "retrieval_ablation.png"
    fig.savefig(out, dpi=300)
    plt.close(fig)
    return out


def plot_grounding_and_integrity() -> Path:
    gdata = json.loads((RESULTS_DIR / "grounding_summary.json").read_text(encoding="utf-8"))
    idata = json.loads((RESULTS_DIR / "integrity_summary.json").read_text(encoding="utf-8"))

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(7.6, 3.3), constrained_layout=True)

    # Panel (a): Claim Grounding
    v_keys = ["V0_LegacyFallback", "V1_LexicalNumeric", "V2_HybridMiniLMNumeric"]
    v_labels = ["V0 Legacy\nFallback", "V1 Lexical+\nNumeric", "V2 Hybrid\nMiniLM+Num"]
    acc_vals = [gdata["systems"][k]["binary_support_detection"]["accuracy"] for k in v_keys]
    fpr_vals = [gdata["systems"][k]["binary_support_detection"]["fpr"] for k in v_keys]
    way3_vals = [gdata["systems"][k]["three_way_accuracy"]["mean"] for k in v_keys]

    x1 = np.arange(len(v_labels))
    w = 0.24
    ax1.bar(x1 - w, acc_vals, w, label="Binary Acc.", color="#3182bd", edgecolor="#222", linewidth=0.5)
    ax1.bar(x1, way3_vals, w, label="3-Way Acc.", color="#1b9e77", edgecolor="#222", linewidth=0.5)
    ax1.bar(x1 + w, fpr_vals, w, label="FPR (Ref./Unv.)", color="#d95f02", edgecolor="#222", linewidth=0.5)
    ax1.set_xticks(x1)
    ax1.set_xticklabels(v_labels)
    ax1.set_ylim(0, 1.28)
    ax1.set_ylabel("Score")
    ax1.set_title("(a) Claim Grounding (n = 90)")
    ax1.legend(loc="upper center", ncol=3, frameon=True, fontsize=6.7, bbox_to_anchor=(0.5, 1.01))
    for i, (a, w3, f) in enumerate(zip(acc_vals, way3_vals, fpr_vals)):
        ax1.text(i - w, a + 0.02, f"{a:.2f}", ha="center", va="bottom", fontsize=6.9)
        ax1.text(i, w3 + 0.02, f"{w3:.2f}", ha="center", va="bottom", fontsize=6.9)
        ax1.text(i + w, f + 0.02, f"{f:.2f}", ha="center", va="bottom", fontsize=6.9)

    # Panel (b): Integrity Pre- vs Post-fix Detection Rate by Stratum
    cats = [
        ("verbatim_exact", "Verbatim"),
        ("localized_patchwrite", "Patchwrite"),
        ("structure_formula_code", "Struct/Math"),
        ("citation_overlap", "Citations"),
        ("semantic_paraphrase", "Paraphrase"),
        ("clean_negative_control", "Clean Ctrl"),
    ]
    pre_rates = [idata["by_category"][c]["prefix_rate"]["mean"] for c, _ in cats]
    post_rates = [idata["by_category"][c]["postfix_rate"]["mean"] for c, _ in cats]
    c_labels = [lbl for _, lbl in cats]

    x2 = np.arange(len(c_labels))
    w2 = 0.35
    ax2.bar(x2 - w2 / 2, pre_rates, w2, label="Pre-fix", color="#9aa0a6", edgecolor="#222", linewidth=0.5)
    ax2.bar(x2 + w2 / 2, post_rates, w2, label="Post-fix", color="#1b9e77", edgecolor="#222", linewidth=0.5)
    ax2.set_xticks(x2)
    ax2.set_xticklabels(c_labels, rotation=24, ha="right")
    ax2.set_ylim(0, 1.28)
    ax2.set_ylabel("Flagged Detection Rate")
    ax2.set_title("(b) Integrity Detection by Stratum (n = 60)")
    ax2.legend(loc="upper center", ncol=2, frameon=True, fontsize=7.0, bbox_to_anchor=(0.5, 1.01))
    for i, (pr, po) in enumerate(zip(pre_rates, post_rates)):
        if po > 0:
            ax2.text(i + w2 / 2, po + 0.02, f"{po:.2f}", ha="center", va="bottom", fontsize=6.9)
        else:
            ax2.text(i + w2 / 2, 0.03, "0.00", ha="center", va="bottom", fontsize=6.9)

    out = FIG_DIR / "grounding_and_integrity.png"
    fig.savefig(out, dpi=300)
    plt.close(fig)
    return out


def plot_architecture_overview() -> Path:
    """Clean system architecture diagram aligned strictly with verified implementation."""
    fig, ax = plt.subplots(figsize=(7.6, 3.5), constrained_layout=True)
    ax.set_xlim(0, 10.2)
    ax.set_ylim(0, 5.2)
    ax.axis("off")

    def draw_box(x, y, w, h, title, body, fc="#f7fbff", ec="#2b5c8f"):
        rect = plt.Rectangle((x, y), w, h, facecolor=fc, edgecolor=ec, linewidth=1.15, zorder=2)
        ax.add_patch(rect)
        ax.text(x + w / 2, y + h - 0.20, title, ha="center", va="top", fontsize=7.8, fontweight="bold", color="#111111", zorder=3)
        ax.text(x + w / 2, y + h / 2 - 0.14, body, ha="center", va="center", fontsize=6.9, color="#222222", zorder=3)

    draw_box(0.15, 3.65, 3.05, 1.30, "1. Document & Table Ingestion",
             "PyMuPDF text + DOI regex\npdfplumber ruled-table matrix\nChunking + chunk_index metadata", fc="#edf8fb", ec="#006d2c")
    draw_box(3.57, 3.65, 3.05, 1.30, "2. Dual Indexing Backends",
             "Qdrant / Cosine In-Memory\nMiniLM-L6-v2 (384d) + blake2b\nNeo4j / NetworkX Graph Cache", fc="#edf8fb", ec="#006d2c")
    draw_box(7.00, 3.65, 3.05, 1.30, "3. Hybrid + KG Retrieval",
             "Dense Top-2k + Full-Corpus BM25\nRRF Fusion + beta*KG Boost\nKG Candidate-Channel (w=0.75..1.0)", fc="#e0f3db", ec="#006d2c")

    draw_box(0.15, 1.85, 4.70, 1.25, "4. 13-Node Linear LangGraph Synthesis",
             "Planner -> Search -> Cluster -> Rank -> Outline\n-> Sections -> References -> LaTeX -> Verify QA\nFallback routing via gemini-2.5-flash", fc="#f2f0f7", ec="#54278f")
    draw_box(5.35, 1.85, 4.70, 1.25, "5. Post-Draft Claim & Citation Audit",
             "verify_section_claims (MiniLM + Bigram + Numeric)\nDetects numeric inversion & dangling [ref_id]\nPopulates final_output['qa_summary']", fc="#f2f0f7", ec="#54278f")

    draw_box(0.15, 0.20, 4.70, 1.20, "6. Express Academic Integrity Engine",
             "MinHash + Winnowing (k=5, w=4) Exact Match\nShared Struct/Formula/Code Extractor + Citations\nFail-closed Auth & Dual-Schema React UI", fc="#fff7ec", ec="#b30000")
    draw_box(5.35, 0.20, 4.70, 1.20, "7. Verification & Export Artifacts",
             "PaperValidator (Roman headings, deduped refs)\nFormaTeX LaTeX Service (env FORMATEX_API_KEY)\n5 Offline Evaluation Suites & CSV/JSON Audit", fc="#fff7ec", ec="#b30000")

    arrow_kw = dict(arrowstyle="-|>", color="#444444", lw=1.1, mutation_scale=11)
    ax.annotate("", xy=(3.54, 4.30), xytext=(3.23, 4.30), arrowprops=arrow_kw)
    ax.annotate("", xy=(6.97, 4.30), xytext=(6.65, 4.30), arrowprops=arrow_kw)
    ax.annotate("", xy=(2.50, 3.13), xytext=(8.52, 3.62), arrowprops=arrow_kw)
    ax.annotate("", xy=(5.32, 2.48), xytext=(4.88, 2.48), arrowprops=arrow_kw)
    ax.annotate("", xy=(7.70, 1.43), xytext=(7.70, 1.82), arrowprops=arrow_kw)
    ax.annotate("", xy=(5.32, 0.80), xytext=(4.88, 0.80), arrowprops=arrow_kw)

    out = FIG_DIR / "architecture_overview.png"
    fig.savefig(out, dpi=300)
    plt.close(fig)
    return out


def main() -> None:
    setup_style()
    p1 = plot_retrieval_ablation()
    p2 = plot_grounding_and_integrity()
    p3 = plot_architecture_overview()
    print("Generated figures:")
    for p in (p1, p2, p3):
        print(f"  {p}")


if __name__ == "__main__":
    main()
