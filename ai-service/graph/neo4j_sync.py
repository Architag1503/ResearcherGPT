import os
from typing import List, Dict, Any
from services.graph_service import neo4j_client

def sync_to_neo4j_db(project_id: str, nodes: List[Dict[str, Any]], links: List[Dict[str, Any]]) -> None:
    """
    Synchronizes nodes and edges to the Neo4j server.
    """
    if neo4j_client and neo4j_client.driver:
        neo4j_client.sync_graph(project_id, nodes, links)
    else:
        print("[Neo4jSync] Client not available. Local fallback representation is preserved.")
