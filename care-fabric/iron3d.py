"""The steam iron, seen from straight above, rendered from a height model so it reads as a real object.

  soleplate  brushed steel, a thin bright band round the body with a bevelled edge
  shell      glossy two-tone plastic: a pearl-white skirt and a deep navy crown, a fine panel line between
  tank       the translucent water window at the front, the light coming through it
  handle     raised high along the middle: a soft-touch grip, the two steam buttons ahead of it, the dark gap
             either side where you see down past it to the shell
  boot       the ribbed rubber strain relief the cord leaves through (the cord itself is drawn live on the page,
             so it can trail after the iron)

The model is a height field built from distance fields; it is lit by a soft key light from the upper left
with a studio environment for reflections, ambient occlusion from the height, and the handle's own shadow
cast onto the shell. Rendered at twice the size and scaled down, so every edge is smooth.

  python iron3d.py   ->  website/src/assets/cloth-iron.webp  (tip to the left, the cord leaves to the right)
"""
import os

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "..", "website", "src", "assets")

# the frame, in model units: the iron runs from its tip at x = 0 to its heel at x = 1; the boot runs on to 1.14
X0, X1 = -0.02, 1.18
Y0, Y1 = -0.26, 0.26
FINAL_W = 1080
SS = 2
WPX = FINAL_W * SS
HPX = int(round(WPX * (Y1 - Y0) / (X1 - X0)))
UPP = (X1 - X0) / WPX  # model units per pixel

y, x = np.mgrid[:HPX, :WPX].astype(np.float32)
x = X0 + (x + 0.5) * UPP
y = Y0 + (y + 0.5) * UPP


def smooth(a, b, t):
    t = np.clip((t - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def inside_dist(mask):
    """Distance (model units) from each inside pixel to the edge of the mask."""
    return cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5) * UPP


# ---- the outline: a pointed tip, full sides, a squared heel with rounded corners
WMAX = 0.232
t = np.clip(x / 0.80, 0, 1)
# a soft ogive: the sides swell out of the tip, fullest a little behind the middle
half = WMAX * (1 - (1 - t) ** 2.15) ** 0.62 * (1 + 0.035 * np.sin(np.pi * np.clip((x - 0.35) / 0.6, 0, 1)))
# the heel bows out a little at the middle, its corners well rounded
heel_x = 1.0 + 0.018 * (1 - (y / WMAX) ** 2)
hk = np.clip((x - 0.84) / (heel_x - 0.84), 0, 1)
half = half * np.sqrt(np.clip(1 - hk ** 3.2, 0, 1))
sole_m = (np.abs(y) < half) & (x > 0) & (x < heel_x)
sole_m = cv2.GaussianBlur(sole_m.astype(np.float32), (0, 0), 0.004 / UPP) > 0.5
d_sole = inside_dist(sole_m)

# ---- the shell sits inset on the soleplate. Its form comes from the outline blurred at a few scales, so it
# swells smoothly from its edge like a moulded part, with no ridges where one distance meets another
def blur(a, sigma):
    return cv2.GaussianBlur(a.astype(np.float32), (0, 0), sigma / UPP)


# (it overhangs nearly to the soleplate's edge: from above only a thin line of steel shows)
M = 0.0055
body_m = d_sole > M
bm_f = body_m.astype(np.float32)
# a full rounded shoulder: steep at the edge, as a moulded shell is, then a broad dome over the top
d_body = inside_dist(body_m)
shoulder = np.sqrt(np.clip(1 - (1 - np.clip(d_body / 0.075, 0, 1)) ** 2, 0, 1))
h_body = 0.04 + 0.21 * shoulder
h_body += 0.09 * np.clip((blur(bm_f, 0.10) - 0.5) * 2, 0, 1) ** 1.4
h_body = cv2.GaussianBlur(h_body, (0, 0), 0.004 / UPP) * body_m
# the crown: a navy panel that sweeps back from under the handle's front and widens over the heel,
# its line curving across the white skirt; a fine groove where they meet
g_in = blur(bm_f, 0.03)
wn = 0.235 * np.sin(np.clip((x - 0.27) / 0.70, 0, 1) * np.pi / 2) ** 1.25
g_crown = blur(((np.abs(y) < wn) & (g_in > 0.88)).astype(np.float32), 0.02)
crown_m = (g_crown > 0.5) & body_m
h_body -= 0.0035 * np.exp(-((g_crown - 0.5) / 0.06) ** 2) * body_m

h_sole = 0.022 + 0.008 * np.clip((blur(sole_m, 0.004) - 0.5) * 2, 0, 1)

# ---- the water window, front and centre in the crown
# a teardrop, its point toward the tip
ry = 0.074 * (0.45 + 0.55 * np.clip((x - 0.07) / 0.2, 0, 1) ** 0.7)
tank_e = ((x - 0.175) / 0.115) ** 2 + (y / ry) ** 2
tank_m = (tank_e < 1) & body_m
h_body -= 0.005 * np.exp(-((tank_e - 1) / 0.04) ** 2) * body_m  # its rim, sunk a little

h = np.where(body_m, h_body, h_sole)
h = np.where(sole_m, h, 0)

# ---- the handle: a capsule along the middle, rising from the shell at its front
# it is not a bar: a slim neck at the front swells into the grip and thickens again into the rear post
HA, HB = 0.30, 0.935
def hrad(xx):
    s_ = np.clip((xx - HA) / (HB - HA), 0, 1)
    return 0.024 + 0.016 * s_ + 0.030 * np.clip(np.sin(np.pi * s_ ** 0.85), 0, 1) ** 0.9 - 0.008 * np.sin(np.pi * np.clip((s_ - 0.15) / 0.3, 0, 1)) ** 2
cx = np.clip(x, HA, HB)
d_cap = np.sqrt((x - cx) ** 2 + y ** 2) - hrad(cx)
handle_m = d_cap < 0
HR = hrad(cx)
rise = smooth(0.26, 0.44, x)
# arched along its length, highest over the grip
sh_ = np.clip((x - HA) / (HB - HA), 0, 1)
h_top = 0.40 + 0.06 * np.sin(np.pi * sh_ ** 0.9) + 0.05 * np.sqrt(np.clip(-d_cap / HR, 0, 1)) ** 1.1
h_handle = h_body + (h_top - h_body) * rise
h = np.where(handle_m, np.maximum(h, h_handle), h)
# the gap either side of it, seen down past it
# (teardrops, widest by the grip, closing to points front and back)
gw = 0.03 * np.clip(np.sin(np.pi * np.clip((x - 0.43) / 0.43, 0, 1) ** 0.8), 0, 1) ** 0.7
gap_soft = smooth(0.0, 0.006, d_cap) * (1 - smooth(gw - 0.007, gw, d_cap)) * (gw > 0.008)
h = h - 0.1 * gap_soft * body_m
# the grip along its top, and the two steam buttons ahead of it
# (a long rounded pad, finely ribbed across)
gx0 = np.clip(x, 0.55, 0.85)
d_grip = np.sqrt((x - gx0) ** 2 + y ** 2) - (hrad(gx0) - 0.016)
grip_m = handle_m & (d_grip < 0)
h = h + grip_m * (0.004 * smooth(0.0, 0.004, -d_grip) + 0.0012 * np.sin(x * 2 * np.pi * 95) ** 2)
buttons = []
for bx in (0.355, 0.425):
    q = np.maximum(np.dstack([np.abs(x - bx) - 0.004, np.abs(y) - 0.012]), 0)
    bd = np.sqrt(q[..., 0] ** 2 + q[..., 1] ** 2) - 0.010
    bm = (bd < 0) & handle_m
    buttons.append(bm)
    # (set into the handle: a fine dark parting line round it, its top barely proud and domed)
    h = h - 0.004 * np.exp(-(bd / 0.0012) ** 2) * handle_m + bm * 0.005 * np.sqrt(np.clip(-bd / 0.010, 0, 1))
button_m = buttons[0] | buttons[1]

# ---- the boot the cord leaves through: ribbed, tapering, set low at the heel
bx = np.clip((x - 0.975) / (1.14 - 0.975), 0, 1)
br = (0.042 - 0.018 * bx) * (1 + 0.07 * np.sin(x * 2 * np.pi * 75) * (bx > 0.12))
boot_m = (x > 0.95) & (x < 1.14) & (np.abs(y) < br)
h_boot = 0.07 + br * np.sqrt(np.clip(1 - (y / br) ** 2, 0, 1))
h = np.where(boot_m & ~sole_m, h_boot, np.where(boot_m & sole_m, np.maximum(h, h_boot), h))

alpha = (sole_m | boot_m).astype(np.float32)
# (the end of the boot faded into the cord, which carries on from there)
alpha *= 1 - smooth(1.125, 1.14, x) * boot_m

# a faint orange-peel texture in the moulded plastic, so its reflections are not machine-perfect
op = cv2.GaussianBlur(np.random.default_rng(11).random((HPX, WPX)).astype(np.float32), (0, 0), 6.0)
h = h + (op - 0.5) * 0.0005 * body_m

# ---- lighting: a product photograph. (Lit for the way it is used on the page, turned a quarter clockwise with
# its tip up: the key light then comes from the upper left of the screen, as the shadows there fall. In the
# image's own frame that is toward the tip and toward the image's bottom.) A dark studio with two crisp softboxes, so the glossy plastic shows
# sharp-edged window reflections on a deep ground, rather than soft even shading
gy, gx = np.gradient(cv2.GaussianBlur(h, (0, 0), 1.6), UPP)
n = np.dstack([-gx, -gy, np.ones_like(h)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
nx, ny, nz = n[..., 0], n[..., 1], n[..., 2]
L = np.array([-0.55, 0.45, 0.70]); L /= np.linalg.norm(L)
ndl = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
Hh = L + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
ndh = np.clip(nx * Hh[0] + ny * Hh[1] + nz * Hh[2], 0, 1)
# reflection of the view straight down
rx, ry, rz = 2 * nx * nz, 2 * ny * nz, 2 * nz * nz - 1


def box(cx, cy, hw, hh, soft):
    return smooth(-soft, soft, hw - np.abs(rx - cx)) * smooth(-soft, soft, hh - np.abs(ry - cy))


def env(rx, ry, rz):
    """A dark studio: a big softbox up and to the left, a tall strip to the right, a little fill overhead,
    the warm cloth all round below."""
    key = 3.0 * box(-0.34, 0.36, 0.22, 0.30, 0.03)
    strip = 1.5 * box(0.02, -0.66, 0.42, 0.055, 0.02)
    fill = 0.55 * box(-0.04, 0.05, 0.10, 0.16, 0.08)
    dark = 0.07 + 0.05 * np.clip(rz, 0, 1)
    up = np.dstack([dark + key + strip + fill] * 3)
    cloth = np.array([0.96, 0.80, 0.68]) * 0.55
    k = smooth(0.22, -0.05, rz)[..., None]
    return up * (1 - k) + cloth * k


E = env(rx, ry, rz)
F0 = 0.045
fres = (F0 + (1 - F0) * (1 - nz) ** 5)[..., None]

# ambient occlusion from the height around each point
ao = 1 - 4.0 * np.clip(cv2.GaussianBlur(h, (0, 0), 22) - h, 0, None)
ao *= 1 - 2.5 * np.clip(cv2.GaussianBlur(h, (0, 0), 6) - h, 0, None)
ao = np.clip(ao, 0.2, 1)[..., None]

# the key light's shadow: march toward it over the height field
shadow = np.ones_like(h)
lx, ly = L[0] / np.hypot(L[0], L[1]), L[1] / np.hypot(L[0], L[1])
slope = L[2] / np.hypot(L[0], L[1])
for step in range(1, 56):
    dist = step * 0.008
    sh_px = dist / UPP
    shifted = cv2.warpAffine(h, np.float32([[1, 0, -lx * sh_px], [0, 1, -ly * sh_px]]), (WPX, HPX),
                             flags=cv2.INTER_LINEAR, borderValue=0)
    block = shifted - h - dist * slope
    shadow = np.minimum(shadow, 1 - np.clip(block / 0.01, 0, 1))
shadow = cv2.GaussianBlur(shadow, (0, 0), 6)
shadow = (0.35 + 0.65 * shadow)[..., None]
# (how much a point sees of the room above it, for the environment's light)
sky = (0.55 + 0.45 * nz)[..., None] * ao


def plastic(albedo, rough, spec_k, coat):
    """Moulded plastic under a clear, glossy skin: diffuse from the key and the room, the skin reflecting
    the studio (sharper the smoother it is), a highlight from the key."""
    a = np.array(albedo)
    diff = a * (0.42 * sky + 0.75 * ndl[..., None] * shadow)
    pw = 2.0 / max(rough, 1e-3) ** 2
    spec = spec_k * (ndh ** pw)[..., None] * shadow
    refl = fres * E * coat
    return diff * (1 - fres * coat) + spec + refl


white = plastic((0.86, 0.865, 0.87), 0.06, 0.6, 1.0)
navy = plastic((0.035, 0.065, 0.17), 0.05, 0.9, 1.15)
rubber = plastic((0.075, 0.078, 0.085), 0.45, 0.06, 0.25)
btn = plastic((0.80, 0.81, 0.83), 0.12, 0.4, 0.8)
bootc = plastic((0.70, 0.72, 0.75), 0.3, 0.15, 0.4)
# polished steel: almost all reflection, tinted a little cool, brushed along its length
steel = np.array([0.86, 0.88, 0.91]) * (0.92 * E + 0.05)
steel *= (0.93 + 0.07 * cv2.GaussianBlur(np.random.default_rng(3).random((HPX, WPX)).astype(np.float32), (0, 0), sigmaX=30, sigmaY=0.6))[..., None]
# the water window: clear blue plastic, the water inside lit from behind, its surface catching the room
depth = np.clip(1 - tank_e, 0, 1)[..., None]
tank = np.array([0.30, 0.52, 0.78]) * (0.35 + 0.5 * (1 - depth)) * (0.55 + 0.45 * ndl[..., None]) + fres * E * 1.3
tank += 0.18 * np.exp(-((tank_e - 0.9) / 0.06) ** 2)[..., None] * np.array([0.7, 0.85, 1.0])
gap = np.array([0.02, 0.025, 0.04]) * ao

col = steel.copy()
col = np.where(body_m[..., None], white, col)
col = np.where((crown_m & body_m)[..., None], navy, col)
col = np.where(tank_m[..., None], tank, col)
gk = smooth(0.0, 0.4, blur(gap_soft, 0.004))[..., None] * (1 - handle_m[..., None] * (rise[..., None] > 0.5))
col = col * (1 - gk) + gap * gk
col = np.where(handle_m[..., None] & (rise > 0.5)[..., None], np.where(grip_m[..., None], rubber, navy), col)
col = np.where(button_m[..., None], btn, col)
col = np.where((boot_m & ~sole_m)[..., None], bootc, col)

# the raised handle's soft shadow on the shell below it, away from the light
hs = (handle_m & (rise > 0.3)).astype(np.float32) * rise
hs = cv2.warpAffine(hs, np.float32([[1, 0, 0.045 / UPP], [0, 1, -0.03 / UPP]]), (WPX, HPX))
hs = blur(hs, 0.018) * (1 - handle_m) * body_m
col *= (1 - 0.55 * hs)[..., None]

# the power light at the heel: a small orange glow under clear plastic
led = np.exp(-(((x - 0.955) / 0.008) ** 2 + ((y - 0.115) / 0.008) ** 2))
col = col * (1 - led[..., None] * 0.9) + led[..., None] * np.array([1.0, 0.5, 0.1]) * 1.3
col += np.exp(-(((x - 0.955) / 0.025) ** 2 + ((y - 0.115) / 0.025) ** 2))[..., None] * np.array([1.0, 0.45, 0.08]) * 0.08 * body_m[..., None]

# ---- the camera: a lens above the middle of the iron, not an infinitely far one, so what stands higher is a
# little larger and pushed out from the middle, as in a photograph
D = 3.0
CX, CY = 0.58, 0.0
qx, qy = x, y
px_, py_ = x.copy(), y.copy()
for _ in range(4):
    hp = cv2.remap(h, ((px_ - X0) / UPP - 0.5).astype(np.float32), ((py_ - Y0) / UPP - 0.5).astype(np.float32),
                   cv2.INTER_LINEAR, borderValue=0)
    k = (D - hp) / D
    px_ = CX + (qx - CX) * k
    py_ = CY + (qy - CY) * k
mx = ((px_ - X0) / UPP - 0.5).astype(np.float32)
my = ((py_ - Y0) / UPP - 0.5).astype(np.float32)
col = cv2.remap(col.astype(np.float32), mx, my, cv2.INTER_LINEAR, borderValue=0)
# its form in slices, for the shadow the page casts live (so it falls the same way however the iron is turned):
# where it stands above each height, at half size, one under another. The page offsets each slice by its height
# away from the light and joins them
SLICES = (0.02, 0.14, 0.26, 0.36, 0.45)
lay = []
for thr in SLICES:
    m_ = ((h > thr) & (alpha > 0.5)).astype(np.float32)
    m_ = cv2.remap(m_, mx, my, cv2.INTER_LINEAR, borderValue=0)
    m_ = cv2.resize(m_, (FINAL_W // 2, HPX // SS // 2), interpolation=cv2.INTER_AREA)
    lay.append(m_)
lay = np.vstack(lay)
sl = np.dstack([np.zeros_like(lay)] * 3 + [lay])
cv2.imwrite(os.path.join(OUT, "cloth-iron-shadow.webp"), np.clip(sl * 255 + 0.5, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 80])
print("slices at", SLICES, "of", X1 - X0, "wide")
alpha = cv2.remap(alpha.astype(np.float32), mx, my, cv2.INTER_LINEAR, borderValue=0)

# tone: a gentle filmic curve, a little lens softness and grain, so it is not cleaner than a photograph
col = np.clip(col, 0, None)
col = col / (1 + 0.32 * col)
col = np.clip(col * 1.16, 0, 1) ** (1 / 1.12)
col = cv2.GaussianBlur(col, (0, 0), 0.7)
grain = np.random.default_rng(17).standard_normal((HPX, WPX)).astype(np.float32)
col = np.clip(col * (1 + 0.012 * cv2.GaussianBlur(grain, (0, 0), 0.8))[..., None], 0, 1)

# scaled down premultiplied, so the colour at the edges does not pick up the black outside
rgba = np.dstack([col[..., ::-1] * alpha[..., None], alpha]).astype(np.float32)
small = cv2.resize(rgba, (FINAL_W, HPX // SS), interpolation=cv2.INTER_AREA)
small[..., :3] = small[..., :3] / np.maximum(small[..., 3:], 1e-3)
out = np.clip(np.nan_to_num(small) * 255 + 0.5, 0, 255).astype(np.uint8)
path = os.path.join(OUT, "cloth-iron.webp")
cv2.imwrite(path, out, [cv2.IMWRITE_WEBP_QUALITY, 92])
# where the cord leaves: the end of the boot along the middle, after the camera's warp
row = out[out.shape[0] // 2, :, 3]
end = int(np.nonzero(row > 128)[0].max()) / out.shape[1]
print("wrote", path, out.shape[1], out.shape[0], "ratio", out.shape[1] / out.shape[0], "boot end at", round(end, 4))
