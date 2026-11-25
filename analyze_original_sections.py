import pypdf
import re

orig_path = r'C:/Users/Archit Gupta/.gemini/antigravity/brain/928bfd16-3a96-45da-9a7a-69151d4d55ca/.user_uploaded/media_1795104643776_2582e5be.pdf'
r = pypdf.PdfReader(orig_path)
full_text = ''
for p in r.pages:
    full_text += p.extract_text() + '\n'

# Define section markers
sections = [
    ("Abstract & Index Terms", r"Abstract—", r"I\.\s+INTRODUCTION"),
    ("Section I: Introduction", r"I\.\s+INTRODUCTION", r"II\.\s+LITERATUREREVIEW"),
    ("Section II: Literature Review", r"II\.\s+LITERATUREREVIEW", r"III\.\s+PROPOSEDMETHODOLOGY"),
    ("Section III: Proposed Methodology", r"III\.\s+PROPOSEDMETHODOLOGY", r"IV\.\s+SYSTEMARCHITECTURE"),
    ("Section IV: System Architecture", r"IV\.\s+SYSTEMARCHITECTURE", r"V\.\s+RESULTS ANDDISCUSSION"),
    ("Section V: Results and Discussion", r"V\.\s+RESULTS ANDDISCUSSION", r"VI\.\s+CONCLUSION"),
    ("Section VI: Conclusion & Roadmap", r"VI\.\s+CONCLUSION", r"REFERENCES"),
    ("References", r"REFERENCES", r"$")
]

print("=== ORIGINAL PAPER SECTION WORD COUNTS ===")
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
