"""The cloth behind the Care section: one plain-woven cotton, and what happens to it on its way through.

  weave   a seamless tile of the cloth itself: warp and weft threads crossing over and under, each thread
          a little different in thickness and tone, slubs along their length and a light fuzz of fibres
  crumple the light and shade of a crumpled piece of that cloth (grey, 128 = flat; blended as overlay)
  dirt    stains, grime settled into the creases and specks (colour + alpha; multiplied)
  wet     the sheen of wet cotton on the creases and beads of water (colour + alpha)
  sun     warm window light falling across the cloth (on black; blended as screen)

  python fabric.py         -> ../website/src/assets/cloth-*.webp and work/preview-*.jpg
"""
import os

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "..", "website", "src", "assets")
WORK = os.path.join(ROOT, "work")
W, H = 1600, 900
rng = np.random.default_rng(7)

# the cloth: a soft apricot cotton, close to the section's old peach, dark navy type stays easy to read on it
BASE = np.array([242, 212, 192], np.float32)     # RGB, the colour of the cloth from a step back
TOP = np.array([249, 224, 206], np.float32)      # the lit crown of a thread
DEEP = np.array([224, 190, 169], np.float32)     # down between threads


def periodic_noise(n, scale, seed, aniso=(1.0, 1.0)):
    """Seamless noise on an n x n torus: random spectrum, band-limited around `scale` px."""
    r = np.random.default_rng(seed)
    fx = np.fft.fftfreq(n)[None, :] * aniso[0]
    fy = np.fft.fftfreq(n)[:, None] * aniso[1]
    f = np.sqrt(fx * fx + fy * fy) + 1e-9
    spec = np.exp(-((f * scale) ** 2)) * (r.normal(size=(n, n)) + 1j * r.normal(size=(n, n)))
    spec[0, 0] = 0
    out = np.real(np.fft.ifft2(spec))
    return out / (out.std() + 1e-9)


def noise(h, w, scale, seed, octaves=4):
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    s = scale
    for _ in range(octaves):
        g = r.normal(size=(int(h / s) + 3, int(w / s) + 3)).astype(np.float32)
        acc += amp * cv2.resize(g, (w, h), interpolation=cv2.INTER_CUBIC)
        tot += amp
        amp *= 0.5
        s /= 2
        s = max(s, 1.5)
    return acc / tot


# ------------------------------------------------------------------------------------------------
# weave tile
# ------------------------------------------------------------------------------------------------
def weave(n=512, pitch=8):
    k = n // pitch                                  # threads each way
    y, x = np.mgrid[:n, :n].astype(np.float32)
    # each thread wanders a touch and varies in thickness and tone (all periodic, so the tile repeats)
    wob_x = periodic_noise(n, 90, 1, (0.15, 1.0)) * 0.55     # warp threads drift sideways along their length
    wob_y = periodic_noise(n, 90, 2, (1.0, 0.15)) * 0.55
    xs = x + wob_x
    ys = y + wob_y
    ci = np.floor(xs / pitch).astype(int) % k        # warp index
    ri = np.floor(ys / pitch).astype(int) % k        # weft index
    u = (xs / pitch) % 1.0 - 0.5                     # across a warp thread, -0.5..0.5
    v = (ys / pitch) % 1.0 - 0.5                     # across a weft thread
    r = np.random.default_rng(3)
    warp_w = 0.78 + 0.12 * r.random(k)               # each thread's own thickness
    weft_w = 0.78 + 0.12 * r.random(k)
    warp_t = r.normal(0, 1, k)                       # and tone
    weft_t = r.normal(0, 1, k)
    # slubs: thicker, lighter runs along a thread
    slub_x = np.maximum(0, periodic_noise(n, 26, 4, (0.08, 1.0))) * 0.10
    slub_y = np.maximum(0, periodic_noise(n, 26, 5, (1.0, 0.08))) * 0.10
    ww = warp_w[ci] + slub_x
    fw = weft_w[ri] + slub_y
    # height of each thread: a rounded profile across it, and along it the rise and dip over/under its partner
    over = ((ci + ri) % 2 == 0)                       # warp on top at this crossing
    prof_warp = np.clip(1 - (np.abs(u) / (ww / 2)) ** 2, 0, 1) ** 0.5
    prof_weft = np.clip(1 - (np.abs(v) / (fw / 2)) ** 2, 0, 1) ** 0.5
    bulge_warp = np.cos(np.pi * v) * 0.5 + 0.5        # highest mid-crossing
    bulge_weft = np.cos(np.pi * u) * 0.5 + 0.5
    hw = prof_warp * (0.55 + 0.45 * np.where(over, bulge_warp, 1 - bulge_warp))
    hf = prof_weft * (0.55 + 0.45 * np.where(over, 1 - bulge_weft, bulge_weft))
    h = np.maximum(np.where(over, hw * 1.0, hw * 0.8), np.where(over, hf * 0.8, hf * 1.0))
    tone = np.where(hw >= hf, warp_t[ci], weft_t[ri])
    # fibre fuzz along each thread's own direction
    fuzz_w = periodic_noise(n, 1.2, 6, (0.12, 1.0))
    fuzz_f = periodic_noise(n, 1.2, 7, (1.0, 0.12))
    fuzz = np.where(hw >= hf, fuzz_w, fuzz_f)
    # light from the top left on the thread surface
    gy, gx = np.gradient(h)
    lit = np.clip(0.5 - 1.6 * gx - 1.6 * gy, 0, 1)
    t = np.clip(0.18 + 0.82 * h, 0, 1)
    col = DEEP[None, None] + (TOP - DEEP)[None, None] * (t[..., None] * 0.75 + lit[..., None] * 0.25)
    col = col * (1 + 0.010 * tone[..., None] + 0.035 * fuzz[..., None])
    # a few loose fibres lying across the surface
    img = col.copy()
    fib = np.zeros((n, n), np.float32)
    for _ in range(26):
        x0, y0 = r.uniform(0, n, 2)
        ang = r.uniform(0, np.pi)
        L = r.uniform(18, 60)
        bend = r.uniform(-0.04, 0.04)
        pts = []
        for s in np.linspace(0, L, 24):
            a = ang + bend * s
            pts.append((x0 + np.cos(a) * s, y0 + np.sin(a) * s))
        pts = np.array(pts)
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                p = (pts + [ox, oy]) * 4
                cv2.polylines(fib, [p.astype(np.int32)], False, 1.0, 1, cv2.LINE_AA, shift=2)
    fib = cv2.GaussianBlur(fib, (0, 0), 0.4) * 0.5
    img = img * (1 - fib[..., None]) + (TOP * 1.02)[None, None] * fib[..., None]
    return np.clip(img, 0, 255)


# ------------------------------------------------------------------------------------------------
# a crumpled piece of it
# ------------------------------------------------------------------------------------------------
def crumple_height():
    """Crumpled cotton: a network of soft, curving ridges (ridged noise, warped so nothing runs straight),
    a few longer sharper creases where it was squashed hardest, all on top of the cloth's broad folds."""
    y, x = np.mgrid[:H, :W].astype(np.float32)
    # warp the space so ridges bend and wander like real fabric
    wx = 70 * noise(H, W, 300, 41, 2)
    wy = 70 * noise(H, W, 300, 42, 2)
    xs, ys = (x + wx).astype(np.float32), (y + wy).astype(np.float32)
    h = np.zeros((H, W), np.float32)
    for scale, amp, seed, _stretch in ((230, 22, 51, 1.6), (120, 11, 52, 1.4), (62, 5, 53, 1.2)):
        n = noise(H, W, scale, seed, 1)
        ridge = np.clip(1 - np.abs(n) / 1.6, 0, 1)
        h += amp * ridge ** 2.2
    # resample everything through the warp (one pass)
    h = cv2.remap(h, np.clip(xs, 0, W - 1), np.clip(ys, 0, H - 1), cv2.INTER_LINEAR)
    # broad folds
    h += 30 * noise(H, W, 520, 54, 2)
    # a handful of longer creases, curved, sharp in the middle and fading out at the ends
    for i in range(16):
        cx, cy = rng.uniform(0, W), rng.uniform(0, H)
        ang = rng.uniform(0, np.pi)
        L = rng.uniform(260, 700)
        w = rng.uniform(5, 11)
        depth = rng.choice([-1, 1]) * rng.uniform(5, 10)
        bend = rng.normal(0, 60)
        X, Y = x - cx, y - cy
        ca, sa = np.cos(ang), np.sin(ang)
        along = X * ca + Y * sa
        across = -X * sa + Y * ca + bend * (along / L) ** 2
        taper = np.clip(1 - (np.abs(along) / (L / 2)) ** 2, 0, 1) ** 2
        h += depth * np.exp(-np.abs(across) / w) * taper
    h += 0.9 * noise(H, W, 18, 55, 2)
    return cv2.GaussianBlur(h, (0, 0), 1.6)


def lighting(h):
    gy, gx = np.gradient(h)
    nz = 1.0 / np.sqrt(gx * gx + gy * gy + 1)
    nx, ny = -gx * nz, -gy * nz
    L = np.array([-0.45, -0.55, 0.70])
    L = L / np.linalg.norm(L)
    lam = nx * L[0] + ny * L[1] + nz * L[2]
    ao = np.clip(cv2.GaussianBlur(h, (0, 0), 18) - h, 0, None)
    return nx, ny, nz, lam, ao, L


def crumple(h):
    nx, ny, nz, lam, ao, L = lighting(h)
    shade = (lam - L[2]) * 1.35 - ao * 0.006
    g = np.clip(128 + 128 * shade, 0, 255)
    return np.dstack([g, g, g])


def dirt(h):
    _, _, _, _, ao, _ = lighting(h)
    a = np.zeros((H, W), np.float32)
    col = np.zeros((H, W, 3), np.float32)
    brown = np.array([132, 92, 52], np.float32)        # RGB, tea and mud
    grey = np.array([128, 112, 98], np.float32)
    # grime settled in the creases, and a general dullness
    grime = np.clip(ao * 0.06, 0, 1) * (0.55 + 0.45 * noise(H, W, 140, 21, 3))
    a += 0.13 + 0.42 * grime
    col += grey * 1
    # stains: soft blotches with a darker tide-line round the edge
    y, x = np.mgrid[:H, :W].astype(np.float32)
    for i in range(11):
        cx, cy = rng.uniform(0, W), rng.uniform(0, H)
        rx, ry = rng.uniform(45, 150), rng.uniform(35, 110)
        ang = rng.uniform(0, np.pi)
        X, Y = x - cx, y - cy
        ca, sa = np.cos(ang), np.sin(ang)
        d = np.sqrt(((X * ca + Y * sa) / rx) ** 2 + ((-X * sa + Y * ca) / ry) ** 2)
        d = d + 0.35 * noise(H, W, 60, 30 + i, 3)
        m = np.clip((1 - d) / 0.45, 0, 1) ** 1.4 * (0.6 + 0.4 * np.clip(noise(H, W, 24, 60 + i, 2) * 0.5 + 0.5, 0, 1))
        rim = np.clip(1 - np.abs(d - 0.97) / 0.05, 0, 1) * (0.5 + 0.5 * np.clip(noise(H, W, 30, 70 + i, 2), 0, 1))
        strength = rng.uniform(0.18, 0.32)
        sa_ = m * strength + rim * strength * 1.4
        tint = brown * rng.uniform(0.85, 1.15)
        col = col * (1 - sa_[..., None]) + tint[None, None] * sa_[..., None]
        a = np.maximum(a, a + sa_ * (1 - a))
    # specks of dust and lint
    sp = np.zeros((H, W), np.float32)
    for _ in range(1100):
        cv2.circle(sp, (int(rng.uniform(0, W) * 4), int(rng.uniform(0, H) * 4)), int(rng.uniform(1, 6)), rng.uniform(0.3, 0.8), -1, cv2.LINE_AA, shift=2)
    sp = cv2.GaussianBlur(sp, (0, 0), 0.5)
    col = col * (1 - sp[..., None]) + np.array([70, 58, 48], np.float32)[None, None] * sp[..., None]
    a = np.maximum(a, sp * 0.8)
    return np.dstack([col, np.clip(a, 0, 1) * 255])


def wet(h):
    nx, ny, nz, lam, ao, L = lighting(h)
    V = np.array([0, 0, 1.0])
    Hv = (L + V) / np.linalg.norm(L + V)
    spec = np.clip(nx * Hv[0] + ny * Hv[1] + nz * Hv[2], 0, 1) ** 28
    spec = cv2.GaussianBlur(spec, (0, 0), 1.6)
    a = np.clip(spec * 0.42, 0, 0.38)
    col = np.zeros((H, W, 3), np.float32) + 255
    # beads of water: a dark lower edge, a bright pin of light near the top, a faint lens of brightness
    for _ in range(70):
        cx, cy = rng.uniform(0, W), rng.uniform(0, H)
        r = rng.uniform(2.5, 7) * (1.6 if rng.random() < 0.12 else 1)
        x0, x1 = int(cx - r * 2), int(cx + r * 2) + 1
        y0, y1 = int(cy - r * 2), int(cy + r * 2) + 1
        if x0 < 0 or y0 < 0 or x1 >= W or y1 >= H:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        d = np.sqrt(((xx - cx) / r) ** 2 + ((yy - cy) / (r * 0.9)) ** 2)
        inside = np.clip((1 - d) / 0.12, 0, 1)
        shadow = np.clip(1 - np.abs(d - 0.92) / 0.18, 0, 1) * np.clip((yy - cy) / r + 0.3, 0, 1)
        pin = np.exp(-(((xx - (cx - r * 0.35)) ** 2 + (yy - (cy - r * 0.38)) ** 2) / (2 * (r * 0.17) ** 2)))
        lens = inside * 0.18
        blk = col[y0:y1, x0:x1]
        aa = a[y0:y1, x0:x1]
        # shadow: dark, mostly opaque at the rim
        s_a = shadow * 0.45
        blk[:] = blk * (1 - s_a[..., None]) + np.array([120, 70, 45], np.float32) * s_a[..., None]
        aa[:] = np.maximum(aa, s_a)
        l_a = np.clip(lens + pin * 0.95, 0, 1)
        blk[:] = blk * (1 - l_a[..., None]) + 255 * l_a[..., None]
        aa[:] = np.maximum(aa, l_a)
    return np.dstack([col, a * 255])


def sun():
    y, x = np.mgrid[:H, :W].astype(np.float32)
    ang = np.radians(-32)
    along = x * np.cos(ang) + y * np.sin(ang)
    across = -x * np.sin(ang) + y * np.cos(ang)
    light = np.zeros((H, W), np.float32)
    # three panes of a window, the light thrown across the cloth
    for c, wdt, k in ((420, 170, 1.0), (640, 150, 0.85), (850, 120, 0.6)):
        light += k * np.clip(1 - np.abs(across - c + 0.0) / (wdt / 2), 0, 1) ** 0.6
    # the window bars inside the beams
    bars = (np.abs(((along + 40) % 260) - 130) < 9).astype(np.float32)
    light *= 1 - 0.75 * cv2.GaussianBlur(bars, (0, 0), 6)
    light = cv2.GaussianBlur(light, (0, 0), 22)
    light *= np.clip(1 - along / 2100, 0, 1)
    warm = np.array([255, 214, 160], np.float32)        # RGB
    img = light[..., None] * warm[None, None] * 0.9
    return np.clip(img, 0, 255)


def save_rgb(name, rgb, q=86):
    cv2.imwrite(os.path.join(OUT, f"cloth-{name}.webp"), cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_WEBP_QUALITY, q])


def save_rgba(name, rgba, q=86):
    bgra = np.dstack([cv2.cvtColor(rgba[..., :3].astype(np.uint8), cv2.COLOR_RGB2BGR), rgba[..., 3].astype(np.uint8)])
    cv2.imwrite(os.path.join(OUT, f"cloth-{name}.webp"), bgra, [cv2.IMWRITE_WEBP_QUALITY, q])


def preview(wv, cr, di):
    """What each step looks like, approximated with the CSS blends, for checking."""
    tile = np.tile(cv2.resize(wv, (256, 256), interpolation=cv2.INTER_AREA), (H // 256 + 1, W // 256 + 1, 1))[:H, :W]
    base = tile / 255

    def overlay(b, o, k=1.0):
        # soft-light (W3C), as the page blends it
        dd = np.where(b <= 0.25, ((16 * b - 12) * b + 4) * b, np.sqrt(b))
        r = np.where(o <= 0.5, b - (1 - 2 * o) * b * (1 - b), b + (2 * o - 1) * (dd - b))
        return b * (1 - k) + r * k

    o = cr / 255
    crum = overlay(base, o)
    out = {}
    d = di[..., :3] / 255
    da = di[..., 3:] / 255
    out["collect"] = crum * (1 - da) + crum * d * da
    out["iron"] = base
    for k, v in out.items():
        cv2.imwrite(os.path.join(WORK, f"preview-{k}.jpg"), cv2.cvtColor((np.clip(v, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])


def main():
    os.makedirs(WORK, exist_ok=True)
    wv = weave()
    save_rgb("weave", wv, 90)
    h = crumple_height()
    cr = crumple(h)
    save_rgb("crumple", cr, 80)
    di = dirt(h)
    save_rgba("dirt", di, 80)
    # wet and sun are no longer used: the water and the drying are drawn live (website/src/sections/clothGL.ts)
    preview(wv, cr, di)
    for f in sorted(os.listdir(OUT)):
        if f.startswith("cloth-"):
            print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")


if __name__ == "__main__":
    main()
