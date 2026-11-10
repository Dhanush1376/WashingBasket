# Washing Basket — 60-second brand film (9:16)

**Final video:** `dist/Washing-Basket-Brand-Film-60s.mp4`. It is 1080 × 1920, 30 fps, H.264 High, AAC 256 kbps, and exactly 60.0 s long.

A story-led, product-launch-style film on a plain beige stage. It is told with a voice-over, kinetic headlines and real UI cards that lift out of the phone. Every UI element is a crop of a **real screen of the Washing Basket app**, captured from the running app (Expo web) by a script that signs up a brand-new customer and goes through the whole journey. Film graphics (counter, check burst, logo build) only restate facts the app shows.

## Story (all app facts captured from the app)
| Time | Beat | Voice-over / what is shown |
|---|---|---|
| 0–6 s | Problem | "Your week is packed." A calendar fills up. "And the laundry? It just keeps piling up." Clothes stack up, then are pulled into… |
| 6–12 s | Brand | …the basket. The logo builds from its real artwork (basket, cloths, towel, sparkles), the wordmark wipes in, then "Laundry, made effortless." |
| 12–17 s | Sign-up | The phone field lifts out and the number types in; the 6 OTP digits fill one by one; a verified check |
| 17–21 s | Dashboard | New account: **0 active orders** and wallet **₹0** cards lift out |
| 21–28 s | Wallet | ₹0 wallet card → ₹2,000 chip → counter ₹2,000 + **₹100 bonus (5% on ₹2,000+)** = **₹2,100** → the real ₹2,100 card + 2 transactions ("Top-up (demo, no charge)") |
| 28–38 s | Booking | Wash & Iron · 9 pieces (Shirt ×4, T-shirt ×3, Jeans ×2) → day **Tmrw 11 Nov** picked → **8:00–10:00 AM** slot → review "Wed, 11 Nov · 8:00–10:00 AM", total **₹214** |
| 38–46 s | Coupon & pay | On the order's Bill & Payment sheet: FIRSTWASH ticket stamps "Applied · Saved ₹33", total **₹214 → ₹181**, "Pay ₹181 & Unlock QR", then "Payment successful · ₹181 paid from wallet" |
| 46–52 s | QR | The locked pickup QR wiggles → after payment it unlocks (real code WHMMF-3MZP2) → scanner frame → confirm beep |
| 52–55.5 s | Tracking | The real progress card fills step by step: Collected → Washing & Drying → Ironing & Packing → **Out for Delivery** → Delivered (pending) |
| 55.5–60 s | End | Logo lockup, "Laundry, made effortless.", "Get started today" |

**Sound:** a voice-over (Microsoft neural TTS through `edge-tts`, voice en-IN-NeerjaExpressive; script in `vo.py`, clips in `vo/`). Under it sits an original synthesised music bed that ducks under the voice. About 150 synthesised sound effects (lifts, typing, OTP ticks, counter ticks, coupon stamp, payment chime, unlock, scanner, beep, logo build) are timed from the composition's own cue list. **Check the TTS licence terms for paid ad use**, or re-record the same script with a voice artist: drop the new clips into `vo/00…10.wav` and rerun `audio.py` + `mux.py`.

## Two demo-data adjustments (capture session only; no app file was changed)
`capture/fresh-account.js` patches the dev bundle **in memory**, and only inside the headless capture browser:
1. **Fresh account.** The app's demo layer pre-fills every new sign-in with sample orders, ₹1,500 "Welcome credit (demo)" and about 14 sample transactions. These are switched off so the film shows what a real new customer sees: ₹0 and 0 orders. The sample profile (a developer test name) is replaced with the fictional on-camera customer, *Ananya Sharma*.
2. **Home pickup.** `NewOrderScreen` currently fixes the service mode to *Office drop-off* and has no switch. Its pickup step (day picker + two-hour slots, configured for Model Town) is therefore built but **not reachable in the app today**. The film starts that screen in *Home pickup* mode so the real calendar step can be shown. **Before publishing this ad, ship a way to choose home pickup in the app, or re-cut the booking beat without the day and slot.**

## Regenerate
Needs Node 18+, Python 3 with Pillow, NumPy and `imageio-ffmpeg`, and Google Chrome.
```bash
cd promo-film && npm install
# 1. app running: from the repo root, start mobile web on :8081 (npx expo start --web --port 8081 in mobile/)
node capture/flow.js                 # → shots/*.png (real screens, 3× retina), log in shots/log.txt
python prep.py                       # → compose/assets/screens/*.jpg (the frames used by the film)
node render.js stills 13.6 25.6 44.6  # optional preview stills → work/ (also writes work/cues.json)
node render.js                       # → dist/video-only.mp4 (1800 frames) + work/cues.json
python vo.py                         # optional: regenerate the voice-over clips (needs `pip install edge-tts`)
python audio.py                      # → work/soundtrack.wav (VO + music + SFX; needs scipy)
python mux.py                        # → dist/Washing-Basket-Brand-Film-60s.mp4 + checks duration/size
```

## Files
- `capture/flow.js`: drives the real app as a new customer and as the demo pickup partner. `capture/fresh-account.js`: the capture-only demo-data fixture.
- `compose/index.html` + `compose/timeline.js`: the composition. `render(t)` is deterministic. It holds headlines, phone screens, taps, the lifted UI cards (crop, target, overlays) and film graphics, and exports `window.CUES` for the sound design. `compose/timeline-v1.js` is the earlier navy cut, kept for reference.
- `render.js`: frame-accurate render to H.264. `audio.py`: soundtrack and UI sounds. `mux.py`: final mux and verification.
