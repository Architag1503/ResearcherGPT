from PIL import Image

im3 = Image.open('rev_page_3.png')
w3, h3 = im3.size
print('Page 3 size:', w3, h3)

# Top half of Page 3 contains Fig. 1
fig1_crop = im3.crop((int(w3*0.05), int(h3*0.05), int(w3*0.95), int(h3*0.45)))
fig1_crop.save('fig1_crop.png')
print('Saved fig1_crop.png')

im4 = Image.open('rev_page_4.png')
w4, h4 = im4.size
print('Page 4 size:', w4, h4)

# On Page 4, let's crop top half (left and right columns)
p4_top_left = im4.crop((int(w4*0.05), int(h4*0.05), int(w4*0.5), int(h4*0.6)))
p4_top_left.save('p4_top_left.png')

p4_top_right = im4.crop((int(w4*0.5), int(h4*0.05), int(w4*0.95), int(h4*0.6)))
p4_top_right.save('p4_top_right.png')

p4_bottom = im4.crop((int(w4*0.05), int(h4*0.55), int(w4*0.95), int(h4*0.95)))
p4_bottom.save('p4_bottom.png')

print('Saved Page 4 crops')
