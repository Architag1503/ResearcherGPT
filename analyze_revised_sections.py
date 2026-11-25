import pypdf
import re

rev_path = 'revision/revised_research_paper.pdf'
r = pypdf.PdfReader(rev_path)
full_text = ''
for p in r.pages:
    full_text += p.extract_text() + '\n'

sections = [
    ("Abstract & Index Terms", r"Abstract—", r"I\.\s+Introduction"),
    ("Section I: Introduction", r"I\.\s+Introduction", r"II\.\s+Literature Review"),
    ("Section II: Literature Review", r"II\.\s+Literature Review", r"III\.\s+Proposed Methodology"),
    ("Section III: Proposed Methodology", r"III\.\s+Proposed Methodology", r"IV\.\s+System Architecture"),
    ("Section IV: System Architecture", r"IV\.\s+System Architecture", r"V\.\s+Results and Discussion"),
    ("Section V: Results and Discussion", r"V\.\s+Results and Discussion", r"VI\.\s+Conclusion and Future Work"),
    ("Section VI: Conclusion & Roadmap", r"VI\.\s+Conclusion and Future Work", r"References"),
    ("References", r"References", r"$")
]

print("=== REVISED PAPER SECTION WORD COUNTS ===")
total = 0
for name, start_pat, end_pat in sections:
    m_start = re.search(start_pat, full_text)
    if not m_start:
        print(f"Could not find start for {name}")
        continue
    start_pos = m_start.start()
    if end_pat == r"$":
        sec_text = full_text[start_pos:]
    else:
        m_end = re.search(end_pat, full_text[start_pos:])
        if m_end:
            sec_text = full_text[start_pos:start_pos + m_end.start()]
        else:
            sec_text = full_text[start_pos:]
    words = len(sec_text.split())
    total += words
    print(f"{name}: {words} words")

print(f"Sum of sections: {total} words")
