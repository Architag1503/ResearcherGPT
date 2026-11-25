with open('test_moved.tex', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find Fig 2 lines
f2_start = None
f2_end = None
for i, l in enumerate(lines):
    if r'\begin{figure}[!t]' in l and 'fig:retrieval' in ''.join(lines[i:i+35]):
        f2_start = i
    if f2_start is not None and r'\end{figure}' in l and i > f2_start:
        f2_end = i + 1
        break

print(f"Fig 2 lines: {f2_start} to {f2_end}")
fig2_lines = lines[f2_start:f2_end]
del lines[f2_start:f2_end]

# Insert Fig 2 right after \subsection{Tri-Hybrid Reciprocal Rank Fusion Retrieval}
insert_f2 = None
for i, l in enumerate(lines):
    if r'\subsection{Tri-Hybrid Reciprocal Rank Fusion Retrieval}' in l:
        insert_f2 = i + 1
        break

print(f"Inserting Fig 2 at line {insert_f2}")
lines[insert_f2:insert_f2] = ['\n'] + fig2_lines + ['\n']

with open('test_fig2_moved.tex', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Wrote test_fig2_moved.tex')
