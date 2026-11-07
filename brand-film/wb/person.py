"""Rigged characters drawn in the reference illustrations' style.

Local space: origin at the base of the neck, facing right, y down. Mirror the
whole figure with `at(c, sx=-1)` to face left.
"""
import math
from dataclasses import dataclass, field

from .draw import (NAVY, NAVY_APRON, SKIN, TONGUE, WHITE, YELLOW, at, capsule, circle, ik, line,
                   oval, paint, pen, poly, shape, smooth, union)

UPPER, FORE = 150.0, 138.0
FAR_SHOULDER = (96.0, 34.0)
NEAR_SHOULDER = (-92.0, 40.0)
HEAD_PIVOT = (6.0, -38.0)     # top of the neck
HEAD_C = (16.0, -132.0)       # head centre
HEAD_S = 1.3                  # big, friendly heads, as in the references


@dataclass
class Style:
    hair: str = 'bun'               # bun | ponytail | long | curly | courier
    shirt: int = 0                  # colour
    cuff: bool = True               # white sleeve cuffs
    apron: bool = True
    glasses: bool = False
    earring: bool = False
    scrunchie: int = YELLOW


@dataclass
class Pose:
    lean: float = 0.0               # degrees, about the hips
    breathe: float = 0.0            # -1..1
    head_tilt: float = 0.0
    head_turn: float = 0.0          # -1 (looking back) .. 1 (towards camera-right)
    head_dy: float = 0.0
    look: tuple = (0.0, 0.0)
    blink: float = 0.0
    brow: float = 0.0               # raise
    smile: float = 0.6
    open: float = 0.0               # open-mouth smile
    hair_sway: float = 0.0          # -1..1
    near_hand: tuple = (40.0, 230.0)
    far_hand: tuple = (150.0, 220.0)
    near_bend: int = -1
    far_bend: int = -1
    near_grip: str = 'grip'          # grip | open | fist
    far_grip: str = 'grip'
    near_hand_rot: float = 0.0
    far_hand_rot: float = 0.0
    extra: dict = field(default_factory=dict)


# ---------------------------------------------------------------- pieces
def torso_path(b):
    s = 1 + 0.012 * b
    pts = [(-30, -6), (30, -6), (98, 10), (134, 50), (144, 124), (140, 470), (-140, 470), (-146, 124),
           (-136, 52), (-100, 12)]
    return smooth([(x, y * s) for x, y in pts])


def apron_path(b):
    s = 1 + 0.012 * b
    pts = [(-66, 92), (70, 92), (78, 200), (112, 470), (-112, 470), (-76, 200)]
    return poly([(x, y * s) for x, y in pts])


def draw_hand(c, wrist, angle, grip, r=27):
    """Hand at the wrist, pointing along `angle` (radians)."""
    with at(c, wrist[0], wrist[1], math.degrees(angle)):
        if grip == 'fist':
            body = smooth([(4, -22), (34, -26), (50, -14), (52, 12), (38, 26), (8, 24), (-4, 6)])
            shape(c, body, SKIN)
            for y in (-12, 1, 14):
                line(c, [(36, y - 4), (49, y), (36, y + 4)], width=4)
            line(c, [(14, -6), (28, 4), (24, 16)], width=4)
        elif grip == 'open':
            palm = smooth([(2, -20), (30, -24), (60, -18), (66, -2), (58, 14), (30, 22), (4, 18)])
            thumb = smooth([(18, -18), (32, -40), (42, -42), (40, -28), (34, -14)])
            shape(c, thumb, SKIN)
            shape(c, palm, SKIN)
            for y in (-9, 2, 12):
                line(c, [(44, y), (58, y + 1)], width=3.6)
        else:  # grip: fingers curled over an object
            palm = smooth([(2, -22), (34, -26), (54, -16), (56, 8), (44, 24), (14, 26), (0, 10)])
            shape(c, palm, SKIN)
            for x in (24, 36, 47):
                line(c, [(x, -20), (x + 4, -6), (x, 6)], width=3.6)
            line(c, [(8, 12), (24, 18), (36, 16)], width=3.6)


def draw_arm(c, shoulder, target, bend, grip, style, hand_rot=0.0, sleeve=True):
    elbow, wrist = ik(shoulder, target, UPPER, FORE, bend)
    shape(c, capsule(elbow, 25, wrist, 21), SKIN)
    shape(c, capsule(shoulder, 31, elbow, 26), SKIN)
    if sleeve:
        mid = (shoulder[0] + (elbow[0] - shoulder[0]) * 0.55, shoulder[1] + (elbow[1] - shoulder[1]) * 0.55)
        shape(c, capsule(shoulder, 38, mid, 33), style.shirt)
        if style.cuff:
            a = math.atan2(elbow[1] - shoulder[1], elbow[0] - shoulder[0])
            nx, ny = -math.sin(a), math.cos(a)
            p0 = (mid[0] - nx * 32, mid[1] - ny * 32)
            p1 = (mid[0] + nx * 32, mid[1] + ny * 32)
            c.drawPath(poly([p0, p1], closed=False), pen(WHITE, 11))
    ang = math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]) + math.radians(hand_rot)
    draw_hand(c, wrist, ang, grip)
    return elbow, wrist


# ---------------------------------------------------------------- hair
def hair_back(c, style, p):
    h = style.hair
    sway = p.hair_sway
    if h == 'bun':
        bun = circle(-46 + sway * 2, -92, 36)
        k = sway * 8
        flow = smooth([(-40, -70), (-88, -50), (-112, -12), (-100, 18), (-122, 52 + k * 0.3), (-104, 84),
                       (-124 + k * 0.5, 118), (-96, 150 + k * 0.6), (-62, 136), (-58, 96), (-44, 50),
                       (-30, 0)])
        shape(c, union(bun, flow), NAVY)
        line(c, [(-98, 30), (-106, 60)], color=WHITE, width=3, alpha=0.3)
    elif h == 'long':
        flow = smooth([(-72, -70), (-98, -10), (-112, 70), (-120, 160 + sway * 8), (-96, 230 + sway * 10),
                       (-40, 200), (60, 210 + sway * 8), (96, 150), (90, 40), (70, -40)])
        shape(c, flow, NAVY)
    elif h == 'ponytail':
        k = sway
        tail = smooth([(-58, -84), (-96, -80), (-128, -50), (-142 + k * 6, -4), (-136 + k * 14, 50),
                       (-112 + k * 22, 100), (-100 + k * 18, 70), (-104 + k * 8, 24), (-96, -20), (-70, -52)])
        shape(c, tail, NAVY)
        shape(c, oval(-62, -74, 12, 17), style.scrunchie)


def hair_cap(c, style, p):
    """Hair mass behind the face (drawn before the face)."""
    h = style.hair
    if h in ('bun', 'ponytail', 'long'):
        cap = smooth([(-80, 0), (-84, -46), (-58, -84), (-8, -102), (44, -92), (76, -60), (82, -24), (60, -30),
                      (-30, -20), (-60, 30)])
        shape(c, cap, NAVY)
    elif h in ('curly', 'courier'):
        blobs = [circle(x, y, r) for x, y, r in
                 ((-62, -40, 34), (-40, -78, 36), (0, -96, 36), (40, -86, 34), (68, -56, 28),
                  (-74, 0, 28), (-52, 30, 24))]
        shape(c, union(*blobs), NAVY)


def hair_front(c, style, p):
    h = style.hair
    if h in ('bun', 'ponytail'):
        fringe = smooth([(-48, -60), (-10, -92), (40, -86), (76, -54), (80, -26), (56, -46), (24, -50),
                         (0, -40), (-24, -46)])
        shape(c, fringe, NAVY)
    elif h == 'long':
        fringe = smooth([(-56, -40), (-20, -86), (34, -88), (74, -56), (84, -8), (66, -30), (30, -54),
                         (8, -44), (-30, -30)])
        shape(c, fringe, NAVY)
    elif h == 'curly':
        bangs = [circle(x, y, r) for x, y, r in ((20, -70, 22), (48, -60, 20), (-6, -74, 20))]
        shape(c, union(*bangs), NAVY)
    elif h == 'courier':
        dome = smooth([(-74, -30), (-60, -82), (-6, -112), (52, -100), (80, -62), (84, -40), (10, -44)])
        brim = smooth([(40, -52), (96, -58), (130, -46), (118, -34), (60, -36)])
        shape(c, brim, YELLOW)
        shape(c, dome, YELLOW)
        line(c, [(-10, -110), (20, -46)], width=3.6, alpha=0.7)
        shape(c, circle(-6, -112, 7), YELLOW)


# ---------------------------------------------------------------- head
def draw_head(c, style, p):
    fx = p.head_turn * 9
    hair_cap(c, style, p)
    face = smooth([(-64, -36), (-36, -70), (10, -80), (54, -62), (78, -22), (82, 16), (68, 50), (42, 70),
                   (12, 74), (-24, 60), (-54, 30), (-70, -2)])
    shape(c, face, SKIN)
    # ear
    shape(c, oval(-44, 6, 15, 20), SKIN)
    line(c, [(-40, -4), (-48, 4), (-40, 14)], width=3.6)
    if style.earring:
        shape(c, circle(-44, 32, 7), YELLOW, lw=3)
    # eyes
    lx, ly = p.look[0] * 3.5, p.look[1] * 2.5
    for ex, ey, s in ((20 + fx, -2, 1.0), (56 + fx, -4, 0.9)):
        ex, ey = ex + lx, ey + ly
        if p.blink > 0.75:
            line(c, [(ex - 7 * s, ey + 1), (ex, ey + 4), (ex + 7 * s, ey + 1)], width=4)
        else:
            c.drawPath(oval(ex, ey, 6.2 * s, 8.4 * s * (1 - p.blink * 0.85)), paint(NAVY))
            c.drawPath(circle(ex + 2 * s, ey - 3 * s * (1 - p.blink), 1.8 * s), paint(WHITE))
    # brows
    by = -24 - p.brow * 7
    line(c, [(10 + fx, by + 3), (20 + fx, by - 2), (30 + fx, by + 1)], width=4.2)
    line(c, [(48 + fx, by + 1), (58 + fx, by - 2), (66 + fx, by + 2)], width=4.2)
    # nose
    nx = 64 + fx * 0.5
    line(c, [(nx, 4), (nx + 7, 14), (nx - 1, 19)], width=4)
    # mouth
    mx, my = 40 + fx, 40
    if p.open > 0.05:
        o = p.open
        top = [(mx - 18, my - 2), (mx, my + 2), (mx + 16, my - 4)]
        bot = [(mx + 16, my - 4), (mx + 2, my + 6 + 14 * o), (mx - 18, my - 2)]
        mouth = smooth(top + bot[1:], closed=True, tension=0.8)
        shape(c, mouth, NAVY, lw=3.4)
        c.save()
        c.clipPath(mouth, doAntiAlias=True)
        c.drawPath(oval(mx, my + 8 + 12 * o, 11, 7 * o + 2), paint(TONGUE))
        c.restore()
    else:
        s = p.smile
        line(c, [(mx - 16, my - 2 * s), (mx, my + 10 * s), (mx + 15, my - 4 * s)], width=4.4)
    hair_front(c, style, p)
    if style.glasses:
        for ex in (20 + fx + lx, 56 + fx + lx):
            c.drawPath(circle(ex, -1 + ly, 15), pen(NAVY, 4.4))
            c.drawPath(circle(ex, -1 + ly, 13), paint(WHITE, 0.12))
        line(c, [(35 + fx + lx, -4 + ly), (41 + fx + lx, -6 + ly)], width=4)
        line(c, [(5 + fx + lx, -4 + ly), (-34, -4)], width=4, smooth_=False)


# ---------------------------------------------------------------- whole figure
def draw_person(c, style, p, layer='all'):
    """layer: 'body' (everything behind props), 'front' (near arm), or 'all'."""
    with at(c, 0, 0, p.lean, px=0, py=320):
        if layer in ('all', 'body'):
            if style.hair == 'long':
                with at(c, HEAD_C[0], HEAD_C[1] + p.head_dy, p.head_tilt, sx=HEAD_S,
                        px=HEAD_PIVOT[0] - HEAD_C[0], py=HEAD_PIVOT[1] - HEAD_C[1]):
                    hair_back(c, style, p)
            draw_arm(c, FAR_SHOULDER, p.far_hand, p.far_bend, p.far_grip, style, p.far_hand_rot)
            shape(c, torso_path(p.breathe), style.shirt)
            # neckline
            c.drawPath(smooth([(-38, -4), (0, 22), (38, -4)], closed=False), pen(WHITE, 10))
            if style.apron:
                shape(c, apron_path(p.breathe), NAVY_APRON)
                line(c, [(-62, 94), (-56, 8)], width=14, color=NAVY_APRON)
                line(c, [(64, 94), (64, 6)], width=14, color=NAVY_APRON)
                line(c, [(-62, 94), (-56, 8)], width=2.5, color=NAVY)
            shape(c, poly([(-20, -56), (26, -56), (30, 6), (-24, 6)]), SKIN)
            with at(c, HEAD_C[0], HEAD_C[1] + p.head_dy, p.head_tilt, sx=HEAD_S, px=HEAD_PIVOT[0] - HEAD_C[0],
                    py=HEAD_PIVOT[1] - HEAD_C[1]):
                if style.hair != 'long':
                    hair_back(c, style, p)
                draw_head(c, style, p)
        if layer in ('all', 'front'):
            draw_arm(c, NEAR_SHOULDER, p.near_hand, p.near_bend, p.near_grip, style, p.near_hand_rot)
