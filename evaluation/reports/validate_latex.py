"""Strict IEEEtran LaTeX structural, escaping, citation-order, table-width, and asset validator."""

import re
import sys
from pathlib import Path


def strip_latex_comments(line: str) -> str:
    return re.split(r"(?<!\\)%", line, maxsplit=1)[0]


def validate_tex(tex_path: Path) -> list[str]:
    text = tex_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    errors: list[str] = []

    # 0. Strict IEEE link style: hidelinks (no blue links)
    if "colorlinks=true" in text:
        errors.append("IEEE format error: found 'colorlinks=true'; use [hidelinks]{hyperref}.")

    # 1. Balanced environments
    env_stack: list[tuple[str, int]] = []
    for idx, line in enumerate(lines, 1):
        stripped = strip_latex_comments(line)
        for m in re.finditer(r"\\(begin|end)\{([^}]+)\}", stripped):
            kind, name = m.group(1), m.group(2)
            if kind == "begin":
                env_stack.append((name, idx))
            else:
                if not env_stack or env_stack[-1][0] != name:
                    errors.append(f"Line {idx}: mismatched \\end{{{name}}}; stack={env_stack}")
                else:
                    env_stack.pop()
    if env_stack:
        errors.append(f"Unclosed LaTeX environments: {env_stack}")

    # 2. Balanced braces
    depth = 0
    for idx, line in enumerate(lines, 1):
        stripped = strip_latex_comments(line)
        i = 0
        while i < len(stripped):
            ch = stripped[i]
            if ch == "\\" and i + 1 < len(stripped) and stripped[i + 1] in "{}":
                i += 2
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth < 0:
                    errors.append(f"Line {idx}: negative brace depth")
                    depth = 0
            i += 1
    if depth != 0:
        errors.append(f"Unbalanced braces at EOF: depth={depth}")

    # 3. Citation order & parity check (strict IEEE sequential appearance)
    bib_order = re.findall(r"\\bibitem\{([^}]+)\}", text)
    bib_idx = {k: i for i, k in enumerate(bib_order)}
    cited_first_order: list[str] = []
    seen_cite: set[str] = set()
    body_text = text.split("\\begin{thebibliography}", 1)[0]
    for m in re.finditer(r"\\cite(?:\[[^\]]*\])?\{([^}]+)\}", body_text):
        for key in m.group(1).split(","):
            k = key.strip()
            if k not in seen_cite:
                seen_cite.add(k)
                cited_first_order.append(k)

    missing_bib = sorted(seen_cite - set(bib_order))
    unused_bib = sorted(set(bib_order) - seen_cite)
    if missing_bib:
        errors.append(f"Missing bibliography entries for citations: {missing_bib}")
    if unused_bib:
        errors.append(f"Unused bibliography entries: {unused_bib}")

    # Verify strict sequential appearance order [1], [2], [3], ...
    last_pos = -1
    for k in cited_first_order:
        if k in bib_idx:
            if bib_idx[k] < last_pos:
                errors.append(
                    f"IEEE citation order violation: '\\cite{{{k}}}' appears out of order "
                    f"(bib index {bib_idx[k]+1} < previous {last_pos+1})"
                )
            else:
                last_pos = bib_idx[k]

    # 4. \ref / \eqref vs \label parity
    refs = set(re.findall(r"\\(?:eq)?ref\{([^}]+)\}", text))
    labels = set(re.findall(r"\\label\{([^}]+)\}|label=\{([^}]+)\}", text))
    flat_labels = {a or b for a, b in labels}
    missing_lbl = sorted(refs - flat_labels)
    if missing_lbl:
        errors.append(f"Undefined \\ref labels: {missing_lbl}")

    # 5. \includegraphics targets exist
    for img in re.findall(r"\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}", text):
        img_path = tex_path.parent / img
        if not img_path.exists():
            errors.append(f"Missing included graphic: {img_path}")

    # 6. Check TikZ node alignment widths against IEEE column bounds (~8.6 cm)
    for m in re.finditer(r"\\begin\{tikzpicture\}(.*?)\\end\{tikzpicture\}", text, re.DOTALL):
        block = m.group(1)
        for wm in re.finditer(r"minimum width=([0-9.]+)cm", block):
            w_cm = float(wm.group(1))
            if w_cm > 8.4:
                errors.append(f"TikZ node width {w_cm}cm exceeds IEEE single-column safe width (8.4cm)")

    # 7. Check escaping rules outside listings/tabular/math
    in_tabular_or_align = False
    in_display_math = False
    in_listing = False
    for idx, line in enumerate(lines, 1):
        code = strip_latex_comments(line)
        if "\\begin{lstlisting}" in code:
            in_listing = True
            continue
        if "\\end{lstlisting}" in code:
            in_listing = False
            continue
        if in_listing:
            continue

        if any(tok in code for tok in ("\\begin{tabular", "\\begin{align", "\\begin{cases")):
            in_tabular_or_align = True
        if any(tok in code for tok in ("\\end{tabular", "\\end{align", "\\end{cases")):
            in_tabular_or_align = False
        if any(tok in code for tok in ("\\begin{equation", "\\begin{align")):
            in_display_math = True
        if any(tok in code for tok in ("\\end{equation", "\\end{align")):
            in_display_math = False

        if "`" in code and "``" not in code:
            errors.append(f"Line {idx}: stray Markdown backtick found: {code.strip()}")
        if "\u2014" in code:
            errors.append(f"Line {idx}: Unicode em-dash found (prefer '---'): {code.strip()}")
        if not in_tabular_or_align:
            cleaned = re.sub(r"\\url\{[^}]+\}", "", code)
            for _ in re.finditer(r"(?<!\\)&", cleaned):
                errors.append(f"Line {idx}: unescaped '&' outside tabular/cases: {code.strip()}")

        in_math = in_display_math
        j = 0
        while j < len(code):
            if code[j] == "$" and (j == 0 or code[j - 1] != "\\"):
                in_math = not in_math
            elif code[j] == "_" and not in_math and (j == 0 or code[j - 1] != "\\"):
                prefix = code[:j]
                if not re.search(r"\\(?:includegraphics|url|label|ref|eqref|cite|bibitem)(?:\[[^\]]*\])?\{[^}]*$", prefix):
                    errors.append(f"Line {idx}: unescaped '_' outside math/key: {code.strip()}")
                    break
            j += 1

    return errors


def main() -> int:
    tex_path = Path("a:/Antigravity/ResearcherGPT/research-paper/final/ResearcherGPT_Conference_Paper.tex")
    errors = validate_tex(tex_path)
    if errors:
        print(f"Found {len(errors)} LaTeX validation issue(s):")
        for e in errors:
            print(" -", e)
        return 1
    print(f"Strict IEEE LaTeX validation PASSED cleanly for {tex_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
