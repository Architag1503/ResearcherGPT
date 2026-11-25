import re

with open('test_fig2_moved.tex', 'r', encoding='utf-8') as f:
    text = f.read()

alg2_clean = r"""\begin{algorithm}[!t]
\caption{Real-Time Claim Extraction and Multi-Hop Grounding}
\label{alg:fact}
\begin{algorithmic}[1]
\Require Draft section $T_{\mathrm{sec}}$, project ID $p$, threshold $\theta=0.85$
\Ensure Verification report $V$
\State $C\gets\mathrm{Split}(T_{\mathrm{sec}})$ filtered for empirical or attribution claims
\State $V\gets\mathrm{EmptyReport}()$
\ForAll{$c\in C$}
\State $v_c\gets\mathrm{DenseEmbed}(c)$
\State $E_c\gets\mathrm{QdrantSearch}(v_c,p,3)$
\State $r\gets\mathrm{AuditLLM}(c,E_c)$
\If{$r.status=\mathrm{VALIDATED}$ and $r.confidence\geq\theta$}
\State Add claim and source location to validated set in $V$
\ElsIf{$r.status=\mathrm{CONFLICTING}$}
\State Add claim and conflicting evidence to $V$
\State Rewrite claim against the retrieved evidence
\Else
\State Add claim to unverified set in $V$
\State Prune or qualify the unsupported claim
\EndIf
\EndFor
\State \Return $V$
\end{algorithmic}
\end{algorithm}"""

# Replace Algorithm 2 in text
alg2_pat = r'\\begin\{algorithm\}\[!t\]\s*\\caption\{Real-Time Claim.*?\\end\{algorithm\}'
m = re.search(alg2_pat, text, re.DOTALL)
if m:
    text = text[:m.start()] + alg2_clean + text[m.end():]
    print('Replaced Algorithm 2 with clean 25-line version')
else:
    print('Algorithm 2 not found')

with open('test_alg2_fixed.tex', 'w', encoding='utf-8') as f:
    f.write(text)

print('Wrote test_alg2_fixed.tex')
