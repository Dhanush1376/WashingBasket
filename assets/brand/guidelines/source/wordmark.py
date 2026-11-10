# Outlines the website's wordmark setting (site.css .brand-title) to SVG paths, so no font can alter it.
import json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
F = __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '../../../../website')+'/node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-%d-normal.woff'
fonts = {w: TTFont(F % w) for w in (500, 600)}
# (text, weight, size em, letter-spacing em, margin-right em) — from website/src/styles/site.css
runs = [('W', 500, 1.25, -0.04, -0.11), ('ashing', 600, 0.72, -0.02, 0), ('B', 500, 1.25, -0.04, -0.03), ('asket', 600, 0.72, -0.02, 0)]
x, ds = 0.0, []
top, bot = 0, 0
for text, w, size, ls, mr in runs:
    f = fonts[w]; upm = f['head'].unitsPerEm; gs = f.getGlyphSet(); cmap = f.getBestCmap(); s = size / upm
    for ch in text:
        g = cmap[ord(ch)]; pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, 0)))
        ds.append(pen.getCommands())
        x += gs[g].width * s + ls * size
    x += mr * size
    top = min(top, -f['OS/2'].sCapHeight * s); 
ds_all = ' '.join(ds)
asc = 1.25 * 0.74  # approx cap height region; compute bbox precisely below
from fontTools.pens.boundsPen import BoundsPen
json.dump({'d': ds_all, 'w': round(x, 4)}, open('wordmark.json', 'w'))
print('advance', x)
