import csv
import json
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Dict, Any, List

import fitz

os.environ["GEMINI_API_KEY"] = "your_gemini_api_key"
os.environ.pop("FORMATEX_API_KEY", None)

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
AI_DIR = ROOT_DIR / "ai-service"
EVAL_DIR = ROOT_DIR / "evaluation"
for p in (str(AI_DIR), str(EVAL_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from stats.stats_utils import bootstrap_ci
from utils.pdf_processor import extract_pdf_content, chunk_text
from services.paper_validator import PaperValidator


def create_synthetic_academic_pdf(path: str, doc_idx: int) -> Dict[str, Any]:
    doc = fitz.open()
    p1 = doc.new_page(width=595, height=842)
    title = f"Evaluation Study {doc_idx}: Structured Multi-Agent Document Analysis"
    doi = f"10.1109/RG.{2024 + (doc_idx % 3)}.{1000 + doc_idx}"

    p1.insert_text((50, 60), title, fontsize=13)
    p1.insert_text((50, 82), f"Authors: Researcher A, Researcher B   DOI: {doi}", fontsize=9)

    # Two-column text blocks
    left_col = (
        "1. Introduction\n"
        "Automated scholarly synthesis requires reliable structural extraction across dense multi-column PDF files.\n"
        "When table geometry or mathematical identifiers are discarded, downstream RAG agents lose precision.\n"
    )
    right_col = (
        "2. Methodology\n"
        "We combine PyMuPDF text stream parsing with pdfplumber grid extraction to recover structured rows.\n"
        "Every chunk retains page provenance metadata for downstream verification checks.\n"
    )
    p1.insert_textbox(fitz.Rect(50, 110, 285, 290), left_col, fontsize=10)
    p1.insert_textbox(fitz.Rect(305, 110, 545, 290), right_col, fontsize=10)

    # Ruled 4x3 table on page 2 (or page 1 lower half)
    x_coords = [60, 210, 360, 510]
    y_coords = [340, 370, 400, 430, 460]
    for x in x_coords:
        p1.draw_line((x, y_coords[0]), (x, y_coords[-1]))
    for y in y_coords:
        p1.draw_line((x_coords[0], y), (x_coords[-1], y))

    table_data = [
        ["Method", "Recall@5", "Latency(ms)"],
        ["DenseOnly", f"{0.60 + 0.01 * (doc_idx % 5):.2f}", f"{12 + doc_idx}"],
        ["BM25Only", f"{0.72 + 0.01 * (doc_idx % 4):.2f}", f"{8 + doc_idx}"],
        ["HybridKG", f"{0.88 + 0.01 * (doc_idx % 3):.2f}", f"{15 + doc_idx}"],
    ]
    for r_i, row in enumerate(table_data):
        for c_i, cell in enumerate(row):
            p1.insert_text((x_coords[c_i] + 8, y_coords[r_i] + 20), cell, fontsize=10)

    doc.save(path)
    doc.close()
    return {
        "doc_id": f"pdf_{doc_idx:02d}",
        "expected_tables": 1,
        "expected_rows": 4,
        "expected_doi": doi,
        "expected_tokens": ["Introduction", "Methodology", "PyMuPDF", "pdfplumber", "HybridKG"],
    }


def main():
    per_doc_rows: List[Dict[str, Any]] = []

    with tempfile.TemporaryDirectory() as tmpdir:
        for i in range(15):
            pdf_path = str(Path(tmpdir) / f"synthetic_paper_{i:02d}.pdf")
            gt = create_synthetic_academic_pdf(pdf_path, i)

            t0 = time.perf_counter()
            extracted = extract_pdf_content(pdf_path)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            chunks = chunk_text(extracted["pages"], metadata=extracted["metadata"])

            full_text = "\n".join(p["text"] for p in extracted["pages"])
            token_recall = sum(1 for tok in gt["expected_tokens"] if tok in full_text) / len(gt["expected_tokens"])
            doi_match = 1 if extracted["metadata"].get("doi") == gt["expected_doi"] else 0
            extracted_tables = extracted.get("tables", [])
            table_recall = 1.0 if len(extracted_tables) >= gt["expected_tables"] else 0.0
            row_accuracy = 1.0 if (extracted_tables and extracted_tables[0]["row_count"] == gt["expected_rows"]) else 0.0

            per_doc_rows.append({
                "doc_id": gt["doc_id"],
                "num_pages": len(extracted["pages"]),
                "num_chunks": len(chunks),
                "token_recall": token_recall,
                "doi_match": doi_match,
                "baseline_pymupdf_table_recall": 0.0,  # Baseline hardcoded tables=[]
                "pdfplumber_table_recall": table_recall,
                "table_row_exact": row_accuracy,
                "latency_ms": round(elapsed_ms, 2),
            })

    # Real manuscript PDF audit on uploaded paper artifact (read-only)
    real_pdf_path = Path(r"C:/Users/Archit Gupta/.gemini/antigravity/brain/40e311ae-0ded-49f5-ade5-0fc72bfd7847/.user_uploaded/media_1794371999709_584962b6.pdf")
    real_pdf_audit = None
    if real_pdf_path.exists():
        t0 = time.perf_counter()
        ext_real = extract_pdf_content(str(real_pdf_path))
        real_ms = (time.perf_counter() - t0) * 1000.0
        real_chunks = chunk_text(ext_real["pages"], metadata=ext_real["metadata"])
        real_pdf_audit = {
            "filename": "ResearcherGPT_Research_Paper_Final_v2.pdf",
            "pages": len(ext_real["pages"]),
            "chunks": len(real_chunks),
            "tables_detected": len(ext_real.get("tables", [])),
            "latency_ms": round(real_ms, 2),
        }

    # PaperValidator structure normalization, reference & paragraph deduplication check
    sample_sections = [
        {"title": "Abstract", "content": "Abstract: Structured extraction improves downstream synthesis."},
        {"title": "III. III. Introduction", "content": "<p>Repeated paragraph block for deduplication.</p>"},
        {"title": "2. Methodology", "content": "<p>Repeated paragraph block for deduplication.</p><p>Unique methodology block.</p>"},
    ]
    sample_refs = ["[1] Author A, Paper One, 2024.", "Author A, Paper One, 2024.", "[2] Author B, Paper Two, 2023."]
    sanitized = PaperValidator.sanitize_paper_structure("Evaluation Manuscript", sample_sections, sample_refs)

    results_dir = EVAL_DIR / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    csv_path = results_dir / "extraction_per_doc.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(per_doc_rows[0].keys()))
        writer.writeheader()
        writer.writerows(per_doc_rows)

    summary = {
        "benchmark": "document_extraction_and_validation_v1",
        "num_synthetic_pdfs": len(per_doc_rows),
        "token_recall": bootstrap_ci([r["token_recall"] for r in per_doc_rows]),
        "doi_exact_match": bootstrap_ci([r["doi_match"] for r in per_doc_rows]),
        "baseline_table_recall": 0.0,
        "pdfplumber_table_recall": bootstrap_ci([r["pdfplumber_table_recall"] for r in per_doc_rows]),
        "table_row_exact": bootstrap_ci([r["table_row_exact"] for r in per_doc_rows]),
        "latency_ms": bootstrap_ci([r["latency_ms"] for r in per_doc_rows]),
        "real_pdf_artifact_audit": real_pdf_audit,
        "paper_validator_check": {
            "abstract_extracted": sanitized["abstract"],
            "normalized_headings": [s["heading"] for s in sanitized["sections"]],
            "deduped_ref_count": len(sanitized["references"]),
            "input_ref_count": len(sample_refs),
        },
    }
    json_path = results_dir / "extraction_summary.json"
    json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {csv_path} and {json_path}")


if __name__ == "__main__":
    main()
