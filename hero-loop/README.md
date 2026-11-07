# Washing Basket — hero loop

A 15-second, silent, seamlessly looping hero animation made directly from `../assets/artwork/1.png` … `../assets/artwork/6.png`
(collect → wash → dry → iron → fold → deliver).

## Deliverables (`dist/`)

| File | Format |
| --- | --- |
| `washing-basket-hero-square.mp4` | H.264 High, 1080×1080 (1:1), 30 fps, 15.00 s, no audio, faststart |
| `washing-basket-hero.mp4` | H.264 High, 1200×1312 (full artwork), 30 fps, 15.00 s, no audio, faststart |
| `washing-basket-hero-poster.jpg` | a frame from scene 1, for reduced-motion / before the video loads |

The square version only drops the top 113 px, which is empty background in every illustration, so no character is cropped.

## How it's made (`hero.py` + `acts.py`)

The characters are never redrawn. Every frame starts from the original pixels.

**Actions (`acts.py`)**: pieces of the artwork are lifted as cut-out layers: the bag, a forearm, the shirt, the pegs, arms, the garment, a whole person. Anything a piece used to hide is rebuilt from that piece's own pixels, and the background behind it is repaired. Pieces move rigidly (they slide, or turn about a wrist or shoulder), so faces and hands keep their exact shape.

1. **Collect**: he takes the weight of the bag and draws it over to himself. Her fingers slip off the knot and her hand drops away.
2. **Wash**: scrubbing, foam ripples and a stream of bubbles.
3. **Dry**: she lifts the shirt up to the line, snaps the left peg on and then the right one, and lets go. The breeze then swings the shirt, the towel and the orange tee.
4. **Iron**: the iron glides back and forth while soft puffs of steam roll up (fog, not line-art).
5. **Fold**: she folds the flap over, side-steps to the stack carrying the garment, sets it on top (the stack settles), and steps back.
6. **Deliver**: she takes the stack from him and steps back with it. His hands slide out from under it and lower.

**Life everywhere**: blinks, nods, lean and breathing, swaying cloth, the plant in the breeze, tick-mark pops and sparkles.

**Transitions**: the next scene swipes in from the right (0.6 s, eased, light directional blur). Scene 6 → scene 1 is just another swipe, so the loop has no seam.

The camera is static, and there is no text or sound.

## Re-render

```bash
python hero.py render        # → dist/*.mp4 + poster (≈2 min)
python hero.py sheet         # → work/sheet.jpg, 24-frame contact sheet
python hero.py still 6.2     # → work/still.png
python hero.py debug 4       # → work/debug_s4.png, motion handles / eye boxes drawn on scene 4
```

Timing, amplitudes and positions are all in the `SCENES` table at the top of `hero.py`.
