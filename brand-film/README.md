# Washing Basket — brand story film

A 15-second, silent, seamlessly looping film for the top of the login screen,
animated directly from the six original illustrations (`../1 collecting.png` … `../6 delivery.png`).

## Deliverables (`dist/`)

| File | Format | Notes |
| --- | --- | --- |
| `washing-basket-story.mp4` | H.264 High, 1080×1350 (4:5), 30 fps, 15.00 s, ~4.2 MB, no audio, faststart | Used by the app (iOS + Android + web) |
| `washing-basket-story.webm` | VP9, 1080×1350, ~2.5 MB | Smaller, for web use only (iOS can't play WebM) |
| `washing-basket-story-poster.jpg` | 1080×1350, a sharp frame at 1.2 s | Static fallback / reduced-motion frame |

## The film

One continuous journey, with a match cut between every stage:

1. **Collecting** — she lifts the shirt, glances at it, laughs; three small suds turn in the porthole.
2. Camera dives **into the porthole**, which opens as an iris onto the washing drum.
3. **Washing** — he feeds the cloth in, the drum water spins, the artwork's own bubbles slosh.
4. The drum's spin becomes the **sun's spin** (rotational blur match cut).
5. **Drying** — the T-shirt and towel billow in the breeze, her ponytail swings, she laughs.
6. A **whip-pan** into the ironing room.
7. **Ironing** — the iron glides, steam curls up; the camera pushes into the ironed stack.
8. A **steam cloud** blooms from the stack and clears onto the packing table.
9. **Packing** — the stack is patted down.
10. **Folded-cloth bands** sweep across and fold down into the courier's stack.
11. **Delivery** — the customer's hands (the courier's own hand from the artwork, mirrored) reach in
    and take the stack; the camera drifts left with it.
12. The camera **whips left** into the next pickup → scene 1 → loop.

No text anywhere. Bubbles and sparkles are kept minimal. Loop seam verified numerically: the
last→first frame difference (3.3 mean abs) matches its neighbours (3.1), i.e. no restart.

Transitions run a full second each with eased camera moves (`TR` in `film.py`; camera keyframes are
re-timed by `camera_time`), so nothing snaps.

Portrait framing: at zoom 1 each scene shows 94 % of the art's width, anchored to the art's bottom
edge (figures are cut there); the extra height is the scene's flat background above it.

## How it's made

`film.py` — programmatic 2.5D motion design (Python, OpenCV, NumPy):

- white line-art (sparkles, sun, steam, hanger, bursts) is lifted off each flat background as sprites and the plate is inpainted;
- characters are cut-out puppets (`scenes_puppet.py`, `puppet.py`): heads, arms, props and cloth are lifted as layers with blinks, gaze and laughing mouths; cloth in the drying scene bends in place; packing and delivery use local mesh warps (`work/rigs.py`);
- steam, suds and transitions are drawn procedurally in the artwork's own language (white strokes, navy outlines);
- a virtual camera (pan / zoom / roll keyframes) frames each scene, and six transitions compose them.

## Re-render

```bash
cd brand-film
python film.py frames 0 450          # → work/frames/f0000.png … f0449.png (split ranges across processes to go faster)
python film.py still 13.95           # a single frame at t = 13.95 s
```

Encode (ffmpeg ships with `imageio-ffmpeg`):

```bash
ffmpeg -framerate 30 -i work/frames/f%04d.png -c:v libx264 -preset slow -crf 21 -profile:v high -pix_fmt yuv420p -g 60 -movflags +faststart -an dist/washing-basket-story.mp4
ffmpeg -framerate 30 -i work/frames/f%04d.png -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -pix_fmt yuv420p -an dist/washing-basket-story.webm
```

Then copy the MP4 and poster into `../mobile/assets/video/`.
