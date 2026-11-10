"""Finds clean component bounds + corner radius in the real captures → compose/assets/crops.js."""
import json, numpy as np
from PIL import Image
# key: (screen, search region x0,y0,x1,y1, mode) — 'trim' = card on page bg, 'pad' = content on white, padded
SPEC = {
 'field': ('s02-phone', (0.02, 0.66, 0.98, 0.745), 'trim'),
 'otp': ('s04-otp-filled', (0.03, 0.698, 0.97, 0.775), 'pad'),
 'orders': ('h01-home', (0.01, 0.17, 0.99, 0.38), 'trim'),
 'hwallet': ('h01-home', (0.505, 0.37, 0.99, 0.53), 'trim'),
 'wcard': ('w05-topup-done', (0.0, 0.06, 1.0, 0.375), 'trim'),
 'chips': ('w03-topup-2000', (0.03, 0.635, 0.97, 0.705), 'pad'),
 'txns': ('w05-topup-done', (0.02, 0.40, 0.98, 0.665), 'pad'),
 'service': ('b04-items-done', (0.0, 0.57, 1.0, 0.72), 'trim'),
 'items': ('b11-review', (0.0, 0.376, 1.0, 0.58), 'trim'),
 'days': ('b07-days', (0.02, 0.29, 0.98, 0.425), 'pad'),
 'slots': ('b09-slots', (0.02, 0.425, 0.98, 0.64), 'pad'),
 'pickup': ('b11-review', (0.0, 0.28, 1.0, 0.378), 'trim'),
 'bill': ('b11-review', (0.0, 0.615, 1.0, 0.81), 'trim'),
 'coupon': ('p03-coupon-applied', (0.02, 0.21, 0.98, 0.51), 'pad'),
 'pbill': ('p03-coupon-applied', (0.02, 0.74, 0.98, 0.866), 'pad'),
 'paybtn': ('p03-coupon-applied', (0.03, 0.885, 0.97, 0.945), 'trim'),
 'slip': ('p05-paying-7', (0.02, 0.19, 0.98, 0.9), 'trim'),
 'qr': ('q01-qr-unlocked', (0.0, 0.2, 1.0, 0.75), 'trim'),
 'prog': ('r-ready-progress', (0.0, 0.0, 1.0, 0.375), 'trim'),
}
out = {}
for k, (n, (x0, y0, x1, y1), mode) in SPEC.items():
    im = np.asarray(Image.open(f'shots/{n}.png').convert('RGB')).astype(int); H, W, _ = im.shape
    X0, Y0, X1, Y1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
    reg = im[Y0:Y1, X0:X1]
    bg = np.median(np.concatenate([reg[:3, :3].reshape(-1, 3), reg[:3, -3:].reshape(-1, 3), reg[-3:, :3].reshape(-1, 3), reg[-3:, -3:].reshape(-1, 3)]), 0)
    m = np.abs(reg - bg).sum(2) > 24
    if mode == 'trim':
        from scipy import ndimage
        lab, _ = ndimage.label(m); sizes = np.bincount(lab.ravel()); sizes[0] = 0; m = lab == sizes.argmax()
    ys, xs = np.nonzero(m)
    a, b, c, d = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    r = 0
    if mode == 'trim':
        sub = m[b:d, a:c]; dd = 0
        while dd < min(sub.shape) // 2 and not sub[dd, dd]: dd += 1
        r = dd / (1 - 2 ** -0.5)
        if dd == 0 and b == 0: r = 0
    else:
        p = int(0.035 * W); a, b, c, d = a - p, b - p, c + p, d + p; r = 0.045 * W
    out[k] = {'img': n, 'c': [round((X0 + a) / W, 4), round((Y0 + b) / H, 4), round((X0 + c) / W, 4), round((Y0 + d) / H, 4)], 'r': round(r * 780 / W, 1), 'pad': mode == 'pad'}
out['service'].update(c=[0.0359,0.5699,0.9641,0.72],r=25); out['items'].update(c=[0.0359,0.376,0.9641,0.5798],r=27)
out['prog'].update(c=[0.0385,0.0,0.9615,0.3748],r=40); out['pickup']['r']=41  # thin-bordered white cards: blob search fails
open('compose/assets/crops.js', 'w').write('window.CROPS=' + json.dumps(out) + ';')
for k, v in out.items(): print(k, v['c'], v['r'])
import sys; sys.exit(0)
# logo parts: drop near-white pixels (towel knockout) so no white patches show on beige
for p in ['basket', 'clothTop', 'clothRed', 'towel', 'sparkles']:
    f = f'compose/assets/logo/{p}.png'; a = np.asarray(Image.open(f).convert('RGBA')).copy()
    wht = (a[..., :3].min(2) > 225); a[wht, 3] = 0
    Image.fromarray(a).save(f)
