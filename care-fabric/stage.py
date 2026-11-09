"""The rest of the cloth's journey (see fabric.py for the weave and the first crumpling).

  washed   the cloth's creases after the wash: a different, softer lie than when it came in
  caustics a seamless tile of the light that ripples through water onto the cloth (on black; screen)
  foam     suds lying on the soaked cloth: clusters of bubbles, each with a bright rim and a pin of light
  bubble   one loose bubble, for the few that drift across
  iron     the steam iron, trimmed and sized for the page
  fold     the pressed cloth seen whole, folded in half and in half again the way a towel is folded: the
           free edge lifts, rolls over in a soft loop and settles on top, the loop easing down to the
           thickness of the cloth. Rendered top-down, frame by frame, into one sprite sheet.

  python stage.py
"""
import json
import os

import cv2
import numpy as np

import fabric
from fabric import H, W, OUT, WORK, noise, lighting

rng = np.random.default_rng(31)


# ------------------------------------------------------------------------------------------------
def washed_height():
    y, x = np.mgrid[:H, :W].astype(np.float32)
    wx = 80 * noise(H, W, 320, 141, 2)
    wy = 80 * noise(H, W, 320, 142, 2)
    xs, ys = np.clip(x + wx, 0, W - 1).astype(np.float32), np.clip(y + wy, 0, H - 1).astype(np.float32)
    h = np.zeros((H, W), np.float32)
    for scale, amp, seed in ((260, 20, 151), (140, 9, 152), (70, 3.5, 153)):
        n = noise(H, W, scale, seed, 1)
        h += amp * np.clip(1 - np.abs(n) / 1.6, 0, 1) ** 2.0
    h = cv2.remap(h, xs, ys, cv2.INTER_LINEAR)
    h += 34 * noise(H, W, 560, 154, 2)
    for _ in range(9):
        cx, cy = rng.uniform(0, W), rng.uniform(0, H)
        ang = rng.uniform(0, np.pi)
        L = rng.uniform(200, 460)
        w = rng.uniform(7, 14)
        depth = rng.choice([-1, 1]) * rng.uniform(4, 8)
        bend = rng.normal(0, 150)
        phase = rng.uniform(0, 2 * np.pi)
        X, Y = x - cx, y - cy
        ca, sa = np.cos(ang), np.sin(ang)
        along = X * ca + Y * sa
        # bowed and wavering along their length: cloth never creases dead straight
        across = -X * sa + Y * ca + bend * (along / L) ** 2 + 9 * np.sin(along / 85 + phase)
        taper = np.clip(1 - (np.abs(along) / (L / 2)) ** 2, 0, 1) ** 2
        h += depth * np.exp(-np.abs(across) / w) * taper
    return cv2.GaussianBlur(h, (0, 0), 2.0)


def caustics(n=512):
    """Seamless water caustics: bright, wavering lines along the borders of warped cells (on a torus)."""
    r = np.random.default_rng(5)
    pts = r.uniform(0, n, (30, 2))
    y, x = np.mgrid[:n, :n].astype(np.float32)
    warp_x = fabric.periodic_noise(n, 70, 8) * 9
    warp_y = fabric.periodic_noise(n, 70, 9) * 9
    X, Y = x + warp_x, y + warp_y
    f1 = np.full((n, n), 1e9, np.float32)
    f2 = np.full((n, n), 1e9, np.float32)
    for px, py in pts:
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                d = np.hypot(X - px - ox, Y - py - oy)
                f2 = np.where(d < f1, f1, np.minimum(f2, d))
                f1 = np.minimum(f1, d)
    edge = f2 - f1
    c = np.exp(-edge / 5.5) ** 1.3
    c = cv2.GaussianBlur(c, (0, 0), 1.1)
    c = c / c.max()
    warm = np.array([255, 250, 238], np.float32)
    return np.clip(c[..., None] * warm * 0.95, 0, 255)


def bubble_sprite(r):
    s = int(r * 2 + 6)
    yy, xx = np.mgrid[:s, :s].astype(np.float32)
    c = s / 2
    d = np.hypot(xx - c, yy - c) / r
    rim = np.clip(1 - np.abs(d - 0.93) / 0.09, 0, 1) ** 1.2
    film = np.clip((1 - d) / 0.08, 0, 1) * 0.10
    pin = np.exp(-(((xx - (c - r * 0.38)) ** 2 + (yy - (c - r * 0.42)) ** 2) / (2 * (r * 0.13) ** 2)))
    arc = np.clip(1 - np.abs(d - 0.78) / 0.07, 0, 1) * np.clip(((xx - c) + (yy - c)) / r, 0, 1) * 0.5   # light on the far side
    a = np.clip(rim * 0.75 + film + pin * 0.95 + arc, 0, 1)
    # a faint rainbow sheen on the film
    hue = np.stack([255 - 30 * np.clip(xx / s, 0, 1), 250 * np.ones_like(xx), 240 + 15 * np.clip(yy / s, 0, 1)], -1)
    return np.dstack([np.clip(hue, 0, 255), a * 255])


def foam():
    """Suds over the soaked cloth: dense near the edges and the open right side, thin where the words are."""
    col = np.zeros((H, W, 3), np.float32) + 255
    a = np.zeros((H, W), np.float32)
    shadow = np.zeros((H, W), np.float32)
    y, x = np.mgrid[:H, :W].astype(np.float32)
    # where foam gathers: the right of the frame, the bottom, the corners; less over the copy on the left
    want = 0.25 + 0.75 * np.clip((x / W - 0.38) / 0.4, 0, 1)
    want = np.maximum(want, np.clip((y / H - 0.78) / 0.2, 0, 1))
    want *= 0.6 + 0.4 * np.clip(noise(H, W, 180, 61, 2) + 0.5, 0, 1)
    clusters = []
    for _ in range(4000):
        cx, cy = rng.uniform(0, W), rng.uniform(0, H)
        if rng.random() < want[int(cy), int(cx)] ** 2 * 0.038:
            clusters.append((cx, cy, rng.uniform(40, 150)))
    bubbles = []
    for cx, cy, R in clusters:
        nb = int(R * 1.6)
        for _ in range(nb):
            ang = rng.uniform(0, 2 * np.pi)
            dist = R * np.sqrt(rng.random()) * rng.uniform(0.6, 1)
            rr = float(np.clip(rng.exponential(5.5) + 1.8, 1.8, 26)) * (1.25 - dist / R * 0.6)
            bubbles.append((cx + np.cos(ang) * dist, cy + np.sin(ang) * dist * 0.8, rr))
    bubbles.sort(key=lambda b: -b[2])
    sprites = {}
    for bx, by, rr in bubbles:
        key = round(rr * 2) / 2
        if key not in sprites:
            sprites[key] = bubble_sprite(key)
        sp = sprites[key]
        s = sp.shape[0]
        x0, y0 = int(bx - s / 2), int(by - s / 2)
        if x0 < 0 or y0 < 0 or x0 + s >= W or y0 + s >= H:
            continue
        sa = sp[..., 3] / 255
        blk = col[y0:y0 + s, x0:x0 + s]
        ab = a[y0:y0 + s, x0:x0 + s]
        blk[:] = blk * (1 - sa[..., None]) + sp[..., :3] * sa[..., None]
        ab[:] = sa + ab * (1 - sa)
        # each bubble shades the cloth a little below and to the right
        so = 2 + int(key * 0.25)
        ys, xs_ = y0 + so, x0 + so
        if ys + s < H and xs_ + s < W:
            disc = np.clip(1 - np.hypot(*np.mgrid[:s, :s].astype(np.float32) - s / 2) / (key + 0.5), 0, 1)
            shadow[ys:ys + s, xs_:xs_ + s] = np.maximum(shadow[ys:ys + s, xs_:xs_ + s], disc)
    # the dense heart of a cluster is creamy white, the bubbles packed past seeing
    dens = cv2.GaussianBlur(a, (0, 0), 7)
    cream = np.clip((dens - 0.55) / 0.35, 0, 1) * 0.55
    col = col * (1 - cream[..., None]) + np.array([255, 253, 250], np.float32) * cream[..., None]
    a = np.maximum(a, cream)
    shadow = cv2.GaussianBlur(shadow, (0, 0), 2.5) * 0.18 * (1 - a)
    out_col = col * a[..., None] + np.array([110, 70, 50], np.float32) * shadow[..., None]
    out_a = np.clip(a + shadow, 0, 1)
    out_col = out_col / np.maximum(out_a, 1e-3)[..., None]
    return np.dstack([np.clip(out_col, 0, 255), out_a * 255])


def iron():
    src = cv2.imread(os.path.join(fabric.ROOT, "..", "Flat Vector Electric Steam Iron.png"), cv2.IMREAD_UNCHANGED)
    a = src[..., 3]
    ys, xs = np.where(a > 8)
    crop = src[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = crop.shape[:2]
    out = cv2.resize(crop, (720, int(h * 720 / w)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(OUT, "cloth-iron.webp"), out, [cv2.IMWRITE_WEBP_QUALITY, 90])
    return out.shape[1], out.shape[0], int(xs.min()), int(xs.max())


# ------------------------------------------------------------------------------------------------
# the fold
# ------------------------------------------------------------------------------------------------
SW, SH = 600, 400          # the cloth, in frame pixels
FW, FH = 720, 520          # a frame: room round the cloth for its shadow and the loop
OX, OY = (FW - SW) // 2, (FH - SH) // 2
# the fold sheet, written twice: in full for large screens, and smaller for phones (a decoded sprite sheet
# costs its full width x height in memory, and phones have little to spare)
SHEETS = {"cloth-fold": 1.0, "cloth-fold-m": 0.6}


def sheet_texture():
    """The pressed cloth seen whole: its weave at this distance, a hem round the edge, soft handling ripples."""
    tile = cv2.resize(fabric.weave(), (90, 90), interpolation=cv2.INTER_AREA)
    t = np.tile(tile, (SH // 90 + 2, SW // 90 + 2, 1))[:SH, :SW].astype(np.float32)
    y, x = np.mgrid[:SH, :SW].astype(np.float32)
    # a gentle unevenness, as any cloth lying flat has
    hgt = 3.0 * noise(SH, SW, 140, 71, 2)
    gy, gx = np.gradient(hgt)
    t *= (1 + (-gx - gy) * 0.09)[..., None]
    # hem: a turned edge, a touch darker, with a line of stitching inside it
    e = np.minimum(np.minimum(x, SW - 1 - x), np.minimum(y, SH - 1 - y))
    hem = np.clip(1 - (e - 9) / 2, 0, 1)
    t *= (1 - 0.06 * hem)[..., None]
    t *= (1 - 0.10 * np.exp(-e / 1.2))[..., None]
    stitch = (np.abs(e - 11.5) < 0.7) & (((x + y) // 4) % 2 == 0)
    t[stitch] *= 0.86
    return np.clip(t, 0, 255)


def fold_once(tex, alpha, t, axis, r_max, r_min, wave):
    """Fold `tex` (RGB, with `alpha`) in half across its middle, the far half rolling over onto the near half.
    axis 0: the top half folds down; axis 1: the left half folds right. Returns an RGB + A image the same size.
    t in 0..1."""
    if axis == 1:
        tex, alpha = np.transpose(tex, (1, 0, 2)), alpha.T
    h, w = alpha.shape
    rows = np.where(alpha.max(axis=1) > 0.01)[0]
    top, bot = rows.min(), rows.max() + 1
    mid = (top + bot) / 2
    S = mid - top                                    # the flap's length, from the fold line to its free edge
    e = t * t * (3 - 2 * t)
    r = r_min + (r_max - r_min) * np.sin(np.pi * min(1, t * 1.05)) ** 1.2
    a0 = S * (1 - e)                                 # where the loop is, measured from the fold line
    cols = np.arange(w, dtype=np.float32)
    # a held cloth is never quite straight: the loop runs a little ahead at one side and waves along its length
    lead = wave * np.sin(np.pi * e) * (0.55 * np.sin(cols / w * np.pi * 2.2 + 0.6) + 0.45 * (cols / w - 0.5))
    a = np.clip(a0 + lead, 0, S)
    rr = r * (1 + 0.25 * np.sin(cols / w * np.pi * 3 + 1.3))
    U = np.linspace(0, S, int(S * 3))[:, None]                       # material, out from the fold line
    A, R = a[None, :], rr[None, :]
    flat = U <= A
    loop = (U > A) & (U <= A + np.pi * R)
    alpha_ang = np.clip((U - A) / R, 0, np.pi)
    Ypos = np.where(flat, mid - U,
                    np.where(loop, mid - (A + R * np.sin(alpha_ang)), mid - A + (U - A - np.pi * R)))
    Z = np.where(flat, 0, np.where(loop, R * (1 - np.cos(alpha_ang)), 2 * R * (1 - 0.35 * np.clip((U - A - np.pi * R) / S, 0, 1))))
    # light from above and a little up the frame
    ny = np.where(flat, 0, np.where(loop, np.sin(alpha_ang), 0))
    nz = np.where(flat, 1, np.where(loop, np.cos(alpha_ang), -1))
    back = nz < 0
    ny, nz = np.where(back, -ny, ny), np.abs(nz)
    lam = np.clip(-0.42 * ny + 0.91 * nz, 0, 1)
    shade = 0.62 + 0.38 * lam / 0.91
    shade = np.where(back, shade * 0.93, shade)
    # a lifted cloth hangs in soft ripples running out from the fold; they ease away as it settles
    ripple = (0.6 * np.sin(cols / w * np.pi * 9 + 0.8) + 0.4 * np.sin(cols / w * np.pi * 23 + 2.1))[None, :]
    env = np.sin(np.pi * e) * np.clip(Z / (R * 2 + 1e-3), 0, 1)
    shade = shade * (1 + 0.09 * ripple * env)
    Ypos = Ypos + 3.0 * ripple * env
    src_row = np.clip(mid - U, 0, h - 1)                                # the flap's material row
    out = np.zeros((h, w, 3), np.float32)
    out_a = np.zeros((h, w), np.float32)
    near = np.arange(h) >= mid
    out[near] = tex[near]
    out_a[near] = alpha[near]
    # the flap's shadow on what lies beneath
    cover = np.zeros((h, w), np.float32)
    hgt = np.zeros((h, w), np.float32)
    Yi = np.round(Ypos).astype(int)
    ok = (Yi >= 0) & (Yi < h)
    cc = np.broadcast_to(cols[None, :], Yi.shape).astype(int)
    lift = Z > 0.5
    src_ok = alpha[np.clip(np.round(mid - U), 0, h - 1).astype(int), np.broadcast_to(cols[None, :], Yi.shape).astype(int)] > 0.5
    sel = ok & lift & src_ok
    cover[Yi[sel], cc[sel]] = 1
    np.maximum.at(hgt, (Yi[sel], cc[sel]), Z[sel])
    zbar = float(hgt[cover > 0].mean()) if cover.any() else 0
    sh = cv2.GaussianBlur(cover, (0, 0), 3 + zbar * 0.35)
    shift = int(4 + zbar * 0.25)
    sh = np.roll(sh, shift, axis=0) * (0.42 * np.clip(zbar / 12 + 0.35, 0, 1))
    under = out_a > 0
    out[under] *= (1 - sh[under])[..., None]
    table = sh * 0.6
    # paint the flap from lowest to highest, so the highest wins
    order = np.argsort(Z[ok], kind="stable")
    yy, xx = Yi[ok][order], cc[ok][order]
    sr = np.round(src_row).astype(int)
    sr = np.broadcast_to(sr, Yi.shape)[ok][order]
    sv = np.broadcast_to(shade, Yi.shape)[ok][order]
    pix = tex[sr, xx] * sv[:, None]
    pa = alpha[sr, xx]
    keep = pa > 0.5
    out[yy[keep], xx[keep]] = pix[keep]
    out_a[yy[keep], xx[keep]] = 1.0
    table = table * (1 - out_a)
    if axis == 1:
        out, out_a, table = np.transpose(out, (1, 0, 2)), out_a.T, table.T
    return out, out_a, table


def contact_shadow(alpha):
    s = cv2.GaussianBlur(alpha, (0, 0), 7)
    s = np.roll(np.roll(s, 5, 0), 2, 1) * 0.30
    return s


def fold_frames():
    tex = np.zeros((FH, FW, 3), np.float32)
    al = np.zeros((FH, FW), np.float32)
    # matched to the live-drawn cloth (website/src/sections/clothGL.ts) as it is when the fold takes over
    tex[OY:OY + SH, OX:OX + SW] = np.clip(sheet_texture() * np.array([1.065, 1.019, 0.985], np.float32), 0, 255)
    al[OY:OY + SH, OX:OX + SW] = 1
    frames = []
    # 24 frames a fold (49 in all), so it reads as continuous motion
    n1, n2 = 24, 24
    for i in range(n1 + 1):
        frames.append(fold_once(tex, al, i / n1, 0, r_max=46, r_min=2.5, wave=26))
    mid_tex, mid_a, _ = frames[-1]
    for i in range(1, n2 + 1):
        frames.append(fold_once(mid_tex, mid_a, i / n2, 1, r_max=38, r_min=4.0, wave=18))
    cols = 7
    rows = int(np.ceil(len(frames) / cols))
    sheet = np.zeros((rows * FH, cols * FW, 4), np.float32)
    for k, (rgb, a, tb) in enumerate(frames):
        cs = np.maximum(contact_shadow(a), tb)
        A = np.clip(a + cs * (1 - a), 0, 1)
        col = np.where(a[..., None] > 0, rgb, np.array([60, 36, 20], np.float32))
        r_, c_ = divmod(k, cols)
        sheet[r_ * FH:(r_ + 1) * FH, c_ * FW:(c_ + 1) * FW] = np.dstack([col, A * 255])
    bgra = np.dstack([cv2.cvtColor(np.clip(sheet[..., :3], 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), sheet[..., 3].astype(np.uint8)])
    for name, k in SHEETS.items():
        img = bgra if k == 1 else cv2.resize(bgra, (round(bgra.shape[1] * k), round(bgra.shape[0] * k)), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(OUT, name + ".webp"), img, [cv2.IMWRITE_WEBP_QUALITY, 80])
    # a strip of frames to look at
    pick = [6, 12, 18, 24, 30, 36, 48]
    strip = []
    for k in pick:
        rgb, a, tb = frames[k]
        bg = np.zeros_like(rgb) + np.array([236, 242, 245][::-1], np.float32)
        cs = np.maximum(contact_shadow(a), tb)[..., None]
        bgc = bg * (1 - cs * 0.9)
        strip.append(cv2.cvtColor((rgb * a[..., None] + bgc * (1 - a[..., None])).astype(np.uint8), cv2.COLOR_RGB2BGR))
    cv2.imwrite(os.path.join(WORK, "fold-strip.jpg"), np.hstack([cv2.resize(s, (360, 260)) for s in strip]))
    return dict(frames=len(frames), cols=cols, fw=FW, fh=FH, sw=SW, sh=SH, scales=SHEETS)


def main():
    import sys
    only = sys.argv[1:] or ["washed", "iron", "fold"]  # caustics, foam, bubble: no longer used (the water is live)
    if "washed" in only:
        h = washed_height()
        fabric.save_rgb("washed", fabric.crumple(h), 80)
    if "caustics" in only:
        fabric.save_rgb("caustics", caustics(), 80)
    if "foam" in only:
        f = foam()
        f = cv2.resize(f, (1280, 720), interpolation=cv2.INTER_AREA)
        fabric.save_rgba("foam", f, 76)
    if "bubble" in only:
        fabric.save_rgba("bubble", bubble_sprite(40), 90)
    meta = {}
    if "iron" in only:
        meta["iron"] = iron()
    if "fold" in only:
        meta["fold"] = fold_frames()
    print(json.dumps(meta))
    for f in sorted(os.listdir(OUT)):
        if f.startswith("cloth-"):
            print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")


if __name__ == "__main__":
    main()
