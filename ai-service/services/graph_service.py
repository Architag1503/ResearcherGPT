import os
import re
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
            # Test connection
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

def extract_entities_heuristics(paper: Dict[str, Any]) -> Dict[str, List[str]]:
    # Simple heuristic entity extractor looking at Title, Authors, and Abstract content
    title = paper.get("title", "")
    abstract = paper.get("abstract", "")
    authors = paper.get("authors", [])
    
    entities = {
        "authors": authors,
        "methods": [],
        "datasets": [],
        "keywords": []
    }
    
    # 1. Methods detection (Heuristics: common machine learning models, frameworks, architectures)
    method_keywords = [
        "ResNet", "Transformer", "BERT", "GPT-3", "GPT-4", "LSTM", "CNN", "RNN",
        "Random Forest", "SVM", "Gradient Boosting", "Autoencoder", "Diffusion Model",
        "Retrieval-Augmented Generation", "RAG", "LangGraph", "Fine-Tuning", "Reinforcement Learning"
    ]
    for mk in method_keywords:
        if re.search(r'\b' + re.escape(mk) + r'\b', title + " " + abstract, re.IGNORECASE):
            entities["methods"].append(mk)
            
    # 2. Datasets detection
    dataset_keywords = [
        "MNIST", "ImageNet", "CIFAR-10", "SST-2", "GLUE", "SQuAD", "CoLA", "COCO",
        "IMDb", "Wikipedia", "Common Crawl", "LlamaIndex", "PubMed", "arXiv"
    ]
    for dk in dataset_keywords:
        if re.search(r'\b' + re.escape(dk) + r'\b', title + " " + abstract, re.IGNORECASE):
            entities["datasets"].append(dk)
            
    # 3. Keywords/Concepts extraction
    concept_keywords = [
        "Deep Learning", "Natural Language Processing", "Computer Vision",
        "Graph Neural Networks", "Agentic Workflow", "Self-Supervised Learning",
        "Semantic Search", "Vector Embeddings", "Zero-Shot Learning"
    ]
    for ck in concept_keywords:
        if re.search(r'\b' + re.escape(ck) + r'\b', title + " " + abstract, re.IGNORECASE):
            entities["keywords"].append(ck)
            
    # Deduplicate lists
    for key in entities:
        if isinstance(entities[key], list):
            entities[key] = list(set(entities[key]))
            
    return entities

def build_project_graph(project_id: str, papers: List[Dict[str, Any]]) -> Dict[str, Any]:
    # Initialize NetworkX graph
    G = nx.Graph()
    
    # Nodes list
    nodes: Dict[str, Dict[str, Any]] = {}
    
    for paper in papers:
        paper_id = paper["_id"]
        paper_title = paper.get("title", "Untitled Paper")
        
        # Add Paper node
        p_node_id = f"paper_{paper_id}"
        nodes[p_node_id] = {
            "id": p_node_id,
            "label": paper_title,
            "type": "paper",
            "val": 4,
            "color": "#6366f1" # Indigo
        }
        
        # Extract related terms
        ents = extract_entities_heuristics(paper)
        
        # Add Author nodes and link to paper
        for author in ents["authors"]:
            auth_node_id = f"author_{author.replace(' ', '_').lower()}"
            if auth_node_id not in nodes:
                nodes[auth_node_id] = {
                    "id": auth_node_id,
                    "label": author,
                    "type": "author",
                    "val": 2,
                    "color": "#10b981" # Green
                }
            G.add_edge(p_node_id, auth_node_id, label="authored_by")
            
        # Add Method nodes and link to paper
        for method in ents["methods"]:
            method_node_id = f"method_{method.replace(' ', '_').lower()}"
            if method_node_id not in nodes:
                nodes[method_node_id] = {
                    "id": method_node_id,
                    "label": method,
                    "type": "method",
                    "val": 2,
                    "color": "#f59e0b" # Orange
                }
            G.add_edge(p_node_id, method_node_id, label="implements")
            
        # Add Dataset nodes and link to paper
        for dataset in ents["datasets"]:
            ds_node_id = f"dataset_{dataset.replace(' ', '_').lower()}"
            if ds_node_id not in nodes:
                nodes[ds_node_id] = {
                    "id": ds_node_id,
                    "label": dataset,
                    "type": "dataset",
                    "val": 2.5,
                    "color": "#ec4899" # Pink
                }
            G.add_edge(p_node_id, ds_node_id, label="evaluates_on")
            
        # Add Keyword/Concept nodes and link
        for kw in ents["keywords"]:
            kw_node_id = f"concept_{kw.replace(' ', '_').lower()}"
            if kw_node_id not in nodes:
                nodes[kw_node_id] = {
                    "id": kw_node_id,
                    "label": kw,
                    "type": "concept",
                    "val": 1.5,
                    "color": "#06b6d4" # Cyan
                }
            G.add_edge(p_node_id, kw_node_id, label="relates_to")

    # Format nodes and links for react-force-graph
    formatted_nodes = list(nodes.values())
    formatted_links = []
    
    for u, v, d in G.edges(data=True):
        formatted_links.append({
            "source": u,
            "target": v,
            "label": d.get("label", "connected")
        })

    # Sync asynchronously to Neo4j if available
    neo4j_client.sync_graph(project_id, formatted_nodes, formatted_links)

    return {
        "nodes": formatted_nodes,
        "links": formatted_links
    }
