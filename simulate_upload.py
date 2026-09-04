import subprocess
import sys
import time

# Ensure dependencies are installed
def install_deps():
    subprocess.check_call([sys.executable, "-m", "pip", "install", "fpdf", "requests", "pymongo"])

try:
    import fpdf
    import requests
    from pymongo import MongoClient
    from bson.objectid import ObjectId
except ImportError:
    install_deps()
    import fpdf
    import requests
    from pymongo import MongoClient
    from bson.objectid import ObjectId

print("Creating PDF...")
pdf = fpdf.FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)

# Using a snippet from the user's provided paper
paper_text = """
Inference Scaled GraphRAG: Improving Multi Hop Question Answering on Knowledge Graphs
Travis Thompson, Seung-Hwan Lim, Paul Liu, Ruoying He, Dongkuan (DK) Xu

Abstract
Large Language Models (LLMs) have achieved impressive capabilities in language understanding and generation, yet they continue to underperform on knowledge intensive reasoning tasks due to limited access to structured context and multi-hop information. Retrieval-Augmented Generation (RAG) partially mitigates this by grounding generation in retrieved context, but conventional RAG and GraphRAG methods often fail to capture relational structure across nodes in knowledge graphs. We introduce Inference-Scaled GraphRAG, a novel framework that enhances LLM based graph reasoning by applying inference-time compute scaling.
"""
pdf.multi_cell(0, 10, paper_text.encode('latin-1', 'replace').decode('latin-1'))
pdf.output("Inference_Scaled_GraphRAG.pdf")
print("PDF 'Inference_Scaled_GraphRAG.pdf' created successfully.")

print("Connecting to MongoDB to create a dummy project...")
# Create a dummy project in MongoDB so we have a valid projectId
client = MongoClient("mongodb://localhost:27017/")
db = client.researcher_gpt
project_id = str(ObjectId())
db.projects.insert_one({"_id": ObjectId(project_id), "name": "Test Project", "createdAt": time.time()})
print(f"Created project with ID: {project_id}")

print("Uploading to local server...")
url = "http://localhost:5000/api/papers/upload"
files = {'pdf': ('Inference_Scaled_GraphRAG.pdf', open('Inference_Scaled_GraphRAG.pdf', 'rb'), 'application/pdf')}
data = {'projectId': project_id}

try:
    response = requests.post(url, files=files, data=data)
    print("Upload Response:", response.status_code, response.text)
    
    if response.status_code == 201:
        res_json = response.json()
        paper_id = res_json['paper']['_id']
        print(f"Paper uploaded successfully! ID: {paper_id}")
        
        # Poll for status
        print("Polling paper status...")
        for i in range(100):
            time.sleep(2)
            paper = db.papers.find_one({"_id": ObjectId(paper_id)})
            if paper:
                status = paper.get('status')
                stage = paper.get('currentStage')
                progress = paper.get('progress')
                error = paper.get('processingError')
                print(f"[{i*2}s] Status: {status} | Stage: {stage} | Progress: {progress}%")
                if status == 'processed':
                    print("Processing completed successfully!")
                    break
                elif status == 'failed' or status == 'error':
                    print(f"Processing failed! Error: {error}")
                    break
            else:
                print("Paper not found in DB.")
except Exception as e:
    print("Error uploading:", e)
