with open('test_calibrated.tex', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find exact start and end of Table 4
t4_start = None
t4_end = None
for i, l in enumerate(lines):
    if r'\begin{table*}[!t]' in l and i > 500 and i < 650:
        t4_start = i
    if t4_start is not None and r'\end{table*}' in l and i > t4_start:
        t4_end = i + 1
        break

print(f"Table 4 lines: {t4_start} to {t4_end}")
table4_lines = lines[t4_start:t4_end]

# Find exact start and end of Table 7
t7_start = None
t7_end = None
for i, l in enumerate(lines):
    if r'\begin{table*}[!t]' in l and i > 650:
        t7_start = i
    if t7_start is not None and r'\end{table*}' in l and i > t7_start:
        t7_end = i + 1
        break

print(f"Table 7 lines: {t7_start} to {t7_end}")
table7_lines = lines[t7_start:t7_end]

# Remove Table 7 first (higher line index)
del lines[t7_start:t7_end]
# Remove Table 4
del lines[t4_start:t4_end]

# Insert Table 4 right after \section{Results and Discussion}
for i, l in enumerate(lines):
    if r'\section{Results and Discussion}' in l:
        insert_t4 = i + 1
        break

print(f"Inserting Table 4 at line {insert_t4}")
lines[insert_t4:insert_t4] = ['\n'] + table4_lines + ['\n']

# Insert Table 7 right before \subsection{Agent Latency} or \subsection{Plagiarism}
for i, l in enumerate(lines):
    if r'\subsection{Plagiarism and Attribution Engine Performance}' in l:
        insert_t7 = i
        break

print(f"Inserting Table 7 at line {insert_t7}")
lines[insert_t7:insert_t7] = ['\n'] + table7_lines + ['\n']

with open('test_moved.tex', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Wrote test_moved.tex')
