/**
 * Care · how each order is treated, told by the cloth itself.
 *
 * The title sits in the top-left corner; the step being shown is written large in the bottom-right one, and
 * the steps follow the scroll one at a time, holding each for a moment however fast the page moves. Behind
 * them lies one piece of apricot cotton, seen up close, thread by thread, and it goes through the journey
 * (drawn live with WebGL, see clothGL.ts):
 *
 *   Collect  crumpled and dirty, as it came in
 *   Wash     it goes into the water: the water wicks through it and darkens it, rings spread from where it
 *            went in, air bubbles out of the weave, the dirt lifts away in a cloud, suds gather, swell and
 *            burst, and the cloth settles into a new, softer lie
 *   Dry      the water drains and the suds burst away; the damp leaves it patch by patch, the raised folds
 *            first, the last of it rising off in wisps, until it is matte and crisp
 *   Iron     a steam iron is set down on it and pushed and pulled across it in long strokes, pressing the
 *            creases out wherever its soleplate has been, then lifted away
 *   Return   the view draws back to the whole piece, which is folded softly, the way a towel is folded,
 *            and slides away to be handed back
 *
 * Without motion, the steps are listed with their pictures. Without WebGL, the cloth is still shown, dry.
 */
import React, { useRef, useState } from 'react';

import { Lines } from '../components';
import { CARE } from '../content';
import crumple from '../assets/cloth-crumple.webp';
import dirt from '../assets/cloth-dirt.webp';
import foldSprite from '../assets/cloth-fold.webp';
import ironImg from '../assets/cloth-iron.webp';
import washed from '../assets/cloth-washed.webp';
import weave from '../assets/cloth-weave.webp';
import { getLenis, gsap, isJumping, ScrollTrigger, useScene } from '../motion';
import { createClothGL } from './clothGL';

const N = CARE.steps.length;
/** The last step is due by this share of the scroll, leaving the rest for it to be read before the page moves on. */
const DUE = 0.75;
/** The least time (ms) a step stays on screen before the page may scroll on past it, however fast it is scrolled. */
const DWELL = 1400;
/** The share of the scroll at which step `i` comes up. */
const dueAt = (i: number) => (Math.max(0, i - 0.15) * DUE) / (N - 1);

/** How long (s) the cloth takes from one step's state to the next: wash, dry, iron, return. */
const CLOTH = [2.6, 3.0, 5.6, 4.4];
/** The fold, rendered frame by frame (care-fabric/stage.py): a sprite sheet of `frames` cells. */
const FOLD = { frames: 33, cols: 6, fw: 720, fh: 520, sw: 600, sh: 400 };
/** The iron image: its width over its height. */
const IRON_RATIO = 720 / 317;
/** The close-up is drawn a little larger than the stage, so its edges never show. */
const ZOOM = 1.06;

const CLOTH_VARS = {
  '--weave': `url(${weave})`,
  '--crumple': `url(${crumple})`,
  '--dirt': `url(${dirt})`,
} as React.CSSProperties;

const load = (src: string) => {
  const im = new Image();
  im.decoding = 'async';
  im.src = src;
  return im;
};
const pad = (n: number) => String(n).padStart(2, '0');

export function Care() {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);

  useScene(ref, ({ root, one, desktop }) => {
    const stage = one<HTMLElement>('.wash__stage');
    const copy = one<HTMLElement>('.wash__copy');
    const now = one<HTMLElement>('.wash__now');
    const piece = one<HTMLElement>('.cloth__piece');
    const glCv = one<HTMLCanvasElement>('.cloth__gl');
    const foldCv = one<HTMLCanvasElement>('.cloth__fold');
    const iron = one<HTMLElement>('.iron');
    const ironFace = one<HTMLElement>('.iron__face');
    const fctx = foldCv.getContext('2d')!;
    const foldIm = load(foldSprite);
    const state = { p: 0, f: 0 };

    // the iron's track, kept at half the stage's size: white wherever the soleplate has pressed
    const pressCv = document.createElement('canvas');
    pressCv.width = 2;
    pressCv.height = 2;
    const pctx = pressCv.getContext('2d')!;

    const gl = createClothGL(glCv, { weave, crumple, washed, dirt }, pressCv, () => piece.classList.add('has-gl'));
    const u = gl?.u ?? { fold: 0, dirt: 1, lift: 0, soak: 0, water: 0, ring: 0, foam: 0, pop: 0, dry: 0, fluff: 0 };

    // ---- layout: the stage, where the folded cloth will lie, the iron's strokes ------------------------------
    let SW = 0;
    let SH = 0;
    let ironW = 0;
    let track = 0;
    let verts: { x: number; y: number; r: number }[] = [];
    const geo = { dx: 0, dy: 0, k: 1, cx: 0, cy: 0 };
    // the folded piece, as the fold leaves it: where it lies in a sprite cell (a quarter of the cloth, in the
    // lower right), so the view can push in on it and bring it to the middle as it folds
    const folded = { x: 0.75, y: 0.7, w: 0.42, h: 0.39 };
    const zoomIn = { z: 1, w: 1, h: 1, cx: 0, cy: 0, sw: 1, sh: 1, c: new DOMRect(), n: new DOMRect() };

    // where the iron is at `p` of its work, and which way it faces: move by move, easing into and out of
    // each, the line of a stroke bowing a little and the wrist never quite still, as a hand irons
    const ironAt = (p: number) => {
      const segs = verts.length - 1;
      const x = Math.min(segs - 1e-6, Math.max(0, p * segs));
      const k = Math.floor(x);
      const t = x - k;
      const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
      const a = verts[k];
      const b = verts[k + 1];
      const bow = Math.abs(b.x - a.x) > track ? Math.sin(Math.PI * e) * track * 0.07 * (k % 2 ? 1 : -1) : 0;
      return {
        x: a.x + (b.x - a.x) * e,
        y: a.y + (b.y - a.y) * e + bow,
        r: a.r + (b.r - a.r) * e + Math.sin(k * 1.9 + t * 3.1) * 2.2,
        k,
      };
    };
    // from the stage to the close-up's own coordinates (it is drawn ZOOM× about its centre), at half size
    const toPress = (x: number, y: number): [number, number] => [((x - SW / 2) / ZOOM + SW / 2) * 0.5, ((y - SH / 2) / ZOOM + SH / 2) * 0.5];

    const press = (p: number) => {
      if (!SW || verts.length < 2) return;
      pctx.globalCompositeOperation = 'source-over';
      pctx.shadowColor = 'transparent';
      pctx.fillStyle = '#000';
      pctx.fillRect(0, 0, pressCv.width, pressCv.height);
      const at = ironAt(p);
      if (p > 0) {
        // the soleplate's track, soft at its edges: a blurred shadow cast from a path drawn far off the canvas
        const off = 20000;
        pctx.lineCap = 'round';
        pctx.lineJoin = 'round';
        pctx.lineWidth = (track * 0.5) / ZOOM;
        pctx.strokeStyle = '#fff';
        pctx.shadowColor = '#fff';
        pctx.shadowBlur = 9;
        pctx.shadowOffsetX = off;
        pctx.beginPath();
        const [x0, y0] = toPress(verts[0].x, verts[0].y);
        pctx.moveTo(x0 - off, y0);
        for (let i = 1; i <= at.k; i++) {
          const [x, y] = toPress(verts[i].x, verts[i].y);
          pctx.lineTo(x - off, y);
        }
        const [cx, cy] = toPress(at.x, at.y);
        pctx.lineTo(cx - off, cy);
        pctx.stroke();
        // and the whole soleplate where it rests now
        pctx.fillStyle = '#fff';
        pctx.beginPath();
        pctx.ellipse(cx - off, cy, (ironW * 0.42 * 0.5) / ZOOM, (track * 0.5 * 0.5) / ZOOM, 0, 0, Math.PI * 2);
        pctx.fill();
        pctx.shadowColor = 'transparent';
      }
      gl?.pressChanged();
      const h = ironW / IRON_RATIO;
      gsap.set(iron, { x: at.x - ironW / 2, y: at.y - h / 2 });
      gsap.set(ironFace, { rotation: at.r });
    };

    // the fold, frame by frame from the sprite sheet
    foldCv.width = FOLD.fw;
    foldCv.height = FOLD.fh;
    const drawFold = (f: number) => {
      fctx.clearRect(0, 0, FOLD.fw, FOLD.fh);
      if (!foldIm.complete || !foldIm.naturalWidth) return;
      const k = Math.max(0, Math.min(FOLD.frames - 1, Math.round(f * (FOLD.frames - 1))));
      fctx.drawImage(foldIm, (k % FOLD.cols) * FOLD.fw, Math.floor(k / FOLD.cols) * FOLD.fh, FOLD.fw, FOLD.fh, 0, 0, FOLD.fw, FOLD.fh);
    };
    const measureFold = () => {
      const k = FOLD.frames - 1;
      const cv = document.createElement('canvas');
      cv.width = FOLD.fw;
      cv.height = FOLD.fh;
      const cx = cv.getContext('2d', { willReadFrequently: true })!;
      cx.drawImage(foldIm, (k % FOLD.cols) * FOLD.fw, Math.floor(k / FOLD.cols) * FOLD.fh, FOLD.fw, FOLD.fh, 0, 0, FOLD.fw, FOLD.fh);
      const a = cx.getImageData(0, 0, FOLD.fw, FOLD.fh).data;
      let x0 = FOLD.fw, y0 = FOLD.fh, x1 = 0, y1 = 0;
      for (let y = 0; y < FOLD.fh; y += 2)
        for (let x = 0; x < FOLD.fw; x += 2)
          if (a[(y * FOLD.fw + x) * 4 + 3] > 128) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 > x0 && y1 > y0)
        Object.assign(folded, { x: (x0 + x1) / 2 / FOLD.fw, y: (y0 + y1) / 2 / FOLD.fh, w: (x1 - x0) / FOLD.fw, h: (y1 - y0) / FOLD.fh });
      fitZoom();
    };
    // how far to push in: as large as it can be, centred, without touching the title in the top left corner or
    // the step in the bottom right (it may pass beside either of them), the bar at the top or the edges
    const fitZoom = () => {
      const { cx, cy, sw, sh, c, n } = zoomIn;
      const pw = folded.w * zoomIn.w;
      const ratio = (folded.h * zoomIn.h) / pw;
      const m = 20;
      const clear = (below: number, beside: number) => Math.max(below / ratio, beside) * 2;
      const W = Math.min(
        clear(cy - c.bottom - m, cx - c.right - m),
        clear(n.top - m - cy, n.left - m - cx),
        (2 * Math.min(cy - 84, sh - 28 - cy)) / ratio,
        sw - 2 * m,
        sw * (desktop ? 0.42 : 0.68),
        640,
      );
      zoomIn.z = Math.max(1, Math.min(2.4, W / pw));
      pushIn(state.f);
    };
    const pushIn = (f: number) => {
      gsap.set(foldCv, {
        transformOrigin: `${folded.x * 100}% ${folded.y * 100}%`,
        scale: 1 + (zoomIn.z - 1) * f,
        xPercent: -(folded.x - 0.5) * 100 * f,
        yPercent: -(folded.y - 0.5) * 100 * f,
      });
    };
    foldIm.onload = () => {
      drawFold(state.f);
      measureFold();
    };

    const layout = () => {
      const r = stage.getBoundingClientRect();
      SW = r.width;
      SH = r.height;
      gl?.resize(SW, SH);
      pressCv.width = Math.max(2, Math.round(SW / 2));
      pressCv.height = Math.max(2, Math.round(SH / 2));
      // the whole piece, when the view draws back: 3 : 2, in the middle of the stage, between the corners
      const c = copy.getBoundingClientRect();
      const n = now.getBoundingClientRect();
      const top = c.bottom - r.top + 16;
      const bottom = n.top - r.top - 16;
      const spot = { cx: SW / 2, cy: Math.min(Math.max(SH * 0.52, top + 60), bottom - 60) };
      const room = Math.min(spot.cy - top, bottom - spot.cy) * 2;
      const tw = Math.max(120, Math.min(SW * (desktop ? 0.33 : 0.72), SH * 0.42 * 1.5, room * 1.5, 620));
      // the part of the close-up that becomes the piece: the largest 3 : 2 window in the stage
      const ww = Math.min(SW, SH * 1.5);
      const wh = ww / 1.5;
      geo.cx = (SW - ww) / 2;
      geo.cy = (SH - wh) / 2;
      geo.k = tw / (ww * ZOOM);
      geo.dx = spot.cx - SW / 2;
      geo.dy = spot.cy - SH / 2;
      const fw = (tw * FOLD.fw) / FOLD.sw;
      const fh = (fw * FOLD.fh) / FOLD.fw;
      gsap.set(foldCv, { width: fw, height: fh, left: spot.cx - fw / 2, top: spot.cy - fh / 2 });
      const off = (b: DOMRect) => new DOMRect(b.x - r.left, b.y - r.top, b.width, b.height);
      Object.assign(zoomIn, { w: fw, h: fh, cx: spot.cx, cy: spot.cy, sw: SW, sh: SH, c: off(c), n: off(n) });
      fitZoom();
      // the iron's work, row by row down the cloth, as a person irons: pushed tip first a good way along,
      // drawn back a little, pushed on to the edge; there it is turned round as it comes down to the next
      // row, and worked back the other way
      ironW = Math.min(desktop ? SW * 0.3 : SW * 0.7, 540);
      const ironH = ironW / IRON_RATIO;
      const rows = Math.min(5, Math.max(3, Math.round(SH / (ironH * 0.95))));
      track = (SH / rows) * 1.08;
      const ys = Array.from({ length: rows }, (_, i) => track * 0.42 + ((SH - track * 0.84) * i) / (rows - 1));
      const X = (f: number) => -0.04 * SW + f * SW * 1.08;
      verts = [{ x: X(1), y: ys[0], r: 0 }];
      ys.forEach((y, i) => {
        const r = i % 2 ? -180 : 0;
        const fs = i % 2 ? [0.58, 0.4, 1] : [0.42, 0.6, 0];
        if (i > 0) verts.push({ x: X(i % 2 ? 0 : 1), y, r });
        fs.forEach((f) => verts.push({ x: X(f), y, r }));
      });
      gsap.set(iron, { width: ironW, height: ironW / IRON_RATIO });
      press(state.p);
      drawFold(state.f);
    };
    layout();

    // ---- the journey, as one timeline with a label at each step -----------------------------------------------
    const L = (i: number) => CLOTH.slice(0, i).reduce((x, y) => x + y, 0);
    const cloth = gsap.timeline({ paused: true, defaults: { ease: 'power1.inOut' } });
    const [w, d, i3] = CLOTH;
    cloth
      .addLabel('s0', 0)
      // wash: into the water. It wicks through, rings spread, the dirt lifts away, suds gather, the folds change
      .to(u, { water: 1, duration: 0.8, ease: 'power2.out' }, 0.05)
      .to(u, { ring: 1, duration: w - 0.1, ease: 'power1.out' }, 0.05)
      .to(u, { soak: 1, duration: w * 0.62, ease: 'power1.out' }, 0.1)
      .to(u, { lift: 1, duration: w * 0.8, ease: 'sine.inOut' }, w * 0.2)
      .to(u, { dirt: 0, duration: w * 0.7 }, w * 0.25)
      .to(u, { fold: 1, duration: w * 0.7 }, w * 0.25)
      .to(u, { foam: 1, duration: w * 0.65, ease: 'power2.out' }, w * 0.35)
      .to('.cloth__crumple', { opacity: 0, duration: w * 0.7 }, w * 0.25)
      .to('.cloth__dirt', { opacity: 0, duration: w * 0.7 }, w * 0.25)
      .addLabel('s1', L(1))
      // dry: the water drains, the suds burst away, then the damp leaves it patch by patch
      .to(u, { pop: 1, duration: d * 0.5, ease: 'sine.in' }, L(1))
      .to(u, { water: 0, duration: d * 0.55, ease: 'sine.inOut' }, L(1) + d * 0.05)
      .to(u, { dry: 1, duration: d * 0.8, ease: 'sine.inOut' }, L(1) + d * 0.18)
      .to(u, { fluff: 1, duration: d * 0.45 }, L(1) + d * 0.55)
      .addLabel('s2', L(2))
      // iron: set down on the cloth, pushed and drawn back across it, lifted away
      .fromTo(iron, { autoAlpha: 0, scale: 1.14 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power2.out' }, L(2))
      .to(state, { p: 1, duration: i3 - 0.75, ease: 'none', onUpdate: () => press(state.p) }, L(2) + 0.35)
      .to(iron, { autoAlpha: 0, scale: 1.12, duration: 0.4, ease: 'power2.in' }, L(3) - 0.4)
      .addLabel('s3', L(3))
      // return: the view draws back to the whole piece; it is folded, softly, and slides away
      .to(
        piece,
        {
          x: () => geo.dx,
          y: () => geo.dy,
          scale: () => geo.k * ZOOM,
          clipPath: () => `inset(${geo.cy}px ${geo.cx}px ${geo.cy}px ${geo.cx}px round 3px)`,
          duration: 1.2,
          ease: 'power2.inOut',
        },
        L(3),
      )
      .set(foldCv, { autoAlpha: 1 }, L(3) + 1.2)
      .set(piece, { autoAlpha: 0 }, L(3) + 1.25)
      .to(state, { f: 1, duration: 2.1, ease: 'sine.inOut', onUpdate: () => {
        drawFold(state.f);
        pushIn(state.f);
      } }, L(3) + 1.25)
      .to(foldCv, { x: () => SW, duration: 0.85, ease: 'power2.inOut' }, L(3) + 3.5)
      .addLabel('s4', L(4));

    const onResize = () => {
      layout();
      cloth.invalidate();
      cloth.seek(cloth.time());
    };
    window.addEventListener('resize', onResize);

    // the water answers the pointer: moving through it drags ripples behind, a click or tap drops a ring
    let lastDrop = { x: -1e4, y: -1e4, t: 0 };
    const toPiece = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      return { x: (e.clientX - r.left - SW / 2) / ZOOM + SW / 2, y: (e.clientY - r.top - SH / 2) / ZOOM + SH / 2 };
    };
    const onMove = (e: PointerEvent) => {
      if (!gl || u.water < 0.15) return;
      const p = toPiece(e);
      const t = performance.now();
      const dist = Math.hypot(p.x - lastDrop.x, p.y - lastDrop.y);
      if (dist < 34 && t - lastDrop.t < 140) return;
      gl.drop(p.x, p.y, Math.min(1, 0.35 + dist / 160) * u.water);
      lastDrop = { ...p, t };
    };
    const onDown = (e: PointerEvent) => {
      if (!gl || u.water < 0.15) return;
      const p = toPiece(e);
      gl.drop(p.x, p.y, 1.8 * u.water);
      lastDrop = { ...p, t: performance.now() };
    };
    // and with nobody touching it, now and then a drip lands on its own: one, sometimes a second close by
    let drip: gsap.core.Tween | null = null;
    const dripLater = () => {
      drip = gsap.delayedCall(1.6 + Math.random() * 2.2, () => {
        if (gl && u.water > 0.5 && vis.isActive && performance.now() - lastDrop.t > 1500) {
          const x = SW * (0.12 + Math.random() * 0.76);
          const y = SH * (0.12 + Math.random() * 0.76);
          gl.drop(x, y, (1.0 + Math.random() * 0.5) * u.water);
          if (Math.random() < 0.4) {
            const a = Math.random() * Math.PI * 2;
            const r = 60 + Math.random() * 120;
            gsap.delayedCall(0.25 + Math.random() * 0.35, () => gl.drop(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.7 * u.water));
          }
        }
        dripLater();
      });
    };
    stage.addEventListener('pointermove', onMove, { passive: true });
    stage.addEventListener('pointerdown', onDown, { passive: true });

    // draw only while the section is on screen
    const vis = ScrollTrigger.create({ trigger: root, start: 'top bottom', end: 'bottom top', onToggle: (self) => gl?.setActive(self.isActive) });
    gl?.setActive(vis.isActive);
    dripLater();

    // ---- the steps follow the scroll --------------------------------------------------------------------------
    let shown = 0;
    let target = 0;
    let shownAt = 0;
    let play: gsap.core.Timeline | null = null;
    const advance = () => {
      if (shown === target) return;
      const jump = Math.abs(target - shown);
      const back = target < shown;
      shown = target;
      shownAt = performance.now();
      setStep(target);
      root.style.setProperty('--hold', `${DWELL}ms`);
      // one step forward plays at its own pace, after hurrying through whatever is left of the one before;
      // going back, or a jump across several, is hurried through
      play?.kill();
      play = gsap.timeline();
      const end = cloth.labels[`s${target}`];
      const dist = Math.abs(end - cloth.time());
      if (jump > 1 || back) {
        play.add(cloth.tweenTo(end, { duration: jump > 1 ? Math.min(3.2, dist / 2.2) : Math.min(2.4, dist / 2), ease: 'none' }));
      } else {
        const from = cloth.labels[`s${target - 1}`];
        if (cloth.time() < from - 0.01) play.add(cloth.tweenTo(from, { duration: (from - cloth.time()) / 3, ease: 'none' }));
        play.add(cloth.tweenTo(end, { duration: end - Math.max(from, cloth.time()), ease: 'none' }));
      }
    };

    const st = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        let next = Math.min(N - 1, Math.floor((self.progress / DUE) * (N - 1) + 0.15));
        if (next > shown && !isJumping()) next = performance.now() - shownAt >= DWELL ? shown + 1 : shown;
        target = next;
        advance();
      },
    });

    // however fast the page is scrolled, each step holds the screen for a moment (its tick fills meanwhile)
    // before the page moves past it, the last one included. Going back up is never held, nor a jump from a link.
    let inside = false;
    let held = false;
    let release = 0;
    const pace = () => {
      const lenis = getLenis();
      const y = window.scrollY;
      if (y < st.start) {
        inside = false;
        return;
      }
      if (!inside) {
        inside = true;
        if (shown === 0) {
          shownAt = performance.now();
          // the first step's tick starts filling now, not when the page loaded
          one<HTMLElement>('.wash__ticks')
            .getAnimations({ subtree: true })
            .forEach((an) => (an.currentTime = 0));
        }
      }
      if (!lenis || isJumping() || y >= st.end) return;
      const settled = performance.now() - shownAt >= DWELL;
      let max: number;
      if (shown >= N - 1) {
        if (settled) return;
        max = st.end - 2;
      } else {
        const next = settled ? shown + 2 : shown + 1;
        max = next > N - 1 ? st.end - 2 : st.start + dueAt(next) * (st.end - st.start) - 2;
      }
      if (y > max) {
        // a clean pause rather than a tug of war with the wheel: the page stops at the step, and is let go
        // once the step has had its moment
        lenis.scrollTo(max, { immediate: true, force: true });
        if (!held) {
          held = true;
          lenis.stop();
          const wait = Math.max(120, DWELL - (performance.now() - shownAt));
          release = window.setTimeout(() => {
            held = false;
            getLenis()?.start();
          }, wait);
        }
      }
    };
    window.addEventListener('scroll', pace, { passive: true });
    return () => {
      window.clearTimeout(release);
      if (held) getLenis()?.start();
      drip?.kill();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', pace);
      vis.kill();
      play?.kill();
      cloth.kill();
      gl?.destroy();
      piece.classList.remove('has-gl');
    };
  });

  return (
    <section className="wash" ref={ref} aria-labelledby="care-title" style={CLOTH_VARS}>
      <div className="wash__stage">
        {/* the cloth, close up, and what happens to it */}
        <div className="cloth" aria-hidden="true">
          <div className="cloth__piece">
            <i className="cloth__weave" />
            <i className="cloth__crumple" />
            <i className="cloth__dirt" />
            <canvas className="cloth__gl" />
          </div>
          <canvas className="cloth__fold" />
          <div className="iron">
            <div className="iron__face">
              <img src={ironImg} alt="" />
              <span className="iron__steam">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        </div>

        {/* top left: what this is */}
        <div className="wash__copy">
          <p className="index">
            <span>03</span>
            Garment care
          </p>
          <h2 className="h2 title" id="care-title">
            <Lines lines={CARE.title} />
          </h2>
          <p className="wash__promise">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1.5 13.5 3.6v4c0 3.2-2.3 5.7-5.5 6.9C4.8 13.3 2.5 10.8 2.5 7.6v-4L8 1.5Z" />
              <path d="m5.6 8 1.7 1.7 3.2-3.4" />
            </svg>
            <strong>{CARE.promise.label}</strong>
            <span>{CARE.promise.body}</span>
          </p>
        </div>

        {/* bottom right: the step being shown, large */}
        <div className="wash__now" aria-live="polite">
          <p className="wash__at">
            <b>{pad(step + 1)}</b>
            <span>/ {pad(N)}</span>
            <span className="wash__ticks" aria-hidden="true">
              {CARE.steps.map((c, i) => (
                <i key={c.word} className={i < step ? 'is-done' : i === step ? 'is-on' : undefined} />
              ))}
            </span>
          </p>
          <div className="wash__big">
            {CARE.steps.map((c, i) => (
              <h3 key={c.word} className={i === step ? 'is-on' : i < step ? 'is-done' : undefined} aria-hidden={i !== step}>
                {c.word}
              </h3>
            ))}
          </div>
          <div className="wash__say">
            {CARE.steps.map((c, i) => (
              <p key={c.word} className={i === step ? 'is-on' : undefined} aria-hidden={i !== step}>
                {c.body}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* without motion: the five steps, simply listed */}
      <ol className="wash__list">
        {CARE.steps.map((c, i) => (
          <li key={c.word}>
            <img src={c.img} width={1000} height={1094} alt={c.alt} loading="lazy" />
            <div>
              <p className="wash__count">
                <b>{pad(i + 1)}</b> / {pad(N)}
              </p>
              <h3 className="wash__word">{c.word}</h3>
              <p className="wash__body">{c.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
