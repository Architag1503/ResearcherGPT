with open('test_fig1_page2.tex', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update preamble float & spacing parameters
old_params = r"""% ---------- Float parameters for exact 8-page IEEE conference format ----------
\renewcommand{\topfraction}{0.95}
\renewcommand{\bottomfraction}{0.95}
\renewcommand{\textfraction}{0.05}
\renewcommand{\floatpagefraction}{0.85}
\renewcommand{\dbltopfraction}{0.95}
\renewcommand{\dblfloatpagefraction}{0.85}
\setcounter{topnumber}{4}
\setcounter{bottomnumber}{4}
\setcounter{totalnumber}{8}
\setcounter{dbltopnumber}{4}
\setlength{\textfloatsep}{5pt plus 2pt minus 1pt}
\setlength{\floatsep}{5pt plus 2pt minus 1pt}
\setlength{\intextsep}{5pt plus 2pt minus 1pt}
\setlength{\dbltextfloatsep}{6pt plus 2pt minus 1pt}
\setlength{\dblfloatsep}{6pt plus 2pt minus 1pt}"""

new_params = r"""% ---------- Float parameters for exact 8-page IEEE conference format ----------
\renewcommand{\topfraction}{0.98}
\renewcommand{\bottomfraction}{0.98}
\renewcommand{\textfraction}{0.02}
\renewcommand{\floatpagefraction}{0.90}
\renewcommand{\dbltopfraction}{0.98}
\renewcommand{\dblfloatpagefraction}{0.90}
\setcounter{topnumber}{5}
\setcounter{bottomnumber}{5}
\setcounter{totalnumber}{10}
\setcounter{dbltopnumber}{5}
\setlength{\textfloatsep}{3.5pt plus 1pt minus 1pt}
\setlength{\floatsep}{3.5pt plus 1pt minus 1pt}
\setlength{\intextsep}{3.5pt plus 1pt minus 1pt}
\setlength{\dbltextfloatsep}{4pt plus 1pt minus 1pt}
\setlength{\dblfloatsep}{4pt plus 1pt minus 1pt}
\setlength{\abovecaptionskip}{2pt plus 1pt minus 1pt}
\setlength{\belowcaptionskip}{2pt plus 1pt minus 1pt}
\renewcommand{\arraystretch}{0.88}"""

text = text.replace(old_params, new_params)

# 2. Resize Fig 1 slightly
text = text.replace(r'\resizebox{0.96\textwidth}{!}', r'\resizebox{0.88\textwidth}{!}')

# 3. Resize Fig 2, Fig 3, Fig 4 slightly
text = text.replace(r'\resizebox{\columnwidth}{!}', r'\resizebox{0.88\columnwidth}{!}')

# 4. In bibliography, set \footnotesize and small itemsep
old_bib = r'\begin{thebibliography}{20}'
new_bib = r"""\begin{thebibliography}{20}
\footnotesize
\setlength{\itemsep}{0.8pt plus 0.3pt minus 0.3pt}
\setlength{\parskip}{0pt}"""
text = text.replace(old_bib, new_bib)

with open('test_8pages.tex', 'w', encoding='utf-8') as f:
    f.write(text)

print('Wrote test_8pages.tex')
