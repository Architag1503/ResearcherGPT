import fitz

orig_path = r'C:/Users/Archit Gupta/.gemini/antigravity/brain/928bfd16-3a96-45da-9a7a-69151d4d55ca/.user_uploaded/media_1795104643776_2582e5be.pdf'
rev_path = 'revised_research_paper.pdf'

# Render pages 3 and 4 of orig
doc_orig = fitz.open(orig_path)
for pno in [2, 3]:
    page = doc_orig[pno]
    pix = page.get_pixmap(dpi=150)
    pix.save(f"orig_page_{pno+1}.png")
print("Rendered orig pages 3 and 4")

# Render pages 3 and 4 of revised
doc_rev = fitz.open(rev_path)
for pno in [2, 3]:
    page = doc_rev[pno]
    pix = page.get_pixmap(dpi=150)
    pix.save(f"rev_page_{pno+1}.png")
print("Rendered rev pages 3 and 4")
