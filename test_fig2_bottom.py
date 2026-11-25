with open('test_alg2_fixed.tex', 'r', encoding='utf-8') as f:
    text = f.read()

# Change Fig 2 to \begin{figure}[!b]
text = text.replace(r'\begin{figure}[!t]', r'\begin{figure}[!b]', 1)

with open('test_fig2_bottom.tex', 'w', encoding='utf-8') as f:
    f.write(text)

print('Wrote test_fig2_bottom.tex with Fig 2 as [!b]')
