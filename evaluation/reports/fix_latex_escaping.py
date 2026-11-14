"""Fix LaTeX escaping (backticks, em-dashes, unescaped '&' and '_' outside math/tabular)."""
import re
from pathlib import Path

p = Path(r"a:\Antigravity\ResearcherGPT\research-paper\final\ResearcherGPT_Conference_Paper.tex")
lines = p.read_text(encoding="utf-8").splitlines()

out_lines = []
in_tabular = False
in_math_env = False
in_listing = False

for line in lines:
    if "\\begin{lstlisting}" in line:
        in_listing = True
        out_lines.append(line)
        continue
    if "\\end{lstlisting}" in line:
        in_listing = False
        out_lines.append(line)
        continue
    if in_listing:
        out_lines.append(line)
        continue

    if any(t in line for t in ("\\begin{tabular", "\\begin{align", "\\begin{cases")):
        in_tabular = True
    if any(t in line for t in ("\\end{tabular", "\\end{align", "\\end{cases")):
        in_tabular = False
    if any(t in line for t in ("\\begin{equation", "\\begin{align")):
        in_math_env = True
    if any(t in line for t in ("\\end{equation", "\\end{align")):
        in_math_env = False

    # 1. Replace Unicode em-dash
    line = line.replace("\u2014", "---")

    # 2. Replace **bold** if any
    line = re.sub(r"\*\*([^*]+)\*\*", r"\\textbf{\1}", line)

    # 3. Replace inline single backticks `...` with \texttt{...} (preserve LaTeX ``)
    def repl_bt(m):
        inner = m.group(1)
        inner = re.sub(r"(?<!\\)_", r"\\_", inner)
        inner = re.sub(r"(?<!\\)&", r"\\&", inner)
        inner = inner.replace("{", r"\{").replace("}", r"\}")
        return f"\\texttt{{{inner}}}"

    line = re.sub(r"(?<!`)`([^`\n]+)`(?!`)", repl_bt, line)

    # 4. Escape bare & outside tabular/align/cases and outside \url{...}
    if not in_tabular:
        # split around \url{...}
        parts = re.split(r"(\\url\{[^}]+\})", line)
        for i in range(0, len(parts), 2):
            parts[i] = re.sub(r"(?<!\\)&", r"\\&", parts[i])
        line = "".join(parts)

    # 5. Escape bare '_' in DOI strings (e.g., qss_a_00022)
    if "doi:" in line.lower() and not in_math_env:
        line = re.sub(r"(?<!\\)_", r"\\_", line)

    out_lines.append(line)

p.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
print("Cleaned LaTeX escaping cleanly.")
