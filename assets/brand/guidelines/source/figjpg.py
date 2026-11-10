# figure PNGs (2.5x renders) -> JPEG q88 for the Word edition; lockup.png stays PNG (transparent)
import glob, os
from PIL import Image
n = 0
for f in glob.glob('out/figs/*.png'):
    if f.endswith('lockup.png'): continue
    im = Image.open(f)
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA'); bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[-1]); im = bg
    im.convert('RGB').save(f[:-4] + '.jpg', 'JPEG', quality=88, optimize=True); n += 1
print('converted', n)
