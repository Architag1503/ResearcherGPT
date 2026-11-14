import json
from pathlib import Path
from typing import Dict, Any, List


DOMAINS = [
    {
        "name": "ir_rag_systems",
        "topic": "scholarly retrieval-augmented generation and hybrid vector indexing",
        "concepts": ["BM25 lexical scoring", "Reciprocal Rank Fusion", "Knowledge Graph boosting", "bi-encoder embeddings", "citation grounding"],
    },
    {
        "name": "multi_agent_orchestration",
        "topic": "stateful multi-agent academic planning and claim verification",
        "concepts": ["LangGraph state machines", "claim extraction", "evidence attribution", "planner routing", "consistency auditing"],
    },
    {
        "name": "document_integrity_extraction",
        "topic": "structural PDF parsing, LaTeX typesetting, and plagiarism detection",
        "concepts": ["MinHash shingling", "Winnowing fingerprints", "LaTeX AST parsing", "table bounding boxes", "entropy burstiness"],
    },
]


def build_retrieval_benchmark() -> Dict[str, Any]:
    """
    Constructs a deterministic 60-paper (180-chunk), 75-query scholarly retrieval benchmark
    stratified into:
      - 25 lexical/identifier queries (exact protocol codes, method acronyms, metric names)
      - 25 semantic paraphrase queries (zero exact keyword overlap with target concept phrase)
      - 25 multi-hop KG-linked queries (method/concept nodes bridged to target papers in KG)
    """
    documents: List[Dict[str, Any]] = []
    chunks: List[Dict[str, Any]] = []
    kg_nodes: List[Dict[str, Any]] = []
    kg_links: List[Dict[str, Any]] = []
    queries: List[Dict[str, Any]] = []

    seen_kg_entities = set()

    for idx in range(25):
        domain = DOMAINS[idx % len(DOMAINS)]
        paper_id = f"doc_{idx:03d}"
        code = f"RGX{100 + idx}"
        metric_tag = f"MTR{200 + idx}"
        entity_label = f"MethodNode{idx}"
        entity_id = f"ent_m_{idx}"

        documents.append({
            "paper_id": paper_id,
            "domain": domain["name"],
            "title": f"Study {idx} on {domain['concepts'][idx % 5]}",
            "year": 2021 + (idx % 5),
        })

        # Chunk 0: Dense background prose (distractor/context rich in shared domain vocabulary)
        c0_text = (
            f"This technical paper investigates {domain['topic']} across large scholarly collections. "
            f"Modern scientific pipelines frequently combine neural ranking with structured verification to "
            f"reduce unsupported assertions in automated literature synthesis workflows."
        )
        # Chunk 1: Lexical / exact identifier anchor placed separately from dense background
        c1_text = (
            f"Experimental telemetry module {code} records latency percentiles under controlled throughput. "
            f"Evaluation identifier {metric_tag} captures exact token boundaries across noisy PDF tables and "
            f"bibliography strings without altering downstream storage schemas."
        )
        # Chunk 2: Paraphrase + Entity-anchored synthesis description
        c2_text = (
            f"When human readers inspect empirical summaries produced via automated workflows, replacing "
            f"brittle heuristic checks with verifiable source passage provenance prevents fabricated numeric "
            f"arguments and improves trustworthiness across interdisciplinary manuscripts."
        )

        chunks.extend([
            {"chunk_id": f"{paper_id}_0", "paper_id": paper_id, "chunk_index": 0, "page_number": 1, "text_content": c0_text},
            {"chunk_id": f"{paper_id}_1", "paper_id": paper_id, "chunk_index": 1, "page_number": 3, "text_content": c1_text},
            {"chunk_id": f"{paper_id}_2", "paper_id": paper_id, "chunk_index": 2, "page_number": 5, "text_content": c2_text},
        ])

        kg_nodes.append({"id": f"paper_{paper_id}", "label": f"Study {idx}", "type": "paper", "val": 2})
        if entity_id not in seen_kg_entities:
            seen_kg_entities.add(entity_id)
            kg_nodes.append({"id": entity_id, "label": entity_label, "type": "method", "val": 3})
        kg_links.append({"source": entity_id, "target": f"paper_{paper_id}", "label": "evaluates"})

    # Add 35 realistic distractor papers (105 additional chunks = 180 chunks total)
    # Distractors intentionally contain high dense domain terms so CR-1 / dense-only must rank carefully.
    for d_idx in range(25, 60):
        domain = DOMAINS[d_idx % len(DOMAINS)]
        paper_id = f"doc_{d_idx:03d}"
        documents.append({
            "paper_id": paper_id,
            "domain": domain["name"],
            "title": f"Survey Distractor {d_idx} in {domain['concepts'][d_idx % 5]}",
            "year": 2020 + (d_idx % 6),
        })
        for c_i in range(3):
            chunks.append({
                "chunk_id": f"{paper_id}_{c_i}",
                "paper_id": paper_id,
                "chunk_index": c_i,
                "page_number": c_i + 1,
                "text_content": (
                    f"Comparative survey section {c_i} examining {domain['topic']} and {domain['concepts'][c_i % 5]}. "
                    f"Prior literature discusses vector similarity, BM25 term weighting, knowledge graphs, "
                    f"academic integrity scoring, and multi-agent coordination protocols in distributed software."
                ),
            })
        kg_nodes.append({"id": f"paper_{paper_id}", "label": f"Survey Distractor {d_idx}", "type": "paper", "val": 1})

    # Make semantic target chunks distinct across the 25 paraphrase queries so dense bi-encoders discriminate well
    paraphrase_facts = [
        ("autonomous astronomical spectroscopy telescope calibration pipeline", "automated starlight spectral dispersion alignment workflow"),
        ("cardiovascular echocardiography ventricular strain imaging", "ultrasonic heart chamber contraction motion estimation"),
        ("perovskite photovoltaic solar cell degradation stability", "halide crystalline light-harvesting module aging resilience"),
        ("seismic waveform microearthquake arrival picking", "subsurface crustal tremor onset detection algorithm"),
        ("oceanic thermohaline circulation salinity buoy array", "deep seawater density stratification autonomous sensor network"),
        ("protein folding intrinsically disordered peptide dynamics", "unstructured amino acid chain conformational flexibility"),
        ("compiler loop unrolling register pressure scheduling", "low-level instruction optimization hardware slot allocation"),
        ("federated healthcare differential privacy gradient clipping", "decentralized clinical training statistical noise bound"),
        ("lidar point cloud autonomous vehicle pedestrian tracking", "laser depth scan urban walker trajectory prediction"),
        ("electrochemical lithium sulfur battery cathode polysulfide", "rechargeable energy storage electrode dissolution mitigation"),
        ("glacier basal sliding subglacial hydrology runoff", "ice sheet bedrock lubrication meltwater drainage model"),
        ("metamaterial acoustic cloaking Helmholtz resonator", "engineered sound wave redirection cavity array"),
        ("agricultural drought evapotranspiration satellite thermal", "cropland moisture loss orbital infrared monitoring"),
        ("quantum error correction surface code stabilizer syndrome", "fault tolerant qubit parity check measurement"),
        ("natural gas pipeline acoustic leak localization", "pressurized conduit rupture soundwave triangulation"),
        ("histopathology whole slide mitotic figure counting", "microscopic tissue biopsy cell division identification"),
        ("wind turbine blade aerodynamic flutter damping", "rotary energy airfoil vibration suppression control"),
        ("medieval manuscript parchment multispectral ink recovery", "ancient vellum hidden script optical wavelength imaging"),
        ("semiconductor lithography extreme ultraviolet photoresist", "microchip patterning short wavelength photosensitive film"),
        ("urban traffic signal reinforcement learning queue spillback", "city intersection timing congestion overflow prevention"),
        ("coral reef bleaching thermal stress symbiont expulsion", "marine warming algal loss calcification decline"),
        ("speech dereverberation binaural hearing aid beamforming", "room echo suppression dual ear directional filtering"),
        ("blockchain zero knowledge succinct arithmetic circuit", "cryptographic verifiable computation compact proof constraint"),
        ("bridge cable stays ambient vibration modal identification", "suspension span structural oscillation frequency analysis"),
        ("antibiotic resistance plasmid horizontal gene transfer", "microbial drug immunity mobile DNA exchange"),
    ]

    for idx in range(25):
        paper_id = f"doc_{idx:03d}"
        src_fact, para_query = paraphrase_facts[idx]
        target_chunk_idx = idx * 3 + 2
        # Place both paraphrased scientific fact and shared multi-hop bridge anchor in chunk 2
        chunks[target_chunk_idx]["text_content"] = (
            f"Domain study focused on {src_fact}. "
            f"Experimental validation demonstrates reliable reproducibility under offline evaluation protocol {idx}."
        )
        # Also include exact code in chunk 1 alongside heavy distractor domain context
        code = f"RGX{100 + idx}"
        metric_tag = f"MTR{200 + idx}"
        chunks[idx * 3 + 1]["text_content"] = (
            f"Benchmark evaluation log {code} and diagnostic trace {metric_tag} evaluate "
            f"scholarly retrieval-augmented generation and hybrid vector indexing under dense distractor interference."
        )

        # Stratum A: Lexical / Exact Identifier (requires exact code/metric matching despite high dense domain distractors)
        queries.append({
            "query_id": f"q_lex_{idx:02d}",
            "stratum": "lexical_identifier",
            "query": f"hybrid vector indexing telemetry {code} {metric_tag}",
            "relevant_chunk_ids": [f"{paper_id}_1"],
            "relevant_paper_ids": [paper_id],
        })

        # Stratum B: Semantic Paraphrase (low lexical overlap; favors dense embeddings over BM25)
        queries.append({
            "query_id": f"q_sem_{idx:02d}",
            "stratum": "semantic_paraphrase",
            "query": para_query,
            "relevant_chunk_ids": [f"{paper_id}_2"],
            "relevant_paper_ids": [paper_id],
        })

        # Stratum C: Multi-Hop KG-Linked (query names MethodNode{idx} linked in KG to paper_id + topic clue)
        domain = DOMAINS[idx % len(DOMAINS)]
        queries.append({
            "query_id": f"q_kg_{idx:02d}",
            "stratum": "multihop_kg",
            "query": f"How does MethodNode{idx} advance {domain['topic']}?",
            "relevant_chunk_ids": [f"{paper_id}_0", f"{paper_id}_2"],
            "relevant_paper_ids": [paper_id],
        })

    return {
        "project_id": "eval_retrieval_proj",
        "num_papers": len(documents),
        "num_chunks": len(chunks),
        "num_queries": len(queries),
        "documents": documents,
        "chunks": chunks,
        "knowledge_graph": {"nodes": kg_nodes, "links": kg_links},
        "queries": queries,
    }


def save_manifest(output_path: Path) -> Path:
    manifest = build_retrieval_benchmark()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Save readable summary + full data manifest
    output_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return output_path


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "manifests" / "retrieval_manifest.json"
    saved = save_manifest(out)
    print(f"Saved retrieval manifest to {saved}")
