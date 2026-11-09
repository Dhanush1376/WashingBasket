"""python grid.py x0 y0 x1 y1 [scale] -> work/grid.png : a crop of the source with a labelled 20 px grid,
used to read off polygon coordinates. If work/mask.png exists, it is tinted over the crop."""
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
img = cv2.imread(os.path.join(ROOT, "..", "Bright Laundry Workplace Illustration.png"))
x0, y0, x1, y1 = (int(v) for v in sys.argv[1:5])
sc = float(sys.argv[5]) if len(sys.argv) > 5 else 2.0
c = img[y0:y1, x0:x1].copy()
mp = os.path.join(ROOT, "work", "mask.png")
if os.path.exists(mp) and os.environ.get("MASK", "1") == "1":
    m = cv2.imread(mp, 0)[y0:y1, x0:x1].astype(np.float32)[..., None] / 255
    c = (c * (1 - 0.45 * m) + np.array([60, 60, 255]) * 0.45 * m).astype(np.uint8)
c = cv2.resize(c, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC)
for x in range((x0 // 20 + 1) * 20, x1, 20):
    X = int((x - x0) * sc)
    major = x % 100 == 0
    cv2.line(c, (X, 0), (X, c.shape[0]), (0, 160, 0) if major else (150, 220, 150), 1)
    if major:
        cv2.putText(c, str(x), (X + 2, 14), 0, 0.45, (0, 120, 0), 1, cv2.LINE_AA)
for y in range((y0 // 20 + 1) * 20, y1, 20):
    Y = int((y - y0) * sc)
    major = y % 100 == 0
    cv2.line(c, (0, Y), (c.shape[1], Y), (200, 0, 200) if major else (230, 170, 230), 1)
    if major:
        cv2.putText(c, str(y), (2, Y - 3), 0, 0.45, (160, 0, 160), 1, cv2.LINE_AA)
cv2.imwrite(os.path.join(ROOT, "work", "grid.png"), c)
print(c.shape)
