import re

with open('paper.tex', 'r', encoding='utf-8') as f:
    orig = f.read()

with open('temp_build_rev.tex', 'r', encoding='utf-8') as f:
    rev = f.read()

figs_orig = re.findall(r'\\begin\{figure\*?\}.*?\\end\{figure\*?\}', orig, re.DOTALL)
figs_rev = re.findall(r'\\begin\{figure\*?\}.*?\\end\{figure\*?\}', rev, re.DOTALL)

print(f"Orig figures: {len(figs_orig)}")
for i, f in enumerate(figs_orig):
    print(f"Orig Fig {i+1} length: {len(f)}")

print(f"Rev figures: {len(figs_rev)}")
for i, f in enumerate(figs_rev):
    print(f"Rev Fig {i+1} length: {len(f)}")
