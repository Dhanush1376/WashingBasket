"""Cut the five care illustrations out of their flat orange/yellow backdrops.

The backdrop is not perfectly flat (a soft lighter blob sits behind some figures), so it is modelled per
pixel: seed the pixels close to the corner colour, spread their colour smoothly across the frame, then
measure how far each pixel is from that local backdrop. Edges are un-mixed from the backdrop so no orange
fringe survives on the transparent cut.

  python cutout.py            -> ../website/src/assets/care-<name>.webp (RGBA) + work/cut-sheet.jpg
"""
import os

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "..", "website", "src", "assets")
NAMES = ["collect", "wash", "dry", "iron", "deliver"]
SEED = {"collect": 26, "wash": 24, "dry": 22, "iron": 22, "deliver": 22}
RAMP = {"dry": (4, 9)}   # (start, width) of the alpha ramp; default (7, 16)   # Lab distance that counts as backdrop


def smooth_fill(lab, seed, sigma):
    w = cv2.GaussianBlur(seed, (0, 0), sigma)
    out = np.empty_like(lab)
    for c in range(3):
        out[..., c] = cv2.GaussianBlur(lab[..., c] * seed, (0, 0), sigma) / np.maximum(w, 1e-4)
    return out, w


def cut(name):
    bgr = cv2.imread(os.path.join(ASSETS, f"art-{name}.webp"))
    img = bgr.astype(np.float32)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    corner = np.median(np.concatenate([lab[:20, :20].reshape(-1, 3), lab[:20, -20:].reshape(-1, 3)]), axis=0)
    seed = (np.linalg.norm(lab - corner, axis=2) < SEED[name]).astype(np.float32)
    # keep only backdrop connected to the frame edge, so a figure's own orange is not taken for backdrop
    n, lbl = cv2.connectedComponents(seed.astype(np.uint8), connectivity=4)
    edge = set(np.unique(np.concatenate([lbl[0], lbl[-1], lbl[:, 0], lbl[:, -1]]))) - {0}
    near = np.linalg.norm(lab - corner, axis=2) < 10
    big = [i for i in range(1, n) if (lbl == i).sum() > 4000 and near[lbl == i].mean() > 0.8]
    keep = np.isin(lbl, list(edge | set(big))).astype(np.float32)
    seed = cv2.erode(keep, np.ones((5, 5), np.uint8))
    # local backdrop colour: fine where the backdrop is all round, broad where it has to bridge a figure
    fine, wf = smooth_fill(lab, seed, 12)
    broad, _ = smooth_fill(lab, seed, 60)
    k = np.clip(wf * 3, 0, 1)[..., None]
    bg_lab = fine * k + broad * (1 - k)
    d = np.linalg.norm(lab - bg_lab, axis=2)
    r0, rw = RAMP.get(name, (7, 16))
    a = np.clip((d - r0) / rw, 0, 1)
    a = a * a * (3 - 2 * a)
    # drop specks
    solid = (a > 0.5).astype(np.uint8)
    n, lbl, st, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 60:
            a[lbl == i] = 0
    # holes inside a figure that are not the backdrop's own colour (a pale yellow towel on a yellow ground) are filled
    dc = np.linalg.norm(lab - corner, axis=2)
    clear = (a < 0.5).astype(np.uint8)
    n, lbl, st, _ = cv2.connectedComponentsWithStats(clear, connectivity=4)
    border = set(np.unique(np.concatenate([lbl[0], lbl[-1], lbl[:, 0], lbl[:, -1]])))
    for i in range(1, n):
        if i in border or st[i, cv2.CC_STAT_AREA] > 9000:
            continue
        m = lbl == i
        if np.median(dc[m]) > 12:
            a[m] = 1.0
    a = np.maximum(a, cv2.GaussianBlur((a > 0.99).astype(np.float32), (0, 0), 0.6) * 0)  # keep a as is
    bg_bgr = cv2.cvtColor(np.clip(bg_lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)
    A = a[..., None]
    fg = np.where(A > 0.02, (img - bg_bgr * (1 - A)) / np.maximum(A, 0.02), img)
    fg = np.clip(fg, 0, 255)
    # the soft ground shadows painted in the backdrop's colour become neutral shadows on whatever is behind
    fg_lab = cv2.cvtColor(fg.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    tinted = (np.linalg.norm(lab - bg_lab, axis=2) < 45) & (a < 0.999) & (a > 0) & (lab[..., 0] <= bg_lab[..., 0] + 4)
    fg[tinted] = (52, 34, 22)
    a = np.where(tinted, a * 0.4, a)
    A = a[..., None]
    rgba = np.dstack([fg, a * 255]).astype(np.uint8)
    cv2.imwrite(os.path.join(ASSETS, f"care-{name}.webp"), rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
    return rgba


def main():
    tiles = []
    for nm in NAMES:
        rgba = cut(nm).astype(np.float32)
        A = rgba[..., 3:] / 255
        chk = np.zeros_like(rgba[..., :3])
        chk[:] = (150, 110, 60)   # a mid blue-grey check backdrop (BGR)
        yy, xx = np.mgrid[:chk.shape[0], :chk.shape[1]]
        chk[((yy // 40 + xx // 40) % 2) == 0] = (205, 170, 120)
        comp = rgba[..., :3] * A + chk * (1 - A)
        tiles.append(cv2.resize(comp.astype(np.uint8), (330, 361)))
    cv2.imwrite(os.path.join(ROOT, "work", "cut-sheet.jpg"), np.hstack(tiles))
    print("ok")


if __name__ == "__main__":
    main()
