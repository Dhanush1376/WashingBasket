"""Vector drawing primitives in the Washing Basket illustration language:
flat fills, rounded navy outlines, and a white "sticker" rim around groups."""
import math
from contextlib import contextmanager

import skia

# ---------------------------------------------------------------- palette
def C(r, g, b, a=255):
    return skia.Color(int(r), int(g), int(b), int(a))


NAVY = C(16, 36, 82)          # outline / hair / apron
NAVY_APRON = C(14, 44, 104)
NAVY_BG = C(1, 58, 129)
BLUE = C(52, 110, 196)
ORANGE = C(254, 140, 2)
ORANGE_BG = C(254, 142, 2)
AMBER_BG = C(254, 168, 8)
YELLOW = C(253, 186, 20)
RED = C(232, 48, 38)
RED_BG = C(226, 32, 30)
TOMATO_BG = C(247, 86, 32)
SKIN = C(250, 200, 160)
SKIN_SHADE = C(236, 176, 136)
WHITE = C(255, 255, 255)
CREAM = C(255, 246, 232)
TONGUE = C(224, 92, 92)

LW = 5.5    # outline width at 1:1
RIM = 11    # sticker rim


def paint(color, alpha=1.0):
    p = skia.Paint(AntiAlias=True, Color=color)
    if alpha < 1:
        p.setAlphaf(alpha)
    return p


def pen(color=NAVY, width=LW, alpha=1.0, cap=skia.Paint.kRound_Cap):
    p = skia.Paint(AntiAlias=True, Color=color, Style=skia.Paint.kStroke_Style, StrokeWidth=width,
                   StrokeCap=cap, StrokeJoin=skia.Paint.kRound_Join)
    if alpha < 1:
        p.setAlphaf(alpha)
    return p


def shape(c, path, fill, outline=True, lw=LW, alpha=1.0):
    if fill is not None:
        c.drawPath(path, paint(fill, alpha))
    if outline:
        c.drawPath(path, pen(NAVY, lw, alpha))


def line(c, pts, color=NAVY, width=LW, alpha=1.0, smooth_=True):
    if len(pts) < 2:
        return
    c.drawPath(smooth(pts, closed=False) if smooth_ and len(pts) > 2 else poly(pts, closed=False),
               pen(color, width, alpha))


# ---------------------------------------------------------------- paths
def poly(pts, closed=True):
    p = skia.Path()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    if closed:
        p.close()
    return p


def smooth(pts, closed=True, tension=1.0):
    """Catmull-Rom spline through points, as cubic Béziers."""
    n = len(pts)
    p = skia.Path()
    if n < 3:
        return poly(pts, closed)
    p.moveTo(*pts[0])
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if (closed or i > 0) else pts[i]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else pts[(i + 1) % n]
        k = tension / 6
        c1 = (p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k)
        c2 = (p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k)
        p.cubicTo(*c1, *c2, *p2)
    if closed:
        p.close()
    return p


def circle(x, y, r):
    p = skia.Path()
    p.addCircle(x, y, max(r, 0.01))
    return p


def oval(x, y, rx, ry):
    p = skia.Path()
    p.addOval(skia.Rect.MakeLTRB(x - rx, y - ry, x + rx, y + ry))
    return p


def rrect(x0, y0, x1, y1, r):
    p = skia.Path()
    r = max(0.0, min(r, (x1 - x0) / 2, (y1 - y0) / 2))
    p.addRRect(skia.RRect.MakeRectXY(skia.Rect.MakeLTRB(x0, y0, x1, y1), r, r))
    return p


def union(*paths):
    out = paths[0]
    for q in paths[1:]:
        out = skia.Op(out, q, skia.PathOp.kUnion_PathOp)
    return out


def capsule(p0, r0, p1, r1, n=20):
    """Tapered limb: convex hull of two circles."""
    pts = []
    for (x, y), r in ((p0, r0), (p1, r1)):
        for i in range(n):
            a = 2 * math.pi * i / n
            pts.append((x + r * math.cos(a), y + r * math.sin(a)))
    return poly(_hull(pts))


def _hull(pts):
    pts = sorted(set((round(x, 3), round(y, 3)) for x, y in pts))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def sparkle_path(x, y, size, angle=0.0):
    pts = []
    a = math.radians(angle)
    for i in range(48):
        th = 2 * math.pi * i / 48
        cx, sy = math.cos(th), math.sin(th)
        rx = math.copysign(abs(cx) ** 2.6, cx)
        ry = math.copysign(abs(sy) ** 2.6, sy)
        pts.append((x + size * (rx * math.cos(a) - ry * math.sin(a)),
                    y + size * (rx * math.sin(a) + ry * math.cos(a))))
    return poly(pts)


# ---------------------------------------------------------------- groups
@contextmanager
def sticker(c, rim=RIM):
    """Everything drawn inside gets the illustrations' white outer rim."""
    rimf = skia.ImageFilters.ColorFilter(
        skia.ColorFilters.Blend(WHITE, skia.BlendMode.kSrcIn),
        skia.ImageFilters.Dilate(rim, rim))
    c.saveLayer(None, skia.Paint(ImageFilter=skia.ImageFilters.Merge([rimf, None])))
    try:
        yield
    finally:
        c.restore()


@contextmanager
def at(c, x=0.0, y=0.0, rot=0.0, sx=1.0, sy=None, px=0.0, py=0.0):
    """Translate to (x, y), then rotate/scale about local pivot (px, py)."""
    c.save()
    c.translate(x, y)
    if rot or sx != 1 or (sy is not None and sy != 1):
        c.translate(px, py)
        if rot:
            c.rotate(rot)
        c.scale(sx, sx if sy is None else sy)
        c.translate(-px, -py)
    try:
        yield
    finally:
        c.restore()


@contextmanager
def faded(c, alpha):
    if alpha >= 0.999:
        yield
        return
    c.saveLayerAlpha(None, int(max(0, min(1, alpha)) * 255))
    try:
        yield
    finally:
        c.restore()


# ---------------------------------------------------------------- maths
def lerp(a, b, u):
    return a + (b - a) * u


def clamp01(x):
    return max(0.0, min(1.0, x))


def smoothstep(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def ease_io(x):
    x = clamp01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_out(x, p=3):
    return 1 - (1 - clamp01(x)) ** p


def ease_in(x, p=3):
    return clamp01(x) ** p


def back_out(x, s=1.6):
    x = clamp01(x) - 1
    return x * x * ((s + 1) * x + s) + 1


def wave(t, period, phase=0.0):
    return math.sin(2 * math.pi * t / period + phase)


def pulse(t, start, dur):
    """0 → 1 → 0 bump over [start, start+dur]."""
    u = (t - start) / dur
    return math.sin(math.pi * u) if 0 <= u <= 1 else 0.0


def blink(t, times, dur=0.16):
    """Eyelid closure (0 open … 1 closed) for blinks starting at `times`."""
    v = 0.0
    for s in times:
        v = max(v, pulse(t, s, dur))
    return v


def keys(t, ks):
    """Piecewise eased keyframes: ks = [(t, value, ease)]; value may be a tuple."""
    if t <= ks[0][0]:
        return ks[0][1]
    for (t0, v0, _), (t1, v1, e) in zip(ks, ks[1:]):
        if t <= t1:
            u = (e or smoothstep)((t - t0) / (t1 - t0))
            if isinstance(v0, tuple):
                return tuple(lerp(a, b, u) for a, b in zip(v0, v1))
            return lerp(v0, v1, u)
    return ks[-1][1]


def ik(shoulder, target, l1, l2, bend=1):
    """Two-bone IK: returns (elbow, wrist). bend=+1/-1 chooses elbow side."""
    sx, sy = shoulder
    dx, dy = target[0] - sx, target[1] - sy
    d = math.hypot(dx, dy)
    d = max(1e-3, min(d, l1 + l2 - 1e-3))
    a = math.atan2(dy, dx)
    cos_b = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    b = math.acos(max(-1, min(1, cos_b)))
    ang = a - bend * b
    elbow = (sx + l1 * math.cos(ang), sy + l1 * math.sin(ang))
    wrist = (sx + d * math.cos(a), sy + d * math.sin(a))
    return elbow, wrist
