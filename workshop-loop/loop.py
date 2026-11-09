"""Washing Basket — the workshop, alive. A 4 s seamless loop made from
`../Bright Laundry Workplace Illustration.png` with the same method as ../hero-loop:

  * nothing is redrawn: every frame is the original artwork, gently displaced;
  * handles: small areas (hands + the thing they hold) move about a rigid core, with a smooth falloff,
    so faces, hands and props keep their exact shape and only the space between parts flexes;
  * bodies breathe and lean from the feet; cloth and plants sway from where they hang or grow;
  * soft steam rolls up from the iron; the machine displays pulse.

Every motion repeats a whole number of times in 4 s, so the last frame runs straight into the first.
The white paper is keyed out and the room is set on the site's ivory, so the video sits on the page
with no box around it.

  python loop.py still 1.0      -> work/still.png
  python loop.py debug          -> work/debug.png (handles drawn)
  python loop.py sheet          -> work/sheet.jpg
  python loop.py render         -> dist/workshop-loop.mp4 (+ .webm, poster)
"""
import math
import os
import subprocess
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "..", "Bright Laundry Workplace Illustration.png")
FPS, DUR = 30, 4.0
NFR = int(FPS * DUR)
TAU = 2 * math.pi
CROP_Y = 140                      # empty paper above the room
OUT_W = 1920
IVORY = np.array([236, 242, 245], np.float32)   # #f5f2ec in BGR, the page behind the video


def sm(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


from people import PEOPLE, PROPS, HANDLES, SWAY, IRON_X, glide, S, C   # noqa: E402

DISPLAYS = [(120, 236, 194, 276, 0.0), (2018, 244, 2092, 282, 0.5)]   # x0, y0, x1, y1, phase
IRON_STEAM = (1346, 506)   # the heel of the iron: steam drifts off it to the right, over the light shelves


class Room:
    def __init__(self):
        img = cv2.imread(SRC)
        assert img is not None, SRC
        self.H, self.W = img.shape[:2]
        self.img = img.astype(np.float32)
        gx, gy = np.meshgrid(np.arange(self.W, dtype=np.float32), np.arange(self.H, dtype=np.float32))
        self.gx, self.gy = gx, gy
        st = 4
        self.st = st
        self.cgx, self.cgy = np.meshgrid(np.arange(0, self.W + st, st, dtype=np.float32),
                                         np.arange(0, self.H + st, st, dtype=np.float32))
        self.build_masks()
        self.fog = [self.fog_sprite(r, s) for r, s in ((26, 3), (34, 7), (22, 11))]

    @staticmethod
    def fog_sprite(r, seed):
        """A soft cloud: a few overlapping round blobs, heavily feathered (alpha only)."""
        rng = np.random.default_rng(seed)
        n = 2 * r + 24
        a = np.zeros((n * 2, n * 2), np.float32)
        for _ in range(5):
            cx = n + rng.uniform(-r * .45, r * .45)
            cy = n + rng.uniform(-r * .35, r * .35)
            rr = r * rng.uniform(.55, .85)
            cv2.circle(a, (int(cx * 2 / 2) , int(cy)), int(rr), 1.0, -1, cv2.LINE_AA)
        a = cv2.GaussianBlur(a, (0, 0), r * .55)
        a = a / max(a.max(), 1e-6)
        a = cv2.resize(a, (n, n), interpolation=cv2.INTER_AREA)
        return a

    # -- masks: where motion is allowed ---------------------------------------------------
    def build_masks(self):
        H, W = self.H, self.W

        def feather(m, grow=2, soft=2.5):
            if grow:
                m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
            return cv2.GaussianBlur(m, (0, 0), soft)

        self.pmask = []
        for p in PEOPLE:
            m = np.zeros((H, W), np.float32)
            cv2.fillPoly(m, [np.array(p["poly"], np.int32)], 1.0, cv2.LINE_AA)
            self.pmask.append(feather(m))
        props = np.zeros((H, W), np.float32)
        for poly in PROPS:
            cv2.fillPoly(props, [np.array(poly, np.int32)], 1.0, cv2.LINE_AA)
        hsv = cv2.cvtColor(self.img.astype(np.uint8), cv2.COLOR_BGR2HSV)
        green = ((hsv[..., 0] >= 30) & (hsv[..., 0] <= 90) & (hsv[..., 1] > 70) & (hsv[..., 2] > 50)).astype(np.float32)
        self.green = feather(green, grow=2, soft=1.5)
        people = np.max(np.stack(self.pmask), axis=0)
        self.move = np.clip(np.maximum(people, feather(props)), 0, 1)

    # -- motion field ---------------------------------------------------------------------
    def up(self, A):
        st = self.st
        return cv2.resize(A, (A.shape[1] * st, A.shape[0] * st), interpolation=cv2.INTER_LINEAR)[:self.H, :self.W]

    def field(self, u):
        X, Y = self.cgx, self.cgy
        DX = np.zeros((self.H, self.W), np.float32)
        DY = np.zeros_like(DX)
        # each upper body leans and breathes about its waist, and the head nods; only inside its own outline
        for p, m in zip(PEOPLE, self.pmask):
            k = np.clip((p["waist"] - Y) / (p["waist"] - p["top"]), 0, 1) ** 1.2
            bx = k * p["lean"](u)
            by = -k * p["breath"](u)
            hx, hy = p["head"]
            dx, dy, deg = p["nod"](u)
            dist = np.hypot(X - hx, Y - hy)
            w = sm(1 - (dist - 34) / (70 - 34))
            a = math.radians(deg)
            ca, sa = math.cos(a), math.sin(a)
            bx = bx + w * (hx + ca * (X - hx) - sa * (Y - hy) + dx - X)
            by = by + w * (hy + sa * (X - hx) + ca * (Y - hy) + dy - Y)
            DX += self.up(bx.astype(np.float32)) * m
            DY += self.up(by.astype(np.float32)) * m
        hx_ = np.zeros_like(X)
        hy_ = np.zeros_like(X)
        for h in HANDLES:
            cx, cy = h["c"]
            sx, sy = h.get("asp", (1.0, 1.0))
            dist = np.hypot((X - cx) / sx, (Y - cy) / sy)
            w = sm(1 - (dist - h["r0"]) / (h["r1"] - h["r0"]))
            if "ymax" in h:
                w = w * sm((h["ymax"] - Y) / 8.0)
            dx, dy, deg = h["f"](u)
            a = math.radians(deg)
            ca, sa = math.cos(a), math.sin(a)
            hx_ += w * (cx + ca * (X - cx) - sa * (Y - cy) + dx - X)
            hy_ += w * (cy + sa * (X - cx) + ca * (Y - cy) + dy - Y)
        DX += self.up(hx_) * self.move
        DY += self.up(hy_) * self.move
        sx_ = np.zeros_like(X)
        sy_ = np.zeros_like(X)
        gx_ = np.zeros_like(X)
        gy_ = np.zeros_like(X)
        for s in SWAY:
            x0, y0, x1, y1 = s["box"]
            fb = 14.0
            wx = sm((X - x0) / fb + .5) * sm((x1 - X) / fb + .5)
            wy = sm((Y - y0) / fb + .5) * sm((y1 - Y) / fb + .5)
            if "bottom" in s:
                depth = np.clip((s["bottom"] - Y) / (s["bottom"] - y0), 0, 1)
            else:
                depth = np.clip((Y - s["top"]) / (y1 - s["top"]), 0, 1)
            ph = TAU * (u / s["period"] + s["phase"])
            ddx = wx * wy * s["amp"] * depth ** 1.3 * np.sin(ph - depth * 1.1)
            ddy = wx * wy * (-0.3) * s["amp"] * depth ** 2 * (0.5 - 0.5 * np.cos(2 * ph))
            if s["green"]:
                gx_ += ddx
                gy_ += ddy
            else:
                sx_ += ddx
                sy_ += ddy
        DX += self.up(sx_) * self.move + self.up(gx_) * self.green
        DY += self.up(sy_) * self.move + self.up(gy_) * self.green
        return DX, DY

    def warp(self, u):
        DX, DY = self.field(u)
        return cv2.remap(self.img, self.gx - DX, self.gy - DY, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)

    # -- the room set on the page's ivory --------------------------------------------------
    @staticmethod
    def on_ivory(img):
        m = img.min(axis=2)
        a = np.clip((250 - m) / 22, 0, 1)[..., None]
        ink = np.where(a > 0, (img - 255 * (1 - a)) / np.maximum(a, 1e-3), img)
        return np.clip(ink, 0, 255) * a + IVORY * (1 - a)

    def displays(self, img, u):
        for x0, y0, x1, y1, ph in DISPLAYS:
            g = 0.5 + 0.5 * math.sin(TAU * (u / 1.0 + ph))
            roi = img[y0:y1, x0:x1]
            bright = roi.mean(axis=2, keepdims=True) > 150  # only the lit readouts and buttons
            img[y0:y1, x0:x1] = np.where(bright, np.clip(roi * (0.9 + 0.16 * g), 0, 255), roi)

    def steam(self, img, u):
        """Soft puffs roll up off the iron (they follow it along the board), drift and fade."""
        ix = IRON_STEAM[0] + IRON_X(u)
        for k in range(6):
            life = 1.6
            t = (u / life + k / 6.0) % 1.0           # 6 puffs in flight, staggered, seamless over 4 s
            spr = self.fog[k % 3]
            n = spr.shape[0]
            cx = ix + 6 + 46 * t + 6 * math.sin(TAU * (t * 0.8 + k * .37)) + (k % 3 - 1) * 5
            cy = IRON_STEAM[1] - 6 - t * 62
            sc = 0.32 + 0.55 * t
            alpha = 0.34 * math.sin(math.pi * t) ** 1.4
            s = cv2.resize(spr, (max(2, int(n * sc)), max(2, int(n * sc))), interpolation=cv2.INTER_LINEAR)
            h, w = s.shape
            x0, y0 = int(cx - w / 2), int(cy - h / 2)
            xa, ya, xb, yb = max(0, x0), max(0, y0), min(self.W, x0 + w), min(self.H, y0 + h)
            if xb <= xa or yb <= ya:
                continue
            a = (s[ya - y0:yb - y0, xa - x0:xb - x0] * alpha)[..., None]
            tint = np.array([250, 249, 248], np.float32)
            img[ya:yb, xa:xb] = img[ya:yb, xa:xb] * (1 - a) + tint * a

    def frame(self, u):
        img = self.warp(u)
        self.displays(img, u)
        img = self.on_ivory(img)
        # steam is drawn over the page, a shade lighter than it, so it reads as vapour
        self.steam(img, u)
        img = img[CROP_Y:]
        h = int(round(img.shape[0] * OUT_W / img.shape[1] / 2) * 2)
        return cv2.resize(img, (OUT_W, h), interpolation=cv2.INTER_AREA)


def out8(f):
    return np.clip(f + 0.5, 0, 255).astype(np.uint8)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "sheet"
    os.makedirs(os.path.join(ROOT, "work"), exist_ok=True)
    room = Room()
    if cmd == "still":
        cv2.imwrite(os.path.join(ROOT, "work", "still.png"), out8(room.frame(float(sys.argv[2]))))
    elif cmd == "debug":
        m = np.maximum(room.move, room.green)
        cv2.imwrite(os.path.join(ROOT, "work", "mask.png"), (m * 255).astype(np.uint8))
        # how far each pixel ever travels over the loop
        mx = np.zeros((room.H, room.W), np.float32)
        for i in range(0, NFR, 6):
            DX, DY = room.field(i / FPS)
            mx = np.maximum(mx, np.hypot(DX, DY))
        cv2.imwrite(os.path.join(ROOT, "work", "travel.png"), np.clip(mx * 40, 0, 255).astype(np.uint8))
        print("max travel", mx.max())
    elif cmd == "sheet":
        ts = [float(x) for x in sys.argv[2:]] or [i * DUR / 8 for i in range(8)]
        tiles = []
        for t in ts:
            tile = cv2.resize(out8(room.frame(t)), (960, 258), interpolation=cv2.INTER_AREA)
            cv2.putText(tile, f"{t:.2f}", (8, 22), 0, 0.6, (0, 0, 200), 2)
            tiles.append(tile)
        cv2.imwrite(os.path.join(ROOT, "work", "sheet.jpg"), np.vstack(tiles), [cv2.IMWRITE_JPEG_QUALITY, 88])
    elif cmd == "crop":   # python loop.py crop x0 y0 x1 y1 t1 t2 ...  (source px) -> work/crop.png
        x0, y0, x1, y1 = (int(v) for v in sys.argv[2:6])
        ts = [float(v) for v in sys.argv[6:]]
        sc = OUT_W / room.W
        tiles = []
        for t in ts:
            f = out8(room.frame(t))
            c = f[int((y0 - CROP_Y) * sc):int((y1 - CROP_Y) * sc), int(x0 * sc):int(x1 * sc)]
            c = cv2.resize(c, (c.shape[1] * 2, c.shape[0] * 2), interpolation=cv2.INTER_CUBIC)
            cv2.putText(c, f"{t:.2f}", (6, 20), 0, 0.6, (0, 0, 200), 2)
            tiles.append(c)
        cv2.imwrite(os.path.join(ROOT, "work", "crop.png"), np.hstack(tiles))
    elif cmd == "render":
        import imageio_ffmpeg
        ff = imageio_ffmpeg.get_ffmpeg_exe()
        dist = os.path.join(ROOT, "dist")
        os.makedirs(dist, exist_ok=True)
        first = out8(room.frame(0.0))
        H, W = first.shape[:2]
        p = subprocess.Popen(
            [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
             "-i", "-",
             "-map", "0:v", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high",
             "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709",
             "-color_trc", "bt709", "-g", "120", "-movflags", "+faststart", "-an",
             os.path.join(dist, "workshop-loop.mp4"),
             "-map", "0:v", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1", "-pix_fmt", "yuv420p",
             "-an", os.path.join(dist, "workshop-loop.webm")],
            stdin=subprocess.PIPE)
        for n in range(NFR):
            p.stdin.write((first if n == 0 else out8(room.frame(n / FPS))).tobytes())
            if n % 30 == 0:
                print(f"frame {n}/{NFR}", flush=True)
        p.stdin.close()
        p.wait()
        cv2.imwrite(os.path.join(dist, "workshop-loop-poster.jpg"), first, [cv2.IMWRITE_JPEG_QUALITY, 90])
        print("done", W, H)


if __name__ == "__main__":
    main()
