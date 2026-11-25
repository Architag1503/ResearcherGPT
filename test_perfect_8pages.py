with open('test_8pages.tex', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update preamble float & spacing parameters
text = text.replace(r'\setlength{\textfloatsep}{3.5pt plus 1pt minus 1pt}', r'\setlength{\textfloatsep}{2.5pt plus 1pt minus 1pt}')
text = text.replace(r'\setlength{\dbltextfloatsep}{4pt plus 1pt minus 1pt}', r'\setlength{\dbltextfloatsep}{3pt plus 1pt minus 1pt}')
text = text.replace(r'\setlength{\floatsep}{3.5pt plus 1pt minus 1pt}', r'\setlength{\floatsep}{2.5pt plus 1pt minus 1pt}')
text = text.replace(r'\setlength{\dblfloatsep}{4pt plus 1pt minus 1pt}', r'\setlength{\dblfloatsep}{3pt plus 1pt minus 1pt}')

# 2. In Table I, change \small to \footnotesize
text = text.replace(r'\caption{Specialized Agent Specifications in the LangGraph Orchestration Topology}' + '\n' + r'\label{tab:agents}' + '\n' + r'\centering' + '\n' + r'\small',
                    r'\caption{Specialized Agent Specifications in the LangGraph Orchestration Topology}' + '\n' + r'\label{tab:agents}' + '\n' + r'\centering' + '\n' + r'\footnotesize')

# 3. In Table VII, change \small to \footnotesize
text = text.replace(r'\caption{Proposed ResearcherGPT Technical Roadmap}' + '\n' + r'\label{tab:roadmap}' + '\n' + r'\small',
                    r'\caption{Proposed ResearcherGPT Technical Roadmap}' + '\n' + r'\label{tab:roadmap}' + '\n' + r'\footnotesize')

# 4. Scale TikZ figures slightly
text = text.replace(r'\resizebox{0.88\textwidth}{!}', r'\resizebox{0.84\textwidth}{!}')
text = text.replace(r'\resizebox{0.88\columnwidth}{!}', r'\resizebox{0.82\columnwidth}{!}')

# 5. In bibliography, tighten itemsep
old_bib_setup = r"""\begin{thebibliography}{20}
\footnotesize
\setlength{\itemsep}{0.8pt plus 0.3pt minus 0.3pt}
\setlength{\parskip}{0pt}"""

new_bib_setup = r"""\begin{thebibliography}{20}
\footnotesize
\setlength{\itemsep}{0pt plus 0.2pt}
\setlength{\parskip}{0pt}"""
text = text.replace(old_bib_setup, new_bib_setup)

with open('test_perfect_8pages.tex', 'w', encoding='utf-8') as f:
    f.write(text)

print('Wrote test_perfect_8pages.tex')
