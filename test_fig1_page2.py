with open('test_fig1_moved.tex', 'r', encoding='utf-8') as f:
    text = f.read()

# Find Fig 1
f1_start = text.find(r'\begin{figure*}[!t]')
f1_end = text.find(r'\end{figure*}', f1_start) + len(r'\end{figure*}')
fig1_code = text[f1_start:f1_end]
text = text[:f1_start] + text[f1_end:]

# Insert Fig 1 right after \section{Literature Review and Related Work}
anchor = r"\section{Literature Review and Related Work}"
pos = text.find(anchor)
if pos != -1:
    insert_pos = pos + len(anchor)
    text = text[:insert_pos] + '\n\n' + fig1_code + '\n\n' + text[insert_pos:]
    print('Moved Fig 1 to start of Section II')
else:
    print('Anchor not found!')

with open('test_fig1_page2.tex', 'w', encoding='utf-8') as f:
    f.write(text)

print('Wrote test_fig1_page2.tex')
