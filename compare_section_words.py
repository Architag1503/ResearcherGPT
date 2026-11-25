import pypdf
import re

def get_sections(pdf_path, is_orig=False):
    r = pypdf.PdfReader(pdf_path)
    full_text = ''
    for p in r.pages:
        full_text += p.extract_text() + '\n'
    
    # Define sections
    if is_orig:
        patterns = [
            ("Abstract & Index Terms", r"Abstract—", r"I\.\s+INTRODUCTION"),
            ("Section I: Introduction", r"I\.\s+INTRODUCTION", r"II\.\s+LITERATUREREVIEW"),
            ("Section II: Literature Review", r"II\.\s+LITERATUREREVIEW", r"III\.\s+PROPOSEDMETHODOLOGY"),
            ("Section III: Proposed Methodology", r"III\.\s+PROPOSEDMETHODOLOGY", r"IV\.\s+SYSTEMARCHITECTURE"),
            ("Section IV: System Architecture", r"IV\.\s+SYSTEMARCHITECTURE", r"V\.\s+RESULTS ANDDISCUSSION"),
            ("Section V: Results and Discussion", r"V\.\s+RESULTS ANDDISCUSSION", r"VI\.\s+CONCLUSION"),
            ("Section VI: Conclusion & Roadmap", r"VI\.\s+CONCLUSION", r"REFERENCES"),
            ("References", r"REFERENCES", r"$")
        ]
    else:
        patterns = [
            ("Abstract & Index Terms", r"Abstract—", r"I\.\s+Introduction"),
            ("Section I: Introduction", r"I\.\s+Introduction", r"II\.\s+Literature Review"),
            ("Section II: Literature Review", r"II\.\s+Literature Review", r"III\.\s+Proposed Methodology"),
            ("Section III: Proposed Methodology", r"III\.\s+Proposed Methodology", r"IV\.\s+System Architecture"),
            ("Section IV: System Architecture", r"IV\.\s+System Architecture", r"V\.\s+Results and Discussion"),
            ("Section V: Results and Discussion", r"V\.\s+Results and Discussion", r"VI\.\s+Conclusion and Future Work"),
            ("Section VI: Conclusion & Roadmap", r"VI\.\s+Conclusion and Future Work", r"References"),
            ("References", r"References", r"$")
        ]
    
    results = {}
    for name, start_pat, end_pat in patterns:
        m_start = re.search(start_pat, full_text)
        if not m_start:
            results[name] = 0
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
        results[name] = len(sec_text.split())
    return results

orig_path = r'C:/Users/Archit Gupta/.gemini/antigravity/brain/928bfd16-3a96-45da-9a7a-69151d4d55ca/.user_uploaded/media_1795104643776_2582e5be.pdf'
rev_path = 'test_no_fig5.pdf'

s_orig = get_sections(orig_path, is_orig=True)
s_rev = get_sections(rev_path, is_orig=False)

print(f"{'Section Name':<35} | {'Original':<10} | {'Revised':<10} | {'Diff':<8}")
print("-" * 70)
total_orig = sum(s_orig.values())
total_rev = sum(s_rev.values())
for k in s_orig:
    o = s_orig[k]
    r = s_rev.get(k, 0)
    print(f"{k:<35} | {o:<10} | {r:<10} | {r - o:+d}")
print("-" * 70)
print(f"{'Total':<35} | {total_orig:<10} | {total_rev:<10} | {total_rev - total_orig:+d}")
