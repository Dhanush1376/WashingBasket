"""Clean component cut-outs from the real captures → compose/assets/crops.js, plus asset touch-ups.
trim: the card is the largest region of its own fill colour (borders, shadows and neighbours fall away).
pad:  content on a white sheet; elements cut by the search box are dropped, then the rest is padded.
Also: recolours the app's #013E86 navy to the film's dark navy (#0B1F44) in the screen JPEGs, and closes the
towel knock-out gap in the logo basket."""
import json, numpy as np
from PIL import Image
from scipy import ndimage

SPEC = {
 'field': ('s02-phone', (0.02, 0.66, 0.98, 0.745), 'trim'),
 'otp': ('s04-otp-filled', (0.03, 0.698, 0.97, 0.775), 'pad'),
 'orders': ('h01-home', (0.01, 0.17, 0.99, 0.38), 'trim'),
 'hwallet': ('h01-home', (0.505, 0.37, 0.99, 0.53), 'trim'),
 'wcard': ('w05-topup-done', (0.0, 0.06, 1.0, 0.375), 'trim'),
 'chips': ('w03-topup-2000', (0.03, 0.635, 0.97, 0.705), 'pad'),
 'txns': ('w05-topup-done', (0.02, 0.40, 0.98, 0.665), 'pad'),
 'service': ('b04-items-done', (0.0, 0.57, 1.0, 0.72), 'trim'),
 'items': ('b11-review', (0.0, 0.376, 1.0, 0.585), 'trim'),
 'days': ('b07-days', (0.02, 0.29, 0.98, 0.425), 'pad'),
 'slots': ('b09-slots', (0.02, 0.43, 0.98, 0.645), 'pad'),
 'pickup': ('b11-review', (0.0, 0.28, 1.0, 0.38), 'trim'),
 'bill': ('b11-review', (0.0, 0.612, 1.0, 0.815), 'trim'),
 'coupon': ('p03-coupon-applied', (0.02, 0.205, 0.98, 0.52), 'pad'),
 'pbill': ('p03-coupon-applied', (0.02, 0.735, 0.98, 0.872), 'pad'),
 'paybtn': ('p03-coupon-applied', (0.03, 0.88, 0.97, 0.95), 'trim'),
 'slip': ('p05-paying-7', (0.02, 0.19, 0.98, 0.92), 'trim'),
 'qr': ('q01-qr-unlocked', (0.0, 0.2, 1.0, 0.75), 'trim'),
 'prog': ('r-ready-progress', (0.0, 0.0, 1.0, 0.38), 'trim'),
}
out = {}
for k, (n, (x0, y0, x1, y1), mode) in SPEC.items():
    im = np.asarray(Image.open(f'shots/{n}.png').convert('RGB')).astype(int); H, W, _ = im.shape
    X0, Y0, X1, Y1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
    reg = im[Y0:Y1, X0:X1]
    bg = np.median(np.concatenate([reg[:4, :4].reshape(-1, 3), reg[:4, -4:].reshape(-1, 3), reg[-4:, :4].reshape(-1, 3), reg[-4:, -4:].reshape(-1, 3)]), 0)
    if mode == 'trim':
        cand = reg[np.abs(reg - bg).sum(2) > 24] // 6
        vals, cnt = np.unique(cand.reshape(-1, 3), axis=0, return_counts=True)
        fill = vals[cnt.argmax()] * 6 + 3
        m = np.abs(reg - fill).sum(2) < 24
        m = ndimage.binary_closing(m, iterations=3)
        lab, _ = ndimage.label(m); sizes = np.bincount(lab.ravel()); sizes[0] = 0; m = lab == sizes.argmax()
        m = ndimage.binary_fill_holes(m)
        ys, xs = np.nonzero(m); a, b, c, d = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        sub = m[b:d, a:c]; dd = 0
        while dd < min(sub.shape) // 2 and not sub[dd, dd]: dd += 1
        r = dd / (1 - 2 ** -0.5) if not (b == 0 and dd == 0) else 0
    else:
        m = np.abs(reg - bg).sum(2) > 24
        g = ndimage.binary_dilation(m, iterations=10)
        lab, nl = ndimage.label(g); keep = np.zeros_like(m)
        for i in range(1, nl + 1):
            ys, xs = np.nonzero(lab == i)
            if ys.min() == 0 or xs.min() == 0 or ys.max() == g.shape[0] - 1 or xs.max() == g.shape[1] - 1: continue
            keep |= (lab == i) & m
        ys, xs = np.nonzero(keep); p = int(0.035 * W)
        a, b, c, d = xs.min() - p, ys.min() - p, xs.max() + 1 + p, ys.max() + 1 + p; r = 0.045 * W
    out[k] = {'img': n, 'c': [round((X0 + a) / W, 4), round((Y0 + b) / H, 4), round((X0 + c) / W, 4), round((Y0 + d) / H, 4)], 'r': round(r * 780 / W, 1), 'pad': mode == 'pad'}
    print(k, out[k]['c'], out[k]['r'])
open('compose/assets/crops.js', 'w').write('window.CROPS=' + json.dumps(out) + ';')

# app navy → dark navy, only on the white↔navy blend line (fills, text and their anti-aliasing)
import glob
NAVY, DARK, WH = np.array([1, 62, 134.]), np.array([11, 31, 68.]), np.array([255, 255, 255.])
for f in glob.glob('compose/assets/screens/*.jpg'):
    src = f.replace('compose/assets/screens', 'shots').replace('.jpg', '.png')
    x = np.asarray(Image.open(src).convert('RGB')).astype(float)
    a = ((WH - x) @ (WH - NAVY)) / ((WH - NAVY) @ (WH - NAVY))
    resid = np.abs(x - (WH + (NAVY - WH) * a[..., None])).sum(2)
    sel = (resid < 30) & (a > 0.25)
    y = x.copy(); y[sel] = (WH + (DARK - WH) * np.clip(a, 0, 1)[..., None])[sel]
    Image.fromarray(y.astype(np.uint8)).save(f, quality=94)

# basket: fill the towel knock-out so the towel sits directly on the rim (no gap)
bk = np.asarray(Image.open('compose/assets/logo/basket.png').convert('RGBA')).copy()
al = bk[..., 3] > 128
closed = ndimage.binary_closing(al, structure=np.ones((3, 3)), iterations=14)
new = closed & ~al
bk[new] = [254, 135, 1, 255]
Image.fromarray(bk).save('compose/assets/logo/basket.png')

# Hand-checked bounds where the automatic search is unreliable (thin-bordered white cards, carousels, pills).
FIX = {'wcard': ([0.0359, 0.0829, 0.9641, 0.3578], 47.8), 'otp': ([0.0274, 0.6987, 0.9726, 0.7907], 35.1),
       'service': ([0.0359, 0.5699, 0.9641, 0.72], 25), 'items': ([0.0359, 0.376, 0.9641, 0.5798], 27),
       'bill': ([0.035, 0.628, 0.965, 0.805], 41), 'pickup': ([0.0359, 0.286, 0.9641, 0.372], 41),
       'coupon': ([0.0274, 0.1939, 0.9726, 0.5257], 35.1), 'pbill': ([0.0274, 0.738, 0.9726, 0.858], 35.1), 'slip': ([0.0897, 0.262, 0.9103, 0.9186], 0),
       'prog': ([0.0385, 0.0, 0.9615, 0.3748], 40)}
for k, (c, r) in FIX.items(): out[k]['c'] = c; out[k]['r'] = r
for k in ('field', 'paybtn'):  # pills: radius = half the height
    out[k]['r'] = round((out[k]['c'][3] - out[k]['c'][1]) * 1688 / 2, 1)
open('compose/assets/crops.js', 'w').write('window.CROPS=' + json.dumps(out) + ';')
