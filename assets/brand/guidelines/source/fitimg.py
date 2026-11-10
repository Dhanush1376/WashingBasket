# Fit the supplied artwork into the divider panel (141.4 x 210 mm) WITHOUT cropping anything:
# the picture is scaled to the panel width, and the missing height is filled with the picture's own
# background colour, blended in with a soft edge so no seam shows. Prints the colour to use as the page bg.
import sys, statistics as st
from PIL import Image, ImageFilter, ImageDraw

SRC = 'D:/'
JOBS = [  # out, source, anchor (where the picture sits), faded edges
    ('div-01.jpg', 'Friendly Laundry Handover on Orange.png', 'bottom', 'top'),
    ('div-03.jpg', 'Folded Laundry Stacks with Sparkles.png', 'center', 'tb'),
    ('div-05.jpg', 'Cheerful Laundry Day Illustration.png', 'center', 'tb'),
    ('div-08.jpg', 'Hands Holding Laundry App Smartphone.png', 'bottom', 'top'),
    ('div-10.jpg', 'Laundry Branding Mockup Flat Lay.png', 'center', 'all'),
]
W, H = 1226, 1820  # panel at ~220 dpi
for out, src, anchor, fade in JOBS:
    im = Image.open(SRC + src).convert('RGB')
    edge = [im.getpixel((x, 3)) for x in range(10, im.width - 10, 7)]
    bg = tuple(int(st.median(c[i] for c in edge)) for i in range(3))
    s = W / im.width
    nh = round(im.height * s)
    if nh > H and anchor != 'bottom':  # taller than the panel: fit height instead (never crop)
        s = H / im.height; nh = H
    nw = round(im.width * s)
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGB', (W, H), bg)
    x = (W - nw) // 2
    y = H - nh if anchor == 'bottom' else (H - nh) // 2
    m = Image.new('L', (nw, nh), 255)
    d = ImageDraw.Draw(m)
    F = 60
    for k in range(F):
        a = int(255 * k / F)
        if fade in ('top', 'tb', 'all') and y > 0: d.line([(0, k), (nw, k)], fill=a)
        if fade in ('tb', 'all') and y + nh < H: d.line([(0, nh - 1 - k), (nw, nh - 1 - k)], fill=a)
    if fade == 'all' and x > 0:
        side = Image.new('L', (nw, nh), 255); sd = ImageDraw.Draw(side)
        for k in range(F):
            a = int(255 * k / F); sd.line([(k, 0), (k, nh)], fill=a); sd.line([(nw - 1 - k, 0), (nw - 1 - k, nh)], fill=a)
        from PIL import ImageChops
        m = ImageChops.darker(m, side)
    canvas.paste(im, (x, y), m)
    canvas.save('img/' + out, quality=90)
    print(out, '#%02X%02X%02X' % bg, (nw, nh), 'at', (x, y))

# product sheets: keep whole, just optimise
for out, src in (('sheet-bag.jpg', 'WashingBasket Canvas Bag Views.png'), ('sheet-tote.jpg', 'WashingBasket Orange Bag Product Showcase.png')):
    Image.open(SRC + src).convert('RGB').save('img/' + out, quality=90)
    print(out)
