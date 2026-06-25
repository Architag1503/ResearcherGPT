import pymongo
from bson import ObjectId
import re

# In Docker, MongoDB host is 'mongodb'
client = pymongo.MongoClient('mongodb://mongodb:27017/')
db = client['researcher_gpt']
paper_col = db['generatedpapers']

paper = paper_col.find_one({'title': {'$regex': 'Neuro-Symbolic', '$options': 'i'}})
if not paper:
    print("Paper not found!")
    exit(1)

title = paper.get("title", "")
sections = paper.get("sections", [])
references = paper.get("references", [])
style = "IEEE"

abstract_text = ""
keywords_text = ""

for s in sections:
    t = s["title"].strip()
    c = s["content"].strip()
    if t.lower() == 'abstract':
        abstract_text = re.sub(r'<[^>]*>', '', c).strip()
    elif t.lower() in ('keywords', 'key words'):
        keywords_text = re.sub(r'<[^>]*>', '', c).strip()

print(f"DEBUG: abstract_text len = {len(abstract_text)}")
print(f"DEBUG: keywords_text len = {len(keywords_text)}")

# Build LaTeX document
from services.formatex_service import FormaTeXService
latex_code = FormaTeXService._build_latex_document("", title, sections, references, bib_style="IEEEtran", style="IEEE")
print("=== Generated LaTeX Source ===")
print(latex_code[:2500])
