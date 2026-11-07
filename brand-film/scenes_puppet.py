"""Puppet-rigged versions of the six scenes (original artwork, cut into moving parts)."""
import math

import cv2
import numpy as np

import film
from puppet import (Layer, along, apply, color_mask, compose, eye_shift, eyelid, falloff, fill_holes, heal, mouth,
                    poly_mask, rot_about)
from film import smooth, wave, PAD


def blink(tau, times, dur=0.16):
    v = 0.0
    for s in times:
        u = (tau - s) / dur
        if 0 <= u <= 1:
            v = max(v, math.sin(math.pi * u) * 1.15)
    return min(v, 1.0)


def fill_behind(img, hole, bg, regions):
    """Repaint what sits behind a lifted layer: flat colours per region, then a soft seam."""
    out = img.copy()
    m = cv2.dilate((hole > 20).astype(np.uint8), np.ones((9, 9), np.uint8))
    # smooth the cut-out boundary so it can never read as a dotted fringe
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    m = (cv2.GaussianBlur(m.astype(np.float32), (0, 0), 3) > 0.45)
    out[m] = bg.astype(np.uint8)
    for reg, col in regions:
        out[m & (reg > 127)] = np.asarray(col, np.uint8)
    ring = cv2.dilate(m.astype(np.uint8), np.ones((7, 7), np.uint8)) - cv2.erode(m.astype(np.uint8), np.ones((7, 7), np.uint8))
    return cv2.inpaint(out, ring * 255, 4, cv2.INPAINT_TELEA)


def nonbg(img, bg, thr=40):
    d = np.linalg.norm(img.astype(np.float32) - bg, axis=2)
    return ((d > thr) * 255).astype(np.uint8)


def skin_mask(img):
    # peach skin of the illustrations
    return color_mask(img, (225, 160, 110), (255, 225, 195))


def white_mask(img):
    return color_mask(img, (215, 215, 215), (255, 255, 255))


# ====================================================================== scene 1
class PCollecting(film.Collecting):
    """The staff member receives a shirt, lifts it to show it off, and laughs."""

    NECK = (470, 545)
    EYES = [((515, 387), 7, 12), ((577, 378), 7, 11)]
    MOUTH = ((523, 441), (569, 437))
    MOUTH_COVER = (546, 446, 29, 15)
    SHOULDER = (290, 880)
    HAND = (712, 640)       # wrist
    SHIRT_PIVOT = (880, 560)

    def setup(self):
        super().setup()
        img = self.base
        nb = nonbg(img, self.bg)
        H = img.shape[:2]
        self.skin = tuple(int(v) for v in img[425, 480])

        # hard cut across the flat neck skin (below the jaw line), soft cut through the hair
        head_poly = [(150, 190), (640, 190), (650, 330), (632, 470), (580, 540), (548, 578), (430, 578),
                     (392, 500), (330, 466), (250, 436), (150, 372)]
        hard = poly_mask(H, head_poly)
        soft = cv2.GaussianBlur(hard, (0, 0), 14)
        hair_zone = poly_mask(H, [(120, 330), (420, 430), (420, 600), (120, 600)]) > 0
        head = np.where(hair_zone, soft, hard).astype(np.uint8)
        head = cv2.bitwise_and(head, nb)

        shirt_poly = [(588, 556), (760, 528), (900, 556), (990, 536), (1084, 556), (1104, 640), (1166, 960),
                      (1152, 994), (1046, 1004), (1034, 1114), (820, 1148), (636, 1138), (598, 1060), (574, 1004),
                      (474, 1006), (556, 760)]
        sp = poly_mask(H, shirt_poly)
        wm = cv2.bitwise_and(white_mask(img), sp)
        wm = cv2.morphologyEx(wm, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        wm = fill_holes(wm)
        far_hand = cv2.bitwise_and(skin_mask(img), poly_mask(H, [(978, 532), (1082, 538), (1094, 652), (1030, 662),
                                                                  (988, 604)]))
        shirt = cv2.dilate(cv2.bitwise_or(wm, far_hand), np.ones((13, 13), np.uint8))
        shirt = cv2.bitwise_and(shirt, cv2.bitwise_and(nb, cv2.dilate(sp, np.ones((15, 15), np.uint8))))

        # starts just below the sleeve cuff, where the arm never moves
        arm_poly = [(236, 934), (290, 918), (436, 864), (470, 740), (556, 664), (604, 560), (690, 500), (846, 500),
                    (834, 600), (814, 700), (744, 762), (650, 876), (566, 1006), (456, 1074), (322, 1074),
                    (236, 1022)]
        ap = poly_mask(H, arm_poly)
        arm = cv2.bitwise_and(skin_mask(img), ap)
        arm = cv2.morphologyEx(arm, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
        arm = cv2.bitwise_and(cv2.dilate(arm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))), ap)
        arm = cv2.bitwise_and(arm, nb)
        # the gripping hand belongs to the shirt (fingers and collar stay locked together);
        # the forearm stops at the wrist line and overlaps it slightly to hide the join
        hand_poly = [(682, 572), (760, 518), (864, 522), (864, 592), (806, 604), (796, 694), (716, 700)]
        hand_zone = poly_mask(H, hand_poly)
        hand = cv2.bitwise_and(arm, hand_zone)
        wrist_overlap = poly_mask(H, [(660, 560), (700, 556), (734, 700), (690, 706)])
        arm = cv2.bitwise_and(arm, cv2.bitwise_not(cv2.bitwise_and(hand_zone, cv2.bitwise_not(wrist_overlap))))
        shirt = cv2.bitwise_and(shirt, cv2.bitwise_not(cv2.erode(arm, np.ones((5, 5), np.uint8))))
        shirt = cv2.bitwise_or(shirt, hand)

        self.L_head = Layer(img, head)
        self.L_shirt = Layer(img, shirt)
        self.L_arm = Layer(img, arm)
        core = (head > 235).astype(np.uint8) * 255
        hole = cv2.bitwise_or(core, cv2.bitwise_or(shirt, cv2.dilate(arm, np.ones((7, 7), np.uint8))))
        # keep the original art in a band under each cut line, so joins stay seamless
        keep = cv2.bitwise_or(poly_mask(H, [(150, 820), (450, 820), (452, 880), (300, 934), (150, 968)]),
                              poly_mask(H, [(410, 562), (566, 562), (566, 604), (410, 604)]))
        hole = cv2.bitwise_and(hole, cv2.bitwise_not(keep))
        apron = np.median(img[760:840, 450:520].reshape(-1, 3), 0)
        tee = np.median(img[610:640, 600:630].reshape(-1, 3), 0)
        behind = [(poly_mask(H, [(300, 668), (560, 668), (700, 660), (780, 1254), (260, 1254)]), apron),
                  (poly_mask(H, [(588, 584), (650, 590), (694, 606), (684, 664), (612, 670)]), tee)]
        body_src = fill_behind(img, hole, self.bg, behind)
        # the whole figure is a layer too (breathing, leaning); the room behind is flat navy
        icon = poly_mask(H, [(700, 180), (1090, 180), (1090, 520), (700, 520)])
        fig = cv2.bitwise_and(nb, cv2.bitwise_not(icon))
        fig = cv2.bitwise_and(fig, cv2.bitwise_not(poly_mask(H, [(820, 1150), (1254, 1150), (1254, 1254), (820, 1254)])))
        self.L_body = Layer(body_src, fig)
        flat = img.copy()
        flat[cv2.dilate(fig, np.ones((5, 5), np.uint8)) > 0] = self.bg.astype(np.uint8)
        self.base = flat

    # only the loose back hair moves on the plate
    def blob_offsets(self, tau):
        return [(0, 0), (0, 0), (0, 0), (0, 0), (6 * wave(tau, 2.2, 0.3), 2 * wave(tau, 2.2, 1.2))]

    def decorate_calm(self, img, tau):
        s = self.sprites
        tw = 0.5 + 0.5 * wave(tau, 1.3)
        film.draw_sprite(img, s['sparkA'], scale=0.8 + 0.3 * tw, angle=15 * wave(tau, 2.6), alpha=0.65 + 0.35 * tw)
        tw2 = 0.5 + 0.5 * wave(tau, 1.3, 2.2)
        film.draw_sprite(img, s['sparkB'], scale=0.75 + 0.35 * tw2, angle=-15 * wave(tau, 2.6), alpha=0.65 + 0.35 * tw2)
        # three small suds turning inside the porthole: a quiet hint of the wash to come
        px, py = self.PORT
        for i in range(3):
            th = tau * 1.9 + i * 2 * math.pi / 3
            rr = self.PORT_R * 0.55
            film.bubble(img, px + math.cos(th) * rr, py + math.sin(th) * rr, 5 + i, opacity=0.85, outline=0)

    def motion(self, tau):
        # a small dip (anticipation), then she lifts the shirt to show it off
        lift = 6 * math.sin(math.pi * min(1, max(0, (tau - 0.55) / 0.3))) * (tau < 0.85)             - 20 * smooth((tau - 0.8) / 0.5) + 4 * wave(tau, 1.6)
        swing = 2.4 * wave(tau, 1.6, 0.6)
        laugh = smooth((tau - 1.0) / 0.25) - smooth((tau - 2.15) / 0.3)
        return lift, swing, laugh

    def render(self, tau):
        img = self.base.copy()
        lift, swing, laugh = self.motion(tau)
        # body: breathing and a slow lean, pivoting at the bottom of the frame
        B = rot_about(470, 1254, 0.9 * wave(tau, 3.2, 0.4), 0, 0, 1.0)
        B[1] *= 1  # (kept explicit for readability)
        breath = 1 + 0.008 * wave(tau, 1.6)
        B = compose(B, np.float32([[1, 0, 0], [0, breath, 1254 * (1 - breath)]]))

        def hair(x, y):
            w = falloff(x, y, 175, 650, 95) + 0.6 * falloff(x, y, 250, 470, 70)
            return 7 * w * math.sin(2 * math.pi * tau / 2.2 + 0.3), 2.5 * w * math.sin(2 * math.pi * tau / 2.2 + 1.4)

        self.L_body.draw(img, B, deform=hair)

        # head: gentle sway, a nod when she laughs, blinks, laughing mouth
        tilt = 2.2 * wave(tau, 2.4) + 2.5 * laugh
        Mh = rot_about(*self.NECK, tilt, 0, -2.5 * laugh + 1.5 * wave(tau, 1.2))
        b = blink(tau, (0.55, 1.95, 2.95))

        # gaze: down at the shirt while lifting, then up to us when she laughs
        look = smooth((tau - 0.6) / 0.25) * (1 - smooth((tau - 1.05) / 0.2))
        gx, gy = 3.5 * look, 5 * look

        def face(rgb, a, x0, y0):
            for (e, rx, ry) in self.EYES:
                eye_shift(rgb, a, x0, y0, e, rx, ry, gx, gy, self.skin)
                eyelid(rgb, a, x0, y0, (e[0] + gx, e[1] + gy), rx, ry, b, self.skin)
            mouth(rgb, a, x0, y0, self.MOUTH, self.skin, laugh, cover=self.MOUTH_COVER)

        self.L_head.draw(img, compose(B, Mh), overlay=face)

        # shirt: lifted and swinging from her grip, hem and sleeves fluttering
        Ms = rot_about(*self.SHIRT_PIVOT, swing, 0, lift)
        gust = 1 + 0.5 * max(0.0, wave(tau, 3.2, -1.0))

        def flutter(x, y):
            k = np.clip((y - 600) / 540, 0, 1) ** 1.5
            ph = 2 * math.pi * tau / 0.95 + (y - 600) * 0.012 + (x - 700) * 0.004
            side = np.clip(np.abs(x - 760) / 260, 0, 1)
            return (7 * gust * k * np.sin(ph) + 6 * side * k * np.sin(ph * 1.3 + 1),
                    2.5 * k * np.cos(ph))

        self.L_shirt.draw(img, compose(B, Ms), deform=flutter)

        # near arm stretches to keep holding the collar
        hx, hy = apply(Ms, *self.HAND)
        ddx, ddy = hx - self.HAND[0], hy - self.HAND[1]

        def follow(x, y):
            w = along(x, y, self.SHOULDER, self.HAND) ** 1.3
            return ddx * w, ddy * w

        self.L_arm.draw(img, B, deform=follow)
        self.decorate_calm(img, tau)
        plate = self.plate.copy()
        plate[PAD:PAD + self.h, PAD:PAD + self.w] = img
        return plate


def fill_vertical(img, hole):
    """Rebuild what's behind a roughly horizontal part (an arm) by continuing the
    artwork vertically from just above and just below it."""
    out = img.copy()
    h = hole > 0
    H, W = h.shape
    for x in np.nonzero(h.any(0))[0]:
        col = h[:, x]
        ys = np.nonzero(col)[0]
        # split into runs
        breaks = np.nonzero(np.diff(ys) > 1)[0]
        starts = np.r_[ys[0], ys[breaks + 1]]
        ends = np.r_[ys[breaks], ys[-1]] + 1
        for y0, y1 in zip(starts, ends):
            mid = (y0 + y1) // 2
            if y0 > 0:
                out[y0:mid, x] = out[y0 - 1, x]
            if y1 < H:
                out[mid:y1, x] = out[y1, x]
            elif y0 > 0:
                out[mid:y1, x] = out[y0 - 1, x]
    return out


def fill_horizontal(img, hole):
    """Like fill_vertical, but continues the artwork from the left and right."""
    return fill_vertical(img.transpose(1, 0, 2), hole.T).transpose(1, 0, 2).copy()


def orange_cloth_mask(img):
    r, g, b = [img[..., i].astype(np.int32) for i in range(3)]
    return (((r > 215) & (g > 95) & (g < 215) & (b < 110)) * 255).astype(np.uint8)


def layer_over(dst, L):
    """Paint a layer at rest into an image (used to build plates)."""
    a = L.alpha[..., None]
    reg = dst[L.y0:L.y1, L.x0:L.x1].astype(np.float32)
    dst[L.y0:L.y1, L.x0:L.x1] = (reg * (1 - a) + L.rgb * a).astype(np.uint8)


# ====================================================================== scene 2
class PWashing(film.Washing):
    """He feeds an orange cloth into the spinning drum, nods along and laughs."""

    NECK = (500, 505)
    EYES = [((567, 360), 6, 12), ((616, 376), 4.5, 9)]
    MOUTH = ((517, 420), (553, 440))
    MOUTH_COVER = (535, 428, 26, 17)
    ELBOW = (360, 835)
    WRIST = (650, 815)

    def setup(self):
        img = self.base.copy()
        nb = nonbg(img, self.bg)
        H = img.shape[:2]
        self.skin = tuple(int(v) for v in img[400, 490])
        machine_white = np.array([250, 250, 250], np.uint8)
        drum_navy = np.median(img[780:800, 880:900].reshape(-1, 3), 0)

        head_poly = [(310, 110), (700, 110), (724, 330), (650, 420), (604, 484), (546, 510), (470, 512),
                     (420, 474), (326, 420), (296, 300)]
        head = cv2.bitwise_and(poly_mask(H, head_poly), nb)

        arm_poly = [(352, 760), (440, 732), (560, 716), (650, 724), (742, 736), (770, 800), (744, 892),
                    (664, 908), (560, 902), (440, 912), (364, 924), (336, 860)]
        ap = poly_mask(H, arm_poly)
        arm = cv2.bitwise_and(skin_mask(img), ap)
        arm = cv2.morphologyEx(arm, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
        arm = cv2.bitwise_and(cv2.dilate(arm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19))), ap)

        cloth_poly = [(630, 736), (770, 740), (870, 820), (992, 948), (972, 1000), (870, 1004), (846, 1066),
                      (700, 1076), (652, 996), (628, 900)]
        cp = poly_mask(H, cloth_poly)
        cloth = cv2.bitwise_and(orange_cloth_mask(img), cp)
        cloth = cv2.morphologyEx(cloth, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8))
        cloth = fill_holes(cloth)
        cloth = cv2.bitwise_and(cv2.dilate(cloth, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))), cp)
        cloth = cv2.bitwise_and(cloth, cv2.bitwise_not(cv2.erode(arm, np.ones((5, 5), np.uint8))))

        man_poly = [(40, 380), (330, 380), (520, 470), (526, 1110), (40, 1150)]
        man = cv2.bitwise_and(nb, poly_mask(H, man_poly))
        man = cv2.bitwise_and(man, cv2.bitwise_not(head))
        # keep the original neck under the head's cut so a nod never opens a gap
        man = cv2.bitwise_or(man, cv2.bitwise_and(nb, poly_mask(H, [(300, 360), (420, 440), (616, 462), (606, 548), (300, 548)])))

        self.L_head = Layer(img, head)
        self.L_arm = Layer(img, arm)
        self.L_cloth = Layer(img, cloth)

        # what's behind the arm and cloth: drum water, machine front, the man's apron
        yy, xx = np.mgrid[0:H[0], 0:H[1]]
        drum = (((xx - self.DRUM[0]) ** 2 + (yy - self.DRUM[1]) ** 2) < (self.DRUM_R + 2) ** 2).astype(np.uint8) * 255
        apron = np.median(img[900:960, 300:340].reshape(-1, 3), 0)
        regions = [(poly_mask(H, [(526, 400), (1160, 400), (1160, 1140), (526, 1140)]), machine_white),
                   (drum, drum_navy),
                   (poly_mask(H, [(0, 400), (522, 400), (522, 1150), (0, 1150)]), apron)]
        # rebuild only inside the moving parts, so at rest they cover the repair completely
        lifted = cv2.erode(cv2.bitwise_or(arm, cloth), np.ones((7, 7), np.uint8))
        body_src = fill_vertical(img, lifted)
        man_src = body_src.copy()
        self.L_man = Layer(man_src, man)
        plate = body_src.copy()
        # the machine side keeps its own artwork (rim and outline) under the man's edge
        off_machine = poly_mask(H, [(0, 0), (500, 0), (500, 1254), (0, 1254)])
        plate[cv2.bitwise_and(cv2.dilate(man, np.ones((5, 5), np.uint8)), off_machine) > 0] = self.bg.astype(np.uint8)
        plate[cv2.dilate(head, np.ones((5, 5), np.uint8)) > 0] = self.bg.astype(np.uint8)
        self.base = plate
        super().setup()    # drum water plate from the clean machine
        # the artwork's own few bubbles ride round with the water, nothing added
        x0, y0, x1, y1 = self.wbox
        crop = self.base[y0:y1, x0:x1]
        n = 2 * self.DRUM_R
        yy, xx = np.mgrid[0:n, 0:n]
        inside = ((xx - self.DRUM_R) ** 2 + (yy - self.DRUM_R) ** 2) < (self.DRUM_R - 26) ** 2
        wm = (white_mask(crop) > 0) & inside
        k, lab, st, _ = cv2.connectedComponentsWithStats(wm.astype(np.uint8), 8)
        small = np.isin(lab, [i for i in range(1, k) if st[i, 4] < 2500])
        foam = wm & ~small
        self.dots = cv2.dilate(small.astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
        self.no_foam = (1 - cv2.dilate(foam.astype(np.uint8), np.ones((9, 9), np.uint8))) * inside
        self.bubble_rgb = crop.copy()

    def blob_offsets(self, tau):
        return [(0, 0)] * len(self.blob_w)

    def spin_water(self, img, tau):
        x0, y0, x1, y1 = self.wbox
        m = cv2.getRotationMatrix2D((self.DRUM_R, self.DRUM_R), -self.spin(tau), 1.0)
        rot = cv2.warpAffine(self.water_plate, m, (2 * self.DRUM_R, 2 * self.DRUM_R), flags=cv2.INTER_LINEAR,
                             borderValue=tuple(int(v) for v in self.navy))
        a = self.water_mask[..., None]
        roi = img[y0:y1, x0:x1].astype(np.float32)
        roi = roi * (1 - a) + rot.astype(np.float32) * a
        # bubbles: rotated with their own mask, kept off the foam
        n = 2 * self.DRUM_R
        # they slosh back and forth with the tumble, staying in view above the cloth
        mb = cv2.getRotationMatrix2D((self.DRUM_R, self.DRUM_R), -28 * math.sin(2 * math.pi * tau / 1.6), 1.0)
        bub = cv2.warpAffine(self.bubble_rgb, mb, (n, n), flags=cv2.INTER_LINEAR).astype(np.float32)
        ba = cv2.warpAffine(self.dots, mb, (n, n), flags=cv2.INTER_LINEAR).astype(np.float32) / 255 * self.no_foam
        ba = ba[..., None]
        img[y0:y1, x0:x1] = (roi * (1 - ba) + bub * ba).clip(0, 255).astype(np.uint8)

    def render(self, tau):
        img = self.base.copy()
        self.spin_water(img, tau)                      # the drum's water and bubbles really spin
        # he stands against the machine: keep the body sway tiny so no gap opens between them
        B = rot_about(280, 1254, 0.2 * wave(tau, 3.2), 0, 0)
        breath = 1 + 0.003 * wave(tau, 1.6, 0.5)
        B = compose(B, np.float32([[1, 0, 0], [0, breath, 1254 * (1 - breath)]]))
        self.L_man.draw(img, B)

        laugh = smooth((tau - 1.35) / 0.25) - smooth((tau - 2.3) / 0.3)
        nod = 2.5 * math.sin(2 * math.pi * tau / 0.8) * (0.4 + 0.6 * laugh)
        Mh = rot_about(*self.NECK, -1.5 + nod, 0, 0)
        b = blink(tau, (0.8, 2.05))

        def face(rgb, a, x0, y0):
            for (e, rx, ry) in self.EYES:
                eyelid(rgb, a, x0, y0, e, rx, ry, b, self.skin, width=5)
            mouth(rgb, a, x0, y0, self.MOUTH, self.skin, laugh, cover=self.MOUTH_COVER, width=5)

        self.L_head.draw(img, compose(B, Mh), overlay=face)

        # pushing the cloth into the drum: in-out with a small swirl
        push = 0.5 - 0.5 * math.cos(2 * math.pi * tau / 1.6)
        hx, hy = 16 * push, 8 * push
        turn = 7 * math.sin(2 * math.pi * tau / 1.6 + 0.9)
        Mc = rot_about(*self.WRIST, turn, hx, hy)

        def swirl(x, y):
            d = np.hypot(x - self.WRIST[0], y - self.WRIST[1])
            k = np.clip(d / 340, 0, 1) ** 1.3
            ph = 2 * math.pi * tau / 0.8 - d * 0.018
            return 12 * k * np.sin(ph), 8 * k * np.cos(ph * 0.9)

        self.L_cloth.draw(img, compose(B, Mc), deform=swirl)

        def follow(x, y):
            w = along(x, y, self.ELBOW, self.WRIST) ** 1.2
            return hx * w, hy * w

        self.L_arm.draw(img, B, deform=follow)
        plate = self.plate.copy()
        plate[PAD:PAD + self.h, PAD:PAD + self.w] = img
        return plate


def yellow_mask(img):
    r, g, b = [img[..., i].astype(np.int32) for i in range(3)]
    return (((r > 230) & (g > 170) & (b < 120)) * 255).astype(np.uint8)


def gust(tau):
    """Wind strength 0..1: two soft gusts per scene, never fully still."""
    return 0.35 + 0.65 * (0.5 - 0.5 * math.cos(2 * math.pi * tau / 1.6)) ** 1.5


# ====================================================================== scene 3
class PDrying(film.Drying):
    """She pins a T-shirt to the line; the breeze billows the shirt and swings the towel."""

    NECK = (400, 494)
    EYES = [((392, 365), 6, 9), ((451, 355), 6, 9)]
    MOUTH = ((396, 411), (438, 415))
    MOUTH_COVER = (417, 418, 27, 15)

    def setup(self):
        super().setup()
        img = self.base
        nb = nonbg(img, self.bg, thr=16)   # the towel yellow is close to this orange
        H = img.shape[:2]
        self.skin = tuple(int(v) for v in img[410, 355])

        head_poly = [(30, 140), (530, 140), (546, 300), (506, 440), (474, 482), (440, 494), (350, 494),
                     (304, 474), (250, 520), (186, 556), (120, 618), (30, 618)]
        head = cv2.bitwise_and(poly_mask(H, head_poly), nb)

        sk = cv2.dilate(skin_mask(img), np.ones((9, 9), np.uint8))
        pins = cv2.dilate(cv2.bitwise_and(yellow_mask(img), poly_mask(H, [(560, 390), (880, 390), (880, 520), (560, 520)])),
                          np.ones((7, 7), np.uint8))
        tee_poly = [(480, 466), (612, 466), (700, 496), (848, 474), (940, 630), (946, 748), (882, 760),
                    (878, 986), (786, 992), (476, 992), (462, 760), (440, 700)]
        tp = poly_mask(H, tee_poly)
        tee = cv2.bitwise_and(white_mask(img), tp)
        tee = fill_holes(cv2.morphologyEx(tee, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8)))
        # take the whole outline and the white sticker rim with the cloth
        tee = cv2.bitwise_and(cv2.dilate(tee, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (47, 47))), tp)
        tee = cv2.bitwise_and(tee, nb)
        tee = cv2.bitwise_and(tee, cv2.bitwise_not(cv2.bitwise_or(sk, pins)))

        towel_poly = [(896, 446), (1100, 400), (1186, 420), (1199, 806), (900, 810)]
        twp = poly_mask(H, towel_poly)
        towel = cv2.bitwise_and(yellow_mask(img), twp)
        towel = fill_holes(cv2.morphologyEx(towel, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)))
        towel = cv2.bitwise_and(cv2.dilate(towel, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (47, 47))), twp)
        towel = cv2.bitwise_and(towel, nb)
        towel = cv2.bitwise_and(towel, cv2.bitwise_not(poly_mask(H, [(900, 380), (1199, 330), (1199, 446), (900, 470)])))

        static = poly_mask(H, [(600, 860), (1199, 860), (1199, 1312), (600, 1312)])                     # basket
        woman_poly = [(20, 140), (540, 140), (620, 470), (930, 460), (930, 620), (560, 1312), (20, 1312)]
        woman = cv2.bitwise_and(nb, poly_mask(H, woman_poly))
        woman = cv2.bitwise_and(woman, cv2.bitwise_not(cv2.bitwise_or(static, cv2.bitwise_or(tee, towel))))
        woman = cv2.bitwise_and(woman, cv2.bitwise_not(head))
        woman = cv2.bitwise_or(woman, cv2.bitwise_and(nb, poly_mask(H, [(330, 470), (480, 470), (480, 540), (330, 540)])))
        line_strip = poly_mask(H, [(470, 430), (930, 400), (930, 478), (470, 492)])
        woman = cv2.bitwise_and(woman, cv2.bitwise_not(cv2.bitwise_and(line_strip,
                                cv2.bitwise_not(cv2.dilate(skin_mask(img), np.ones((9, 9), np.uint8))))))
        # the leaves (a lighter blue than the apron) keep their own layer on top of her
        r, g, bch = [img[..., i].astype(np.int32) for i in range(3)]
        leaf = (((bch > 100) & (bch < 150) & (r < 45) & (g > 45) & (g < 85)) * 255).astype(np.uint8)
        leaf = cv2.bitwise_and(leaf, poly_mask(H, [(0, 900), (310, 900), (310, 1312), (0, 1312)]))
        leaf = cv2.morphologyEx(leaf, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        plant = cv2.bitwise_and(cv2.dilate(leaf, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))), nb)

        self.L_head = Layer(img, head)
        self.L_tee = Layer(img, tee)
        self.L_towel = Layer(img, towel)
        self.L_plant = Layer(img, plant)
        hands = cv2.bitwise_and(cv2.dilate(skin_mask(img), np.ones((11, 11), np.uint8)),
                                poly_mask(H, [(500, 480), (930, 470), (930, 610), (500, 620)]))
        self.L_hands = Layer(img, cv2.bitwise_or(hands, pins))          # hands and pegs stay on top of the shirt
        body_src = fill_vertical(img, cv2.dilate(cv2.bitwise_or(tee, towel), np.ones((5, 5), np.uint8)))
        self.L_woman = Layer(body_src, woman)
        plate = img.copy()
        for m in (woman, head, tee, towel):
            plate[cv2.dilate(m, np.ones((11, 11), np.uint8)) > 0] = self.bg.astype(np.uint8)
        # the clothesline and basket come back on top of the cleared plate
        line_m = cv2.bitwise_and(nb, poly_mask(H, [(450, 420), (1199, 330), (1199, 420), (450, 500)]))
        line_m = cv2.bitwise_and(line_m, cv2.bitwise_not(cv2.bitwise_or(tee, towel)))
        keep = cv2.bitwise_or(line_m, cv2.bitwise_and(nb, static))
        keep = cv2.bitwise_and(keep, cv2.bitwise_not(cv2.bitwise_or(woman, cv2.dilate(cv2.bitwise_or(tee, towel),
                                                                                    np.ones((17, 17), np.uint8)))))
        plate[keep > 0] = img[keep > 0]
        self.base = plate

        # The cloth is bent in place (a smooth displacement field over the untouched artwork)
        # rather than cut out, so nothing behind the shirt or towel is ever revealed.
        flat = img.copy()
        core = cv2.dilate((head > 235).astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
        neck = poly_mask(H, [(330, 470), (480, 470), (480, 540), (330, 540)])
        neck = cv2.bitwise_or(neck, poly_mask(H, [(240, 480), (340, 450), (340, 560), (225, 560)]))
        seam = np.zeros(H, np.uint8)
        cv2.polylines(seam, [np.array([(304, 474), (250, 520), (186, 556), (120, 618), (30, 618)], np.int32)],
                      False, 255, 26)
        neck = cv2.bitwise_or(neck, seam)
        core = cv2.bitwise_and(core, cv2.bitwise_not(neck))
        flat[core > 0] = self.bg.astype(np.uint8)
        self.flat = flat

        def reach(m, grow, soft):
            m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow, grow)))
            return cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), soft)

        hand_hold = reach(cv2.bitwise_or(hands, pins), 15, 6)
        self.w_tee = reach(tee, 31, 9) * (1 - hand_hold)
        self.w_towel = reach(towel, 31, 9)
        self.w_plant = reach(plant, 21, 7)
        self.fx, self.fy = np.meshgrid(np.arange(self.w, dtype=np.float32), np.arange(self.h, dtype=np.float32))

    def blob_offsets(self, tau):
        return [(0, 0)] * len(self.blob_w)

    def render(self, tau):
        img = self.flat.copy()
        s = self.sprites
        film.draw_sprite(img, s['sun'], angle=16 * tau, scale=1.0 + 0.035 * wave(tau, 1.6), pivot=self.SUN)
        g = gust(tau)
        x, y = self.fx, self.fy
        v = np.clip((y - 500) / 460, 0, 1) ** 1.3
        hz = 0.35 + 0.65 * np.clip((x - 500) / 400, 0, 1)
        ph = 2 * math.pi * tau / 0.75 - (y - 500) * 0.016
        dx = self.w_tee * v * hz * (18 * g + 7 * np.sin(ph))
        dy = self.w_tee * v * (-7 * g + 3 * np.cos(ph))
        k = np.clip((y - 440) / 330, 0, 1) ** 1.4
        ph2 = 2 * math.pi * tau / 0.7 - (y - 440) * 0.02
        dx += self.w_towel * k * (16 * g + 6 * np.sin(ph2))
        dy += self.w_towel * k * (-6 * g + 3 * np.cos(ph2))
        kl = np.clip((1230 - y) / 300, 0, 1) ** 1.5
        dx += self.w_plant * kl * (5 * g * math.sin(2 * math.pi * tau / 1.6 + 0.4) + 2 * np.sin(x * 0.02 + tau * 5))
        img = cv2.remap(img, x - dx, y - dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        film.draw_sprite(img, s['lines'], alpha=0.55 + 0.45 * (0.5 + 0.5 * wave(tau, 0.9)))
        self.render_head(img, tau, g)
        plate = self.plate.copy()
        plate[PAD:PAD + self.h, PAD:PAD + self.w] = img
        return plate

    def render_head(self, img, tau, g):
        B = np.float32([[1, 0, 0], [0, 1, 0]])
        laugh = smooth((tau - 1.2) / 0.25) - smooth((tau - 2.2) / 0.3)
        Mh = rot_about(*self.NECK, 2.0 * wave(tau, 2.4) + 2.0 * laugh, 0, 1.2 * wave(tau, 1.2))
        b = blink(tau, (0.75, 2.0))
        look = smooth((tau - 0.5) / 0.25) * (1 - smooth((tau - 1.1) / 0.2))

        def face(rgb, a, x0, y0):
            for (e, rx, ry) in self.EYES:
                eye_shift(rgb, a, x0, y0, e, rx, ry, 4 * look, 3 * look, self.skin)
                eyelid(rgb, a, x0, y0, (e[0] + 4 * look, e[1] + 3 * look), rx, ry, b, self.skin)
            mouth(rgb, a, x0, y0, self.MOUTH, self.skin, laugh, cover=self.MOUTH_COVER)

        def ponytail(x, y):
            # swings through the middle; pinned where the hair meets the shoulder
            w = np.clip((300 - x) / 240, 0, 1) * np.clip((y - 200) / 200, 0, 1) * np.clip((600 - y) / 110, 0, 1)
            return w * (-12 * g + 5 * math.sin(2 * math.pi * tau / 0.9)), w * 4 * math.cos(2 * math.pi * tau / 0.9)

        self.L_head.draw(img, compose(B, Mh), overlay=face, deform=ponytail)

    def render_cutout(self, tau):
        """Earlier cut-out version, kept for reference."""
        img = self.base.copy()
        s = self.sprites
        film.draw_sprite(img, s['sun'], angle=16 * tau, scale=1.0 + 0.035 * wave(tau, 1.6), pivot=self.SUN)
        film.draw_sprite(img, s['lines'], alpha=0.55 + 0.45 * (0.5 + 0.5 * wave(tau, 0.9)))
        g = gust(tau)

        def leaves(x, y):
            k = np.clip((1230 - y) / 300, 0, 1) ** 1.5
            return k * (5 * g * math.sin(2 * math.pi * tau / 1.6 + 0.4) + 2 * np.sin(x * 0.02 + tau * 5)), 0 * x


        def towel_wind(x, y):
            k = np.clip((y - 440) / 330, 0, 1) ** 1.4
            ph = 2 * math.pi * tau / 0.7 - (y - 440) * 0.02
            return k * (16 * g + 6 * np.sin(ph)), k * (-6 * g + 3 * np.cos(ph))

        self.L_towel.draw(img, deform=towel_wind)

        B = rot_about(260, 1312, 0.7 * wave(tau, 3.2), 0, 0)
        breath = 1 + 0.008 * wave(tau, 1.6, 0.2)
        B = compose(B, np.float32([[1, 0, 0], [0, breath, 1312 * (1 - breath)]]))
        self.L_woman.draw(img, B)
        self.L_plant.draw(img, deform=leaves)

        laugh = smooth((tau - 1.2) / 0.25) - smooth((tau - 2.2) / 0.3)
        Mh = rot_about(*self.NECK, 2.0 * wave(tau, 2.4) + 2.0 * laugh, 0, 1.2 * wave(tau, 1.2))
        b = blink(tau, (0.75, 2.0))
        look = smooth((tau - 0.5) / 0.25) * (1 - smooth((tau - 1.1) / 0.2))

        def face(rgb, a, x0, y0):
            for (e, rx, ry) in self.EYES:
                eye_shift(rgb, a, x0, y0, e, rx, ry, 4 * look, 3 * look, self.skin)
                eyelid(rgb, a, x0, y0, (e[0] + 4 * look, e[1] + 3 * look), rx, ry, b, self.skin)
            mouth(rgb, a, x0, y0, self.MOUTH, self.skin, laugh, cover=self.MOUTH_COVER)

        def ponytail(x, y):
            w = np.clip((300 - x) / 240, 0, 1) * np.clip((y - 200) / 360, 0, 1)
            return w * (-12 * g + 5 * math.sin(2 * math.pi * tau / 0.9)), w * 4 * math.cos(2 * math.pi * tau / 0.9)

        self.L_head.draw(img, compose(B, Mh), overlay=face, deform=ponytail)

        def tee_wind(x, y):
            v = np.clip((y - 500) / 460, 0, 1) ** 1.3
            hz = 0.35 + 0.65 * np.clip((x - 500) / 400, 0, 1)
            ph = 2 * math.pi * tau / 0.75 - (y - 500) * 0.016
            return v * hz * (18 * g + 7 * np.sin(ph)), v * (-7 * g + 3 * np.cos(ph))

        self.L_tee.draw(img, deform=tee_wind)
        self.L_hands.draw(img)
        plate = self.plate.copy()
        plate[PAD:PAD + self.h, PAD:PAD + self.w] = img
        return plate


# ====================================================================== scene 4
class PIroning(film.Ironing):
    """The iron glides back and forth, steam curls up, she smooths the shirt and smiles."""

    NECK = (530, 470)
    EYES = [((567, 337), 6, 9), ((616, 352), 5.5, 8.5)]
    MOUTH = ((537, 386), (577, 404))
    MOUTH_COVER = (557, 396, 27, 16)
    ELBOW = (70, 705)
    WRIST = (420, 830)

    def setup(self):
        super().setup()
        img = self.base
        nb = nonbg(img, self.bg, thr=30)
        H = img.shape[:2]
        self.skin = tuple(int(v) for v in img[370, 515])

        head_poly = [(220, 80), (700, 80), (738, 300), (692, 410), (640, 446), (600, 468), (560, 492), (470, 492),
                     (430, 470), (330, 440), (250, 380), (210, 250)]
        hard = poly_mask(H, head_poly)
        hair_zone = poly_mask(H, [(150, 220), (300, 330), (470, 440), (470, 520), (150, 520)]) > 0
        hair_zone |= poly_mask(H, [(560, 430), (640, 380), (780, 300), (780, 520), (560, 520)]) > 0
        head = np.where(hair_zone, cv2.GaussianBlur(hard, (0, 0), 14), hard).astype(np.uint8)
        head = cv2.bitwise_and(head, nb)

        iron_poly = [(156, 826), (330, 812), (480, 830), (566, 852), (652, 986), (662, 1046), (164, 1050),
                     (140, 1000)]
        ip = poly_mask(H, iron_poly)
        iron = cv2.bitwise_and(nb, ip)

        fa_poly = [(26, 610), (300, 596), (480, 770), (486, 846), (360, 852), (200, 806), (26, 790)]
        fp = poly_mask(H, fa_poly)
        forearm = cv2.bitwise_and(skin_mask(img), fp)
        forearm = cv2.bitwise_and(cv2.dilate(forearm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))), fp)
        forearm = cv2.bitwise_and(forearm, nb)
        # fingers on the handle travel with the iron
        fingers = cv2.bitwise_and(forearm, poly_mask(H, [(330, 812), (500, 812), (500, 900), (330, 900)]))
        iron = cv2.bitwise_or(iron, fingers)
        forearm = cv2.bitwise_and(forearm, cv2.bitwise_not(poly_mask(H, [(352, 836), (500, 836), (500, 900), (352, 900)])))

        stack_poly = [(830, 700), (1199, 700), (1199, 1000), (830, 1000)]
        body_poly = [(20, 70), (740, 70), (760, 690), (900, 950), (880, 1004), (0, 1004)]
        body = cv2.bitwise_and(nb, poly_mask(H, body_poly))
        body = cv2.bitwise_and(body, cv2.bitwise_not(cv2.bitwise_or(poly_mask(H, stack_poly), head)))
        # keep the original hair and neck under the head's cut lines
        cut_band = poly_mask(H, [(170, 220), (300, 340), (440, 448), (600, 466), (600, 530), (420, 530),
                                 (280, 440), (150, 300)])
        cut_band = cv2.bitwise_or(cut_band, poly_mask(H, [(545, 440), (640, 370), (780, 290), (780, 530), (545, 530)]))
        body = cv2.bitwise_or(body, cv2.bitwise_and(nb, cut_band))

        self.L_head = Layer(img, head)
        self.L_iron = Layer(img, iron)
        self.L_forearm = Layer(img, forearm)
        # only the interior of each moving part is rebuilt; at rest the parts cover it completely,
        # and in motion just a sliver next to the edge is revealed
        lifted = cv2.erode(cv2.bitwise_or(iron, forearm), np.ones((7, 7), np.uint8))
        iron_hole = cv2.erode(iron, np.ones((7, 7), np.uint8))
        filled = fill_vertical(img, cv2.bitwise_and(lifted, cv2.bitwise_not(iron_hole)))
        filled = fill_horizontal(filled, iron_hole)
        body = cv2.bitwise_and(body, cv2.bitwise_not(cv2.bitwise_and(lifted, cv2.bitwise_not(body))))
        core_head = cv2.erode((head > 235).astype(np.uint8) * 255, np.ones((3, 3), np.uint8))
        self.L_body = Layer(filled, cv2.bitwise_or(cv2.bitwise_and(body, cv2.bitwise_not(core_head)),
                                                   cv2.bitwise_and(nb, cut_band)))
        plate = filled.copy()
        upper = cv2.bitwise_and(body, poly_mask(H, [(0, 0), (1199, 0), (1199, 960), (0, 960)]))
        core = (head > 235).astype(np.uint8) * 255
        plate[cv2.dilate(cv2.bitwise_or(upper, core), np.ones((7, 7), np.uint8)) > 0] = self.bg.astype(np.uint8)
        self.base = plate

    def blob_offsets(self, tau):
        return [(0, 0)] * len(self.blob_w)

    def glide(self, tau):
        return 24 * math.sin(2 * math.pi * tau / 1.3)

    def render(self, tau):
        img = self.base.copy()
        B = rot_about(420, 1004, 0.6 * wave(tau, 3.2), 0, 0)
        breath = 1 + 0.009 * wave(tau, 1.6, 0.3)
        B = compose(B, np.float32([[1, 0, 0], [0, breath, 1004 * (1 - breath)]]))

        def smoothing_hand(x, y):
            w = falloff(x, y, 790, 950, 70)
            return w * 7 * math.sin(2 * math.pi * tau / 1.3 + math.pi), w * 1.5 * math.cos(2 * math.pi * tau / 1.3)

        self.L_body.draw(img, B, deform=smoothing_hand)

        laugh = smooth((tau - 1.3) / 0.25) - smooth((tau - 2.25) / 0.3)
        Mh = rot_about(*self.NECK, 1.8 * wave(tau, 2.6) - 2.0 * laugh, 0, 1.2 * wave(tau, 1.3))
        b = blink(tau, (0.7, 2.0))
        look = smooth((tau - 0.45) / 0.25) * (1 - smooth((tau - 1.15) / 0.2))
        gx = -3.5 * look + 2.5 * look * math.sin(2 * math.pi * tau / 1.3)

        def face(rgb, a, x0, y0):
            for (e, rx, ry) in self.EYES:
                eye_shift(rgb, a, x0, y0, e, rx, ry, gx, 4 * look, self.skin)
                eyelid(rgb, a, x0, y0, (e[0] + gx, e[1] + 4 * look), rx, ry, b, self.skin)
            mouth(rgb, a, x0, y0, self.MOUTH, self.skin, laugh, cover=self.MOUTH_COVER)

        self.L_head.draw(img, compose(B, Mh), overlay=face)

        dx = self.glide(tau)
        self.L_iron.draw(img, rot_about(400, 1040, -0.8 * math.cos(2 * math.pi * tau / 1.3), dx, 0))

        def follow(x, y):
            # only the forearm (below the elbow→wrist line) stretches; the upper arm stays put
            below = y - (690 + (x - 100) * 90 / 340)
            t_ = along(x, y, self.ELBOW, self.WRIST)
            u = np.clip((t_ - 0.3) / 0.7, 0, 1)
            w = u * u * (3 - 2 * u) * np.clip(below / 25 + 0.5, 0, 1)
            return dx * w, 0 * x

        self.L_forearm.draw(img, B, deform=follow)

        s = self.sprites
        for k in range(2):                          # two staggered curls of steam, rising and fading
            u = (tau / 1.4 + k * 0.5) % 1.0
            film.draw_sprite(img, s['steam'], dx=8 * math.sin(u * 6 + k), dy=40 - 110 * u,
                             alpha=math.sin(math.pi * u) ** 1.2, scale=0.85 + 0.25 * u)
        t1 = 0.5 + 0.5 * wave(tau, 1.2)
        t2 = 0.5 + 0.5 * wave(tau, 1.2, 2.5)
        film.draw_sprite(img, s['sparkA'], scale=0.8 + 0.3 * t1, angle=12 * wave(tau, 2.4), alpha=0.65 + 0.35 * t1)
        film.draw_sprite(img, s['sparkB'], scale=0.75 + 0.35 * t2, angle=-12 * wave(tau, 2.4), alpha=0.65 + 0.35 * t2)
        self.steam_surge(img, tau)
        plate = self.plate.copy()
        plate[PAD:PAD + self.h, PAD:PAD + self.w] = img
        return plate

    def steam_surge(self, img, tau):
        surge = smooth((tau - 2.45) / 0.65)   # paced to the 1 s transition
        if surge <= 0.02:
            return
        m = np.zeros(img.shape[:2], np.uint8)
        sx, sy = self.STACK
        for dxp, dyp, r, th in self.puffs:
            grow = 0.4 + 0.9 * surge
            cv2.circle(m, film.P(sx + dxp * 210 * grow + 20 * math.cos(th + tau * 3), sy - 60 + dyp * 170 * grow - 80 * surge),
                       int(r * grow * 16), 255, -1, cv2.LINE_AA, 4)
        m = cv2.GaussianBlur(m, (0, 0), 14)
        film.blend_mask(img, m, (255, 255, 255), 0.92 * surge)
