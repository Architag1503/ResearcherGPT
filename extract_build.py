import re

with open('build_revision.py', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'revised_latex = r"""(.*?)"""', text, re.DOTALL)
if m:
    latex = m.group(1)
    print('Length of revised_latex in build_revision.py:', len(latex))
    with open('temp_build_rev.tex', 'w', encoding='utf-8') as out:
        out.write(latex)
else:
    print('Not found')
