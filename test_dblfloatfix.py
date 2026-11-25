with open('test_fig2_moved.tex', 'r', encoding='utf-8') as f:
    text = f.read()

# Add \usepackage{dblfloatfix}
pos = text.find(r'\usepackage{tikz}')
text = text[:pos] + '\\usepackage{dblfloatfix}\n' + text[pos:]

with open('test_dblfloatfix.tex', 'w', encoding='utf-8') as f:
    f.write(text)

print('Wrote test_dblfloatfix.tex with dblfloatfix')
