"""Where the life is: the seven people, the things in their hands, the plants and the hanging shirts.
Everything outside these shapes (machines, tables, shelves, the cart, the board, the rack) is locked:
the motion field is multiplied by a feathered mask of these shapes, so those pixels never move.
Source pixels of the 2172 x 724 illustration."""
import math

TAU = 2 * math.pi


def S(u, period, phase=0.0):
    return math.sin(TAU * (u / period + phase))


def C(u, period, phase=0.0):
    return math.cos(TAU * (u / period + phase))


def glide(u, period, phase=0.0):
    """Back and forth with a soft pause at each end (an ironing stroke, a push)."""
    s = S(u, period, phase)
    return math.copysign(abs(s) ** 0.7, s)


# each person: outline (head, shoulders, torso, arms, down to where a table, cart or stack hides them),
# the head (centre, for a small nod), and how the upper body leans and breathes about the waist
PEOPLE = [
    dict(name="A left machine",
         poly=[(287, 282), (300, 268), (330, 264), (358, 272), (372, 292), (370, 318), (384, 336), (408, 344), (425, 362),
               (438, 400), (448, 440), (450, 500), (380, 500), (378, 470), (360, 462), (330, 462), (290, 470), (255, 480),
               (210, 470), (198, 455), (205, 437), (232, 428), (262, 422), (290, 410), (320, 388), (332, 360), (318, 350),
               (305, 330), (292, 310)],
         head=(332, 308), top=264, waist=472,
         lean=lambda u: 1.4 * S(u, 2.0, .05), breath=lambda u: 0.9 * S(u, 4.0 / 3),
         nod=lambda u: (0.6 * S(u, 2.0, .1), 0.8 * S(u, 2.0, .35), 1.4 * S(u, 4.0))),
    dict(name="B towel",
         poly=[(493, 341), (520, 322), (546, 316), (575, 322), (596, 341), (598, 372), (592, 392), (584, 408), (606, 425),
               (618, 445), (624, 475), (636, 505), (668, 525), (696, 540), (698, 553), (686, 558), (660, 548), (640, 545),
               (600, 546), (560, 546), (540, 545), (520, 530), (490, 515), (468, 505), (460, 490), (466, 460), (474, 438),
               (500, 420), (515, 408), (525, 390), (500, 370)],
         head=(552, 362), top=316, waist=545,
         lean=lambda u: 1.2 * S(u, 4.0 / 3, .1), breath=lambda u: 1.0 * S(u, 4.0 / 3, .4),
         nod=lambda u: (0.5 * S(u, 4.0, .2), 0.9 * S(u, 4.0 / 3, .3), -1.6 * S(u, 4.0))),
    dict(name="C cart",
         poly=[(886, 279), (915, 266), (945, 272), (962, 296), (950, 318), (942, 330), (925, 350), (945, 370), (954, 390),
               (958, 415), (975, 443), (1000, 465), (1018, 480), (1030, 496), (1015, 504), (990, 495), (960, 500),
               (900, 506), (862, 510), (845, 495), (818, 460), (802, 432), (805, 400), (814, 372), (850, 343), (880, 338),
               (885, 320)],
         head=(918, 305), top=266, waist=492,
         lean=lambda u: 1.8 * glide(u, 2.0, .2), breath=lambda u: 1.0 * S(u, 2.0, .3),
         nod=lambda u: (0.6 * S(u, 2.0, .2), 0.7 * S(u, 2.0, .45), 1.4 * S(u, 4.0, .3))),
    dict(name="D rack",
         poly=[(1021, 296), (1045, 280), (1068, 284), (1078, 300), (1077, 318), (1070, 332), (1090, 340), (1115, 318),
               (1140, 300), (1155, 285), (1165, 282), (1168, 296), (1150, 315), (1132, 335), (1110, 358), (1094, 372),
               (1100, 410), (1108, 470), (1110, 505), (1032, 505), (1030, 440), (1036, 370), (1010, 365), (1003, 345),
               (1006, 320), (1015, 305)],
         head=(1048, 306), top=280, waist=500,
         lean=lambda u: 1.0 * S(u, 2.0, .3), breath=lambda u: 0.9 * S(u, 2.0, .6),
         nod=lambda u: (0.4 * S(u, 2.0, .3), -0.8 * abs(S(u, 2.0, .1)), 1.2 * S(u, 4.0, .5))),
    dict(name="E iron",
         poly=[(1326, 300), (1332, 278), (1362, 264), (1395, 272), (1420, 300), (1422, 320), (1395, 334), (1385, 350),
               (1365, 362), (1395, 378), (1412, 410), (1418, 450), (1445, 488), (1480, 520), (1505, 540), (1508, 552),
               (1485, 556), (1460, 535), (1420, 505), (1395, 500), (1380, 505), (1370, 546), (1240, 546), (1240, 500),
               (1290, 512), (1250, 490), (1215, 462), (1208, 445), (1225, 412), (1258, 364), (1305, 354), (1328, 330)],
         head=(1366, 316), top=264, waist=520,
         lean=lambda u: 1.6 * glide(u, 2.0, .02), breath=lambda u: 1.0 * S(u, 1.0, .2),
         nod=lambda u: (1.0 * S(u, 2.0, .05), 0.7 * S(u, 1.0, .3), 1.2 * S(u, 2.0, .05))),
    dict(name="F folding",
         poly=[(1674, 336), (1700, 325), (1725, 317), (1750, 325), (1767, 350), (1762, 388), (1752, 404), (1772, 436),
               (1786, 462), (1812, 478), (1830, 490), (1832, 505), (1810, 508), (1790, 505), (1760, 505), (1730, 500),
               (1690, 505), (1655, 505), (1640, 485), (1640, 445), (1636, 420), (1655, 380), (1670, 355)],
         head=(1724, 362), top=317, waist=500,
         lean=lambda u: 1.2 * S(u, 2.0, .2), breath=lambda u: 1.0 * S(u, 4.0 / 3, .1),
         nod=lambda u: (0.5 * S(u, 2.0, .3), 0.9 * S(u, 2.0, .05), 1.6 * S(u, 4.0, .6))),
    dict(name="G right machine",
         poly=[(1848, 318), (1852, 292), (1880, 285), (1905, 292), (1922, 308), (1905, 320), (1903, 340), (1890, 355),
               (1898, 370), (1910, 408), (1950, 415), (1985, 420), (2030, 426), (2034, 440), (2015, 448), (1980, 450),
               (1935, 452), (1910, 460), (1910, 503), (1832, 503), (1830, 440), (1834, 372), (1860, 350)],
         head=(1878, 326), top=285, waist=455,
         lean=lambda u: 1.2 * glide(u, 2.0, .55), breath=lambda u: 0.9 * S(u, 2.0, .9),
         nod=lambda u: (0.6 * S(u, 2.0, .55), 0.6 * S(u, 2.0, .8), 0.0)),
]

# what the hands hold, with the flat cloth or paper around it (bending a flat white surface is invisible),
# kept clear of every hard edge of the furniture
PROPS = [
    # the laundry he draws out of the left drum
    [(128, 440), (160, 415), (200, 405), (250, 402), (290, 415), (330, 425), (350, 440), (345, 480), (320, 500),
     (270, 505), (220, 510), (180, 500), (140, 490), (125, 470)],
    # the towel she rolls, on the flat table top
    [(530, 548), (560, 538), (700, 538), (712, 556), (712, 588), (540, 590), (526, 575)],
    # the iron and the cloth it glides over (stops short of the board's edge and the small stack)
    [(1228, 500), (1300, 494), (1390, 503), (1422, 518), (1422, 553), (1228, 553)],
    # the shirt she folds
    [(1722, 492), (1770, 490), (1820, 500), (1842, 520), (1845, 548), (1722, 548), (1718, 530)],
    # the load he pushes into the right drum
    [(1945, 395), (1990, 383), (2030, 388), (2045, 410), (2045, 465), (2010, 478), (1975, 470), (1945, 450)],
    # the white shirts on the rail
    [(1180, 286), (1312, 286), (1312, 438), (1180, 438)],
]

# hands and the things they hold: c centre, r0 rigid radius, r1 falloff, asp ellipse scale, ymax nothing below,
# f(u) -> (dx, dy, deg)
HANDLES = [
    dict(c=(240, 455), r0=60, r1=125, asp=(1.3, 1.0), f=lambda u: (4.5 * glide(u, 2.0), 0.8 * S(u, 2.0, .25), 0.8 * S(u, 2.0))),
    dict(c=(622, 562), r0=72, r1=120, asp=(1.5, 1.0), ymax=590, f=lambda u: (5.0 * glide(u, 4.0 / 3), 0, 0)),
    dict(c=(1155, 290), r0=20, r1=58, f=lambda u: (2.0 * S(u, 2.0, .1), -2.0 * abs(S(u, 2.0, .1)), 0)),
    dict(c=(1310, 528), r0=54, r1=105, asp=(1.35, 1.0), ymax=553, f=lambda u: (8.0 * glide(u, 2.0), 0, 0)),
    dict(c=(1490, 542), r0=24, r1=58, ymax=556, f=lambda u: (-3.0 * glide(u, 2.0, .1), 0, 0)),
    dict(c=(1790, 508), r0=38, r1=88, asp=(1.4, 1.0), ymax=546,
         f=lambda u: (1.4 * S(u, 2.0, .15), -4.0 * (0.5 - 0.5 * C(u, 2.0)), 0)),
    dict(c=(2000, 432), r0=50, r1=95, asp=(1.3, 1.0), f=lambda u: (3.5 * glide(u, 2.0, .5), 0.8 * S(u, 1.0), 0)),
]

IRON_X = lambda u: 8.0 * glide(u, 2.0)

# cloth and leaves: hang from `top` or grow from `bottom`; leaves only move where they are green
SWAY = [
    dict(box=(1182, 284, 1312, 436), top=290, amp=2.5, period=2.0, phase=0.0, green=False),   # shirts on the rail
    dict(box=(0, 408, 104, 600), bottom=600, amp=4.0, period=4.0, phase=0.0, green=True),     # plant, far left
    dict(box=(2084, 414, 2172, 600), bottom=600, amp=4.0, period=4.0, phase=0.35, green=True),  # plant, far right
    dict(box=(700, 196, 810, 404), top=212, amp=4.0, period=4.0, phase=0.15, green=True),     # trailing plant
    dict(box=(1390, 180, 1495, 262), bottom=262, amp=2.5, period=4.0, phase=0.5, green=True),  # shelf plant
    dict(box=(652, 156, 772, 228), bottom=228, amp=2.0, period=4.0, phase=0.7, green=True),    # pot plant
]
