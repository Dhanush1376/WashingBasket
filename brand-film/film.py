"""
Washing Basket — 15 s seamless brand loop.

Programmatic 2.5D motion design built directly from the six original
illustrations: each scene is rigged with local mesh warps (character life),
lifted sprites (sparkles, sun, steam, hanger…), procedural effects drawn in
the illustrations' own line language (white strokes, navy outlines), and a
virtual camera. Six match-cut transitions connect the scenes into one loop:

  porthole → drum → sun (spin) → whip-pan on the breeze → steam/stack match →
  folded-cloth bands → delivery shrinks back into the porthole → (loop)

Usage:  python film.py frames  [--from N --to M]   (writes PNG frames)
        python film.py still T                     (one frame at time T)
"""
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'work'))
from rigs import FILES, RIGS  # noqa: E402

SRC_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_W, OUT_H = 1080, 1350   # 4:5 portrait canvas for the login hero
OUT = OUT_W
FIT = 0.94            # at zoom 1 the frame shows 94 % of the artwork's width
FPS = 30
DURATION = 15.0
NFRAMES = int(DURATION * FPS)
PAD = 520             # flat background margin around each illustration

WHITE = np.array([255, 255, 255], np.float32)
NAVY_LINE = (24, 42, 88)   # outline navy used throughout the artwork (RGB)

# ------------------------------------------------------------------ timeline
# Each scene owns 3.2 s of local time τ: [0, .7] transition in,
# [.7, 2.5] solo, [2.5, 3.2] transition out. Scene k starts at START[k].
TR = 1.0   # transitions are slow and eased: a full second each
START = {1: 14.3, 2: 1.8, 3: 4.3, 4: 6.8, 5: 9.3, 6: 11.8}
SCENE_LEN = 2.5 + TR

# Camera keyframes are authored on the original 0.7 s-transition timeline
# ([0, .7] in, [.7, 2.5] solo, [2.5, 3.2] out); this maps local time onto it so
# every camera move stretches to fill the longer transitions.
AUTHORED_TR = 0.7


def camera_time(tau):
    if tau <= TR:
        return tau * AUTHORED_TR / TR
    if tau <= 2.5:
        return AUTHORED_TR + (tau - TR) * (2.5 - AUTHORED_TR) / (2.5 - TR)
    return 2.5 + (tau - 2.5) * AUTHORED_TR / TR


def local_time(k, t):
    tau = (t - START[k]) % DURATION
    return tau if tau <= SCENE_LEN + 1e-9 else None


# ------------------------------------------------------------------ easing
def clamp01(x):
    return max(0.0, min(1.0, x))


def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def ease_in_out_cubic(x):
    x = clamp01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_out_cubic(x):
    return 1 - (1 - clamp01(x)) ** 3


def ease_in_cubic(x):
    return clamp01(x) ** 3


def ease_out_quint(x):
    return 1 - (1 - clamp01(x)) ** 5


def ease_out_back(x, s=1.7):
    x = clamp01(x) - 1
    return x * x * ((s + 1) * x + s) + 1


def lerp(a, b, u):
    return a + (b - a) * u


def keyframes(keys, tau):
    """keys: [(τ, value-tuple, easing)], easing applies to the segment ending at that key."""
    if tau <= keys[0][0]:
        return keys[0][1]
    for (t0, v0, _), (t1, v1, ease) in zip(keys, keys[1:]):
        if tau <= t1:
            u = ease((tau - t0) / (t1 - t0))
            return tuple(lerp(a, b, u) for a, b in zip(v0, v1))
    return keys[-1][1]


def wave(tau, period, phase=0.0):
    return math.sin(2 * math.pi * tau / period + phase)


# ------------------------------------------------------------------ assets
class Sprite:
    def __init__(self, rgba, x0, y0):
        self.rgba, self.x0, self.y0 = rgba, x0, y0
        h, w = rgba.shape[:2]
        self.cx, self.cy = x0 + w / 2, y0 + h / 2


class Scene:
    def __init__(self, k):
        self.k = k
        rgb = np.array(Image.open(os.path.join(SRC_DIR, FILES[k] + '.png')).convert('RGB'))
        self.h, self.w = rgb.shape[:2]
        border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3),
                                 rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
        self.bg = np.median(border, 0).astype(np.float32)
        rig = RIGS[k]

        # Lift white line-art sprites off the flat background, then heal the plate.
        self.sprites = {}
        heal = np.zeros((self.h, self.w), np.uint8)
        for name, (x0, y0, x1, y1) in rig['sprites'].items():
            patch = rgb[y0:y1, x0:x1].astype(np.float32)
            wb = WHITE - self.bg
            a = np.clip(((patch - self.bg) @ wb) / (wb @ wb), 0, 1)
            a[a < 0.12] = 0
            rgba = np.dstack([np.broadcast_to(WHITE, patch.shape), a * 255]).astype(np.uint8)
            self.sprites[name] = Sprite(rgba, x0, y0)
            heal[y0:y1, x0:x1] = cv2.dilate((a > 0.05).astype(np.uint8) * 255, np.ones((7, 7), np.uint8))
        base = cv2.inpaint(rgb, heal, 6, cv2.INPAINT_TELEA) if heal.any() else rgb.copy()
        self.base = base

        # Padded plate: background extended smoothly from the four corners.
        H, W = self.h + 2 * PAD, self.w + 2 * PAD
        corners = [rgb[5:40, 5:40], rgb[5:40, -40:-5], rgb[-40:-5, 5:40], rgb[-40:-5, -40:-5]]
        c = [cc.reshape(-1, 3).mean(0) for cc in corners]
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        u = np.clip((xx - PAD) / self.w, 0, 1)[..., None]
        v = np.clip((yy - PAD) / self.h, 0, 1)[..., None]
        self.plate = ((c[0] * (1 - u) + c[1] * u) * (1 - v) + (c[2] * (1 - u) + c[3] * u) * v).astype(np.uint8)

        # Precomputed blob weights for the local warp field (quarter resolution).
        q = 4
        gy, gx = np.mgrid[0:self.h:q, 0:self.w:q].astype(np.float32)
        self.q = q
        self.blob_w = []
        for (bx, by, rx, ry) in rig['blobs']:
            d2 = ((gx - bx) / rx) ** 2 + ((gy - by) / ry) ** 2
            self.blob_w.append(np.exp(-2.2 * d2).astype(np.float32))
        self.grid_x, self.grid_y = np.meshgrid(np.arange(self.w, dtype=np.float32),
                                               np.arange(self.h, dtype=np.float32))
        self.setup()

    # per-scene extra setup
    def setup(self):
        pass

    def blob_offsets(self, tau):
        return [(0.0, 0.0)] * len(self.blob_w)

    def warp(self, img, tau):
        offs = self.blob_offsets(tau)
        fx = np.zeros_like(self.blob_w[0])
        fy = np.zeros_like(self.blob_w[0])
        for wgt, (dx, dy) in zip(self.blob_w, offs):
            if dx:
                fx += wgt * dx
            if dy:
                fy += wgt * dy
        fx = cv2.resize(fx, (self.w, self.h), interpolation=cv2.INTER_LINEAR)
        fy = cv2.resize(fy, (self.w, self.h), interpolation=cv2.INTER_LINEAR)
        return cv2.remap(img, self.grid_x - fx, self.grid_y - fy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    def decorate(self, img, tau):
        """Scene-specific sprites and procedural effects, drawn in image space."""
        pass

    def render(self, tau):
        img = self.warp(self.base, tau)
        self.decorate(img, tau)
        plate = self.plate.copy()
        plate[PAD:PAD + self.h, PAD:PAD + self.w] = img
        return plate

    def camera(self, tau):
        return (self.w / 2, self.h / 2, 1.0, 0.0)

    def cam_at(self, tau):
        return self.camera(camera_time(tau))

    BOTTOM_LOCK = True    # figures are cut by the art's bottom edge: never show below it

    def cover(self):
        return OUT_W / (self.w * FIT)


# ------------------------------------------------------------------ drawing helpers
def draw_sprite(img, spr, dx=0.0, dy=0.0, scale=1.0, angle=0.0, alpha=1.0, pivot=None):
    if alpha <= 0.01 or scale <= 0.01:
        return
    px, py = pivot if pivot else (spr.cx, spr.cy)
    h, w = spr.rgba.shape[:2]
    m = cv2.getRotationMatrix2D((px - spr.x0, py - spr.y0), -angle, scale)
    m[0, 2] += spr.x0 + dx
    m[1, 2] += spr.y0 + dy
    pts = cv2.transform(np.array([[[0, 0]], [[w, 0]], [[0, h]], [[w, h]]], np.float32), m).reshape(-1, 2)
    x0, y0 = np.floor(pts.min(0)).astype(int) - 2
    x1, y1 = np.ceil(pts.max(0)).astype(int) + 2
    x0, y0 = max(x0, 0), max(y0, 0)
    x1, y1 = min(x1, img.shape[1]), min(y1, img.shape[0])
    if x1 <= x0 or y1 <= y0:
        return
    m2 = m.copy()
    m2[0, 2] -= x0
    m2[1, 2] -= y0
    warped = cv2.warpAffine(spr.rgba, m2, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    a = warped[..., 3:4].astype(np.float32) / 255 * alpha
    roi = img[y0:y1, x0:x1].astype(np.float32)
    img[y0:y1, x0:x1] = (roi * (1 - a) + warped[..., :3].astype(np.float32) * a).astype(np.uint8)


def blend_mask(img, mask, color, opacity=1.0, bbox=None):
    """Composite a solid colour through an 8-bit AA mask."""
    if bbox:
        x0, y0, x1, y1 = bbox
    else:
        ys, xs = np.nonzero(mask)
        if len(xs) == 0:
            return
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    a = mask[y0:y1, x0:x1, None].astype(np.float32) / 255 * opacity
    roi = img[y0:y1, x0:x1].astype(np.float32)
    img[y0:y1, x0:x1] = (roi * (1 - a) + np.array(color, np.float32) * a).astype(np.uint8)


SUB = 4  # sub-pixel bits for cv2 AA drawing


def P(x, y):
    return (int(round(x * (1 << SUB))), int(round(y * (1 << SUB))))


def bubble(img, x, y, r, opacity=1.0, outline=4):
    """A soap bubble in the artwork's style: white disc, navy outline, tiny highlight."""
    if r < 1.5 or opacity <= 0.02:
        return
    m = np.zeros(img.shape[:2], np.uint8)
    bb = (max(int(x - r - 8), 0), max(int(y - r - 8), 0),
          min(int(x + r + 8), img.shape[1]), min(int(y + r + 8), img.shape[0]))
    if bb[2] <= bb[0] or bb[3] <= bb[1]:
        return
    cv2.circle(m, P(x, y), int((r + outline) * (1 << SUB)), 255, -1, cv2.LINE_AA, SUB)
    blend_mask(img, m, NAVY_LINE, opacity, bb)
    m[:] = 0
    cv2.circle(m, P(x, y), int(r * (1 << SUB)), 255, -1, cv2.LINE_AA, SUB)
    blend_mask(img, m, (255, 255, 255), opacity, bb)


def ring_bubble(img, x, y, r, opacity=1.0, width=5):
    if r < 2 or opacity <= 0.02:
        return
    m = np.zeros(img.shape[:2], np.uint8)
    cv2.circle(m, P(x, y), int(r * (1 << SUB)), 255, width, cv2.LINE_AA, SUB)
    bb = (max(int(x - r - 10), 0), max(int(y - r - 10), 0),
          min(int(x + r + 10), img.shape[1]), min(int(y + r + 10), img.shape[0]))
    if bb[2] > bb[0] and bb[3] > bb[1]:
        blend_mask(img, m, (255, 255, 255), opacity, bb)


def stroke(img, pts, width, color=(255, 255, 255), opacity=1.0):
    if opacity <= 0.02 or len(pts) < 2:
        return
    m = np.zeros(img.shape[:2], np.uint8)
    arr = np.array([P(x, y) for x, y in pts], np.int32).reshape(-1, 1, 2)
    cv2.polylines(m, [arr], False, 255, int(width), cv2.LINE_AA, SUB)
    # round caps
    for (x, y) in (pts[0], pts[-1]):
        cv2.circle(m, P(x, y), int(width / 2 * (1 << SUB)), 255, -1, cv2.LINE_AA, SUB)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    bb = (max(int(min(xs) - width - 4), 0), max(int(min(ys) - width - 4), 0),
          min(int(max(xs) + width + 4), img.shape[1]), min(int(max(ys) + width + 4), img.shape[0]))
    if bb[2] > bb[0] and bb[3] > bb[1]:
        blend_mask(img, m, color, opacity, bb)


def sparkle(img, x, y, size, opacity=1.0, angle=0.0):
    """Four-point sparkle with concave sides, as drawn in the illustrations."""
    if size < 2 or opacity <= 0.02:
        return
    pts = []
    for i in range(64):
        th = 2 * math.pi * i / 64
        # astroid-like four point star
        c, s = math.cos(th), math.sin(th)
        rx = math.copysign(abs(c) ** 3, c)
        ry = math.copysign(abs(s) ** 3, s)
        a = math.radians(angle)
        px = rx * math.cos(a) - ry * math.sin(a)
        py = rx * math.sin(a) + ry * math.cos(a)
        pts.append(P(x + px * size, y + py * size))
    m = np.zeros(img.shape[:2], np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 255, cv2.LINE_AA, SUB)
    bb = (max(int(x - size - 4), 0), max(int(y - size - 4), 0),
          min(int(x + size + 4), img.shape[1]), min(int(y + size + 4), img.shape[0]))
    if bb[2] > bb[0] and bb[3] > bb[1]:
        blend_mask(img, m, (255, 255, 255), opacity, bb)


def rng_list(seed, n, *ranges):
    r = np.random.default_rng(seed)
    return [tuple(r.uniform(lo, hi) for lo, hi in ranges) for _ in range(n)]


# ------------------------------------------------------------------ scenes
class Collecting(Scene):
    PORT = (894, 398)
    PORT_R = 84  # inner radius of the porthole ring

    def setup(self):
        self.suds = rng_list(11, 9, (0, 2 * math.pi), (0.25, 0.85), (4, 9), (0.4, 1.2))
        self.floaters = rng_list(12, 6, (640, 1180), (0, 1), (8, 18), (0, 1))

    def blob_offsets(self, tau):
        b = 2.2
        return [
            (4 * wave(tau, b * 1.1), 3 * wave(tau, b * 1.1, 1.0)),          # head
            (0, -4 * wave(tau, b * 0.8)),                                  # breathing
            (4 * wave(tau, b * 0.8, 0.6), -9 * wave(tau, b * 0.8, -0.5)),  # shirt lifted
            (7 * wave(tau, 1.1), 0),                                       # hem flutter
            (5 * wave(tau, b, 0.3), 0),                                    # hair
        ]

    def decorate(self, img, tau):
        s = self.sprites
        tw = 0.5 + 0.5 * wave(tau, 1.3)
        draw_sprite(img, s['sparkA'], scale=0.75 + 0.4 * tw, angle=20 * wave(tau, 2.6), alpha=0.6 + 0.4 * tw)
        tw2 = 0.5 + 0.5 * wave(tau, 1.3, 2.2)
        draw_sprite(img, s['sparkB'], scale=0.7 + 0.45 * tw2, angle=-20 * wave(tau, 2.6), alpha=0.6 + 0.4 * tw2)
        # Suds orbiting inside the porthole: a quiet promise of the next scene.
        px, py = self.PORT
        for th0, rr, r, sp in self.suds:
            th = th0 + tau * (1.6 + sp)
            bubble(img, px + math.cos(th) * rr * self.PORT_R * 0.8, py + math.sin(th) * rr * self.PORT_R * 0.8,
                   r, opacity=0.85, outline=0)
        # Soap bubbles drifting up beside the machine.
        for x0, ph, r, sd in self.floaters:
            k = (tau / 3.2 + ph) % 1.0
            y = 760 - k * 640
            op = smooth(k / 0.2) * smooth((1 - k) / 0.25)
            ring_bubble(img, x0 + 18 * math.sin(k * 6 + sd * 6), y, r, opacity=0.55 * op, width=4)

    def camera(self, tau):
        px, py = self.PORT
        mid = (lerp(627, px, 0.35), lerp(640, py, 0.35))
        return keyframes([
            # arrives on the whip from the delivery and settles; the loop point is τ = 0.7 ≡ t = 0
            (0.0, (590, 650, 1.2, 0), None),
            (1.6, (620, 650, 1.14, 0), smooth),
            (2.5, (mid[0], mid[1], 1.26, 0), smooth),
            (2.82, (px, py, 1.9, 0), ease_in_cubic),
            (3.2, (px, py, 3.3, 0), lambda u: u),
        ], tau)


class Washing(Scene):
    DRUM = (826, 856)
    DRUM_R = 192

    def setup(self):
        rgb = self.base.astype(np.int32)
        R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        cx, cy = self.DRUM
        yy, xx = np.mgrid[0:self.h, 0:self.w]
        inside = (xx - cx) ** 2 + (yy - cy) ** 2 < (self.DRUM_R - 6) ** 2
        navyish = (B > 90) & (R < 90)
        white = (R > 200) & (G > 200) & (B > 200)
        # small white dots (bubbles) rotate with the water; big foam stays put
        n, lab, st, _ = cv2.connectedComponentsWithStats((white & inside).astype(np.uint8), 8)
        dots = np.isin(lab, [i for i in range(1, n) if st[i, 4] < 2500])
        self.water = (inside & (navyish | dots)).astype(np.uint8)
        self.water = cv2.erode(self.water, np.ones((3, 3), np.uint8))
        # bubble rings and dots travel whole with the water (their thin strokes must not be eroded away)
        self.water |= cv2.dilate(dots.astype(np.uint8), np.ones((5, 5), np.uint8)) & inside.astype(np.uint8)
        x0, y0 = cx - self.DRUM_R, cy - self.DRUM_R
        self.wbox = (x0, y0, cx + self.DRUM_R, cy + self.DRUM_R)
        navy = np.median(self.base[self.water.astype(bool) & ~dots], 0)
        plate = self.base.copy()
        plate[~self.water.astype(bool)] = navy
        plate[cv2.dilate(dots.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = navy   # bubbles move separately
        self.water_plate = plate[y0:y0 + 2 * self.DRUM_R, x0:x0 + 2 * self.DRUM_R].copy()
        self.water_mask = cv2.GaussianBlur(self.water[y0:y0 + 2 * self.DRUM_R, x0:x0 + 2 * self.DRUM_R].astype(np.float32), (3, 3), 0)
        self.navy = navy
        self.inner = rng_list(21, 14, (0, 2 * math.pi), (0.2, 0.92), (5, 13), (0.6, 1.4))
        self.escape = rng_list(22, 7, (0, 1), (6, 14), (-1, 1))

    def spin(self, tau):
        out = max(0.0, tau - 2.5)
        return 120 * tau + 900 * out * out

    def blob_offsets(self, tau):
        return [
            (2 * wave(tau, 1.6), 4 * wave(tau, 1.6, 0.4)),   # head nod
            (9 * wave(tau, 1.6), 4 * wave(tau, 1.6, 0.5)),   # arm feeding laundry in
            (10 * wave(tau, 0.9), 5 * wave(tau, 0.9, 1.4)),  # cloth flutter
            (0, 4 * wave(tau, 0.7)),                         # foam
        ]

    def decorate(self, img, tau):
        cx, cy = self.DRUM
        x0, y0, x1, y1 = self.wbox
        ang = self.spin(tau)
        m = cv2.getRotationMatrix2D((self.DRUM_R, self.DRUM_R), -ang, 1.0)
        rot = cv2.warpAffine(self.water_plate, m, (2 * self.DRUM_R, 2 * self.DRUM_R), flags=cv2.INTER_LINEAR,
                             borderValue=tuple(int(v) for v in self.navy))
        # bubbles tumbling with the water, drawn into the rotating plate's space
        for th0, rr, r, sp in self.inner:
            th = th0 + math.radians(ang) * sp * 0.6
            bx = self.DRUM_R + math.cos(th) * rr * (self.DRUM_R - 20)
            by = self.DRUM_R + math.sin(th) * rr * (self.DRUM_R - 20)
            bubble(rot, bx, by, r, opacity=0.95, outline=0)
        a = self.water_mask[..., None]
        roi = img[y0:y1, x0:x1].astype(np.float32)
        img[y0:y1, x0:x1] = (roi * (1 - a) + rot.astype(np.float32) * a).astype(np.uint8)
        # a few bubbles escape the door and float up over the orange
        for ph, r, sd in self.escape:
            k = (tau / 1.6 + ph) % 1.0
            x = cx + 150 + 140 * k + 30 * math.sin(k * 7 + sd * 5)
            y = cy - 120 - 560 * k
            bubble(img, x, y, r * (0.6 + 0.6 * k), opacity=smooth(k / 0.15) * smooth((1 - k) / 0.3), outline=4)

    def camera(self, tau):
        cx, cy = self.DRUM
        return keyframes([
            (0.0, (cx, cy, 1.55, 0), None),
            (0.32, (cx, cy, 1.45, 0), lambda u: u),
            (0.9, (700, 690, 1.17, 0), ease_out_cubic),
            (2.5, (680, 700, 1.21, 0), smooth),
            (3.2, (cx, cy, 2.3, 160), ease_in_cubic),
        ], tau)


class Drying(Scene):
    SUN = (922, 222)

    def setup(self):
        self.gusts = rng_list(31, 5, (0, 1), (180, 620), (0.7, 1.3))

    def blob_offsets(self, tau):
        p = 1.7
        gust = 1.0 + 0.6 * max(0.0, wave(tau, 3.2, -1.2))
        return [
            (9 * gust * wave(tau, p), 0),                         # shirt
            (15 * gust * wave(tau, p, -0.7), 3 * wave(tau, p)),   # towel
            (0, 3 * wave(tau, p, -0.3)),                          # clothesline
            (8 * wave(tau, p, 1.0), 0),                           # ponytail
            (2 * wave(tau, 2.6), 2 * wave(tau, 2.6, 1)),          # head
            (7 * wave(tau, 2.0, 0.5), 0),                         # plant
        ]

    def decorate(self, img, tau):
        s = self.sprites
        spin = 18 * tau - 260 * max(0.0, 0.7 - tau) ** 2
        draw_sprite(img, s['sun'], angle=spin, scale=1.0 + 0.04 * wave(tau, 1.6), pivot=self.SUN)
        draw_sprite(img, s['lines'], alpha=0.55 + 0.45 * (0.5 + 0.5 * wave(tau, 0.9)),
                    scale=0.92 + 0.12 * (0.5 + 0.5 * wave(tau, 0.9)))
        # breeze: soft white curls drifting across, in the illustration's stroke weight
        for ph, y0, sp in self.gusts:
            k = (tau * 0.42 * sp + ph) % 1.0
            x = -150 + k * (self.w + 300)
            op = smooth(k / 0.2) * smooth((1 - k) / 0.2) * 0.75
            pts = []
            for i in range(26):
                u = i / 25
                pts.append((x - 170 + u * 170, y0 + 10 * math.sin(u * 5 + tau * 3 + ph * 9)))
            # curl at the head of the gust
            for i in range(1, 14):
                th = -math.pi / 2 + i / 13 * 1.6 * math.pi
                pts.append((x + 22 * math.cos(th), y0 + pts[-1][1] - y0 - 22 - 22 * math.sin(th) + 22))
            stroke(img, pts, 7, opacity=op)

    def camera(self, tau):
        sx, sy = self.SUN
        return keyframes([
            (0.0, (sx, sy, 2.5, -160), None),
            (0.7, (sx - 80, sy + 120, 1.6, 0), ease_out_cubic),
            (1.5, (600, 650, 1.02, 0), ease_in_out_cubic),
            (2.5, (640, 640, 1.06, 0), smooth),
            (3.2, (700, 640, 1.06, 0), lambda u: u),
        ], tau)


class Ironing(Scene):
    STACK = (1000, 865)

    def setup(self):
        self.wisps = rng_list(41, 6, (0, 1), (300, 470), (-1, 1))
        self.puffs = rng_list(42, 16, (-1, 1), (-1, 1), (60, 160), (0, 2 * math.pi))

    def stroke_phase(self, tau):
        return wave(tau, 1.3)

    def blob_offsets(self, tau):
        ph = self.stroke_phase(tau)
        return [
            (26 * ph, 0),                       # iron + hand glide
            (14 * wave(tau, 1.3, -0.25), 0),    # forearm follows
            (2 * wave(tau, 2.6), 3 * wave(tau, 2.6, 0.8)),  # head
            (4 * wave(tau, 1.3, math.pi), 0),   # free hand smoothing
        ]

    def decorate(self, img, tau):
        s = self.sprites
        draw_sprite(img, s['steam'], dy=-6 * (0.5 + 0.5 * wave(tau, 1.0)), dx=4 * wave(tau, 0.8),
                    alpha=0.7 + 0.3 * wave(tau, 1.0))
        t1 = 0.5 + 0.5 * wave(tau, 1.2)
        t2 = 0.5 + 0.5 * wave(tau, 1.2, 2.5)
        draw_sprite(img, s['sparkA'], scale=0.75 + 0.4 * t1, angle=15 * wave(tau, 2.4), alpha=0.6 + 0.4 * t1)
        draw_sprite(img, s['sparkB'], scale=0.7 + 0.45 * t2, angle=-15 * wave(tau, 2.4), alpha=0.6 + 0.4 * t2)
        # steam rising from the soleplate as the iron glides
        ix = 420 + 26 * self.stroke_phase(tau)
        for ph, x0, sd in self.wisps:
            k = (tau / 1.4 + ph) % 1.0
            base_x = ix - 140 + (x0 - 300) * 0.9
            yb = 830 - k * 330
            pts = [(base_x + 14 * math.sin(i / 7 * 2.4 + k * 9 + sd * 3) + sd * 20 * k, yb - i * 9) for i in range(8)]
            stroke(img, pts, 7, opacity=0.8 * smooth(k / 0.2) * smooth((1 - k) / 0.4))
        # steam surge that carries the transition
        surge = smooth((tau - 2.45) / 0.45) * smooth((3.2 - tau) / 0.2 + 0.0001)
        if surge > 0.02:
            m = np.zeros(img.shape[:2], np.uint8)
            sx, sy = self.STACK
            for dx, dy, r, th in self.puffs:
                grow = 0.4 + 0.9 * surge
                cx = sx + dx * 210 * grow + 20 * math.cos(th + tau * 3)
                cy = sy - 60 + dy * 170 * grow - 80 * surge
                cv2.circle(m, P(cx, cy), int(r * grow * (1 << SUB)), 255, -1, cv2.LINE_AA, SUB)
            m = cv2.GaussianBlur(m, (0, 0), 14)
            blend_mask(img, m, (255, 255, 255), 0.92 * surge)

    def camera(self, tau):
        sx, sy = self.STACK
        return keyframes([
            (0.0, (560, 650, 1.06, 0), None),
            (0.7, (600, 650, 1.04, 0), ease_out_cubic),
            (2.5, (660, 680, 1.12, 0), smooth),
            (3.2, (sx, sy, 2.05, 0), ease_in_cubic),
        ], tau)


class Packing(Scene):
    STACK = (350, 960)
    BOTTOM_LOCK = False   # empty background below the table: the art can float

    def setup(self):
        self.pops = rng_list(51, 2, (820, 1040), (820, 880), (0, 1), (14, 20))

    def pat(self, tau):
        return max(0.0, wave(tau, 0.9)) ** 2

    def blob_offsets(self, tau):
        return [
            (0, 7 * self.pat(tau)),                       # patting the folded stack
            (2 * wave(tau, 2.4), 3 * wave(tau, 1.8)),     # head
            (7 * wave(tau, 2.0, 0.5), 0),                 # plant
        ]

    def decorate(self, img, tau):
        p = self.pat(tau)
        draw_sprite(img, self.sprites['burst'], scale=0.85 + 0.3 * p, alpha=0.5 + 0.5 * p,
                    pivot=(230, 735))
        for x, y, ph, sz in self.pops:
            k = (tau / 1.8 + ph) % 1.0
            sparkle(img, x, y - 80 * k, sz * math.sin(math.pi * k), opacity=0.95, angle=40 * k)

    def camera(self, tau):
        sx, sy = self.STACK
        return keyframes([
            (0.0, (sx, sy, 1.15, 0), None),
            (0.7, (540, 700, 1.06, 0), ease_out_cubic),
            (2.5, (600, 650, 1.04, 0), smooth),
            (3.2, (600, 645, 1.08, 0), lambda u: u),
        ], tau)


def chaikin(pts, n=3, closed=True):
    """Round off a polygon (corner cutting), so drawn shapes have the artwork's soft curves."""
    pts = np.asarray(pts, np.float32)
    for _ in range(n):
        nxt = np.roll(pts, -1, 0) if closed else pts[1:]
        cur = pts if closed else pts[:-1]
        q = 0.75 * cur + 0.25 * nxt
        r = 0.25 * cur + 0.75 * nxt
        pts = np.empty((len(q) * 2, 2), np.float32)
        pts[0::2], pts[1::2] = q, r
    return pts


SKIN = (250, 201, 160)
SLEEVE = (1, 58, 129)     # the customer's navy (scene 1's colour)


class Delivery(Scene):
    STACK_BOX = (150, 600, 690, 912)   # x0, y0, x1, y1 of the folded stack
    STACK_L = 142                      # left end of the stack
    FREE_X = True                      # the camera may drift left of the art to meet the customer

    def setup(self):
        # displacement weight for the stack and the courier's hands (they travel together)
        yy, xx = np.mgrid[0:self.h, 0:self.w].astype(np.float32)
        sx = 1 - np.clip((xx - 560) / 260, 0, 1)
        sx = sx * sx * (3 - 2 * sx)
        sy = np.clip((yy - 540) / 50, 0, 1) * np.clip((1000 - yy) / 50, 0, 1)
        self.take_w = (sx * sy).astype(np.float32)

    def reach(self, tau):
        """0 → 1 as the customer's hands come in from the left and close on the stack."""
        return ease_out_cubic((tau - 0.8) / 0.75)

    def take(self, tau):
        """The stack passes from the courier to the customer (pixels to the left)."""
        return 38 * ease_in_out_cubic((tau - 1.55) / 0.8)

    def blob_offsets(self, tau):
        return [
            (0.0, -3 * abs(wave(tau, 0.9)) * (1 - self.reach(tau))),   # stack bobbing in his hands
            (2 * wave(tau, 1.8), 3 * wave(tau, 1.8, 0.7)),           # friendly nod
        ]

    def render(self, tau):
        img = self.warp(self.base, tau)
        dx = self.take(tau)
        if dx > 0.05:
            img = cv2.remap(img, self.grid_x + dx * self.take_w, self.grid_y, cv2.INTER_LINEAR,
                            borderMode=cv2.BORDER_REPLICATE)
        self.decorate(img, tau)
        plate = self.plate.copy()
        plate[PAD:PAD + self.h, PAD:PAD + self.w] = img
        self.customer_hands(plate, tau, dx)
        return plate

    def decorate(self, img, tau):
        draw_sprite(img, self.sprites['hanger'], angle=7 * wave(tau, 1.8), pivot=(305, 168))
        b = 0.5 + 0.5 * wave(tau, 0.9)
        draw_sprite(img, self.sprites['burst'], scale=0.9 + 0.15 * b, alpha=0.7 + 0.3 * b, pivot=(450, 600))

    # ---------------------------------------------------------------- the customer
    def customer_setup(self):
        """Lift the courier's near hand and forearm from the artwork and mirror it: the customer
        reaches in from the left with a hand drawn by the same illustrator."""
        img = self.base
        r, g, b = [img[..., i].astype(np.int32) for i in range(3)]
        skin = ((r > 225) & (g > 160) & (g < 225) & (b > 110) & (b < 195)).astype(np.uint8) * 255
        region = np.zeros((self.h, self.w), np.uint8)
        cv2.fillPoly(region, [np.array([(172, 882), (240, 878), (378, 846), (424, 858), (474, 904), (560, 930),
                                        (720, 1000), (880, 1070), (880, 1170), (720, 1170), (560, 1090),
                                        (420, 1004), (300, 996), (172, 966)], np.int32)], 255)
        hand = cv2.bitwise_and(skin, region)
        hand = cv2.morphologyEx(hand, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        # take the navy outline with it (and the finger creases inside)
        ink = ((b > 50) & (r < 70) & (g < 80)).astype(np.uint8) * 255
        hand = cv2.bitwise_or(hand, cv2.bitwise_and(ink, cv2.dilate(hand, np.ones((13, 13), np.uint8))))
        hand = cv2.bitwise_and(hand, region)
        x0, y0, x1, y1 = 150, 820, 900, 1180
        rgb = img[y0:y1, x0:x1].astype(np.float32)[:, ::-1]
        a = cv2.GaussianBlur(hand[y0:y1, x0:x1].astype(np.float32) / 255, (3, 3), 0)[:, ::-1]
        rim = cv2.GaussianBlur(cv2.dilate(a, np.ones((25, 25), np.uint8)), (3, 3), 0)
        self.c_rgb, self.c_a, self.c_rim = rgb.copy(), a.copy(), rim
        # mirrored fingertips (originally at x≈176) sit under the stack, 230 px in from its left end
        self.c_tip = (x1 - x0) - 1 - (176 - x0)   # in the mirrored crop
        self.c_y0 = y0

    def customer_hands(self, plate, tau, dx):
        r = self.reach(tau)
        if r <= 0.001:
            return
        if not hasattr(self, 'c_rgb'):
            self.customer_setup()
        L = self.STACK_L - dx
        come = (1 - r) * 560                      # slides in from the left
        lift = 22 * (1 - r) - 4 * smooth((tau - 1.4) / 0.3)
        ox = int(round(L + 230 - self.c_tip - come)) + PAD
        oy = int(round(self.c_y0 + 6 + lift)) + PAD
        h, w = self.c_a.shape
        X0, Y0 = max(ox, 0), max(oy, 0)
        X1, Y1 = min(ox + w, plate.shape[1]), min(oy + h, plate.shape[0])
        if X1 <= X0 or Y1 <= Y0:
            return
        sl = (slice(Y0 - oy, Y1 - oy), slice(X0 - ox, X1 - ox))
        roi = plate[Y0:Y1, X0:X1].astype(np.float32)
        # white sticker rim, as in the artwork — only against the background, never over the courier
        on_bg = (np.linalg.norm(roi - self.bg, axis=2) < 60).astype(np.float32)
        on_bg = cv2.erode(on_bg, np.ones((5, 5), np.uint8))
        rim = (self.c_rim[sl] * on_bg)[..., None]
        roi = roi * (1 - rim) + 255 * rim
        a = self.c_a[sl][..., None]
        roi = roi * (1 - a) + self.c_rgb[sl] * a
        plate[Y0:Y1, X0:X1] = roi.clip(0, 255).astype(np.uint8)

    def camera(self, tau):
        bob = 5 * abs(wave(tau, 0.9))
        return keyframes([
            (0.0, (600, 640, 1.0, 0), None),
            (0.7, (600, 630 - bob, 1.0, 0), ease_out_cubic),
            (1.0, (590, 625, 1.0, 0), smooth),
            # drifts left to meet the customer as the stack changes hands
            (2.5, (420, 616, 1.0, 0), smooth),
            (3.2, (390, 618, 1.0, 0), lambda u: u),
        ], tau)


# ------------------------------------------------------------------ camera
def view(scene, tau, cam=None):
    """Render scene at local time τ through its camera (cx, cy, zoom, roll°)."""
    cx, cy, z, roll = cam if cam else scene.cam_at(tau)
    s = scene.cover() * z
    hw, hh = OUT_W / 2 / s, OUT_H / 2 / s
    # Keep the frame inside the artwork horizontally and never below it (figures are cut
    # by the bottom edge); when the portrait frame is taller than the art, the flat
    # background extends above it.
    if z >= 1.0:
        if not getattr(scene, 'FREE_X', False):
            cx = min(max(cx, hw), scene.w - hw)
        if 2 * hh <= scene.h:
            cy = min(max(cy, hh), scene.h - hh)
        else:
            cy = scene.h - hh if scene.BOTTOM_LOCK else min(max(cy, scene.h - hh), hh)
    src = scene.render(tau)
    m = cv2.getRotationMatrix2D((cx + PAD, cy + PAD), roll, s)
    m[0, 2] += OUT_W / 2 - (cx + PAD)
    m[1, 2] += OUT_H / 2 - (cy + PAD)
    frame = cv2.warpAffine(src, m, (OUT_W, OUT_H), flags=cv2.INTER_LINEAR if s > 1 else cv2.INTER_AREA,
                           borderMode=cv2.BORDER_REPLICATE)
    return frame, m


def to_screen(m, x, y):
    return (m[0, 0] * (x + PAD) + m[0, 1] * (y + PAD) + m[0, 2],
            m[1, 0] * (x + PAD) + m[1, 1] * (y + PAD) + m[1, 2])


def circle_mask(cx, cy, r):
    m = np.zeros((OUT_H, OUT_W), np.uint8)
    if r > 0:
        cv2.circle(m, P(cx, cy), int(max(r, 0) * (1 << SUB)), 255, -1, cv2.LINE_AA, SUB)
    return m.astype(np.float32)[..., None] / 255


def mix(a, b, alpha):
    return (a.astype(np.float32) * (1 - alpha) + b.astype(np.float32) * alpha).astype(np.uint8)


def ring(frame, cx, cy, r, width, opacity=1.0):
    if r <= 0 or width <= 0.5:
        return
    m = np.zeros(frame.shape[:2], np.uint8)
    cv2.circle(m, P(cx, cy), int(r * (1 << SUB)), 255, int(max(1, width)), cv2.LINE_AA, SUB)
    blend_mask(frame, m, (255, 255, 255), opacity, (0, 0, frame.shape[1], frame.shape[0]))


FULL = (0, 0, OUT_W, OUT_H)


# ------------------------------------------------------------------ transitions
def tr_porthole_open(s1, s2, u):
    """1 → 2: dive into the porthole; the drum is waiting on the other side."""
    t1, t2 = 2.5 + u * TR, u * TR
    f1, m1 = view(s1, t1)
    px, py = to_screen(m1, *s1.PORT)
    r_port = s1.PORT_R * m1[0, 0]
    open_u = smooth((u - 0.22) / 0.78)   # a long, even opening: no sudden jump through the porthole
    R = lerp(r_port, 1250, open_u)
    # scene 2 framed so its drum window fills the porthole, then relaxing outward
    z_match = r_port / (s2.DRUM_R * s2.cover())
    cam2 = s2.cam_at(t2)
    z2 = lerp(z_match, cam2[2], open_u)
    s2_scale = s2.cover() * z2
    # place the drum at the porthole centre on screen
    cxs, cys = lerp(s2.DRUM[0], cam2[0], open_u), lerp(s2.DRUM[1], cam2[1], open_u)
    shift_x = (px - OUT_W / 2) * (1 - open_u) / s2_scale
    shift_y = (py - OUT_H / 2) * (1 - open_u) / s2_scale
    f2, _ = view(s2, t2, (cxs - shift_x, cys - shift_y, z2, 0))
    a = circle_mask(px, py, R)
    frame = mix(f1, f2, a)
    ring(frame, px, py, R + 4, lerp(14 * m1[0, 0] / 3, 28, open_u), opacity=1 - smooth((u - 0.8) / 0.2))
    return frame


def rotational_blur(frame, degrees, center=(OUT_W / 2, OUT_H / 2)):
    """Blur along circles around `center` (true spin blur, via polar space)."""
    if degrees < 0.5:
        return frame
    m = 260  # replicate margin so the corners have real pixels to blur
    big = cv2.copyMakeBorder(frame, m, m, m, m, cv2.BORDER_REFLECT)
    c = (center[0] + m, center[1] + m)
    rmax = math.hypot(OUT_W, OUT_H) / 2 + 10
    rows = 1440
    polar = cv2.warpPolar(big, (int(rmax), rows), c, rmax, cv2.WARP_POLAR_LINEAR)
    k = max(1, int(degrees / 360 * rows))
    padded = np.concatenate([polar[-k:], polar, polar[:k]], 0)
    blurred = cv2.blur(padded, (1, k))[k:-k]
    out = cv2.warpPolar(blurred, big.shape[1::-1], c, rmax, cv2.WARP_POLAR_LINEAR | cv2.WARP_INVERSE_MAP)
    return out[m:m + OUT_H, m:m + OUT_W]


def tr_spin(s2, s3, u):
    """2 → 3: the drum's spin becomes the sun's spin (rotational match cut)."""
    f2, _ = view(s2, 2.5 + u * TR)
    f3, _ = view(s3, u * TR)
    frame = mix(f2, f3, smooth((u - 0.36) / 0.28))
    return rotational_blur(frame, 20 * math.sin(math.pi * u) ** 2)


def tr_whip(s3, s4, u):
    """3 → 4: the breeze whips the camera along the line into the ironing room."""
    f3, _ = view(s3, 2.5 + u * TR)
    f4, _ = view(s4, u * TR)
    return whip(f3, f4, u, TR)


def whip(fa, fb, u, dur, leftward=False):
    """Whip-pan from frame a to frame b with motion blur and wind streaks."""
    p = ease_in_out_cubic(u)
    if leftward:  # camera swings left: b enters from the left
        fa, fb = fa[:, ::-1], fb[:, ::-1]
    off = int(round(p * OUT_W))
    frame = np.empty_like(fa)
    frame[:, :OUT_W - off] = fa[:, off:]
    frame[:, OUT_W - off:] = fb[:, :off]
    # soft seam
    seam = OUT_W - off
    if 0 < seam < OUT_W:
        x0, x1 = max(seam - 60, 0), min(seam + 60, OUT_W)
        a = frame[:, x0:x1].astype(np.float32)
        frame[:, x0:x1] = cv2.GaussianBlur(a, (0, 0), 18).astype(np.uint8)
    vel = 12 * u * u if u < 0.5 else 12 * (1 - u) ** 2  # true speed of the easing: no blur at rest
    k = int(1 + vel * OUT_W / (dur * FPS) * 0.9)
    if k > 2:
        frame = cv2.blur(frame, (k, 1))
    # wind streaks
    streak = smooth(u / 0.3) * smooth((1 - u) / 0.3)
    for i, (y, ln, ph) in enumerate(rng_list(77, 3, (300, OUT_H - 300), (160, 320), (0, 1))):
        x = (ph * OUT_W - p * OUT_W * 1.6) % (OUT_W + 400) - 200
        stroke(frame, [(x, y), (x + ln, y)], 5, opacity=0.35 * streak)
    return np.ascontiguousarray(frame[:, ::-1]) if leftward else frame


CLOUD = rng_list(88, 18, (0, 2 * math.pi), (0.0, 0.55), (0.35, 0.6), (0, 1))


def cloud_mask(cx, cy, size, t, soft=0.04):
    """Billowing cloud silhouette: a ring of soft lobes around a core."""
    m = np.zeros((OUT_H, OUT_W), np.uint8)
    if size <= 1:
        return m.astype(np.float32)
    cv2.circle(m, P(cx, cy), int(size * 0.72 * (1 << SUB)), 255, -1, cv2.LINE_AA, SUB)
    for th, off, rr, ph in CLOUD:
        a = th + 0.4 * math.sin(t * 2 + ph * 6)
        d = size * (0.55 + off * 0.5)
        cv2.circle(m, P(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.85),
                   int(size * rr * (1 << SUB)), 255, -1, cv2.LINE_AA, SUB)
    return cv2.GaussianBlur(m, (0, 0), max(2.0 if soft < 0.08 else 28.0, size * soft)).astype(np.float32) / 255


def tr_steam(s4, s5, u):
    """4 → 5: push into the freshly ironed stack; a steam cloud blooms and clears onto the packing stack."""
    t4, t5 = 2.5 + u * TR, u * TR
    f4, m4 = view(s4, t4)
    cx, cy = to_screen(m4, *s4.STACK)
    cam5 = s5.cam_at(t5)
    z_in = lerp(cam5[2] * 1.12, cam5[2], ease_out_cubic(u))
    f5, _ = view(s5, t5, (cam5[0], cam5[1], z_in, 0))
    t = u * TR
    # 1) steam blooms out of the stack and fills the frame …
    bloom = smooth(u / 0.6)
    ccx, ccy = lerp(cx, OUT_W / 2, bloom), lerp(cy, OUT_H / 2, bloom) - 30 * u
    steam = cloud_mask(ccx, ccy, lerp(140, 1350, bloom), t)
    # 2) … then clears from the centre onto the packing table.
    clear = smooth((u - 0.3) / 0.7)
    hole = cloud_mask(OUT_W / 2, OUT_H / 2 - 20, lerp(60, 1600, clear), t + 1.3, soft=0.1) * smooth((u - 0.3) / 0.14)
    # swap scenes only behind dense steam, so the two never ghost through each other
    swap = np.clip((steam - 0.55) / 0.35, 0, 1) * smooth((u - 0.22) / 0.12)
    frame = mix(f4, f5, swap[..., None])
    veil = np.clip(steam - hole, 0, 1) * 0.9
    blend_mask(frame, (veil * 255).astype(np.uint8), (255, 255, 255), 1.0, FULL)
    return frame


def stack_bands(frame, box, u_fade, colors, line):
    """Draw folded-cloth bands (white rim, navy outline, fold line) inside box."""
    x0, y0, x1, y1 = box
    n = len(colors)
    hgt = (y1 - y0) / n
    for i, col in enumerate(colors):
        by0 = y0 + i * hgt
        by1 = by0 + hgt
        r = hgt / 2
        rim = max(2.0, hgt * 0.1)
        for pad, c in ((rim + 3, (255, 255, 255)), (3, NAVY_LINE), (0, col)):
            m = np.zeros((OUT_H, OUT_W), np.uint8)
            rr = max(r - 1 + pad, 1)
            cv2.rectangle(m, P(x0 + r, by0 - pad + 1), P(x1 - r, by1 + pad - 1), 255, -1, cv2.LINE_AA, SUB)
            cv2.circle(m, P(x0 + r, (by0 + by1) / 2), int(rr * (1 << SUB)), 255, -1, cv2.LINE_AA, SUB)
            cv2.circle(m, P(x1 - r, (by0 + by1) / 2), int(rr * (1 << SUB)), 255, -1, cv2.LINE_AA, SUB)
            blend_mask(frame, m, c, 1 - u_fade, FULL)
        if line:
            m = np.zeros((OUT_H, OUT_W), np.uint8)
            ly = by0 + hgt * 0.62
            cv2.line(m, P(x0 + r * 0.9, ly), P(x1 - r * 1.1, ly), 255, max(2, int(hgt * 0.04)), cv2.LINE_AA, SUB)
            blend_mask(frame, m, NAVY_LINE, 0.8 * (1 - u_fade), FULL)


def tr_bands(s5, s6, u):
    """5 → 6: folded-cloth bands sweep in and fold down into the delivery stack."""
    t5, t6 = 2.5 + u * TR, u * TR
    f5, _ = view(s5, t5)
    f6, m6 = view(s6, t6)
    cols = [(253, 184, 19), (253, 184, 19), (240, 52, 38)]
    sweep = ease_out_quint(u / 0.42)
    fold = ease_in_out_cubic((u - 0.4) / 0.48)
    fade = smooth((u - 0.86) / 0.14)
    sx0, sy0 = to_screen(m6, *s6.STACK_BOX[:2])
    sx1, sy1 = to_screen(m6, *s6.STACK_BOX[2:])
    full = (-140, -40, OUT_W + 140, OUT_H + 40)
    box = tuple(lerp(a, b, fold) for a, b in zip(full, (sx0, sy0, sx1, sy1)))
    base = f5 if fold <= 0 else f6
    frame = base.copy()
    if fold <= 0:
        # bands enter staggered from the left
        n = 3
        hgt = (full[3] - full[1]) / n
        for i, c in enumerate(cols):
            prog = ease_out_quint((u - i * 0.06) / 0.36)
            bx1 = lerp(-200, full[2], prog)
            stack_bands(frame, (bx1 - (OUT_W + 600), full[1] + i * hgt, bx1, full[1] + (i + 1) * hgt), 0, [c], True)
    else:
        stack_bands(frame, box, fade, cols, True)
    return frame


def tr_porthole_close(s6, s1, u):
    """6 → 1: the delivered laundry drops back into the porthole — and the loop begins again."""
    t6, t1 = 2.5 + u * TR, u * TR
    f1, m1 = view(s1, t1)
    px, py = to_screen(m1, *s1.PORT)
    r_port = s1.PORT_R * m1[0, 0]
    close_u = ease_in_out_cubic(u / 0.8)
    R = lerp(1250, r_port, close_u)
    cam6 = s6.cam_at(t6)
    z6 = lerp(cam6[2], max(0.32, R / 760), close_u)
    s6s = s6.cover() * z6
    sx = (px - OUT_W / 2) * close_u / s6s
    sy = (py - OUT_H / 2) * close_u / s6s
    f6, _ = view(s6, t6, (cam6[0] - sx, cam6[1] - sy, z6, 0))
    inside = 1 - smooth((u - 0.72) / 0.28)
    a = circle_mask(px, py, R) * inside
    frame = mix(f1, f6, a)
    ring(frame, px, py, R + 4, lerp(28, 14 * m1[0, 0] / 3, close_u), opacity=1 - smooth((u - 0.7) / 0.3))
    return frame



def tr_whip_home(s6, s1, u):
    """6 → 1: the courier moves on and the camera swings left with him, straight into the
    next pickup — the story starts again without ever stopping."""
    f6, _ = view(s6, 2.5 + u * TR)
    f1, _ = view(s1, u * TR)
    return whip(f6, f1, u, TR, leftward=True)


# ------------------------------------------------------------------ frame assembly
SCENES = {}


def scenes():
    if not SCENES:
        import scenes_puppet as sp   # puppet-rigged scenes build on the classes above
        for k, cls in zip(range(1, 7), [sp.PCollecting, sp.PWashing, sp.PDrying, sp.PIroning, Packing, Delivery]):
            SCENES[k] = cls(k)
    return SCENES


TRANSITIONS = [  # (start time, from, to, fn)
    (1.8, 1, 2, tr_porthole_open),
    (4.3, 2, 3, tr_spin),
    (6.8, 3, 4, tr_whip),
    (9.3, 4, 5, tr_steam),
    (11.8, 5, 6, tr_bands),
    (14.3, 6, 1, tr_whip_home),
]


def frame_at(t):
    sc = scenes()
    t = t % DURATION
    for t0, a, b, fn in TRANSITIONS:
        if (t - t0) % DURATION < TR:
            return fn(sc[a], sc[b], ((t - t0) % DURATION) / TR)
    for k in range(1, 7):
        tau = local_time(k, t)
        if tau is not None and TR - 1e-6 <= tau <= 2.5 + 1e-6:
            f, _ = view(sc[k], tau)
            return f
    raise RuntimeError(f'no scene at t={t}')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'still':
        t = float(sys.argv[2])
        out = sys.argv[3] if len(sys.argv) > 3 else f'work/still_{t:.2f}.png'
        cv2.imwrite(out, cv2.cvtColor(frame_at(t), cv2.COLOR_RGB2BGR))
    elif cmd == 'frames':
        a = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        b = int(sys.argv[3]) if len(sys.argv) > 3 else NFRAMES
        os.makedirs('work/frames', exist_ok=True)
        for i in range(a, b):
            f = frame_at(i / FPS)
            cv2.imwrite(f'work/frames/f{i:04d}.png', cv2.cvtColor(f, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_PNG_COMPRESSION, 1])
            if i % 30 == 0:
                print('frame', i, flush=True)
