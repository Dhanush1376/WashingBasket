"""Washing Basket — 15 s seamless hero loop, animated from the six original illustrations.

Nothing is redrawn. Each frame is the original artwork with:
  * blinks       — the original eye is briefly covered by a lid (skin + lash line), then restored;
  * micro-motion — small, smooth displacement fields (hands, props, cloth, heads) with rigid cores,
                   so faces and hands keep their exact shape and only the gaps between parts flex;
  * line-art fx  — the artwork's own white bubbles / steam / sparkles / ticks are lifted off the
                   flat background and re-composited with gentle motion.
Scenes are 2.5 s each and cross-dissolve (in linear light) for 0.6 s; scene 6 dissolves into scene 1,
so frame 449 -> frame 0 is just another dissolve step.

  python hero.py still 1.2            -> work/still.png
  python hero.py debug 3              -> work/debug_s3.png (handles drawn)
  python hero.py sheet                -> work/sheet.jpg
  python hero.py render               -> dist/*.mp4
"""
import math
import os
import subprocess
import sys

import cv2
import numpy as np

import acts

ROOT = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(ROOT, "..")
FPS, DUR = 30, 15.0
NFR = int(FPS * DUR)
SCENE = 2.5
XF = 0.6  # swipe transition length

TAU = 2 * math.pi


def sm(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def wave(u, period, phase=0.0):
    return math.sin(TAU * (u / period + phase))


# --------------------------------------------------------------------------------------------
# scene definitions (coordinates in source pixels, 1199 x 1312)
# handle: c centre, r0 rigid radius, r1 falloff radius, asp (sx, sy) ellipse scale,
#         f(u) -> (dx, dy, deg)  rotation about c, then translation
# --------------------------------------------------------------------------------------------

def handover(u):
    # offer-and-settle, twice per scene
    return 0.5 - 0.5 * math.cos(TAU * u / 1.25)


def S(u, period, phase=0.0):
    return math.sin(TAU * (u / period + phase))


def C(u, period, phase=0.0):
    return math.cos(TAU * (u / period + phase))


# body: whole figure leans / breathes from its feet (box feathered into the flat background, so the
#       background flex is invisible); lean(u) px at the top of the box, breath(u) px of rise.
SCENES = [
    dict(  # 1 collecting — she hands the bag over (acts.Collect)
        file="1.png",
        act="Collect",
        eyes=[[(294, 622), (336, 618)], [(879, 567), (918, 567)]],
        blinks=[[0.4, 2.05], [1.6]],
        body=[dict(box=(30, 470, 420, 1312), lean=lambda u: 3 * S(u, 2.5, .05), breath=lambda u: 3 * S(u, 1.25))],
        handles=[
            dict(c=(305, 620), r0=95, r1=175,
                 f=lambda u: (2.5 * S(u, 2.5, .1), 2.5 * S(u, 1.25, .35), 3.0 * S(u, 2.5, .1))),
        ],
        fx=[dict(kind="tick", box=(540, 545, 660, 650), at=1.8, pos=(690, 585))],
    ),
    dict(  # 2 washing
        file="2.png",
        eyes=[[(521, 704), (559, 724, 8, 7.5)]],
        blinks=[[0.4, 1.9]],
        body=[dict(box=(170, 510, 610, 1290), lean=lambda u: 5 * C(u, 2.5 / 3, -.1), breath=lambda u: 3 * S(u, 2.5 / 3))],
        handles=[
            # hands + the lifted garment scrub in a lively ellipse (three strokes per scene)
            dict(c=(630, 1035), r0=75, r1=180, asp=(1.25, 1.0), ymax=1112,
                 f=lambda u: (12 * C(u, 2.5 / 3), 7 * S(u, 2.5 / 3), 4 * S(u, 2.5 / 3))),
            dict(c=(450, 880), r0=70, r1=190,
                 f=lambda u: (4 * C(u, 2.5 / 3, -.08), 2.5 * S(u, 2.5 / 3, -.08), 0)),
            dict(c=(500, 690), r0=120, r1=205,
                 f=lambda u: (2.5 * C(u, 2.5 / 3, -.15), 2.5 * S(u, 1.25, .3), 2.5 * S(u, 2.5, .1))),
        ],
        water=dict(y0=1105, y1=1155, x0=420, x1=800, amp=2.6),
        fx=[dict(kind="bubbles", box=(650, 840, 770, 1010))],
    ),
    dict(  # 3 drying — hands bring the shirt up to the line, pegs snap on, the breeze takes it
        file="3.png",
        act="Pegs",
        eyes=[[(334, 627), (371, 617, 7, 10.5)]],
        blinks=[[0.3, 2.3]],
        body=[dict(box=(130, 470, 560, 1270), lean=lambda u: 1.5 * S(u, 2.5, .2), breath=lambda u: 2 * S(u, 1.25, .1))],
        handles=[
            dict(c=(330, 610), r0=110, r1=180,
                 f=lambda u: (2.0 * S(u, 2.5, .0), 2.0 * S(u, 1.25, .25), 3.0 * S(u, 2.5, .0) - 2.5 * acts.ramp(u, .1, .6))),
            # both hands + the top of the shirt rise to the line (the artwork moves as one, no cut-outs)
            dict(c=(610, 700), r0=110, r1=230, asp=(1.5, 1.0),
                 f=lambda u: (-2 * (1 - acts.ramp(u, 0.0, 0.65)), 9 * (1 - acts.ramp(u, 0.0, 0.65)), 0)),
        ],
        sway=[  # breeze: shirt below her arm, towel, orange tee; the plant bends from its pot
            dict(box=(480, 660, 770, 1010), top=760, amp=9.0, period=1.25, phase=0.0, start=1.15,
                 below=((440, 935), (760, 765))),
            dict(box=(765, 660, 930, 920), top=665, amp=12.0, period=1.25, phase=0.08),
            dict(box=(925, 620, 1160, 860), top=630, amp=14.0, period=1.25, phase=0.16),
            dict(box=(1015, 940, 1104, 1250), bottom=1250, amp=7.0, period=1.25, phase=0.3),
        ],
        breeze=[(560, 430, 0.0), (700, 520, 0.45), (480, 560, 0.8)],
        breeze_from=1.2,
        fx=[dict(kind="tick", box=(525, 525, 610, 590), at=1.3)],
    ),
    dict(  # 4 ironing
        file="4.png",
        eyes=[[(673, 554), (718, 573)]],
        blinks=[[0.6, 2.0]],
        body=[dict(box=(260, 370, 830, 1312), lean=lambda u: -7 * C(u, 1.25), breath=lambda u: 3 * S(u, 1.25, .25))],
        handles=[
            # iron + right hand glide: two full strokes per scene
            dict(c=(575, 1075), r0=125, r1=280, asp=(1.0, 0.75), ymax=1150,
                 f=lambda u: (-22 * C(u, 1.25), 0.0, 0)),
            # left hand smooths the fabric
            dict(c=(950, 1100), r0=45, r1=130, ymax=1150,
                 f=lambda u: (7 * S(u, 1.25), 1.5 * C(u, .625), 0)),
            dict(c=(690, 560), r0=115, r1=205,
                 f=lambda u: (-3 * C(u, 1.25), 2.5 * S(u, .625, .3), -3 * C(u, 1.25))),
        ],
        fx=[dict(kind="steam", box=(660, 960, 790, 1104), follow=0,
                 poly=[(666, 962), (732, 962), (788, 1012), (788, 1102), (700, 1102), (670, 1056)])],
    ),
    dict(  # 5 folding — fold, carry, set it on the stack (acts.Fold)
        file="5.png",
        act="Fold",
        eyes=[[(578, 711), (626, 727)]],
        blinks=[[0.3, 2.3]],
        fx=[dict(kind="tick", box=(735, 975, 820, 1060), at=1.55, pos=(845, 880))],
    ),
    dict(  # 6 delivery — she takes the stack from his hands (acts.Deliver)
        file="6.png",
        act="Deliver",
        eyes=[[(314, 520), (357, 521)], [(861, 579), (907, 589)]],
        blinks=[[1.7], [0.45, 2.2]],
        fx=[dict(kind="sparkle", box=(450, 615, 525, 705), phase=0.0, follow=True, at=1.55,
                 extra=[(585, 640, .55, .2), (650, 600, .45, .6), (410, 780, .5, .35), (815, 770, .5, .8),
                        (700, 660, .4, .05)]),
            dict(kind="sparkle", box=(715, 660, 775, 730), phase=0.45, follow=True, at=1.65)],
    ),
]


# --------------------------------------------------------------------------------------------
# preparation
# --------------------------------------------------------------------------------------------

def find_eye(img, c):
    """Dark blob nearest to c -> (mask uint8, bbox).
    c = (x, y) or (x, y, rx, ry); with radii the blob is clipped to that ellipse, which leaves an
    attached lash / hair strand untouched."""
    x, y = c[:2]
    r = 22
    win = img[y - r:y + r, x - r:x + r].astype(int)
    dark = (win.sum(2) < 230).astype(np.uint8)
    if len(c) == 4:
        el = np.zeros_like(dark)
        cv2.ellipse(el, (r, r), (int(c[2] + 1.5), int(c[3] + 1.5)), 0, 0, 360, 1, -1)
        dark &= el
    n, lab, st, cen = cv2.connectedComponentsWithStats(dark, 8)
    best, bd = None, 1e9
    for i in range(1, n):
        a = st[i, cv2.CC_STAT_AREA]
        if a < 25 or a > 450:
            continue
        d = np.hypot(cen[i][0] - r, cen[i][1] - r)
        if d < bd:
            best, bd = i, d
    if best is None or bd > 9:
        raise RuntimeError(f"no eye near {c}")
    m = np.zeros(img.shape[:2], np.uint8)
    m[y - r:y + r, x - r:x + r] = (lab == best) * 255
    ys, xs = np.nonzero(m)
    return m, (xs.min(), ys.min(), xs.max(), ys.max())


class Eye:
    PAD = 7

    def __init__(self, img, c):
        mask, (x0, y0, x1, y1) = find_eye(img, c)
        self.box = (x0, y0, x1, y1)
        self.cx, self.w, self.h = (x0 + x1) / 2, x1 - x0 + 1, y1 - y0 + 1
        self.y0, self.y1 = y0, y1
        ys, xs = np.nonzero(mask)
        self.ink = np.median(img[ys, xs], axis=0).astype(np.float32)
        P = self.PAD
        self.sl = (slice(y0 - P, y1 + P + 1), slice(x0 - P, x1 + P + 1))
        # skin under the eye: inpaint a slightly grown mask (the area around it is flat skin)
        grow = cv2.dilate(mask, np.ones((5, 5), np.uint8))
        self.skin = cv2.inpaint(img, grow, 4, cv2.INPAINT_TELEA)[self.sl].astype(np.float32)
        self.grow = cv2.GaussianBlur(grow, (0, 0), 0.8)[self.sl].astype(np.float32) / 255
        m = mask[self.sl] > 0
        self.rows = {yy: (np.nonzero(m[yy])[0].min(), np.nonzero(m[yy])[0].max()) for yy in range(m.shape[0]) if m[yy].any()}

    def draw(self, img, state, off=(0, 0)):
        """state: 0 open, 0..1 lid coming down over the original eye, 1 closed.
        off: artwork position of img's top-left corner (for drawing on a cut-out layer)."""
        if state <= 0:
            return
        P, S = self.PAD, 4
        ys, xs = self.sl
        sl = (slice(ys.start - off[1], ys.stop - off[1]), slice(xs.start - off[0], xs.stop - off[0]))
        sub = img[sl]
        hh, ww = sub.shape[:2]
        lay = np.zeros((hh * S, ww * S), np.uint8)
        if state < 1:
            # the lid covers the top of the original eye; its lower part stays exactly as drawn
            yl = P + self.h * state
            yy = np.arange(hh, dtype=np.float32)[:, None]
            cover = np.clip(yl - yy + 0.5, 0, 1) * self.grow
            rr = self.rows.get(int(round(yl)), None) or self.rows[min(self.rows, key=lambda k: abs(k - yl))]
            xa, xb = rr[0] - 0.5, rr[1] + 0.5
            cv2.line(lay, (int(xa * S), int(yl * S)), (int(xb * S), int(yl * S)), 255, int(2.2 * S), cv2.LINE_AA)
        else:
            cover = self.grow
            # closed: a soft downward lash arc across the lower part of the eye
            cx = (self.cx - self.box[0] + P) * S
            cy = (P + self.h * 0.52) * S
            th = max(2.4, self.w * 0.24) * S
            cv2.ellipse(lay, (int(cx), int(cy)), (int(self.w * 0.62 * S), int(self.h * 0.22 * S)), 0, 15, 165,
                        255, int(th), cv2.LINE_AA)
        out = sub * (1 - cover[..., None]) + self.skin * cover[..., None]
        la = cv2.resize(lay, (ww, hh), interpolation=cv2.INTER_AREA).astype(np.float32)[..., None] / 255
        img[sl] = out * (1 - la) + self.ink * la


def lift_white(img, bg, box, poly=None):
    """Lift white line-art inside box (optionally clipped to poly) off a flat background.
    Returns (plate, sprite_rgba, origin)."""
    x0, y0, x1, y1 = box
    crop = img[y0:y1, x0:x1].astype(np.float32)
    white = np.array([248, 248, 248], np.float32)
    d_bg = np.linalg.norm(crop - bg, axis=2)
    d_w = np.linalg.norm(crop - white, axis=2)
    a = np.clip(d_bg / (d_bg + d_w + 1e-3), 0, 1)
    # only keep pixels that are on the white<->bg line (not characters/other colours)
    full = np.linalg.norm(white - bg)
    off_line = (d_bg + d_w) - full
    a[off_line > 30] = 0
    a = np.where(a > 0.12, a, 0)
    if poly is not None:
        pm = np.zeros(a.shape, np.uint8)
        cv2.fillPoly(pm, [np.array(poly, np.int32) - (x0, y0)], 255)
        a[pm == 0] = 0
    # keep only anti-aliased fringes of genuinely white strokes (not skin edges that sit near the line)
    core = cv2.dilate((a > 0.75).astype(np.uint8), np.ones((5, 5), np.uint8))
    a *= core
    m = (a > 0.05).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    plate = img.copy()
    sub = plate[y0:y1, x0:x1]
    sub[m > 0] = bg  # flat background fill
    inp = cv2.inpaint(plate, (np.pad(m, ((y0, img.shape[0] - y1), (x0, img.shape[1] - x1))) > 0).astype(np.uint8),
                      3, cv2.INPAINT_TELEA)
    rgba = np.dstack([np.broadcast_to(white, crop.shape), a]).astype(np.float32)
    return inp, rgba, (x0, y0)


def paste(dst, rgba, x, y, scale=1.0, alpha=1.0, angle=0.0):
    """Composite rgba sprite with its centre at (x, y)."""
    h, w = rgba.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, scale)
    M[0, 2] += x - w / 2
    M[1, 2] += y - h / 2
    H, W = dst.shape[:2]
    # restrict to bounding box
    bx0, by0 = int(max(x - w * scale, 0)), int(max(y - h * scale, 0))
    bx1, by1 = int(min(x + w * scale, W)), int(min(y + h * scale, H))
    if bx1 <= bx0 or by1 <= by0:
        return
    M[0, 2] -= bx0
    M[1, 2] -= by0
    warped = cv2.warpAffine(rgba, M, (bx1 - bx0, by1 - by0), flags=cv2.INTER_LINEAR, borderValue=0)
    a = warped[..., 3:4] * alpha
    sub = dst[by0:by1, bx0:bx1]
    dst[by0:by1, bx0:bx1] = sub * (1 - a) + warped[..., :3] * a


def bubble_sprite(r, th=3.6):
    S = 4
    n = int((r + th + 3) * 2)
    lay = np.zeros((n * S, n * S), np.uint8)
    cv2.circle(lay, (n * S // 2, n * S // 2), int(r * S), 255, int(th * S), cv2.LINE_AA)
    a = cv2.resize(lay, (n, n), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    return np.dstack([np.full((n, n, 3), 248, np.float32), a])


def steam_sprite(length, th=4.0, flip=False):
    """A single soft S-curl, white, drawn like the artwork's own strokes."""
    S = 4
    w, h = int(length * 0.55), int(length)
    pad = 8
    lay = np.zeros(((h + 2 * pad) * S, (w + 2 * pad) * S), np.uint8)
    pts = []
    for i in range(40):
        t = i / 39
        x = w / 2 + (w * 0.32) * math.sin(t * math.pi * 1.6) * (1 if not flip else -1)
        y = h * (1 - t)
        pts.append(((x + pad) * S, (y + pad) * S))
    pts = np.array(pts, np.int32)
    # tapered stroke: thicker at the base
    for i in range(len(pts) - 1):
        tt = th * (1.0 - 0.55 * i / len(pts))
        cv2.line(lay, tuple(pts[i]), tuple(pts[i + 1]), 255, max(1, int(tt * S)), cv2.LINE_AA)
    a = cv2.resize(lay, (w + 2 * pad, h + 2 * pad), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    a = cv2.GaussianBlur(a, (0, 0), 0.6)
    return np.dstack([np.full(a.shape + (3,), 248, np.float32), a])


def fog_sprite(r, seed):
    """A soft cloud of steam: a few overlapping round blobs, heavily feathered."""
    rng = np.random.default_rng(seed)
    n = int(r * 3)
    a = np.zeros((n, n), np.float32)
    for _ in range(6):
        cx, cy = n / 2 + rng.uniform(-r * 0.45, r * 0.45), n / 2 + rng.uniform(-r * 0.3, r * 0.3)
        cv2.circle(a, (int(cx), int(cy)), int(r * rng.uniform(0.35, 0.6)), 1.0, -1, cv2.LINE_AA)
    a = cv2.GaussianBlur(a, (0, 0), r * 0.22)
    a = np.clip(a / a.max(), 0, 1) ** 1.4
    return np.dstack([np.full((n, n, 3), 250, np.float32), a])


def breeze_sprite(length, th=3.2):
    """A wind line ending in a little curl, in the artwork's white stroke style."""
    S = 4
    w, h, pad = int(length), int(length * 0.32), 8
    lay = np.zeros(((h + 2 * pad) * S, (w + 2 * pad) * S), np.uint8)
    pts = []
    for i in range(60):
        t = i / 59
        if t < 0.75:
            x, y = w * t, h * 0.75 - h * 0.18 * math.sin(t / 0.75 * math.pi)
        else:  # curl
            q = (t - 0.75) / 0.25 * 1.5 * math.pi
            r = h * 0.28
            x, y = w * 0.75 + r * math.sin(q), h * 0.75 - r + r * math.cos(q)
        pts.append(((x + pad) * S, (y + pad) * S))
    pts = np.array(pts, np.int32)
    for i in range(len(pts) - 1):
        tt = th * (0.35 + 0.65 * math.sin(math.pi * i / len(pts)))
        cv2.line(lay, tuple(pts[i]), tuple(pts[i + 1]), 255, max(1, int(tt * S)), cv2.LINE_AA)
    a = cv2.resize(lay, (w + 2 * pad, h + 2 * pad), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    return np.dstack([np.full(a.shape + (3,), 248, np.float32), a])


class Scene:
    def __init__(self, d):
        self.d = d
        img = cv2.imread(os.path.join(ART, d["file"]))
        self.H, self.W = img.shape[:2]
        self.bg = np.median(img[20:120, 20:300].reshape(-1, 3), axis=0).astype(np.float32)
        plate = img.copy()
        self.fx = []
        for fx in d.get("fx", []):
            plate, spr, org = lift_white(plate, self.bg, fx["box"], fx.get("poly"))
            self.fx.append((fx, spr, org))
        self.plate = plate.astype(np.float32)
        base = img  # eyes are measured on the original
        self.eyes = [[Eye(self.plate.astype(np.uint8), c) for c in pair] for pair in d["eyes"]]
        gx, gy = np.meshgrid(np.arange(self.W, dtype=np.float32), np.arange(self.H, dtype=np.float32))
        self.gx, self.gy = gx, gy
        st = 4
        self.cgx, self.cgy = np.meshgrid(np.arange(0, self.W + st, st, dtype=np.float32),
                                         np.arange(0, self.H + st, st, dtype=np.float32))
        self.bub = [bubble_sprite(r) for r in (7, 10, 13)]
        self.curls = [steam_sprite(46), steam_sprite(38, flip=True), steam_sprite(54)]
        self.wind = breeze_sprite(150)
        self.fog = [fog_sprite(70, seed) for seed in (3, 7)]
        self.act = getattr(acts, d["act"])(self) if d.get("act") else None

    # -- motion field ----------------------------------------------------------------------
    def field(self, u):
        X, Y = self.cgx, self.cgy
        DX = np.zeros_like(X)
        DY = np.zeros_like(X)
        for h in self.d.get("handles", []):
            cx, cy = h["c"]
            sx, sy = h.get("asp", (1.0, 1.0))
            dist = np.hypot((X - cx) / sx, (Y - cy) / sy)
            w = sm(1 - (dist - h["r0"]) / (h["r1"] - h["r0"]))
            if "ymax" in h:  # nothing below this line moves (board edge, tub rim, table)
                w = w * sm((h["ymax"] - Y) / 12.0)
            dx, dy, deg = h["f"](u)
            a = math.radians(deg)
            ca, sa = math.cos(a), math.sin(a)
            rx = cx + ca * (X - cx) - sa * (Y - cy) + dx - X
            ry = cy + sa * (X - cx) + ca * (Y - cy) + dy - Y
            DX += w * rx
            DY += w * ry
        for b in self.d.get("body", []):
            x0, y0, x1, y1 = b["box"]
            fb = 45.0
            wx = sm((X - x0) / fb + .5) * sm((x1 - X) / fb + .5)
            wy = sm((Y - y0) / fb + .5)
            k = np.clip((y1 - Y) / (y1 - y0), 0, 1)  # 0 at the feet, 1 at the top of the head
            DX += wx * wy * k * b["lean"](u)
            DY -= wx * wy * k * b["breath"](u)
        for s in self.d.get("sway", []):
            x0, y0, x1, y1 = s["box"]
            fb = 26.0
            wx = sm((X - x0) / fb + .5) * sm((x1 - X) / fb + .5)
            wy = sm((Y - y0) / fb + .5) * sm((y1 - Y) / fb + .5)
            if "bottom" in s:
                depth = np.clip((s["bottom"] - Y) / (s["bottom"] - y0), 0, 1)
            else:
                depth = np.clip((Y - s["top"]) / (y1 - s["top"]), 0, 1)
            if "below" in s:  # e.g. her arm lies across the shirt: only cloth below it swings
                (lx0, ly0), (lx1, ly1) = s["below"]
                yl = ly0 + (X - lx0) * (ly1 - ly0) / (lx1 - lx0)
                wy = wy * sm((Y - yl) / 30.0)
            if "start" in s:
                wy = wy * sm((u - s["start"]) / 0.6)
            ph = TAU * (u / s["period"] + s["phase"])
            # swing grows with depth below the peg; a ripple travels down the cloth
            DX += wx * wy * s["amp"] * depth ** 1.3 * (np.sin(ph - depth * 1.2))
            DY += wx * wy * (-0.6) * s["amp"] * depth ** 2 * (0.5 - 0.5 * np.cos(2 * ph))
        st = self.d.get("settle")
        if st:
            x0, y0, x1, y1 = st["box"]
            fb = 20.0
            wx = sm((X - x0) / fb + .5) * sm((x1 - X) / fb + .5)
            wy = sm((Y - y0) / fb + .5)
            k = np.clip((st["bottom"] - Y) / (st["bottom"] - y0), 0, 1)
            # pressed at the same beat as the hands, slight lag
            p = 0.5 - 0.5 * math.cos(TAU * (u - 0.12) / 1.25)
            DY += wx * wy * k * st["amp"] * p
        wa = self.d.get("water")
        if wa:
            fb = 14.0
            wx = sm((X - wa["x0"]) / fb) * sm((wa["x1"] - X) / fb)
            wy = sm((Y - wa["y0"]) / fb) * sm((wa["y1"] - Y) / fb)
            DY += wx * wy * wa["amp"] * np.sin(X / 19.0 + TAU * u / 0.625)
            DX += wx * wy * 0.6 * wa["amp"] * np.sin(X / 31.0 - TAU * u / 1.25)
        return DX, DY

    def blink(self, k, u):
        st = 0
        for t0 in self.d["blinks"][k]:
            n = int(round((u - t0) * FPS))
            st = max(st, {0: .45, 1: 1, 2: 1, 3: .6, 4: .25}.get(n, 0))
        return st

    def paint_eyes(self, cut, u, k):
        """Copy of a cut-out layer's pixels with character k's blink painted on."""
        rgb = cut.copy_rgb()
        st = self.blink(k, u)
        for e in self.eyes[k]:
            e.draw(rgb, st, (cut.x0, cut.y0))
        return rgb

    def frame(self, u):
        img = (self.act.plate if self.act else self.plate).copy()
        # blinks (painted before warping so they ride with the head)
        for k, pair in enumerate(self.eyes):
            if self.act and k in self.act.LAYER_EYES:
                continue
            for e in pair:
                e.draw(img, self.blink(k, u))
        DX, DY = self.field(u)
        DX = cv2.resize(DX, (self.W + 4, self.H + 4))[:self.H, :self.W] if False else \
            cv2.resize(DX, (DX.shape[1] * 4, DX.shape[0] * 4), interpolation=cv2.INTER_LINEAR)[:self.H, :self.W]
        DY = cv2.resize(DY, (DY.shape[1] * 4, DY.shape[0] * 4), interpolation=cv2.INTER_LINEAR)[:self.H, :self.W]
        img = cv2.remap(img, self.gx - DX, self.gy - DY, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        if self.act:
            self.act.frame(self, u, img)
        self.draw_fx(img, u)
        return img

    # -- line-art effects -----------------------------------------------------------------
    def draw_fx(self, img, u):
        for fx, spr, (ox, oy) in self.fx:
            h, w = spr.shape[:2]
            cx, cy = ox + w / 2, oy + h / 2
            k = fx["kind"]
            if k == "tick":
                # pops once, when the step is done ("got it, next")
                if u >= fx["at"]:
                    if "pos" in fx:
                        cx, cy = fx["pos"]
                    s_ = acts.back(u, fx["at"], fx["at"] + 0.3, 0.25)
                    paste(img, spr, cx, cy, max(s_, 0.01), sm((u - fx["at"]) / 0.1))
            elif k == "sparkle":
                if fx.get("follow") and self.act:
                    cx, cy = self.act.follow((cx, cy))
                if u < fx.get("at", -9):
                    continue
                on = sm((u - fx.get("at", -9)) / 0.3)
                p = u / 1.25 + fx["phase"]
                s_ = (0.75 + 0.35 * (0.5 + 0.5 * math.sin(TAU * p))) * on
                a = 0.6 + 0.4 * (0.5 + 0.5 * math.sin(TAU * p))
                paste(img, spr, cx, cy, s_, a, angle=15 * math.sin(TAU * p * 0.5))
                # small twinkles pop in and out around the fresh clothes
                for x, y, sc, ph in fx.get("extra", []):
                    if fx.get("follow") and self.act:
                        x, y = self.act.follow((x, y))
                    q = (u / 1.25 + ph) % 1.0
                    e = math.sin(math.pi * min(q / 0.6, 1.0))
                    if e * on > 0.01:
                        paste(img, spr, x, y, sc * e * on, e * on, angle=40 * q)
            elif k == "bubbles":
                # the artwork's own bubbles drift up and sway
                # the artwork's own bubbles come up from the scrubbing, drift up and fade
                rise = 50 * sm((u + 0.3) / 2.6)
                dx = 5 * math.sin(TAU * u / 1.25)
                a = sm((u - 0.1) / 0.4) * (1 - sm((u - 1.6) / 0.5))
                if a > 0.01:
                    paste(img, spr, cx + dx, cy + 30 - rise, 0.85 + 0.15 * sm((u - 0.1) / 0.4), a)
            elif k == "steam":
                # soft fog puffs (no line-art) roll up from the iron's nose, grow and thin out
                ix = self.d["handles"][fx["follow"]]["f"](u)[0]
                for j in range(4):
                    q = ((u + 0.3) / 1.0 + j / 4) % 1.0
                    a = 0.62 * sm(q / 0.18) * (1 - sm((q - 0.35) / 0.65))
                    x = 700 + ix * 0.9 + 22 * q + 8 * math.sin(TAU * (q + j * 0.3))
                    y = 1075 - 120 * q
                    paste(img, self.fog[j % 2], x, y, 0.45 + 0.9 * q, a, angle=25 * q * (1 if j % 2 else -1))
        for x, y, ph in self.d.get("breeze", []):
            q = (u / 1.25 + ph) % 1.0
            a = math.sin(math.pi * q) ** 1.5 * 0.85 * sm((u - self.d.get("breeze_from", -9)) / 0.4)
            paste(img, self.wind, x + 220 * q, y + 8 * math.sin(TAU * q), 0.9, a)


# --------------------------------------------------------------------------------------------
# timeline
# --------------------------------------------------------------------------------------------

_cache = {}


def scene(i):
    if i not in _cache:
        _cache[i] = Scene(SCENES[i])
    return _cache[i]


def oklab(bgr):
    r, g, b = [((c / 255 + 0.055) / 1.055) ** 2.4 if c / 255 > 0.04045 else c / 255 / 12.92 for c in bgr[::-1]]
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return np.array([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s])


def from_oklab(lab):
    L, A, B = lab
    l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
    s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3
    rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034133285 * m + 1.7076147010 * s]
    out = [255 * (1.055 * max(c, 0) ** (1 / 2.4) - 0.055 if c > 0.0031308 else 12.92 * c) for c in rgb]
    return np.clip(np.array(out[::-1], np.float32), 0, 255)


def melt(f, bg, c, vis):
    """Fade a scene into a flat colour: its background shifts to c, the artwork dissolves into it."""
    m = np.clip(1 - np.linalg.norm(f - bg, axis=2) / 40.0, 0, 1)[..., None]
    shifted = f + m * (c - bg)
    return shifted * vis + c * (1 - vis)


def ease(p):
    p = min(max(p, 0.0), 1.0)
    return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2


def render(t):
    """Scene i owns [2.5 i, 2.5 i + 2.5). Around each boundary (XF wide) the next scene swipes in
    from the right and pushes the current one out to the left; both keep animating while they move.
    Scene 6 -> scene 1 is just another swipe, so 14.97 s -> 0 s has no seam."""
    i = int(t // SCENE) % 6
    u = t - i * SCENE
    if XF / 2 <= u <= SCENE - XF / 2:
        return scene(i).frame(u)
    if u < XF / 2:  # boundary at the start of scene i
        a, b, ua, ub, p = (i - 1) % 6, i, u + SCENE, u, (u + XF / 2) / XF
    else:
        a, b, ua, ub, p = i, (i + 1) % 6, u, u - SCENE, (u - SCENE + XF / 2) / XF
    A, B = scene(a).frame(ua), scene(b).frame(ub)
    W = A.shape[1]
    off = int(round(ease(p) * W))
    out = np.empty_like(A)
    out[:, :W - off] = A[:, off:]
    out[:, W - off:] = B[:, :off]
    # light directional blur, proportional to the swipe speed (px per frame)
    dp = 1 / (XF * FPS)
    v = (ease(p + dp / 2) - ease(p - dp / 2)) * W
    k = int(v * 0.35)
    if k >= 3:
        out = cv2.blur(out, (k, 1))
    return out


def out8(f):
    return np.clip(f + 0.5, 0, 255).astype(np.uint8)


def main():
    cmd = sys.argv[1]
    os.makedirs(os.path.join(ROOT, "work"), exist_ok=True)
    if cmd == "still":
        t = float(sys.argv[2])
        cv2.imwrite(os.path.join(ROOT, "work", "still.png"), out8(render(t)))
    elif cmd == "debug":
        i = int(sys.argv[2]) - 1
        s = scene(i)
        img = out8(s.plate)
        for h in s.d.get("handles", []):
            sx, sy = h.get("asp", (1, 1))
            cv2.ellipse(img, h["c"], (int(h["r0"] * sx), int(h["r0"] * sy)), 0, 0, 360, (0, 255, 0), 2)
            cv2.ellipse(img, h["c"], (int(h["r1"] * sx), int(h["r1"] * sy)), 0, 0, 360, (255, 0, 255), 1)
        for b in s.d.get("sway", []) + ([s.d["settle"]] if s.d.get("settle") else []):
            x0, y0, x1, y1 = b["box"]
            cv2.rectangle(img, (x0, y0), (x1, y1), (255, 255, 0), 2)
        for pair in s.eyes:
            for e in pair:
                x0, y0, x1, y1 = e.box
                cv2.rectangle(img, (int(x0), int(y0)), (int(x1), int(y1)), (0, 0, 255), 1)
        for fx in s.d.get("fx", []):
            x0, y0, x1, y1 = fx["box"]
            cv2.rectangle(img, (x0, y0), (x1, y1), (0, 200, 255), 2)
        cv2.imwrite(os.path.join(ROOT, "work", f"debug_s{i + 1}.png"), img)
    elif cmd == "sheet":
        ts = [float(x) for x in sys.argv[2:]] or [i * 15 / 24 for i in range(24)]
        tiles = [cv2.resize(out8(render(t)), (300, 328), interpolation=cv2.INTER_AREA) for t in ts]
        for tile, t in zip(tiles, ts):
            cv2.putText(tile, f"{t:.2f}", (6, 20), 0, 0.6, (255, 255, 255), 2)
        while len(tiles) % 6:
            tiles.append(np.zeros_like(tiles[0]))
        rows = [np.hstack(tiles[k:k + 6]) for k in range(0, len(tiles), 6)]
        cv2.imwrite(os.path.join(ROOT, "work", "sheet.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])
    elif cmd == "render":
        import imageio_ffmpeg
        ff = imageio_ffmpeg.get_ffmpeg_exe()
        dist = os.path.join(ROOT, "dist")
        os.makedirs(dist, exist_ok=True)
        H, W = 1312, 1199
        common = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p",
                  "-g", "60", "-movflags", "+faststart", "-an"]
        # full artwork (padded 1 px to even width) and 1:1 (the top 113 px are empty background)
        p = subprocess.Popen(
            [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
             "-i", "-", "-filter_complex",
             "[0:v]split=2[a][b];[a]pad=1200:1312:0:0:color=0x000000@0,fillborders=right=1:mode=smear[full];"
             "[b]crop=1199:1199:0:113,scale=1080:1080:flags=lanczos[sq]",
             "-map", "[full]", *common, os.path.join(dist, "washing-basket-hero.mp4"),
             "-map", "[sq]", *common, os.path.join(dist, "washing-basket-hero-square.mp4")],
            stdin=subprocess.PIPE)
        for n in range(NFR):
            p.stdin.write(out8(render(n / FPS)).tobytes())
            if n % 30 == 0:
                print(f"frame {n}/{NFR}", flush=True)
        p.stdin.close()
        p.wait()
        cv2.imwrite(os.path.join(dist, "washing-basket-hero-poster.jpg"), out8(render(1.25)),
                    [cv2.IMWRITE_JPEG_QUALITY, 92])
        print("done")


if __name__ == "__main__":
    main()
