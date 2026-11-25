import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

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

    def test_strict_user_keys_and_429_resilience_during_pdf_processing(self):
        import tempfile
        import fitz
        from unittest.mock import patch, MagicMock
        from agents import router
        from utils import pdf_processor
        from services import graph_service

        # Even if personal .env keys exist, call_model must refuse to use them when user_api_keys is empty
        prev_env = {k: os.environ.get(k) for k in ("GEMINI_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY")}
        os.environ["GEMINI_API_KEY"] = "env_personal_gemini_key"
        os.environ["GROQ_API_KEY"] = "env_personal_groq_key"
        os.environ["OPENAI_API_KEY"] = "env_personal_openai_key"
        os.environ["ANTHROPIC_API_KEY"] = "env_personal_anthropic_key"
        try:
            with self.assertRaises(ValueError):
                router.call_model("writer", "system", "user", user_api_keys={"is_owner": True})

            # Verify call_model cascades from user Groq 429 -> user Gemini key (never .env keys)
            seen_urls = []
            def fake_post(url, headers=None, json=None, timeout=None):
                seen_urls.append((url, (headers or {}).get("Authorization", "")))
                resp = MagicMock()
                if "groq.com" in url:
                    resp.status_code = 429
                    resp.text = "rate_limit"
                    return resp
                resp.status_code = 200
                resp.text = "{}"
                resp.json.return_value = {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "user_gemini_ok"}]}}]}
                return resp

            with patch("agents.router.requests.post", side_effect=fake_post), patch("agents.router.time.sleep"):
                out = router.call_model(
                    "writer",
                    "system",
                    "hello",
                    user_api_keys={"groq": "user_groq_123", "gemini": "user_gemini_456", "is_owner": True},
                )
            self.assertEqual(out, "user_gemini_ok")
            self.assertTrue(any("key=user_gemini_456" in u for u, _ in seen_urls))
            self.assertFalse(any("env_personal" in u or "env_personal" in auth for u, auth in seen_urls))

            # Verify PDF extraction + chunking + indexing + graph succeed even if user API returns 429
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((72, 72), "GraphRAG Paper Title\nAbstract: We study multi-hop retrieval.")
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
                pdf_path = tf.name
            try:
                doc.save(pdf_path)
                doc.close()

                def always_429(url, headers=None, json=None, timeout=None):
                    resp = MagicMock()
                    resp.status_code = 429
                    resp.text = "rate_limit_exceeded"
                    return resp

                with patch("utils.pdf_processor.requests.post", side_effect=always_429), \
                     patch("services.qdrant_service.requests.post", side_effect=always_429), \
                     patch("services.graph_service.requests.post", side_effect=always_429), \
                     patch("time.sleep"):
                    parsed = pdf_processor.extract_pdf_content(pdf_path, user_api_keys={"gemini": "user_gemini_456"})
                    chunks = pdf_processor.chunk_text(parsed["pages"], metadata=parsed["metadata"])
                    indexed = qdrant_service.index_chunks("proj-429", "paper-429", chunks, user_api_keys={"gemini": "user_gemini_456"})
                    graph = graph_service.build_project_graph(
                        "proj-429",
                        [{"_id": "paper-429", "title": parsed["metadata"]["title"], "abstract": "Transformer RAG", "authors": ["Alice"]}],
                        user_api_keys={"gemini": "user_gemini_456"},
                    )
                self.assertGreaterEqual(len(indexed), 1)
                self.assertGreaterEqual(len(graph["nodes"]), 1)
            finally:
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
        finally:
            for k, v in prev_env.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v

    def test_agent_run_accepts_non_string_values_in_user_api_keys_and_json_list_prompts(self):
        from fastapi.testclient import TestClient
        from agents import router
        import main

        self.assertFalse(router._wants_json_object("You must output a JSON list of objects."))
        self.assertTrue(router._wants_json_object("Return strictly as a JSON object."))
        unwrapped = router.parse_json_list_of_dicts('{"gaps": [{"title": "Gap A", "description": "Details"}]}')
        self.assertEqual(unwrapped[0]["title"], "Gap A")

        with patch.object(main, "run_agent_workflow_in_background") as mock_bg:
            client = TestClient(main.app)
            resp = client.post(
                "/api/agent/run",
                json={
                    "run_id": "run-123",
                    "project_id": "proj-123",
                    "query": "Multi-Agent GraphRAG",
                    "workflow_type": "paper",
                    "format": "IEEE",
                    "pages": 5,
                    "user_api_keys": {
                        "groq": "user_groq",
                        "gemini": "user_gemini",
                        "openai": "user_openai",
                        "anthropic": "user_anthropic",
                        "is_owner": False,
                    },
                },
            )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json().get("status"), "running")
            mock_bg.assert_called_once()

        # Also exercise the real compiled LangGraph `agent_workflow` end-to-end with `user_api_keys`
        callbacks = []

        def fake_report_progress(run_id, step_name, status, logs="", output=None, overall_status=None, result=None):
            callbacks.append({
                "run_id": run_id,
                "step_name": step_name,
                "status": status,
                "overall_status": overall_status,
                "result": result,
            })

        def fake_call_model(role, system_prompt, user_prompt, user_api_keys=None):
            if role == "planner":
                return '["Subtopic A", "Subtopic B"]'
            if role == "literature_review":
                return '[{"author": "Alice", "year": 2025, "method": "GraphRAG", "dataset": "HotpotQA", "results": "94%", "limitation": "Latency"}]'
            if role == "methodology_extraction":
                return '[{"paper": "GraphRAG", "architecture": "Hierarchical", "dataset": "HotpotQA", "algorithm": "BFS"}]'
            if role == "comparison":
                return '[{"paper": "GraphRAG", "accuracy": "94%", "latency": "120ms", "parameters": "1M", "strengths": "Recall", "weaknesses": "Cost"}]'
            if role == "trend_analysis":
                return '[{"trend": "Graph indexing", "evidence": "Higher recall", "confidence": 0.9}]'
            if role == "gap_analysis":
                return '[{"title": "Scalability", "description": "Detailed gap description.", "evidence": ["Evidence 1"], "category": "methodological", "impactScore": 8, "feasibilityScore": 7}]'
            if role == "contradiction_detection":
                return '[{"conflict_area": "Chunking", "paper_a": "A", "claim_a": "Small", "paper_b": "B", "claim_b": "Large", "resolution": "Adaptive"}]'
            if role == "fact_verification":
                return '[{"claim": "Recall improved", "status": "verified", "confidenceScore": 0.9, "analysis": "Supported", "sources": [{"paperTitle": "GraphRAG", "pageNumber": 1, "snippet": "Improved recall", "confidenceScore": 0.9}]}]'
            if role == "reviewer":
                return "Strong methodology and coherent structure."
            return "## Title\nSample Title\n\n## Abstract\nSample abstract content for testing.\n\n## 1. Introduction\nDetailed introduction content with verified claims."

        with patch.object(router, "report_progress", side_effect=fake_report_progress), \
             patch.object(router, "call_model", side_effect=fake_call_model), \
             patch.object(router, "search_academic_papers", return_value=[]), \
             patch.object(router, "get_project_papers", return_value=[]):
            main.run_agent_workflow_in_background(
                "run-e2e",
                "proj-e2e",
                "Multi-Agent GraphRAG",
                workflow_type="paper",
                format="IEEE",
                pages=5,
                user_api_keys={
                    "groq": "user_groq",
                    "gemini": "user_gemini",
                    "openai": "user_openai",
                    "anthropic": "user_anthropic",
                },
            )
        completed = [c for c in callbacks if c["overall_status"] == "completed"]
        failed = [c for c in callbacks if c["overall_status"] == "failed"]
        self.assertEqual(failed, [])
        self.assertEqual(len(completed), 1)
        self.assertIn("sections", completed[0]["result"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
