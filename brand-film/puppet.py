"""Cut-out (puppet) animation built from the original illustrations.

Each moving part is cut from the artwork as an RGBA layer, the plate behind it
is repaired, and the part is re-composited every frame with its own transform
and, optionally, its own deformation (cloth, hair, stretching limbs) — so motion
never drags neighbouring artwork along.
"""
import math

import cv2
import numpy as np

NAVY_INK = (22, 38, 78)


def poly_mask(shape, pts, feather=0):
    m = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 255, cv2.LINE_AA)
    if feather:
        m = cv2.GaussianBlur(m, (0, 0), feather)
    return m


def fill_holes(m):
    """Fill enclosed holes of a binary mask (e.g. buttons inside a shirt)."""
    h, w = m.shape
    flood = m.copy()
    ff = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 255)
    return m | cv2.bitwise_not(flood)


def color_mask(img, lo, hi):
    return cv2.inRange(img, np.array(lo, np.uint8), np.array(hi, np.uint8))


class Layer:
    """An RGBA piece of the artwork, stored as a padded crop in source space."""

    def __init__(self, img, mask, pad=60):
        ys, xs = np.nonzero(mask > 8)
        h, w = mask.shape
        self.x0 = max(int(xs.min()) - pad, 0)
        self.y0 = max(int(ys.min()) - pad, 0)
        self.x1 = min(int(xs.max()) + pad, w)
        self.y1 = min(int(ys.max()) + pad, h)
        crop = img[self.y0:self.y1, self.x0:self.x1].astype(np.float32)
        a = mask[self.y0:self.y1, self.x0:self.x1].astype(np.float32) / 255
        self.rgb = crop
        self.alpha = a
        ch, cw = a.shape
        self.gx, self.gy = np.meshgrid(np.arange(cw, dtype=np.float32), np.arange(ch, dtype=np.float32))
        # coarse grid in *source* coordinates for deformation callbacks
        self.step = 8
        cy = np.arange(0, ch, self.step, dtype=np.float32)
        cx = np.arange(0, cw, self.step, dtype=np.float32)
        self.cgx, self.cgy = np.meshgrid(cx + self.x0, cy + self.y0)

    def draw(self, dst, M=None, deform=None, alpha=1.0, overlay=None):
        """Composite onto `dst` (source-space image).

        M: 2x3 affine in source space (applied after deformation).
        deform(x, y) -> (dx, dy): forward displacement field in source coords.
        overlay(rgb, a, x0, y0): paints extra artwork (face changes) into the
        layer before it is transformed, so it moves with the part.
        """
        rgb, a = self.rgb, self.alpha
        if overlay is not None:
            rgb = rgb.copy()
            a = a.copy()
            overlay(rgb, a, self.x0, self.y0)
        if deform is not None:
            dx, dy = deform(self.cgx, self.cgy)
            ch, cw = a.shape
            dx = cv2.resize(dx.astype(np.float32), (cw, ch), interpolation=cv2.INTER_LINEAR)
            dy = cv2.resize(dy.astype(np.float32), (cw, ch), interpolation=cv2.INTER_LINEAR)
            mx, my = self.gx - dx, self.gy - dy
            rgb = cv2.remap(rgb, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            a = cv2.remap(a, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        H, W = dst.shape[:2]
        if M is None:
            M = np.float32([[1, 0, 0], [0, 1, 0]])
        # crop-local → source: translate by (x0, y0), then M
        T = np.float32([[1, 0, self.x0], [0, 1, self.y0], [0, 0, 1]])
        full = np.vstack([M, [0, 0, 1]]).astype(np.float32) @ T
        corners = np.float32([[0, 0, 1], [a.shape[1], 0, 1], [0, a.shape[0], 1], [a.shape[1], a.shape[0], 1]])
        pts = (full @ corners.T).T[:, :2]
        bx0, by0 = np.floor(pts.min(0)).astype(int) - 2
        bx1, by1 = np.ceil(pts.max(0)).astype(int) + 2
        bx0, by0, bx1, by1 = max(bx0, 0), max(by0, 0), min(bx1, W), min(by1, H)
        if bx1 <= bx0 or by1 <= by0:
            return
        local = full.copy()
        local[0, 2] -= bx0
        local[1, 2] -= by0
        size = (bx1 - bx0, by1 - by0)
        wr = cv2.warpAffine(rgb, local[:2], size, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        wa = cv2.warpAffine(a, local[:2], size, flags=cv2.INTER_LINEAR, borderValue=0)[..., None] * alpha
        roi = dst[by0:by1, bx0:bx1].astype(np.float32)
        dst[by0:by1, bx0:bx1] = (roi * (1 - wa) + wr * wa).clip(0, 255).astype(np.uint8)


def rot_about(px, py, deg, tx=0.0, ty=0.0, s=1.0):
    """Affine: rotate/scale about (px, py) then translate by (tx, ty)."""
    M = cv2.getRotationMatrix2D((px, py), -deg, s)
    M[0, 2] += tx
    M[1, 2] += ty
    return M.astype(np.float32)


def apply(M, x, y):
    return (M[0, 0] * x + M[0, 1] * y + M[0, 2], M[1, 0] * x + M[1, 1] * y + M[1, 2])


def heal(img, mask, radius=9):
    """Repair the plate where a layer was lifted out."""
    m = cv2.dilate((mask > 20).astype(np.uint8) * 255, np.ones((9, 9), np.uint8))
    return cv2.inpaint(img, m, radius, cv2.INPAINT_TELEA)


# ------------------------------------------------------------------ face overlays
def _blend(rgb, a, m, color):
    m = m.astype(np.float32)[..., None] / 255
    rgb[:] = rgb * (1 - m) + np.array(color, np.float32) * m
    a[:] = np.maximum(a, m[..., 0])


def _P(x, y):
    return (int(round(x * 16)), int(round(y * 16)))


def eyelid(rgb, a, x0, y0, eye, rx, ry, closed, skin, ink=NAVY_INK, width=6, tilt=0.0):
    """Close an eye: skin lid sweeps down, ending in the artwork's curved closed-eye stroke."""
    if closed <= 0.02:
        return
    ex, ey = eye[0] - x0, eye[1] - y0
    m = np.zeros(a.shape, np.uint8)
    top = ey - ry * 1.25
    lid_y = top + (ry * 2.4) * min(1.0, closed)
    cv2.ellipse(m, _P(ex, ey), (int(rx * 1.6 * 16), int(ry * 1.35 * 16)), tilt, 0, 360, 255, -1, cv2.LINE_AA, 4)
    m[int(lid_y):, :] = 0
    _blend(rgb, a, m, skin)
    if closed > 0.7:
        m2 = np.zeros(a.shape, np.uint8)
        cv2.ellipse(m2, _P(ex, ey - ry * 0.15), (int(rx * 1.3 * 16), int(ry * 0.55 * 16)), tilt, 15, 165, 255,
                    width, cv2.LINE_AA, 4)
        _blend(rgb, a, m2, ink)


def mouth(rgb, a, x0, y0, box, skin, openness, ink=NAVY_INK, tongue=(222, 96, 96), width=6, cover=None):
    """Replace the line smile by an open laughing smile drawn in the same style."""
    if openness <= 0.02:
        return
    (lx, ly), (rx_, ry_) = box               # mouth corners in source coords
    lx, ly, rx_, ry_ = lx - x0, ly - y0, rx_ - x0, ry_ - y0
    cx, cy = (lx + rx_) / 2, (ly + ry_) / 2
    w = rx_ - lx
    cov = np.zeros(a.shape, np.uint8)
    cvx, cvy, crx, cry = cover if cover else (cx, cy + 6, w * 0.62, 18)
    cv2.ellipse(cov, _P(cvx - x0 if cover else cvx, cvy - y0 if cover else cvy), (int(crx * 16), int(cry * 16)),
                0, 0, 360, 255, -1, cv2.LINE_AA, 4)
    _blend(rgb, a, cov, skin)
    depth = 6 + 22 * openness
    pts = [(lx, ly)]
    for i in range(1, 12):
        u = i / 12
        pts.append((lx + w * u, ly + (ry_ - ly) * u - 3 * math.sin(math.pi * u)))
    pts.append((rx_, ry_))
    for i in range(1, 16):
        u = 1 - i / 16
        pts.append((lx + w * u, ly + (ry_ - ly) * u + depth * math.sin(math.pi * u) ** 0.8))
    poly = np.array([_P(x, y) for x, y in pts], np.int32)
    m = np.zeros(a.shape, np.uint8)
    cv2.fillPoly(m, [poly], 255, cv2.LINE_AA, 4)
    _blend(rgb, a, m, ink)
    t = np.zeros(a.shape, np.uint8)
    cv2.ellipse(t, _P(cx + w * 0.06, cy + depth * 0.62), (int(w * 0.24 * 16), int(depth * 0.34 * 16)), 0, 0, 360,
                255, -1, cv2.LINE_AA, 4)
    t = cv2.bitwise_and(t, m)
    t = cv2.erode(t, np.ones((3, 3), np.uint8))
    _blend(rgb, a, t, tongue)


# ------------------------------------------------------------------ deformation helpers
def falloff(x, y, cx, cy, r):
    return np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r))


def along(x, y, p0, p1):
    """0 at p0 → 1 at p1, projected onto the segment (clamped)."""
    vx, vy = p1[0] - p0[0], p1[1] - p0[1]
    t = ((x - p0[0]) * vx + (y - p0[1]) * vy) / (vx * vx + vy * vy)
    return np.clip(t, 0, 1)


def eye_shift(rgb, a, x0, y0, eye, rx, ry, dx, dy, skin, ink=NAVY_INK):
    """Move a dot eye (gaze): paint over the original, redraw it offset."""
    if abs(dx) < 0.3 and abs(dy) < 0.3:
        return
    ex, ey = eye[0] - x0, eye[1] - y0
    m = np.zeros(a.shape, np.uint8)
    cv2.ellipse(m, _P(ex, ey), (int((rx + 3) * 16), int((ry + 3) * 16)), 0, 0, 360, 255, -1, cv2.LINE_AA, 4)
    _blend(rgb, a, m, skin)
    m[:] = 0
    cv2.ellipse(m, _P(ex + dx, ey + dy), (int(rx * 16), int(ry * 16)), 0, 0, 360, 255, -1, cv2.LINE_AA, 4)
    _blend(rgb, a, m, ink)


def m3(M):
    return np.vstack([M, [0, 0, 1]]).astype(np.float32)


def compose(*Ms):
    out = np.eye(3, dtype=np.float32)
    for M in Ms:
        out = out @ m3(M)
    return out[:2]
