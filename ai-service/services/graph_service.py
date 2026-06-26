import os
import re
import json
import requests
from typing import Dict, Any, List
import networkx as nx
from neo4j import GraphDatabase

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "research_password_123")

class Neo4jClient:
    def __init__(self):
        self.driver = None
        try:
            self.driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
            self.driver.verify_connectivity()
            print("Connected to Neo4j graph database.")
        except Exception as e:
            print(f"Neo4j connectivity failed: {str(e)}. Falling back to local NetworkX structures.")
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    def sync_graph(self, project_id: str, nodes: List[Dict[str, Any]], links: List[Dict[str, Any]]):
        if not self.driver:
            return
        
        query_delete = "MATCH (n {projectId: $projectId}) DETACH DELETE n"
        query_create_node = """
        MERGE (n:Entity {id: $id, projectId: $projectId})
        SET n.label = $label, n.type = $type, n.val = $val
        """
        query_create_link = """
        MATCH (s:Entity {id: $sourceId, projectId: $projectId})
        MATCH (t:Entity {id: $targetId, projectId: $projectId})
        MERGE (s)-[r:RELATION {label: $label}]->(t)
        """
        
        try:
            with self.driver.session() as session:
                # Delete existing project sub-graph
                session.run(query_delete, projectId=project_id)
                
                # Write nodes
                for n in nodes:
                    session.run(query_create_node, id=n["id"], projectId=project_id, label=n["label"], type=n["type"], val=n.get("val", 1))
                
                # Write links
                for l in links:
                    session.run(query_create_link, sourceId=l["source"], targetId=l["target"], projectId=project_id, label=l["label"])
                    
            print(f"Synced {len(nodes)} nodes and {len(links)} edges to Neo4j.")
        except Exception as e:
            print(f"Neo4j sync transaction failed: {e}")

neo4j_client = Neo4jClient()

def extract_graph_gemini(paper_title: str, abstract: str) -> Dict[str, Any]:
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or "your_gemini_api_key" in gemini_key:
        return {}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    headers = {"Content-Type": "application/json"}
    
    prompt = f"""
    Analyze the following research paper title and abstract:
    Title: {paper_title}
    Abstract: {abstract}
    
    Extract key scientific entities and semantic relationships between them.
    Entities should belong to these types: paper, author, institution, method, dataset, concept, technology, metric, result.
    Relationships can be: authored_by, affiliated_with, uses, improves, compares, evaluated_on, achieves, references, relates_to.
    
    Format the output strictly as a JSON object with:
    1. "entities": list of objects with keys: "id" (unique lowercase string), "label" (display name), "type" (entity type).
    2. "relations": list of objects with keys: "source" (entity id), "target" (entity id), "label" (relationship type).
    
    Only output the JSON object, no markdown code block backticks.
    """

    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    try:
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        if res.status_code == 200:
            text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            if text.startswith("```json"):
                text = text.replace("```json", "").replace("```", "").strip()
            elif text.startswith("```"):
                text = text.replace("```", "").strip()
            return json.loads(text)
    except Exception as e:
        print(f"[graph_service] Failed to extract graph from Gemini: {e}")
    return {}

def extract_entities_heuristics(paper: Dict[str, Any]) -> Dict[str, List[str]]:
    title = paper.get("title", "")
    abstract = paper.get("abstract", "")
    authors = paper.get("authors", [])
    
    entities = {
        "authors": authors,
        "methods": [],
        "datasets": [],
        "keywords": []
    }
    
    method_keywords = [
        "ResNet", "Transformer", "BERT", "GPT-3", "GPT-4", "LSTM", "CNN", "RNN",
        "Random Forest", "SVM", "Gradient Boosting", "Autoencoder", "Diffusion Model",
        "Retrieval-Augmented Generation", "RAG", "LangGraph", "Fine-Tuning", "Reinforcement Learning"
    ]
    for mk in method_keywords:
        if re.search(r'\b' + re.escape(mk) + r'\b', title + " " + abstract, re.IGNORECASE):
            entities["methods"].append(mk)
            
    dataset_keywords = [
        "MNIST", "ImageNet", "CIFAR-10", "SST-2", "GLUE", "SQuAD", "CoLA", "COCO",
        "IMDb", "Wikipedia", "Common Crawl", "LlamaIndex", "PubMed", "arXiv"
    ]
    for dk in dataset_keywords:
        if re.search(r'\b' + re.escape(dk) + r'\b', title + " " + abstract, re.IGNORECASE):
            entities["datasets"].append(dk)
            
    concept_keywords = [
        "Deep Learning", "Natural Language Processing", "Computer Vision",
        "Graph Neural Networks", "Agentic Workflow", "Self-Supervised Learning",
        "Semantic Search", "Vector Embeddings", "Zero-Shot Learning"
    ]
    for ck in concept_keywords:
        if re.search(r'\b' + re.escape(ck) + r'\b', title + " " + abstract, re.IGNORECASE):
            entities["keywords"].append(ck)
            
    for key in entities:
        if isinstance(entities[key], list):
            entities[key] = list(set(entities[key]))
            
    return entities

def build_project_graph(project_id: str, papers: List[Dict[str, Any]]) -> Dict[str, Any]:
    G = nx.Graph()
    nodes: Dict[str, Dict[str, Any]] = {}
    
    for paper in papers:
        paper_id = paper["_id"]
        paper_title = paper.get("title", "Untitled Paper")
        abstract = paper.get("abstract", "")
        authors = paper.get("authors", [])
        
        # Add Paper Node
        p_node_id = f"paper_{paper_id}"
        nodes[p_node_id] = {
            "id": p_node_id,
            "label": paper_title,
            "type": "paper",
            "val": 4,
            "color": "#6366f1"
        }
        
        # Query Gemini for rich KG entities
        gemini_graph = extract_graph_gemini(paper_title, abstract)
        
        if gemini_graph and gemini_graph.get("entities"):
            # Add Gemini scientific entities and link to Paper node
            for ent in gemini_graph["entities"]:
                ent_id = ent["id"]
                if ent_id == p_node_id:
                    continue
                if ent_id not in nodes:
                    nodes[ent_id] = {
                        "id": ent_id,
                        "label": ent["label"],
                        "type": ent["type"],
                        "val": 2,
                        "color": "#06b6d4" # Cyan by default
                    }
                G.add_edge(p_node_id, ent_id, label="relates_to")
                
            # Add internal relations extracted by Gemini
            for rel in gemini_graph.get("relations", []):
                src = rel["source"]
                tgt = rel["target"]
                if src in nodes and tgt in nodes:
                    G.add_edge(src, tgt, label=rel["label"])
        else:
            # Fallback to heuristics
            ents = extract_entities_heuristics(paper)
            
            for author in ents["authors"]:
                auth_node_id = f"author_{author.replace(' ', '_').lower()}"
                if auth_node_id not in nodes:
                    nodes[auth_node_id] = {
                        "id": auth_node_id,
                        "label": author,
                        "type": "author",
                        "val": 2,
                        "color": "#10b981"
                    }
                G.add_edge(p_node_id, auth_node_id, label="authored_by")
                
            for method in ents["methods"]:
                method_node_id = f"method_{method.replace(' ', '_').lower()}"
                if method_node_id not in nodes:
                    nodes[method_node_id] = {
                        "id": method_node_id,
                        "label": method,
                        "type": "method",
                        "val": 2,
                        "color": "#f59e0b"
                    }
                G.add_edge(p_node_id, method_node_id, label="implements")
                
            for dataset in ents["datasets"]:
                ds_node_id = f"dataset_{dataset.replace(' ', '_').lower()}"
                if ds_node_id not in nodes:
                    nodes[ds_node_id] = {
                        "id": ds_node_id,
                        "label": dataset,
                        "type": "dataset",
                        "val": 2.5,
                        "color": "#ec4899"
                    }
                G.add_edge(p_node_id, ds_node_id, label="evaluates_on")
                
            for kw in ents["keywords"]:
                kw_node_id = f"concept_{kw.replace(' ', '_').lower()}"
                if kw_node_id not in nodes:
                    nodes[kw_node_id] = {
                        "id": kw_node_id,
                        "label": kw,
                        "type": "concept",
                        "val": 1.5,
                        "color": "#06b6d4"
                    }
                G.add_edge(p_node_id, kw_node_id, label="relates_to")

    # Format nodes and links
    formatted_nodes = list(nodes.values())
    formatted_links = []
    
    for u, v, d in G.edges(data=True):
        formatted_links.append({
            "source": u,
            "target": v,
            "label": d.get("label", "connected")
        })

    # Sync to Neo4j DB
    if neo4j_client:
        neo4j_client.sync_graph(project_id, formatted_nodes, formatted_links)

    return {
        "nodes": formatted_nodes,
        "links": formatted_links
    }
