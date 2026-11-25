import dotenv
dotenv.load_dotenv('.env')
import sys
sys.path.append('ai-service')
from services.formatex_service import FormaTeXService
import pypdf
import re

with open('revision/revised_research_paper.tex', 'r', encoding='utf-8') as f:
    tex = f.read()

print('Calling FormaTeX compile/smart...')
pdf_bytes, err = FormaTeXService._compile_project(tex, engine='pdflatex', smart=True)
if err:
    print('Error:', err)
else:
    print('Success! Received', len(pdf_bytes), 'bytes')
    with open('temp_test.pdf', 'wb') as f:
        f.write(pdf_bytes)
    reader = pypdf.PdfReader('temp_test.pdf')
    print('Num pages:', len(reader.pages))
    full_text = ''
    for p in reader.pages:
        full_text += p.extract_text() or ''
    qmarks = re.findall(r'.{0,30}\?\?.{0,30}', full_text)
    if qmarks:
        print(f'Warning: {len(qmarks)} occurrences of ?? found:')
        for q in qmarks[:10]:
            print('  ->', repr(q))
    else:
        print('All references resolved cleanly! Zero "??" found.')
