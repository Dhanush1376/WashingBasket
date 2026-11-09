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
X0, X1 = -0.02, 1.16
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


M = 0.017
body_m = d_sole > M
bm_f = body_m.astype(np.float32)
edge = np.clip((blur(bm_f, 0.028) - 0.5) * 2, 0, 1)          # 0 at the shell's edge, 1 a little way in
h_body = 0.034 + 0.13 * (1 - (1 - edge) ** 2.2)
h_body += 0.17 * np.clip((blur(bm_f, 0.10) - 0.5) * 2, 0, 1) ** 1.6   # the whole crown domed
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
h_top = 0.33 + 0.05 * np.sin(np.pi * sh_ ** 0.9) + 0.06 * np.sqrt(np.clip(-d_cap / HR, 0, 1)) ** 1.3
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
    q = np.maximum(np.dstack([np.abs(x - bx) - 0.010, np.abs(y) - 0.020]), 0)
    bd = np.sqrt(q[..., 0] ** 2 + q[..., 1] ** 2) - 0.009
    bm = (bd < 0) & handle_m
    buttons.append(bm)
    h = h + bm * 0.012 * smooth(0.0, 0.006, -bd)
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
op = cv2.GaussianBlur(np.random.default_rng(11).random((HPX, WPX)).astype(np.float32), (0, 0), 3.0)
h = h + (op - 0.5) * 0.0012 * body_m

# ---- lighting
gy, gx = np.gradient(cv2.GaussianBlur(h, (0, 0), 2.0), UPP)
n = np.dstack([-gx, -gy, np.ones_like(h)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
nx, ny, nz = n[..., 0], n[..., 1], n[..., 2]
L = np.array([-0.45, -0.55, 0.70]); L /= np.linalg.norm(L)
ndl = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
Hh = L + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
ndh = np.clip(nx * Hh[0] + ny * Hh[1] + nz * Hh[2], 0, 1)
# reflection of the view straight down
rx, ry, rz = 2 * nx * nz, 2 * ny * nz, 2 * nz * nz - 1


def env(rx, ry, rz):
    """A studio: a big softbox up and to the left, a strip light to the right, the warm cloth below."""
    box = np.exp(-(((rx + 0.38) / 0.36) ** 2 + ((ry + 0.42) / 0.26) ** 2) ** 1.6)
    strip = 0.55 * np.exp(-(((rx - 0.62) / 0.09) ** 2 + (ry / 0.55) ** 2) ** 2)
    sky = 0.40 + 0.22 * np.clip(rz, 0, 1) - 0.25 * np.clip(rx * 0.6 + ry * 0.8, -1, 1)
    up = np.dstack([sky + 1.1 * box + strip] * 3)
    cloth = np.array([0.95, 0.82, 0.72]) * 0.72
    k = smooth(0.32, 0.0, rz)[..., None]
    return up * (1 - k) + cloth * k


E = env(rx, ry, rz)
fres = (0.04 + 0.96 * (1 - nz) ** 5)[..., None]

# ambient occlusion from the height around each point
ao = 1 - 5.0 * np.clip(cv2.GaussianBlur(h, (0, 0), 22) - h, 0, None)
ao *= 1 - 2.5 * np.clip(cv2.GaussianBlur(h, (0, 0), 6) - h, 0, None)
ao = np.clip(ao, 0.25, 1)[..., None]

# the light's shadow: march toward the light over the height field
shadow = np.ones_like(h)
lx, ly = L[0] / np.hypot(L[0], L[1]), L[1] / np.hypot(L[0], L[1])
slope = L[2] / np.hypot(L[0], L[1])
for step in range(1, 48):
    dist = step * 0.008
    sh_px = dist / UPP
    shifted = cv2.warpAffine(h, np.float32([[1, 0, -lx * sh_px], [0, 1, -ly * sh_px]]), (WPX, HPX),
                             flags=cv2.INTER_LINEAR, borderValue=0)
    # (shifted holds the height at the point `dist` toward the light)
    block = shifted - h - dist * slope
    shadow = np.minimum(shadow, 1 - np.clip(block / 0.01, 0, 1))
shadow = cv2.GaussianBlur(shadow, (0, 0), 5)
shadow = (0.45 + 0.55 * shadow)[..., None]


def plastic(albedo, gloss, spec_pow, spec_k, env_k):
    a = np.array(albedo)
    diff = a * (0.32 * ao + 0.78 * ndl[..., None] * shadow)
    spec = spec_k * (ndh ** spec_pow)[..., None] * shadow
    return diff + spec + fres * E * env_k * gloss


white = plastic((0.90, 0.90, 0.91), 1.0, 160, 0.55, 0.9)
navy = plastic((0.07, 0.13, 0.34), 1.0, 220, 0.75, 1.0)
rubber = plastic((0.13, 0.135, 0.15), 0.35, 24, 0.08, 0.35)
btn = plastic((0.86, 0.87, 0.89), 0.8, 90, 0.35, 0.6)
bootc = plastic((0.78, 0.80, 0.83), 0.5, 40, 0.18, 0.4)
steel = (np.array([0.80, 0.82, 0.85]) * (0.55 * E + 0.25)) * (0.85 + 0.15 * ndl[..., None])
# brushed along its length
steel *= (0.94 + 0.06 * cv2.GaussianBlur(np.random.default_rng(3).random((HPX, WPX)).astype(np.float32), (0, 0), sigmaX=30, sigmaY=0.6))[..., None]
# the water window: light let through, deeper toward the middle, a bright rim, the water's surface catching the light
depth = np.clip(1 - tank_e, 0, 1)[..., None]
tank = np.array([0.52, 0.74, 0.95]) * (0.55 + 0.45 * (1 - depth)) * (0.6 + 0.4 * ndl[..., None]) + fres * E * 1.2
tank += 0.25 * np.exp(-((tank_e - 0.92) / 0.05) ** 2)[..., None] * np.array([0.8, 0.92, 1.0])
tank += 0.18 * np.exp(-(((x - 0.18) / 0.05) ** 2 + ((y + 0.03) / 0.022) ** 2))[..., None]
gap = np.array([0.03, 0.045, 0.09]) * ao

col = steel.copy()
col = np.where(body_m[..., None], white, col)
col = np.where((crown_m & body_m)[..., None], navy, col)
col = np.where(tank_m[..., None], tank, col)
col = np.where((gap_soft > 0.5)[..., None], gap * (1 - 0.5 * gap_soft[..., None]) + col * 0.5 * (1 - gap_soft[..., None]), col)
col = np.where(handle_m[..., None] & (rise > 0.5)[..., None], np.where(grip_m[..., None], rubber, navy), col)
col = np.where(button_m[..., None], btn, col)
col = np.where((boot_m & ~sole_m)[..., None], bootc, col)

# the raised handle's soft shadow on the shell below it, down and to the right, away from the light
hs = (handle_m & (rise > 0.3)).astype(np.float32) * rise
hs = cv2.warpAffine(hs, np.float32([[1, 0, 0.022 / UPP], [0, 1, 0.034 / UPP]]), (WPX, HPX))
hs = blur(hs, 0.012) * (1 - handle_m) * body_m
col *= (1 - 0.5 * hs)[..., None]

# the power light at the heel: a small orange glow
led = np.exp(-(((x - 0.955) / 0.009) ** 2 + ((y - 0.115) / 0.009) ** 2))
col = col * (1 - led[..., None] * 0.9) + led[..., None] * np.array([1.0, 0.56, 0.12]) * 1.25
col += np.exp(-(((x - 0.955) / 0.03) ** 2 + ((y - 0.115) / 0.03) ** 2))[..., None] * np.array([1.0, 0.5, 0.1]) * 0.12 * body_m[..., None]

# a touch of film tone and gamma
col = np.clip(col, 0, None)
col = col / (1 + 0.25 * col)
col = np.clip(col * 1.12, 0, 1) ** (1 / 1.15)

# scaled down premultiplied, so the colour at the edges does not pick up the black outside
rgba = np.dstack([col[..., ::-1] * alpha[..., None], alpha]).astype(np.float32)
small = cv2.resize(rgba, (FINAL_W, HPX // SS), interpolation=cv2.INTER_AREA)
small[..., :3] = small[..., :3] / np.maximum(small[..., 3:], 1e-3)
out = np.clip(small * 255 + 0.5, 0, 255).astype(np.uint8)
path = os.path.join(OUT, "cloth-iron.webp")
cv2.imwrite(path, out, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("wrote", path, out.shape[1], out.shape[0], "ratio", out.shape[1] / out.shape[0],
      "boot end at", (1.14 - X0) / (X1 - X0))
