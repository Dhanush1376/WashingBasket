"""The laundry basket the folded piece is put into at the end of the journey, and the table it all lies on,
both seen from straight above and rendered so they read as real things beside the cloth.

  basket       a woven wicker basket: a rolled, wrapped rim; the walls sloping down inside, stakes and
               weavers over and under; a plain-woven floor. Lit from the upper left like the iron, with
               the rim's shadow falling across the inside and ambient occlusion in its corners
  basket-rim   the rim alone, laid over the folded piece once it has dropped in, so its corners tuck under
  table-wood   a tile of pale oak planks, seamless, for the table the cloth lies on

Units are the folded piece's own width-scale (the cloth when laid flat is 1 wide): the basket's opening
is 0.47 x 0.33 of that, so the piece, folded in four (0.5 x 0.34) and dropped in, sits snugly with its
corners under the rim.

  python basket3d.py  ->  website/src/assets/basket.webp, basket-rim.webp, table-wood.webp
"""
import os

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "..", "website", "src", "assets")

# ---- the basket ------------------------------------------------------------------------------------------
HX, HY = 0.31, 0.24          # half the frame
FINAL_W = 1000
SS = 2
WPX = FINAL_W * SS
HPX = int(round(WPX * HY / HX))
UPP = 2 * HX / WPX
y, x = np.mgrid[:HPX, :WPX].astype(np.float32)
x = -HX + (x + 0.5) * UPP
y = -HY + (y + 0.5) * UPP


def smooth(a, b, t):
    t = np.clip((t - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def rrect(bx, by, r):
    qx = np.abs(x) - bx + r
    qy = np.abs(y) - by + r
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r


def hash1(a):
    return np.modf(np.sin(a * 12.9898 + 4.1) * 43758.5453)[0] % 1.0


RIM = 0.05
d_o = rrect(0.285, 0.215, 0.095)
inside = d_o < 0
rim_m = inside & (d_o > -RIM)
# down the wall: 0 at the rim's inner edge, 1 on the floor
t = np.clip((-d_o - RIM) / 0.05, 0, 1)
wall_m = inside & (d_o <= -RIM) & (t < 1)
floor_m = inside & (t >= 1)

# round the basket, as an angle; and the weave's rows down the wall
theta = np.arctan2(y / 0.215, x / 0.285)
NST = 96
sp = (theta / (2 * np.pi) + 0.5) * NST          # stakes, running down the wall
wv = t * 7.0                                     # weavers, running round it
si, sf = np.floor(sp), sp - np.floor(sp)
wi, wf = np.floor(wv), wv - np.floor(wv)
over = ((si + wi) % 2) == 0                      # the weaver passes over the stake here
prof_w = np.sin(np.pi * wf) ** 0.6
prof_s = np.sin(np.pi * sf) ** 0.6
wall_prof = np.where(over, prof_w, prof_s)
wall_tone = np.where(over, hash1(wi * 3.1 + np.floor(sp / 7)), hash1(si * 1.7))

# the rim: a rolled bundle bound round with a cane wrapped on the diagonal
rk = np.clip(-d_o / RIM, 0, 1)                  # 0 outside edge, 1 inner edge
wrap = (theta / (2 * np.pi)) * 230 + rk * 1.6
rim_prof = np.sin(np.pi * (wrap - np.floor(wrap))) ** 0.5
rim_tone = hash1(np.floor(wrap) * 0.37)

# the floor: plain woven, over one under one
CELL = 0.0105
fu, fv = x / CELL, y / CELL
fiu, fiv = np.floor(fu), np.floor(fv)
along_x = ((fiu + fiv) % 2) == 0
floor_prof = np.where(along_x, np.sin(np.pi * (fv - fiv)), np.sin(np.pi * (fu - fiu))) ** 0.6
floor_tone = np.where(along_x, hash1(fiv * 2.3), hash1(fiu * 5.1 + 9))

h = np.zeros_like(x)
h_rim = 0.22 + 0.016 * np.sqrt(np.clip(1 - ((rk - 0.5) * 2) ** 2, 0, 1)) + 0.0025 * rim_prof
h_wall = 0.22 - 0.16 * t ** 0.75 + 0.002 * wall_prof
h_floor = 0.06 + 0.0018 * floor_prof
h = np.where(rim_m, h_rim, h)
h = np.where(wall_m, h_wall, h)
h = np.where(floor_m, h_floor, h)

# ---- the clothes already in it: folded pieces laid in, overlapping, each a soft slab with rounded, puffed edges,
# the crease where it was folded in half, and the layers showing along its folded side. Where a piece runs under
# the wall the wall shows above it
GARMENTS = [
    # x, y, half length, half width, turn (degrees), its base height, colour, weave
    (-0.10, 0.065, 0.13, 0.085, 12, 0.080, (0.93, 0.93, 0.92), "plain"),    # a white shirt
    (0.10, 0.070, 0.12, 0.080, -15, 0.085, (0.62, 0.74, 0.88), "stripe"),   # a pale blue striped shirt
    (0.11, -0.070, 0.12, 0.080, 18, 0.090, (0.60, 0.61, 0.64), "plain"),    # a grey T-shirt
    (-0.11, -0.072, 0.12, 0.075, -10, 0.095, (0.22, 0.32, 0.50), "twill"),  # jeans
    (0.17, 0.005, 0.10, 0.065, 82, 0.092, (0.86, 0.66, 0.27), "plain"),     # a mustard top
    (-0.175, 0.0, 0.095, 0.06, 86, 0.088, (0.42, 0.52, 0.40), "plain"),     # an olive one
    (0.0, 0.0, 0.125, 0.082, 4, 0.100, (0.95, 0.94, 0.90), "terry"),        # a white towel, on top
]
in_basket = inside & (d_o < -RIM)
cloth_m = np.zeros_like(inside)
galb = np.zeros(x.shape + (3,), np.float32)
fn = cv2.GaussianBlur(np.random.default_rng(8).random((HPX, WPX)).astype(np.float32), (0, 0), 1.2)
lf = cv2.GaussianBlur(np.random.default_rng(12).standard_normal((HPX, WPX)).astype(np.float32), (0, 0), 0.012 / UPP)
lf /= lf.std() + 1e-6
for gx_, gy_, ga, gb, gang, gbase, gc, kind in GARMENTS:
    an = np.radians(gang)
    u = (x - gx_) * np.cos(an) + (y - gy_) * np.sin(an)
    v = -(x - gx_) * np.sin(an) + (y - gy_) * np.cos(an)
    rr = 0.018
    qx, qy = np.abs(u) - ga + rr, np.abs(v) - gb + rr
    d = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - rr
    d = d + 0.0022 * lf  # (no cloth edge is ruler-straight, but it is smooth)
    m = d < 0
    th = 0.028
    hc = gbase + th * smooth(0.0, 0.016, -d) ** 0.55
    hc -= 0.0025 * np.exp(-(u / 0.005) ** 2)                                   # the crease down its middle
    hc += 0.0012 * np.sin(np.pi * np.clip(-d / 0.004, 0, 4)) * (v > gb * 0.4) * (d > -0.016)  # its layers along the fold
    hc += 0.0006 * (fn - 0.5) + 0.002 * lf * smooth(0.0, 0.03, -d)  # a little lumpy, as cloth lies
    top = m & in_basket & (hc > h)
    h = np.where(top, hc, h)
    cloth_m |= top
    a_ = np.array(gc, np.float32)
    tex = 0.96 + 0.08 * fn
    if kind == "stripe":
        tex = tex * (1 - 0.16 * (np.sin(v * 2 * np.pi / 0.009) > 0.6))
    elif kind == "twill":
        tex = tex * (0.9 + 0.2 * (np.sin((u + v) * 2 * np.pi / 0.0035) * 0.5 + 0.5))
    elif kind == "terry":
        tex = tex * (0.95 + 0.07 * cv2.GaussianBlur(np.random.default_rng(9).random((HPX, WPX)).astype(np.float32), (0, 0), 0.7))
    galb = np.where(top[..., None], a_[None, None, :] * tex[..., None], galb)
alpha = cv2.GaussianBlur(inside.astype(np.float32), (0, 0), 1.0)

gy, gx = np.gradient(cv2.GaussianBlur(h, (0, 0), 1.2), UPP)
n = np.dstack([-gx, -gy, np.ones_like(h)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
L = np.array([-0.45, -0.55, 0.70]); L /= np.linalg.norm(L)
ndl = np.clip(n @ L, 0, 1)
Hh = L + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
ndh = np.clip(n @ Hh, 0, 1)

ao = 1 - 4.0 * np.clip(cv2.GaussianBlur(h, (0, 0), 0.03 / UPP) - h, 0, None)
ao *= 1 - 3.0 * np.clip(cv2.GaussianBlur(h, (0, 0), 0.006 / UPP) - h, 0, None)
ao = np.clip(ao, 0.3, 1)

shadow = np.ones_like(h)
lx, ly = L[0] / np.hypot(L[0], L[1]), L[1] / np.hypot(L[0], L[1])
slope = L[2] / np.hypot(L[0], L[1])
for step in range(1, 40):
    dist = step * 0.004
    px = dist / UPP
    sh = cv2.warpAffine(h, np.float32([[1, 0, -lx * px], [0, 1, -ly * px]]), (WPX, HPX), flags=cv2.INTER_LINEAR, borderValue=0)
    shadow = np.minimum(shadow, 1 - np.clip((sh - h - dist * slope) / 0.006, 0, 1))
shadow = cv2.GaussianBlur(shadow, (0, 0), 3)
shadow = 0.4 + 0.6 * shadow

tone = np.where(rim_m, rim_tone, np.where(wall_m, wall_tone, floor_tone))
prof = np.where(rim_m, rim_prof, np.where(wall_m, wall_prof, floor_prof))
base = np.array([0.80, 0.62, 0.40])
col = base[None, None, :] * (0.86 + 0.24 * tone[..., None])
col = col * (0.55 + 0.45 * prof[..., None])                 # darker down between the strands
# fine fibres along each strand
fib = cv2.GaussianBlur(np.random.default_rng(5).random((HPX, WPX)).astype(np.float32), (0, 0), 0.8)
col *= (0.92 + 0.16 * fib)[..., None]
lit = 0.30 * ao + 0.85 * ndl * shadow
col = np.where(cloth_m[..., None], galb, col)
col = col * lit[..., None] + np.where(cloth_m, 0.02, 0.10)[..., None] * (ndh ** 30 * shadow)[..., None]
# the inside a touch deeper in tone, as it is in a real basket
col *= (1 - np.where(cloth_m, 0.06, 0.18) * t * inside)[..., None]
col = np.clip(col, 0, None)
col = col / (1 + 0.2 * col)
col = np.clip(col * 1.1, 0, 1) ** (1 / 1.1)


def save(name, c, a, w):
    rgba = np.dstack([c[..., ::-1] * a[..., None], a]).astype(np.float32)
    small = cv2.resize(rgba, (w, int(round(c.shape[0] * w / c.shape[1]))), interpolation=cv2.INTER_AREA)
    small[..., :3] /= np.maximum(small[..., 3:], 1e-3)
    out = np.clip(np.nan_to_num(small) * 255 + 0.5, 0, 255).astype(np.uint8)
    p = os.path.join(OUT, name)
    cv2.imwrite(p, out, [cv2.IMWRITE_WEBP_QUALITY, 88])
    print("wrote", p, out.shape[1], out.shape[0])


# its shadow on the table, down and to the right like everything else's, baked in (a CSS shadow would be
# drawn again every frame as the view draws back)
sh = cv2.warpAffine(inside.astype(np.float32), np.float32([[1, 0, 0.006 / UPP], [0, 1, 0.010 / UPP]]), (WPX, HPX))
sh = cv2.GaussianBlur(sh, (0, 0), 0.010 / UPP) * 0.30
# and where it stands, the dark line of contact right under its edge
ct = cv2.warpAffine(inside.astype(np.float32), np.float32([[1, 0, 0.0015 / UPP], [0, 1, 0.0025 / UPP]]), (WPX, HPX))
sh = np.maximum(sh, cv2.GaussianBlur(ct, (0, 0), 0.0025 / UPP) * 0.5)
out_a = alpha + sh * (1 - alpha)
shc = np.array([0.24, 0.15, 0.07])
out_c = (col * alpha[..., None] + shc * (sh * (1 - alpha))[..., None]) / np.maximum(out_a, 1e-4)[..., None]
save("basket.webp", out_c, out_a, FINAL_W)
rim_a = cv2.GaussianBlur((inside & (d_o > -RIM - 0.004)).astype(np.float32), (0, 0), 1.0)
save("basket-rim.webp", col, rim_a, FINAL_W)

# ---- the table: pale oak planks, a seamless tile ---------------------------------------------------------
T = 1024
rng = np.random.default_rng(21)


def pnoise(sx, sy, seed):
    """Noise that wraps at the tile's edges: white noise blurred in frequency space."""
    w = np.random.default_rng(seed).standard_normal((T, T))
    fy = np.fft.fftfreq(T)[:, None]
    fx = np.fft.fftfreq(T)[None, :]
    g = np.exp(-2 * (np.pi ** 2) * ((fx * sx) ** 2 + (fy * sy) ** 2))
    r = np.real(np.fft.ifft2(np.fft.fft2(w) * g))
    return (r - r.mean()) / (r.std() + 1e-9)


ty, tx = np.mgrid[:T, :T].astype(np.float32)
PL = 4
plank = np.floor(ty / (T / PL))
pv = (ty % (T / PL)) / (T / PL)
n1 = pnoise(160, 6, 1)
n2 = pnoise(40, 2.5, 2)
n3 = pnoise(400, 30, 3)
# the grain: lines running along each plank, wandering, closer in some boards than others
dens = 9 + 5 * hash1(plank * 7.3)
g = (pv * dens + 0.9 * n1 + 0.25 * n2 + hash1(plank) * 10)
lines = np.abs(np.sin(np.pi * g)) ** 7
pores = np.clip(pnoise(1.2, 0.5, 4), 0, None) * 0.06
tone = 0.92 + 0.08 * hash1(plank * 3.3) + 0.04 * n3
tone = 0.985 + 0.015 * (tone - 0.92) / 0.12
c = np.array([0.945, 0.937, 0.92])[None, None, :] * tone[..., None]
c = c * (1 - 0.018 * lines[..., None] - 0.12 * pores[..., None]) * (1 - 0.008 * n2[..., None])
# the joint between planks, a thin dark seam with a little bevel
seam = np.exp(-(((pv * (T / PL)) - 0.5) / 1.2) ** 2) + np.exp(-((((1 - pv) * (T / PL)) - 0.5) / 1.2) ** 2)
c *= (1 - 0.12 * seam)[..., None]
c = np.clip(c, 0, 1)
p = os.path.join(OUT, "table-wood.webp")
cv2.imwrite(p, np.clip(c[..., ::-1] * 255 + 0.5, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 82])
print("wrote", p)
