"""Cut-out actions for the scenes that need real movement (handing over, pegging, folding, delivering).

Pieces of the original artwork (the bag, a forearm, a shirt, a person) are lifted as RGBA layers.
Anything a piece used to hide is rebuilt from that piece's own pixels (the bag's knot under her
fingers, the shirt behind an arm), and the plate behind the pieces is repaired, mostly with the flat
background colour. Each frame the layers are drawn back on the plate with rigid transforms
(translate / rotate about a joint), so no face or hand is ever bent.
"""
import math

import cv2
import numpy as np

TAU = 2 * math.pi


# ---------------------------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------------------------

def sm(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def ramp(u, a, b):
    """0 before a, eased 0..1 between a and b, 1 after b."""
    return sm((u - a) / (b - a))


def back(u, a, b, over=0.12):
    """Ease-out with a small overshoot (settles like a real object)."""
    p = min(max((u - a) / (b - a), 0.0), 1.0)
    c = 1.70158 * over / 0.1
    return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2


def poly(shape, pts, feather=0.0):
    m = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 255, cv2.LINE_AA)
    m = m.astype(np.float32) / 255
    if feather:
        m = cv2.GaussianBlur(m, (0, 0), feather)
    return m


def not_bg(img, bg, lo=14.0, hi=46.0):
    d = np.linalg.norm(img.astype(np.float32) - bg, axis=2)
    return np.clip((d - lo) / (hi - lo), 0, 1)


def hsv_mask(img, lo, hi):
    hsv = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV)
    return cv2.inRange(hsv, np.array(lo, np.uint8), np.array(hi, np.uint8)).astype(np.float32) / 255


def grow(m, px):
    if px <= 0:
        return m
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * px + 1, 2 * px + 1))
    return cv2.dilate(m, k)


def M3(m):
    return np.vstack([m, [0, 0, 1]])


def T(dx, dy):
    return np.array([[1, 0, dx], [0, 1, dy], [0, 0, 1]], np.float64)


def R(pivot, deg):
    """Rotate about pivot; positive = clockwise on screen."""
    return M3(cv2.getRotationMatrix2D((float(pivot[0]), float(pivot[1])), -deg, 1.0))


def Sc(pivot, sx, sy):
    px, py = pivot
    return np.array([[sx, 0, px - sx * px], [0, sy, py - sy * py], [0, 0, 1]], np.float64)


def apply(M, p):
    v = M @ np.array([p[0], p[1], 1.0])
    return float(v[0]), float(v[1])


def fill_bg(plate, mask, bg):
    m = mask[..., None]
    plate[:] = plate * (1 - m) + bg * m


def inpaint(img, mask, r=5):
    m = (mask > 0.02).astype(np.uint8)
    u8 = np.clip(img + 0.5, 0, 255).astype(np.uint8)
    return cv2.inpaint(u8, m, r, cv2.INPAINT_TELEA).astype(np.float32)


def fill_rows(rgb, known):
    """Fill unknown pixels from the nearest known pixel in the same row. Folded cloth and stacks are
    horizontal bands, so this rebuilds them cleanly (no smudge across the bands)."""
    out = rgb.copy()
    h, w = known.shape
    xs = np.arange(w)
    for y in range(h):
        k = np.nonzero(known[y])[0]
        if not len(k):
            continue
        j = np.clip(np.searchsorted(k, xs), 1, len(k) - 1) if len(k) > 1 else np.zeros(w, int)
        if len(k) > 1:
            left, right = k[j - 1], k[j]
            near = np.where(np.abs(xs - left) <= np.abs(right - xs), left, right)
        else:
            near = np.full(w, k[0])
        unk = ~known[y]
        out[y, unk] = rgb[y, near[unk]]
    return out


class Cut:
    """An RGBA piece of the artwork, kept as a crop. `hole` = area hidden in the artwork that the
    piece should own; it is rebuilt from the piece's own visible pixels."""

    def __init__(self, img, alpha, hole=None, pad=8, hole_rgb=None, rows=False):
        A = alpha if hole is None else np.maximum(alpha, hole)
        ys, xs = np.nonzero(A > 0.02)
        H, W = A.shape
        self.x0, self.y0 = max(xs.min() - pad, 0), max(ys.min() - pad, 0)
        self.x1, self.y1 = min(xs.max() + pad + 1, W), min(ys.max() + pad + 1, H)
        sl = (slice(self.y0, self.y1), slice(self.x0, self.x1))
        rgb = img[sl].astype(np.float32)
        if hole is not None:
            known = (alpha[sl] > 0.6) & (hole[sl] < 0.05)
            if rows:
                # skip a margin round the hole: it holds the outline of whatever covered it
                known &= grow(hole[sl], 3) < 0.05
                rgb = fill_rows(rgb, known)
                rgb = cv2.GaussianBlur(rgb, (0, 0), 0.6) * (hole[sl][..., None] > 0.05) +                     rgb * (hole[sl][..., None] <= 0.05)
            else:
                rgb = inpaint(rgb, (~known).astype(np.float32), 4)
            if hole_rgb is not None:  # a flat fill reads cleaner than a smudge on plain surfaces
                hm = cv2.GaussianBlur(hole[sl], (0, 0), 2.5)[..., None]
                rgb = rgb * (1 - hm) + np.asarray(hole_rgb, np.float32) * hm
        else:
            # extend edge colours outward so the anti-aliased fringe never picks up the plate colour
            known = alpha[sl] > 0.6
            rgb = inpaint(rgb, (~known).astype(np.float32), 3)
        self.rgb = rgb
        self.a = A[sl].astype(np.float32)

    def copy_rgb(self):
        return self.rgb.copy()


def put(dst, cut, M, rgb=None, alpha=1.0):
    """Composite `cut` onto dst with 3x3 matrix M (artwork coords -> frame coords)."""
    rgb = cut.rgb if rgb is None else rgb
    h, w = cut.a.shape
    Mc = M @ T(cut.x0, cut.y0)
    corners = np.array([[0, 0, 1], [w, 0, 1], [0, h, 1], [w, h, 1]], np.float64).T
    cc = Mc @ corners
    H, W = dst.shape[:2]
    bx0, by0 = int(max(math.floor(cc[0].min()) - 1, 0)), int(max(math.floor(cc[1].min()) - 1, 0))
    bx1, by1 = int(min(math.ceil(cc[0].max()) + 1, W)), int(min(math.ceil(cc[1].max()) + 1, H))
    if bx1 <= bx0 or by1 <= by0:
        return
    Mb = (T(-bx0, -by0) @ Mc)[:2]
    rgba = np.dstack([rgb, cut.a])
    out = cv2.warpAffine(rgba, Mb, (bx1 - bx0, by1 - by0), flags=cv2.INTER_CUBIC,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    out[..., 3] = np.clip(out[..., 3], 0, 1)
    a = out[..., 3:4] * alpha
    sub = dst[by0:by1, bx0:bx1]
    dst[by0:by1, bx0:bx1] = sub * (1 - a) + out[..., :3] * a


def deform(cut, rgb, fn):
    """Bend a piece in place: fn(X, Y) -> (dx, dy) forward displacement in artwork coords."""
    h, w = cut.a.shape
    st = 6
    gy, gx = np.mgrid[0:h + st:st, 0:w + st:st].astype(np.float32)
    dx, dy = fn(gx + cut.x0, gy + cut.y0)
    dx = cv2.resize(dx.astype(np.float32), (gx.shape[1] * st, gx.shape[0] * st))[:h, :w]
    dy = cv2.resize(dy.astype(np.float32), (gx.shape[1] * st, gx.shape[0] * st))[:h, :w]
    X, Y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    r = cv2.remap(rgb, X - dx, Y - dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    a = cv2.remap(cut.a, X - dx, Y - dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    c = Cut.__new__(Cut)
    c.x0, c.y0, c.x1, c.y1, c.rgb, c.a = cut.x0, cut.y0, cut.x1, cut.y1, r, a
    return c


# ---------------------------------------------------------------------------------------------
# scene 1 — collecting: she hands the bag over, he takes it, she lets go
# ---------------------------------------------------------------------------------------------

class Collect:
    LAYER_EYES = {1}  # the worker's blinks are painted on his layer
    BAG = [(478, 662), (602, 662), (614, 722), (602, 760), (642, 792), (692, 862), (727, 952), (747, 1042),
           (737, 1092), (692, 1114), (560, 1120), (430, 1114), (390, 1097), (381, 1040), (386, 980),
           (403, 935), (426, 895), (445, 858), (456, 828), (468, 800), (480, 770), (484, 740)]
    HAND = [(402, 814), (418, 790), (468, 744), (510, 714), (548, 712), (575, 726), (592, 752), (590, 800),
            (566, 824), (536, 822), (510, 806), (472, 810), (442, 832), (412, 834)]
    WRIST = (424, 812)  # where the forearm leaves the cuff
    CUFF_EDGE = ((398, 796), (448, 834))  # the cuff's rim line, which stays with the sleeve
    SLEEVE = [(290, 740), (420, 770), (452, 826), (470, 900), (400, 1010), (290, 1010)]
    BACK = (-0.805, 0.593)  # along the forearm, into the cuff

    def __init__(self, sc):
        img = sc.plate  # line-art already lifted
        bg = sc.bg
        H, W = img.shape[:2]
        nb = not_bg(img, bg)
        sat = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV)[..., 1].astype(np.float32)
        hand = poly(img.shape, self.HAND, 0.6) * nb * np.clip((sat - 50) / 30, 0, 1)  # skin, not the cream cuff
        hb = cv2.morphologyEx((hand > 0.5).astype(np.uint8), cv2.MORPH_OPEN,
                              cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))  # drop stray finger lines
        hand = cv2.GaussianBlur(grow(hb.astype(np.float32), 2), (0, 0), 0.7) * nb
        rim = np.zeros((H, W), np.uint8)
        cv2.line(rim, self.CUFF_EDGE[0], self.CUFF_EDGE[1], 255, 7, cv2.LINE_AA)
        rim = rim.astype(np.float32) / 255
        hand *= 1 - rim
        bag = poly(img.shape, self.BAG, 0.6)
        right = np.zeros((H, W), np.float32)
        right[380:, 600:] = 1
        worker = np.maximum(bag, right * nb) * (1 - grow(hand, 1))
        knot = np.maximum(grow(hand, 4), grow(poly(img.shape, self.HAND), 2)) * bag  # bag under her fingers
        Yb = np.arange(H)[:, None]
        pale = (bag > 0.5) & (sat < 40) & (Yb > 800) & (Yb < 870) & (img.sum(2) > 690)
        white = np.median(img[pale].reshape(-1, 3), axis=0)  # the bag's own white
        self.worker = Cut(img, worker, hole=knot, hole_rgb=white)
        self.hand = Cut(img, hand)
        # her sleeve and cuff, drawn over the forearm so the hand can slide back inside the cuff
        warm = img[..., 2] - img[..., 0]  # sweater cream is warm (R >> B); the bag's white is not
        cream0 = ((sat < 50) & (img.sum(2) > 600) & (warm > 16)).astype(np.float32)
        sleeve = np.maximum(cream0 * nb, rim * nb) * poly(img.shape, self.SLEEVE)
        n, lab, st, _ = cv2.connectedComponentsWithStats((sleeve > 0.5).astype(np.uint8), 8)
        keep = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
        sleeve *= grow((lab == keep).astype(np.float32), 1)  # one piece: no specks of bag
        sleeve *= 1 - grow(bag, 1) * (np.arange(H)[:, None] > 836)
        self.sleeve = Cut(img, cv2.GaussianBlur(sleeve, (0, 0), 0.6))
        plate = img.copy()
        fill_bg(plate, np.clip(grow(worker, 2) + grow(hand, 2), 0, 1), bg)
        # also the forearm's faint outer outline (too close to the background colour to be in the mask)
        cream = ((sat < 50) & (img.sum(2) > 600)).astype(np.float32)
        fill_bg(plate, grow(poly(img.shape, self.HAND, 1.0), 7) * (1 - grow(cream, 1)), bg)
        self.plate = plate

    def frame(self, sc, u, out):
        # timing (scene time u: -0.3 .. 2.8)
        take = ramp(u, 0.5, 1.0)            # both hold, he takes the weight
        pull = back(u, 1.05, 1.75, 0.10)    # he draws the bag to himself (done just before the swipe)
        breath = 2.0 * math.sin(TAU * u / 1.25)
        dx = 6 * take + 72 * pull
        dy = -9 * take + 13 * pull + breath * 0.5
        swing = 2.5 * math.sin(TAU * (u - 1.2) / 0.9) * math.exp(-max(u - 1.3, 0) * 1.6) * (u > 1.2)
        foot = (930, 1312)
        Mw = T(dx, dy) @ R(foot, 1.2 * pull - 0.6 * take) @ R((640, 1080), swing)
        # her hand stays exactly as drawn (original pixels); the bag is taken out of it
        put(out, self.worker, Mw, rgb=sc.paint_eyes(self.worker, u, 1))
        put(out, self.hand, np.eye(3))
        put(out, self.sleeve, np.eye(3))


# ---------------------------------------------------------------------------------------------
# scene 6 — delivery: he holds it out, she takes the stack, his empty hands stay offered
# ---------------------------------------------------------------------------------------------

class Deliver:
    LAYER_EYES = {0, 1}
    STACK = [(525, 700), (645, 700), (668, 738), (782, 752), (812, 800), (818, 860), (814, 930), (822, 975),
             (802, 1004), (560, 1008), (470, 998), (412, 978), (406, 930), (418, 880), (436, 840), (438, 780),
             (466, 745), (518, 733)]
    HIS_HANDS = [(370, 935), (450, 940), (560, 948), (600, 965), (604, 1000), (590, 1030), (520, 1048),
                 (420, 1050), (370, 1050)]

    def __init__(self, sc):
        img = sc.plate
        bg = sc.bg
        H, W = img.shape[:2]
        nb = not_bg(img, bg)
        X = np.arange(W)[None, :]
        # his hands incl. their darker outline
        his = poly(img.shape, self.HIS_HANDS, 0.6) * nb * hsv_mask(img, (0, 40, 100), (25, 255, 255))
        his = cv2.morphologyEx((his > 0.5).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        his = cv2.GaussianBlur(grow(his.astype(np.float32), 2), (0, 0), 0.7) * nb
        stack = poly(img.shape, self.STACK, 0.6)
        hsv0 = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
        right = np.zeros((H, W), np.float32)
        right[400:, 615:] = 1
        stackish = np.maximum(stack, grow(stack, 6) * nb)
        woman = np.maximum(stackish, right * nb) * (1 - grow(his, 4))
        hidden = grow(his, 6) * stack
        # the stack is horizontal bands: rebuild what his fingers hid row by row, from the right
        # his far fingertips peek round the stack's left corner: they stay with him, not the stack
        tips = ((hsv0[..., 0] < 22) & (hsv0[..., 1] > 110) & (hsv0[..., 2] > 150)).astype(np.float32) * (X < 490)
        tips = grow(tips, 2) * grow(stack, 8)
        woman = woman * (1 - tips)
        hidden = np.maximum(hidden, tips)
        self.woman = Cut(img, woman, hole=hidden, rows=True)
        # him: the whole figure (hands included) as one piece, so nothing bends at the wrist
        # stray bits of the stack's cloth (bright blue / white folds) beside it are not part of him
        hsv = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
        cloth = ((hsv[..., 0] > 95) & (hsv[..., 0] < 128) & (hsv[..., 1] > 60) & (hsv[..., 2] > 140))
        cloth = grow(cloth.astype(np.float32), 2) * (X > 395)
        # his far forearm (in shadow) runs behind the stack; it swings down behind him once it is free
        Yc = np.arange(H)[:, None]
        far = ((hsv[..., 0] < 22) & (hsv[..., 1] > 165) & (hsv[..., 2] > 150)) & (X > 362) & (X < 470) &               (Yc > 868) & (Yc < 978)
        far = cv2.morphologyEx(far.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(np.float32)
        far = cv2.GaussianBlur(grow(far, 1), (0, 0), 0.6) * nb
        self.far = Cut(img, far)
        his = his * (1 - far)
        # his hands' grown edge must not carry the stack's navy hem or white folds with them
        notcloth = 1 - (((hsv[..., 0] > 95) & (hsv[..., 0] < 130) & (hsv[..., 1] > 50)) |
                        ((hsv[..., 1] < 45) & (hsv[..., 2] > 190))).astype(np.float32) * (X > 395)
        man = np.clip(nb * (X < 615) * (1 - grow(stack, 16)) * (1 - cloth) + grow(his, 1) * notcloth, 0, 1) * nb * (1 - far)
        self.man = Cut(img, man)
        plate = img.copy()
        fill_bg(plate, np.clip(grow(woman, 2) + grow(man, 2) + grow(far, 2) + (grow(stack, 18) + cloth) * (1 - grow(man, 1)), 0, 1), bg)
        self.plate = plate
        self.M = np.eye(3)

    def frame(self, sc, u, out):
        lift = ramp(u, 0.3, 0.8)
        take = back(u, 1.0, 1.7, 0.10)
        breath = 2.0 * math.sin(TAU * u / 1.25 + 1.0)
        dx = 80 * take
        dy = -6 * lift - 16 * take + breath * 0.5  # she lifts it up towards herself
        self.M = T(dx, dy) @ R((980, 1312), -1.4 * take + 0.4 * lift)
        # he lets go and steps back a little, lowering his hands with his whole body
        step = back(u, 1.25, 1.9, 0.10)
        breath2 = 2.0 * math.sin(TAU * u / 1.25)
        Mm = T(-50 * step, -4 * lift + 24 * step + breath2 * 0.4) @ R((300, 1312), -1.5 * step)
        put(out, self.far, Mm @ R((366, 862), 32 * step))
        front = 1 - sm((step - 0.05) / 0.35)  # his fingertips slip from in front of the stack
        if front < 1:
            put(out, self.man, Mm, rgb=sc.paint_eyes(self.man, u, 0))
        put(out, self.woman, self.M, rgb=sc.paint_eyes(self.woman, u, 1))
        if front > 0:
            put(out, self.man, Mm, rgb=sc.paint_eyes(self.man, u, 0), alpha=front)

    def follow(self, p):
        return apply(self.M, p)


# ---------------------------------------------------------------------------------------------
# scene 3 — drying: she lifts the shirt to the line, pegs the left side, then the right, lets go,
# and the breeze takes it
# ---------------------------------------------------------------------------------------------

class Hang:
    LAYER_EYES = set()
    SHIRT = [(518, 680), (575, 676), (660, 680), (702, 678), (730, 722), (756, 790), (722, 822), (716, 860),
             (714, 980), (645, 998), (570, 998), (505, 982), (505, 880), (515, 800), (482, 786), (474, 768),
             (495, 722)]
    ARM_A = [(392, 704), (420, 690), (500, 618), (592, 612), (596, 702), (520, 704), (452, 762), (424, 806),
             (392, 800)]
    ARM_B = [(342, 798), (470, 812), (560, 756), (640, 686), (660, 646), (724, 646), (726, 724), (604, 802),
             (482, 906), (342, 906)]
    PIV_A, PIV_B = (405, 778), (358, 852)
    HAND_A, HAND_B = (545, 655), (685, 690)
    PEG_A, PEG_B = (548, 634, 590, 698), (686, 638, 720, 694)
    TOP = 680

    def __init__(self, sc):
        img = sc.plate
        bg = sc.bg
        H, W = img.shape[:2]
        nb = not_bg(img, bg)
        hsv = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
        hh, ss, vv = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        skin = ((hh < 24) & (ss > 45) & (ss < 215) & (vv > 170)).astype(np.float32)
        peg = ((hh < 22) & (ss > 140) & (vv > 50) & (vv < 215)).astype(np.float32)
        white = ((ss < 80) & (vv > 165)).astype(np.float32)

        def clean(m):
            m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            return cv2.GaussianBlur(grow(m, 2), (0, 0), 0.8) * nb

        def box(b):
            m = np.zeros((H, W), np.float32)
            m[b[1]:b[3], b[0]:b[2]] = 1
            return m

        pegs = [clean(peg * box(b)) for b in (self.PEG_A, self.PEG_B)]
        allpeg = np.maximum(*pegs)
        armA = clean(skin * poly(img.shape, self.ARM_A)) * (1 - grow(allpeg, 1))
        armB = clean(skin * poly(img.shape, self.ARM_B)) * (1 - grow(allpeg, 1))
        shp = poly(img.shape, self.SHIRT, 0.6)
        covered = np.clip(grow(armA, 12) + grow(armB, 12) + grow(allpeg, 3), 0, 1) * shp
        shirt = clean(white * shp)  # (alpha stays solid across the hidden part; Cut rebuilds its colour)
        self.shirt = Cut(img, shirt, hole=covered)
        self.armA, self.armB = Cut(img, armA), Cut(img, armB)
        self.pegs = [Cut(img, p) for p in pegs]
        self.pegc = [((b[0] + b[2]) / 2, (b[1] + b[3]) / 2) for b in (self.PEG_A, self.PEG_B)]

        plate = img.copy()
        gone = np.clip(grow(shirt, 2) + grow(covered, 2) + grow(armA, 2) + grow(armB, 2) + grow(allpeg, 2), 0, 1)
        # the background here has soft light shapes, so rebuild it rather than flat-filling
        plate = inpaint(plate, gone, 9)
        # the clothesline behind the hands and pegs: fit it from its visible run and redraw it
        # (rope centre rows measured on its visible runs)
        xs = [500, 580, 600, 620, 640, 720, 740, 760, 780, 800, 820, 840]
        ys = [636, 658, 661, 664, 666.5, 672, 672, 671, 669.5, 668.5, 667, 665]
        cf = np.polyfit(xs, ys, 2)
        # take the old visible bits of line out first, so the redrawn one is never doubled
        Yg, Xg = np.mgrid[0:H, 0:W]
        old = ((ss < 95) & (vv > 205) & (Xg >= 480) & (Xg <= 805) & (np.abs(Yg - np.polyval(cf, Xg)) < 9))
        old = grow(old.astype(np.float32), 2) * (1 - grow(np.clip(shirt + armA + armB + allpeg, 0, 1), 1))
        plate = inpaint(plate, old, 4) * old[..., None] + plate * (1 - old[..., None])
        th = 5
        rc = np.median(np.array([img[int(round(np.polyval(cf, x))), x] for x in xs[5:]]), axis=0)
        pts = np.array([[x, np.polyval(cf, x)] for x in range(492, 800, 4)], np.float32)
        lay = np.zeros((H * 1, W * 1), np.uint8)
        cv2.polylines(lay, [np.round(pts * 4).astype(np.int32)], False, 255, th, cv2.LINE_AA, shift=2)
        la = cv2.GaussianBlur(lay.astype(np.float32) / 255, (0, 0), 0.5)[..., None]
        plate = plate * (1 - la) + rc * la
        self.plate = plate
        self.wind = 0.0

    def frame(self, sc, u, out):
        bump = lambda a, b: math.sin(math.pi * min(max((u - a) / (b - a), 0), 1))
        rel = 0.0  # her hands stay on the pegged shirt (lifting them off would expose hidden cloth)
        idle = 0.8 * math.sin(TAU * u / 1.25) * rel
        thA = 8 * (1 - ramp(u, 0.1, 0.65)) + 3.0 * bump(0.72, 0.92) + 15 * rel + idle
        thB = 3.6 * (1 - ramp(u, 0.15, 0.7)) + 1.6 * bump(0.95, 1.15) + 6.5 * rel + idle * 0.5
        MA, MB = R(self.PIV_A, thA), R(self.PIV_B, thB)
        dA = np.subtract(apply(MA, self.HAND_A), self.HAND_A)
        dB = np.subtract(apply(MB, self.HAND_B), self.HAND_B)
        held = 1 - ramp(u, 0.68, 0.74)
        d = (dA + dB) / 2 * held
        # the shirt: carried up, then pegged; the breeze grows once she lets go
        amp = 2.5 + 8 * ramp(u, 1.15, 1.9)
        ph = TAU * u / 1.25

        def sway(X, Y):
            # only the lower half really swings: the top is pegged and her arm lies across the middle
            depth = np.clip((Y - 850) / 150.0, 0, 1) * 0.8 + np.clip((Y - self.TOP) / 320.0, 0, 1) * 0.2
            dx = amp * depth ** 1.3 * np.sin(ph - depth * 1.3)
            dy = -0.25 * amp * depth ** 2 * (0.5 - 0.5 * np.cos(2 * ph))
            return dx, dy

        put(out, deform(self.shirt, self.shirt.rgb, sway), T(*d))
        put(out, self.armA, MA)
        put(out, self.armB, MB)
        for k, (pc, t_clip, dk) in enumerate(((self.pegc[0], 0.84, dA), (self.pegc[1], 1.07, dB))):
            on = u >= t_clip
            snap = 7 * bump(t_clip - 0.06, t_clip + 0.12)
            Mp = (np.eye(3) if on else T(*dk)) @ R(pc, snap * (1 if k == 0 else -1))
            put(out, self.pegs[k], Mp)


# ---------------------------------------------------------------------------------------------
# scene 5 — folding: she folds the flap over, carries the folded garment to the stack, sets it on
# top and steps back
# ---------------------------------------------------------------------------------------------

class Fold:
    LAYER_EYES = {0}
    WOMAN = [(330, 480), (800, 480), (800, 1183), (352, 1183), (352, 1000), (330, 960)]
    GARMENT = [(503, 1170), (520, 1120), (600, 1108), (700, 1104), (824, 1102), (850, 1150), (850, 1206),
               (835, 1236), (700, 1244), (520, 1242), (502, 1215)]
    FLAP = [(508, 1172), (520, 1120), (600, 1108), (700, 1104), (824, 1102), (850, 1150), (842, 1180),
            (700, 1190), (560, 1194), (510, 1192)]
    STACK = [(850, 985), (1125, 985), (1125, 1212), (850, 1212)]
    SPLIT = ((580, 960), (690, 1185))  # left arm is left of this line
    PIV_L, PIV_R = (355, 985), (628, 975)
    HAND_L, HAND_R = (600, 1135), (765, 1115)
    FOLD_Y = 1190
    HOME = (675, 1176)          # garment centre on the table
    TARGET = (985, 956)         # garment centre on top of the stack

    def __init__(self, sc):
        img = sc.plate
        bg = sc.bg
        H, W = img.shape[:2]
        nb = not_bg(img, bg)
        hsv = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
        hh, ss, vv = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
        (x0, y0), (x1, y1) = self.SPLIT
        left_side = (X - x0) * (y1 - y0) - (Y - y0) * (x1 - x0) < 0

        def clean(m, g=2):
            m = cv2.morphologyEx(m.astype(np.float32), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            return cv2.GaussianBlur(grow(m, g), (0, 0), 0.8) * nb

        wpoly = poly(img.shape, self.WOMAN)
        skin = ((hh < 24) & (ss > 40) & (ss < 230) & (vv > 150)).astype(np.float32) * (Y >= 975)
        armL = clean(skin * wpoly * left_side)
        armR = clean(skin * wpoly * ~left_side)
        gp = poly(img.shape, self.GARMENT, 0.6)
        yellow = ((hh > 10) & (hh < 36) & (ss > 110) & (vv > 140)).astype(np.float32)
        hands = np.clip(armL + armR, 0, 1)
        garment = clean(yellow * gp, 2) * (1 - grow(hands, 2))
        under_hands = grow(hands, 4) * gp
        fp = poly(img.shape, self.FLAP, 0.6)
        flap = np.clip(garment + under_hands, 0, 1) * fp
        base = np.clip(garment + under_hands, 0, 1) * (1 - fp)
        gy = np.median(img[(yellow * gp * (1 - grow(hands, 3))) > 0.5].reshape(-1, 3), axis=0)
        self.flap = Cut(img, flap, hole=under_hands * fp, hole_rgb=gy)
        self.base = Cut(img, base, hole=flap, hole_rgb=gy * 0.97)   # its top surface was hidden under the flap
        # a clean folded towel, copied from the top of the stack: what she finally sets down
        towel = clean(yellow * poly(img.shape, [(850, 980), (1125, 980), (1125, 1062), (1040, 1072),
                                                 (850, 1072)]), 1)
        self.towel = Cut(img, towel)
        self.towel_c = (987, 1030)
        # her: everything in the woman region except garment and arms; rebuild what those hid
        woman = wpoly * nb * (1 - grow(gp, 1)) * (1 - grow(hands, 1))
        hid = np.clip(grow(hands, 3) * wpoly + gp * wpoly, 0, 1) * (1 - woman)
        hid *= (Y < 1183)
        self.woman = Cut(img, woman, hole=hid, rows=True)
        # extend her apron a little below the table edge, so stepping never shows a gap
        r = self.woman
        yy = 1182 - r.y0
        if 0 < yy < r.a.shape[0]:
            r.rgb[yy:] = r.rgb[yy - 1:yy]
            r.a[yy:] = r.a[yy - 1:yy] * (np.arange(r.a.shape[0] - yy)[:, None] < 40)
        self.armL, self.armR = Cut(img, armL), Cut(img, armR)
        # short sleeves, drawn over the tops of the arms so the shoulder turn never shows a seam
        whiteish = ((ss < 60) & (vv > 190)).astype(np.float32)
        sl = np.zeros((H, W), np.float32)
        for p in (self.PIV_L, self.PIV_R):
            cv2.circle(sl, p, 52, 1.0, -1)
        self.sleeves = Cut(img, cv2.GaussianBlur(whiteish * sl * wpoly, (0, 0), 0.6) * nb)
        stack = poly(img.shape, self.STACK) * nb
        self.stack = Cut(img, stack)
        table = ((hh > 95) & (hh < 118) & (ss > 30) & (ss < 150) & (vv > 170)).astype(np.float32) * (Y > 1165)

        plate = img.copy()
        gone = np.clip(grow(woman, 2) + grow(hands, 2) * wpoly, 0, 1) * (Y < 1185)
        fill_bg(plate, gone, bg)
        # beside the basket, rebuild the wicker from the basket itself rather than flat-filling
        # the basket's right side, which her apron bow hid: continue its cream wall straight down
        cream = np.median(img[1090:1150, 300:325].reshape(-1, 3), axis=0)
        edge = np.interp(Y, [940, 1000, 1030, 1060, 1190], [395, 360, 352, 344, 336])
        wall = ((X <= edge) & (X > 300) & (Y > 1040) & (Y < 1185)).astype(np.float32)
        wall = cv2.GaussianBlur(wall, (0, 0), 0.8) * gone
        plate = plate * (1 - wall[..., None]) + cream * wall[..., None]
        # under the garment: the table top is flat from y 1182 to its front edge at ~1248
        tcol = np.median(img[table > 0.5].reshape(-1, 3), axis=0)
        redo = np.clip(grow(gp, 4) + grow(hands, 3) * (Y >= 1140), 0, 1) * (Y >= 1120)
        tmask = cv2.GaussianBlur(((Y >= 1182) & (Y <= 1248)).astype(np.float32), (0, 0), 0.7)[..., None]
        rebuilt = tcol * tmask + bg * (1 - tmask)
        plate = plate * (1 - redo[..., None]) + rebuilt * redo[..., None]
        # the table is drawn in front of her, including the part the garment used to cover
        tab = np.maximum(table, tmask[..., 0] * redo) * (Y > 1165) * (1 - grow(stack, 2))
        self.table = Cut(plate, cv2.GaussianBlur(tab, (0, 0), 0.6))
        self.plate = plate

    def frame(self, sc, u, out):
        flip = ramp(u, 0.05, 0.55)
        carry = ramp(u, 0.62, 1.15)
        place = back(u, 1.15, 1.5, 0.05)
        ret = ramp(u, 1.6, 2.2)
        up = carry * (1 - ret)
        dx = 235 * carry * (1 - ret)
        dy = -5 * math.sin(math.pi * carry) - 5 * math.sin(math.pi * ret)
        Mw = T(dx, dy)
        press = 3 * math.sin(math.pi * flip)
        thL = -28 * up - 12 * up * math.sin(math.pi * min(max((u - 1.1) / 0.45, 0), 1)) + 2 * press
        thR = -38 * up - 12 * up * math.sin(math.pi * min(max((u - 1.1) / 0.45, 0), 1)) + 1 * press
        ML, MR = Mw @ R(self.PIV_L, thL), Mw @ R(self.PIV_R, thR)
        hl = np.subtract(apply(ML, self.HAND_L), self.HAND_L)
        hr = np.subtract(apply(MR, self.HAND_R), self.HAND_R)
        held = (hl + hr) / 2
        tgt = np.subtract(self.TARGET, self.HOME)
        land = u >= 1.5
        off = held * (1 - place) + tgt * place if not land else tgt
        settle = 3 * math.sin(math.pi * min(max((u - 1.42) / 0.3, 0), 1))
        Ms = T(0, 0) @ Sc((987, 1205), 1, 1 - settle / 220)
        Mg = (Ms if land else np.eye(3)) @ T(*off)
        # as it is set down, the carried garment becomes a clean towel sitting on the stack
        swap = ramp(u, 1.28, 1.46)
        gc = np.add(self.HOME, off)
        on_top = (self.towel_c[0], self.towel_c[1] - 66)
        tc = gc * (1 - place) + np.array(on_top) * place if not land else np.array(on_top)
        Mt = (Ms if land else np.eye(3)) @ T(tc[0] - self.towel_c[0], tc[1] - self.towel_c[1])

        put(out, self.woman, Mw, rgb=sc.paint_eyes(self.woman, u, 0))
        put(out, self.table, np.eye(3))
        put(out, self.stack, Ms)
        s = 0.72 + 0.28 * flip   # the last fold: the flap is smoothed down flat onto the garment
        if swap < 1:
            put(out, self.base, Mg, alpha=1 - swap)
            if abs(s) > 0.04:
                put(out, self.flap, Mg @ Sc((675, self.FOLD_Y), 1, s), rgb=self.flap.rgb * (0.85 + 0.15 * abs(s)),
                    alpha=1 - swap)
        if swap > 0:
            put(out, self.towel, Mt, alpha=swap)
        put(out, self.armL, ML)
        put(out, self.armR, MR)
        put(out, self.sleeves, Mw)



# ---------------------------------------------------------------------------------------------
# scene 3 — drying: the artwork stays whole; the two pegs snap shut on the line
# ---------------------------------------------------------------------------------------------

class Pegs:
    LAYER_EYES = set()
    PEGS = [((548, 634, 590, 698), 0.78), ((686, 638, 720, 694), 1.05)]

    def __init__(self, sc):
        img = sc.plate
        H, W = img.shape[:2]
        nb = not_bg(img, sc.bg)
        hsv = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
        peg = ((hsv[..., 0] < 22) & (hsv[..., 1] > 140) & (hsv[..., 2] > 50) & (hsv[..., 2] < 215)).astype(np.float32)
        self.pegs = []
        for (x0, y0, x1, y1), t in self.PEGS:
            m = np.zeros((H, W), np.float32)
            m[y0:y1, x0:x1] = 1
            m = cv2.morphologyEx(peg * m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            m = cv2.GaussianBlur(grow(m, 1), (0, 0), 0.6) * nb
            self.pegs.append((Cut(img, m), ((x0 + x1) / 2, (y0 + y1) / 2), t))
        self.plate = img

    def frame(self, sc, u, out):
        for cut, c, t in self.pegs:
            q = (u - t) / 0.28
            if 0 < q < 1:  # a quick squeeze-and-release as it clips on
                k = math.sin(math.pi * q)
                put(out, cut, Sc(c, 1 + 0.12 * k, 1 - 0.1 * k) @ R(c, 6 * k))
