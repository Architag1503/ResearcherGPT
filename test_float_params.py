with open('test_alg2_fixed.tex', 'r', encoding='utf-8') as f:
    text = f.read()

float_params = r"""
% ---------- Float parameters for 8-page IEEE conference format ----------
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
\setlength{\textfloatsep}{5pt plus 2pt minus 2pt}
\setlength{\floatsep}{5pt plus 2pt minus 2pt}
\setlength{\intextsep}{5pt plus 2pt minus 2pt}
\setlength{\dbltextfloatsep}{6pt plus 2pt minus 2pt}
\setlength{\dblfloatsep}{6pt plus 2pt minus 2pt}
"""

# Insert float_params before \begin{document}
pos = text.find(r'\begin{document}')
text = text[:pos] + float_params + '\n' + text[pos:]

with open('test_float_params.tex', 'w', encoding='utf-8') as f:
    f.write(text)

print('Wrote test_float_params.tex')
