import re

with open('temp_build_rev.tex', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove Fig 5
# Match \begin{figure}[!t] ... \label{fig:recall} \end{figure}
fig5_pattern = r'\\begin\{figure\}\[!t\]\s*\\centering\s*\\begin\{tikzpicture\}.*?\\label\{fig:recall\}\s*\\end\{figure\}'
m = re.search(fig5_pattern, text, re.DOTALL)
if m:
    text = text[:m.start()] + text[m.end():]
    print('Removed fig:recall')
else:
    print('fig:recall not found')

# Update reference in text: "Table~\ref{tab:retrieval} and Fig.~\ref{fig:recall} summarize" -> "Table~\ref{tab:retrieval} summarizes"
text = text.replace(r'Table~\ref{tab:retrieval} and Fig.~\ref{fig:recall} summarize', r'Table~\ref{tab:retrieval} summarizes')

with open('test_no_fig5.tex', 'w', encoding='utf-8') as f:
    f.write(text)

print('Wrote test_no_fig5.tex')
