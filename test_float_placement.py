import re

with open('test_calibrated.tex', 'r', encoding='utf-8') as f:
    text = f.read()

# Extract Table 4
tab4_match = re.search(r'\\begin\{table\*\}\[!t\].*?\\label\{tab:plagiarism\}.*?\\end\{table\*\}', text, re.DOTALL)
if not tab4_match:
    print('Table 4 not found')
tab4_code = tab4_match.group(0)
text = text[:tab4_match.start()] + text[tab4_match.end():]

# Extract Table 7
tab7_match = re.search(r'\\begin\{table\*\}\[!t\].*?\\label\{tab:roadmap\}.*?\\end\{table\*\}', text, re.DOTALL)
if not tab7_match:
    print('Table 7 not found')
tab7_code = tab7_match.group(0)
text = text[:tab7_match.start()] + text[tab7_match.end():]

# Place Table 4 right after \section{Results and Discussion}
sec5_pos = text.find(r'\section{Results and Discussion}')
if sec5_pos != -1:
    insert_pos = text.find('\n', sec5_pos) + 1
    text = text[:insert_pos] + '\n' + tab4_code + '\n' + text[insert_pos:]
    print('Moved Table 4 to start of Section V')

# Place Table 7 right before \subsection{Limitations and Ethical Considerations} or in Section V-F
sec_lim_pos = text.find(r'\subsection{Limitations and Ethical Considerations}')
if sec_lim_pos != -1:
    text = text[:sec_lim_pos] + tab7_code + '\n\n' + text[sec_lim_pos:]
    print('Moved Table 7 before Limitations')
else:
    sec6_pos = text.find(r'\section{Conclusion and Future Work}')
    text = text[:sec6_pos] + tab7_code + '\n\n' + text[sec6_pos:]
    print('Moved Table 7 before Conclusion')

with open('test_float_placement.tex', 'w', encoding='utf-8') as f:
    f.write(text)

print('Wrote test_float_placement.tex')
