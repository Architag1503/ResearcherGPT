import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("QDRANT_HOST", "127.0.0.1")
os.environ.setdefault("QDRANT_PORT", "63999")
os.environ.setdefault("NEO4J_URI", "bolt://127.0.0.1:63998")
os.environ.setdefault("EXPRESS_API_URL", "http://127.0.0.1:59999")
os.environ.setdefault("EMBEDDING_PROVIDER", "hash")
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("FORMATEX_API_KEY", None)

AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_DIR))

from services import qdrant_service
from services.graph_service import neo4j_client
from services.formatex_service import FormaTeXService
from rag.hybrid_retriever import bm25_search, reciprocal_rank_fusion, retrieve_hybrid, query_knowledge_graph
from agents.verification.claim_verifier import verify_claim, verify_section_claims
from agents.router import qa_node


class Phase1RegressionTests(unittest.TestCase):
    def setUp(self):
        qdrant_service.fallback_store.clear()
        neo4j_client.in_memory_graphs.clear()

    def test_feature_hash_preserves_lexical_cosine_similarity(self):
        v1 = qdrant_service.get_fast_fallback_embedding(
            "Retrieval augmented generation improves factual grounding in academic synthesis",
            dim=384,
        )
        v_near = qdrant_service.get_fast_fallback_embedding(
            "Retrieval augmented generation improves factual attribution in scholarly synthesis",
            dim=384,
        )
        v_far = qdrant_service.get_fast_fallback_embedding(
            "Quantum chromodynamics lattice gauge simulation at finite temperature",
            dim=384,
        )
        import numpy as np
        sim_near = float(np.dot(v1, v_near))
        sim_far = float(np.dot(v1, v_far))
        self.assertGreater(sim_near, 0.5)
        self.assertLess(sim_far, 0.25)

    def test_search_relevant_chunks_propagates_chunk_index_and_scroll(self):
        chunks = [
            {"chunk_index": 0, "page_number": 1, "text_content": "Neural machine translation uses self attention."},
            {"chunk_index": 1, "page_number": 2, "text_content": "Exact acronym XYZQ99 appears only in lexical chunk."},
        ]
        qdrant_service.index_chunks("proj-1", "paper-a", chunks)
        hits = qdrant_service.search_relevant_chunks("proj-1", "self attention translation", limit=2)
        self.assertEqual(len(hits), 2)
        self.assertIsNotNone(hits[0]["chunk_index"])

        scrolled = qdrant_service.scroll_project_chunks("proj-1")
        self.assertEqual(len(scrolled), 2)
        self.assertEqual({c["chunk_index"] for c in scrolled}, {0, 1})

    def test_bm25_consistent_tokenization_with_punctuation(self):
        chunks = [
            {"paper_id": "p1", "chunk_index": 0, "text_content": "Multi-agent attention, attention! outperforms baselines."},
            {"paper_id": "p2", "chunk_index": 1, "text_content": "Conventional recurrent sequence modeling on audio frames."},
        ]
        ranked = bm25_search(chunks, "attention")
        self.assertEqual(ranked[0]["paper_id"], "p1")
        self.assertGreater(ranked[0]["keyword_score"], 0.0)
        self.assertEqual(ranked[1]["keyword_score"], 0.0)

    def test_hybrid_retriever_discovers_lexical_only_match_from_full_corpus(self):
        # Index 5 chunks; dense search limit*2 with limit=1 only grabs top 2 vector hits,
        # while lexical target chunk contains an uncommon token placed outside top dense hits.
        chunks = [
            {"chunk_index": 0, "page_number": 1, "text_content": "Distributed cognitive agents coordinate literature search."},
            {"chunk_index": 1, "page_number": 2, "text_content": "Distributed multi-agent systems coordinate paper review."},
            {"chunk_index": 2, "page_number": 3, "text_content": "Autonomous cognitive multi-agent pipelines for science."},
            {"chunk_index": 3, "page_number": 4, "text_content": "Distributed multi-agent cognitive literature synthesis pipeline."},
            {"chunk_index": 4, "page_number": 5, "text_content": "Appendix note on FZX7719 protocol synchronization benchmark."},
        ]
        qdrant_service.index_chunks("proj-cr1", "paper-lex", chunks)
        # Query combining broad semantic phrase + exact rare token FZX7719
        res = retrieve_hybrid("proj-cr1", "FZX7719", limit=2)
        self.assertTrue(any(r["chunk_index"] == 4 for r in res), f"Expected lexical chunk 4, got {res}")

    def test_knowledge_graph_boost_works_in_memory(self):
        neo4j_client.sync_graph(
            "proj-kg",
            nodes=[
                {"id": "paper_p1", "label": "Paper 1", "type": "paper", "val": 2},
                {"id": "paper_p2", "label": "Paper 2", "type": "paper", "val": 2},
                {"id": "ent_graph", "label": "GraphRAG", "type": "method", "val": 3},
            ],
            links=[{"source": "ent_graph", "target": "paper_p2", "label": "uses"}],
        )
        boosted = query_knowledge_graph("proj-kg", "How does GraphRAG help?")
        self.assertEqual(boosted, ["p2"])

        v = [{"paper_id": "p1", "chunk_index": 0, "text_content": "A"}, {"paper_id": "p2", "chunk_index": 0, "text_content": "B"}]
        fused = reciprocal_rank_fusion(v, [], boosted, k=60, kg_boost=1.3)
        self.assertEqual(fused[0]["paper_id"], "p2")

    def test_claim_verifier_numeric_refutation_and_post_draft_qa(self):
        ev = [{"text_content": "Our retriever achieved 78.5% Recall@5 over 100 benchmark queries.", "confidence_score": 0.9}]
        ok = verify_claim("The retriever achieved 78.5% Recall@5 on 100 benchmark queries.", ev, allow_llm=False)
        self.assertEqual(ok["status"], "verified")

        bad_num = verify_claim("The retriever achieved 99.4% Recall@5 over 500 benchmark queries.", ev, allow_llm=False)
        self.assertEqual(bad_num["status"], "refuted")

        state = {
            "run_id": "",
            "project_id": "proj-qa",
            "query": "Hybrid RAG",
            "paper_sections": [
                {"heading": "1. Introduction", "content": "Our retriever achieved 78.5% Recall@5 over 100 queries [1]. Unsupported hallucinated claim without any grounding context whatsoever [99]."}
            ],
            "citations": [{"title": "Paper 1", "authors": ["A"], "year": 2024}],
            "research_gaps": [],
            "fact_checks": [],
            "literature_reviews": [],
            "research_context": [{"paper_id": "p1", "page_number": 1, "text_content": "Our retriever achieved 78.5% Recall@5 over 100 benchmark queries."}],
            "logs": [],
        }
        updated = qa_node(state)
        qa = updated["final_output"]["qa_summary"]
        self.assertEqual(qa["valid_citation_refs"], 1)
        self.assertEqual(qa["invalid_citation_refs"], 1)
        self.assertGreaterEqual(qa["total_claims"], 2)

    def test_formatex_requires_env_key_without_hardcoded_secret(self):
        from services import formatex_service
        source_text = Path(formatex_service.__file__).read_text(encoding="utf-8")
        self.assertNotIn("fex_", source_text)
        prev_env = os.environ.pop("FORMATEX_API_KEY", None)
        prev_mod = formatex_service.API_KEY
        formatex_service.API_KEY = ""
        try:
            _, err = FormaTeXService._call_api("format", {"latex": "test"})
            self.assertIsNotNone(err)
            self.assertIn("FORMATEX_API_KEY", err)
        finally:
            formatex_service.API_KEY = prev_mod
            if prev_env is not None:
                os.environ["FORMATEX_API_KEY"] = prev_env

    def test_pdfplumber_table_extraction_returns_structured_tables(self):
        import tempfile
        import fitz
        from utils.pdf_processor import extract_tables_with_pdfplumber

        doc = fitz.open()
        page = doc.new_page()
        # Draw a clean 3x3 ruled table so pdfplumber line detection captures it cleanly
        x_coords = [50, 180, 310, 440]
        y_coords = [60, 90, 120, 150]
        for x in x_coords:
            page.draw_line((x, y_coords[0]), (x, y_coords[-1]))
        for y in y_coords:
            page.draw_line((x_coords[0], y), (x_coords[-1], y))
        rows = [
            ["System", "Recall@5", "MRR"],
            ["BM25", "0.71", "0.62"],
            ["HybridKG", "0.86", "0.78"],
        ]
        for r_i, row in enumerate(rows):
            for c_i, val in enumerate(row):
                page.insert_text((x_coords[c_i] + 10, y_coords[r_i] + 20), val)

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
            pdf_path = tf.name
        try:
            doc.save(pdf_path)
            doc.close()
            tables = extract_tables_with_pdfplumber(pdf_path)
            self.assertGreaterEqual(len(tables), 1)
            self.assertEqual(tables[0]["row_count"], 3)
            self.assertEqual(tables[0]["rows"][0][0], "System")
        finally:
            if os.path.exists(pdf_path):
                os.remove(pdf_path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
