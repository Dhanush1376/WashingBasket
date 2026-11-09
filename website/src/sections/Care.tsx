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
 *   Return   the camera draws back: the piece stays as it is and the table it lies on comes into view round
 *            it. It is folded softly, the way a towel is folded, then slid across the table, the view
 *            following, into the basket waiting beside it, where it drops in under the rim
 *
 * Without motion, the steps are listed with their pictures. Without WebGL, the cloth is still shown, dry.
 */
import React, { useRef, useState } from 'react';

import { Lines } from '../components';
import { CARE } from '../content';
import crumple from '../assets/cloth-crumple.webp';
import dirt from '../assets/cloth-dirt.webp';
import foldSprite from '../assets/cloth-fold.webp';
import foldSpriteSmall from '../assets/cloth-fold-m.webp';
import basketImg from '../assets/basket.webp';
import basketRimImg from '../assets/basket-rim.webp';
import woodImg from '../assets/table-wood.webp';
import ironImg from '../assets/cloth-iron.webp';
import ironShadowImg from '../assets/cloth-iron-shadow.webp';
import washed from '../assets/cloth-washed.webp';
import weave from '../assets/cloth-weave.webp';
import { gsap, ScrollTrigger, useScene } from '../motion';
import { createClothGL, type ClothState } from './clothGL';

const N = CARE.steps.length;
/** Each step's part of the journey, and so its share of the scroll: collect, wash, dry, iron, return. */
const CLOTH = [3.4, 3.4, 2.8, 5.0, 3.6];
/** The fold, rendered frame by frame (care-fabric/stage.py): a sprite sheet of `frames` cells. */
const FOLD = { frames: 49, cols: 7, fw: 720, fh: 520, sw: 600, sh: 400 };
/** Phones load the sheet at 0.6 of full size (care-fabric/stage.py writes both). */
const FOLD_SMALL = 0.6;
/** The iron image: its width over its height. */
const IRON_RATIO = 1080 / 468;
/** Where its cord leaves the boot, out from the iron's middle toward its heel (of its width; care-fabric/iron3d.py). */
const CORD_AT = 0.9657 - 0.5;
/** The iron in slices (care-fabric/iron3d.py): where it stands above each of these heights, in the image's
 *  own width units (it is 1.2 of them wide), drawn one under another in the shadow sheet. */
const IRON_SLICES = [0.02, 0.14, 0.26, 0.36, 0.45];
const IRON_FRAME = 1.2;
/** The light comes from the upper left, as high as it is far: shadows fall down and to the right, as long as
 *  what casts them is high. */
const SUN = { x: 0.633, y: 0.774, k: 0.8 };
/** The close-up is drawn a little larger than the stage, so its edges never show. */
const ZOOM = 1.06;
/** The basket (care-fabric/basket3d.py), in the width of the flat piece: its opening fits the piece folded in four. */
const BASKET = { w: 0.8, h: 0.62, tilt: -4 };
/** Where the piece comes to rest on the clothes already in it, from the basket's middle (of the piece's width), and its turn. */
const LAND = { x: -0.03, y: -0.015, r: -6 };
/** The table's grain, as wide as this on screen once the view has drawn back. */
const WOOD = 900;

const CLOTH_VARS = {
  '--weave': `url(${weave})`,
  '--crumple': `url(${crumple})`,
  '--dirt': `url(${dirt})`,
  '--wood': `url(${woodImg})`,
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
    const cordCv = one<HTMLCanvasElement>('.cloth__cord');
    const table = one<HTMLElement>('.cloth__table');
    const lay = one<HTMLElement>('.cloth__lay');
    const basket = one<HTMLElement>('.cloth__basket');
    const rim = one<HTMLElement>('.cloth__rim');
    const hem = one<SVGSVGElement>('.cloth__hem');
    const over = one<HTMLElement>('.cloth__over');
    const ext = one<HTMLElement>('.cloth__ext');
    const flat = one<HTMLElement>('.cloth__flat');
    const hemRect = one<SVGRectElement>('.cloth__hem .stitch');
    const edgeRect = one<SVGRectElement>('.cloth__hem .edge');
    const cctx = cordCv.getContext('2d')!;
    let cordK = 1;
    const ironSh = load(ironShadowImg);
    // the iron's shadow is put together here (its slices joined), then laid soft on the cord's canvas
    const shU = document.createElement('canvas');
    shU.width = 2;
    shU.height = 2;
    const sctx = shU.getContext('2d')!;
    const fctx = foldCv.getContext('2d')!;
    const small = window.matchMedia('(pointer: coarse), (max-width: 899px)').matches;
    const foldIm = load(small ? foldSpriteSmall : foldSprite);
    // one frame's cell in the sheet that was loaded
    const CW = Math.round(FOLD.fw * (small ? FOLD_SMALL : 1));
    const CH = Math.round(FOLD.fh * (small ? FOLD_SMALL : 1));
    const state = { p: 0, f: 0 };

    // the iron's track, kept at half the stage's size: white wherever the soleplate has pressed
    const pressCv = document.createElement('canvas');
    pressCv.width = 2;
    pressCv.height = 2;
    const pctx = pressCv.getContext('2d')!;

    // the timeline drives `u`; a renderer built again after the phone drops the canvas picks up from the same state
    const u: ClothState = { fold: 0, dirt: 0.3, lift: 0, soak: 0, water: 0, ring: 0, foam: 0, pop: 0, dry: 0, fluff: 0, stain: 0, clean: 0, dip: 0 };
    const showGL = () => piece.classList.add('has-gl');
    let gl = createClothGL(glCv, { weave, crumple, washed, dirt }, pressCv, showGL, u);
    // a phone may take the canvas away (low memory, or the browser in the background). The plain cloth beneath
    // shows at once instead of a blank screen, and the live one comes back when the browser hands the canvas back
    const onLost = (e: Event) => {
      e.preventDefault();
      piece.classList.remove('has-gl');
      gl?.setActive(false);
      gl = null;
    };
    const onRestored = () => {
      gl = createClothGL(glCv, { weave, crumple, washed, dirt }, pressCv, showGL, u);
      gl?.resize(SW, SH);
      gl?.setActive(vis.isActive);
    };
    glCv.addEventListener('webglcontextlost', onLost);
    glCv.addEventListener('webglcontextrestored', onRestored);

    // ---- layout: the stage, where the folded cloth will lie, the iron's strokes ------------------------------
    let SW = 0;
    let SH = 0;
    let ironW = 0;
    let SV = 0;
    let track = 0;
    let verts: { x: number; y: number; r: number }[] = [];
    // the view drawn back (`dx`, `dy`, `k`), where the piece lies then (`sx`, `sy`), the basket beside it on the
    // table (`bx`, `by`) and how far the view pans across to it (`pan`)
    const geo = { dx: 0, dy: 0, k: 1, cx: 0, cy: 0, sx: 0, sy: 0, bx: 0, by: 0, pan: 0, tw: 1, flat: 0 };
    // the folded piece, as the fold leaves it: where it lies in a sprite cell (a quarter of the cloth, in the
    // lower right), so it can be brought to the middle as it folds
    const folded = { x: 0.75, y: 0.7, w: 0.42, h: 0.39 };

    // where the iron is at `p` of its work, and which way it faces: move by move, easing into and out of
    // each, the line of a stroke bowing a little and the wrist never quite still, as a hand irons
    // where the cord is plugged in: below the bottom of the screen, a little right of the middle
    const socket = (): [number, number] => [SW * 0.6, SV + ironW * 0.7];
    const ironAt = (p: number) => {
      const segs = verts.length - 1;
      const x = Math.min(segs - 1e-6, Math.max(0, p * segs));
      const k = Math.floor(x);
      const t = x - k;
      const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
      const a = verts[k];
      const b = verts[k + 1];
      // (a long push or pull bows a little sideways, as an arm does)
      const bow = Math.abs(b.y - a.y) > track * 0.6 ? Math.sin(Math.PI * e) * track * 0.06 * (k % 2 ? 1 : -1) : 0;
      const x2 = a.x + (b.x - a.x) * e + bow;
      const y2 = a.y + (b.y - a.y) * e;
      // it lies along its cord: the heel turned toward where the cord is plugged in, below the screen, so the
      // flex leaves the boot straight and runs on in the same line (kept within reason near the bottom)
      const [ax, ay] = socket();
      const toward = (Math.atan2(ay - y2, ax - x2) * 180) / Math.PI;
      return {
        x: x2,
        y: y2,
        r: Math.max(48, Math.min(132, toward)) + Math.sin(k * 1.9 + t * 3.1) * 2.2,
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
        pctx.ellipse(cx - off, cy, (ironW * 0.42 * 0.5) / ZOOM, (track * 0.5 * 0.5) / ZOOM, (at.r * Math.PI) / 180, 0, Math.PI * 2);
        pctx.fill();
        pctx.shadowColor = 'transparent';
      }
      // once it is done, all of it is pressed, the edges off screen too (under a phone's bottom bar, past the
      // stroke ends), which the view drawing back will show
      if (p >= 0.999) {
        pctx.fillStyle = '#fff';
        pctx.fillRect(0, 0, pressCv.width, pressCv.height);
      }
      gl?.pressChanged();
      const h = ironW / IRON_RATIO;
      gsap.set(iron, { x: at.x - ironW / 2, y: at.y - h / 2 });
      gsap.set(ironFace, { rotation: at.r });
      cord(at);
    };

    // the iron's cord, from the boot at its heel down to where it is plugged in, below the bottom of the screen:
    // straight out of the boot, then easing round to the socket, so it trails after the iron and swings as it
    // crosses. Drawn as a round flex: its shadow on the cloth, a darker body, a lighter core, a line of light
    // the iron's shadow on the cloth, cast live so it falls the same way however the iron is turned: the iron swept
    // away from the light, each slice of it from its own height to the next, so the shadow is one unbroken shape
    // joined to the soleplate where it stands; laid down soft, with a darker, tighter one all round where it
    // touches. Lifted (set down or taken away), it all falls further off and softer
    const ironShadow = (at: { x: number; y: number; r: number }) => {
      if (!ironSh.complete || !ironSh.naturalWidth) return;
      const sc = gsap.getProperty(iron, 'scale') as number;
      const raise = Math.max(0, (sc - 1) / 0.14) * 0.3; // (in the image's units, as the slices are)
      const unit = (ironW * sc) / IRON_FRAME;
      const iw = ironW * sc;
      const ih = iw / IRON_RATIO;
      const SWc = ironSh.naturalWidth;
      const SHc = ironSh.naturalHeight / IRON_SLICES.length;
      const k = shU.width / SW;
      const slice = (c: CanvasRenderingContext2D, i: number, dx: number, dy: number, kk: number) => {
        c.save();
        c.setTransform(kk, 0, 0, kk, 0, 0);
        c.translate(at.x + dx, at.y + dy);
        c.rotate((at.r * Math.PI) / 180);
        c.drawImage(ironSh, 0, i * SHc, SWc, SHc, -iw / 2, -ih / 2, iw, ih);
        c.restore();
      };
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, shU.width, shU.height);
      IRON_SLICES.forEach((z, i) => {
        // (the soleplate's slice from the cloth up; each from its height to the next one's, a step every pixel or so)
        const z0 = i === 0 ? 0 : z;
        const z1 = i < IRON_SLICES.length - 1 ? IRON_SLICES[i + 1] : z;
        const steps = Math.max(1, Math.ceil(((z1 - z0) * unit * SUN.k * k) / 1.2));
        for (let j = 0; j <= steps; j++) {
          const d = (z0 + ((z1 - z0) * j) / steps + raise) * unit * SUN.k;
          slice(sctx, i, SUN.x * d, SUN.y * d, k);
        }
      });
      const off = 20000;
      cctx.save();
      cctx.setTransform(1, 0, 0, 1, 0, 0);
      cctx.shadowOffsetX = off;
      cctx.shadowOffsetY = 0;
      // the cast shadow, soft
      cctx.shadowColor = `rgba(62, 32, 14, ${0.3 - raise * 0.35})`;
      cctx.shadowBlur = iw * (0.028 + raise * 0.12) * cordK;
      cctx.drawImage(shU, -off, 0, cordCv.width, cordCv.height);
      cctx.restore();
      // where it rests: tight and dark, just out from the soleplate's edge
      if (raise < 0.05) {
        cctx.save();
        cctx.shadowOffsetX = off * cordK;
        cctx.shadowOffsetY = 0;
        // (the cloth darkened all round the soleplate where light cannot get in under it, then the line of contact)
        cctx.shadowColor = 'rgba(52, 26, 10, 0.32)';
        cctx.shadowBlur = iw * 0.02 * cordK;
        slice(cctx, 0, SUN.x * iw * 0.004 - off, SUN.y * iw * 0.004, cordK);
        cctx.shadowColor = 'rgba(44, 22, 8, 0.55)';
        cctx.shadowBlur = iw * 0.006 * cordK;
        slice(cctx, 0, SUN.x * iw * 0.003 - off, SUN.y * iw * 0.003, cordK);
        cctx.restore();
      }
    };
    const cord = (at: { x: number; y: number; r: number }) => {
      if (!SW) return;
      cctx.setTransform(1, 0, 0, 1, 0, 0);
      cctx.clearRect(0, 0, cordCv.width, cordCv.height);
      ironShadow(at);
      cctx.setTransform(cordK, 0, 0, cordK, 0, 0);
      const a = (at.r * Math.PI) / 180;
      const hx = Math.cos(a);
      const hy = Math.sin(a);
      const ex = at.x + hx * CORD_AT * ironW;
      const ey = at.y + hy * CORD_AT * ironW;
      const [ax, ay] = socket();
      const c1x = ex + hx * ironW * 0.5;
      const c1y = ey + hy * ironW * 0.5;
      const c2x = ax;
      const c2y = ay - ironW * 0.6;
      const path = (dx: number, dy: number) => {
        cctx.beginPath();
        cctx.moveTo(ex + dx, ey + dy);
        cctx.bezierCurveTo(c1x + dx, c1y + dy, c2x + dx, c2y + dy, ax + dx, ay + dy);
      };
      const w = Math.max(3, ironW * 0.03);
      cctx.lineCap = 'round';
      cctx.lineJoin = 'round';
      // its shadow, cast down and to the right like the iron's: well out from it where it leaves the boot, up off
      // the cloth, closing in as it comes down to lie on the cloth, and softer the higher it is
      const off = 20000;
      const lift = gsap.getProperty(iron, 'scale') as number;
      const N = 36;
      const pts: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const u = 1 - t;
        const bx = u * u * u * ex + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ax;
        const by = u * u * u * ey + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ay;
        const z = ((ironW / IRON_FRAME) * 0.07 * lift + (lift - 1) * ironW * 0.3) * Math.pow(Math.max(0, 1 - t * 2.2), 2) + w * 1.1;
        pts.push([bx + SUN.x * z * SUN.k, by + SUN.y * z * SUN.k]);
      }
      const shadowLine = (alpha: number, blur: number, grow: number) => {
        cctx.shadowColor = `rgba(62, 32, 14, ${alpha})`;
        cctx.shadowBlur = blur * cordK;
        cctx.shadowOffsetX = off * cordK;
        cctx.shadowOffsetY = 0;
        cctx.strokeStyle = '#000';
        cctx.lineWidth = w * grow;
        cctx.beginPath();
        cctx.moveTo(pts[0][0] - off, pts[0][1]);
        for (let i = 1; i <= N; i++) cctx.lineTo(pts[i][0] - off, pts[i][1]);
        cctx.stroke();
      };
      // the spring boot, thicker, joining the cord's shadow back into the iron's own
      const z0 = (pts[0][0] - ex) / SUN.x;
      const boot = (alpha: number, blur: number) => {
        cctx.shadowColor = `rgba(62, 32, 14, ${alpha})`;
        cctx.shadowBlur = blur * cordK;
        cctx.shadowOffsetX = off * cordK;
        cctx.shadowOffsetY = 0;
        cctx.strokeStyle = '#000';
        cctx.lineWidth = w * 1.8;
        cctx.beginPath();
        const sx = SUN.x * z0 - off;
        const sy = SUN.y * z0;
        cctx.moveTo(ex - hx * ironW * 0.09 + sx, ey - hy * ironW * 0.09 + sy);
        cctx.lineTo(ex + sx, ey + sy);
        cctx.stroke();
      };
      boot(0.34, w * 1.4);
      boot(0.26, w * 0.5);
      shadowLine(0.4, w * 1.3, 1.2);
      shadowLine(0.34, w * 0.4, 0.85);
      cctx.shadowColor = 'transparent';
      // the flex itself
      cctx.strokeStyle = '#8c939d';
      cctx.lineWidth = w;
      path(0, 0);
      cctx.stroke();
      cctx.strokeStyle = '#d3d8de';
      cctx.lineWidth = w * 0.66;
      path(-w * 0.06, -w * 0.08);
      cctx.stroke();
      cctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      cctx.lineWidth = w * 0.2;
      path(-w * 0.16, -w * 0.2);
      cctx.stroke();
    };

    // the fold, frame by frame from the sprite sheet
    foldCv.width = CW;
    foldCv.height = CH;
    const drawFold = (f: number) => {
      fctx.clearRect(0, 0, CW, CH);
      if (!foldIm.complete || !foldIm.naturalWidth) return;
      // between two frames, the next one fades in over this one, so the cloth moves continuously
      const at = Math.max(0, Math.min(FOLD.frames - 1, f * (FOLD.frames - 1)));
      const k = Math.floor(at);
      const mix = at - k;
      const cell = (n: number) => fctx.drawImage(foldIm, (n % FOLD.cols) * CW, Math.floor(n / FOLD.cols) * CH, CW, CH, 0, 0, CW, CH);
      fctx.globalAlpha = 1;
      cell(k);
      if (mix > 0.02 && k < FOLD.frames - 1) {
        fctx.globalAlpha = mix;
        cell(k + 1);
        fctx.globalAlpha = 1;
      }
    };
    const measureFold = () => {
      const k = FOLD.frames - 1;
      const cv = document.createElement('canvas');
      cv.width = CW;
      cv.height = CH;
      const cx = cv.getContext('2d', { willReadFrequently: true })!;
      cx.drawImage(foldIm, (k % FOLD.cols) * CW, Math.floor(k / FOLD.cols) * CH, CW, CH, 0, 0, CW, CH);
      const a = cx.getImageData(0, 0, CW, CH).data;
      let x0 = CW, y0 = CH, x1 = 0, y1 = 0;
      for (let y = 0; y < CH; y += 2)
        for (let x = 0; x < CW; x += 2)
          if (a[(y * CW + x) * 4 + 3] > 128) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 > x0 && y1 > y0)
        Object.assign(folded, { x: (x0 + x1) / 2 / CW, y: (y0 + y1) / 2 / CH, w: (x1 - x0) / CW, h: (y1 - y0) / CH });
      // (it drops into the basket about its own middle)
      gsap.set(foldCv, { transformOrigin: `${folded.x * 100}% ${folded.y * 100}%` });
      pushIn(state.f);
    };
    // it is brought to the middle as each fold calls for it, never scaled: the first fold (top half down) halves its
    // height, so it is brought up to the middle then; the second (left half over) halves its width, so only then
    // is it brought across. It never runs off the screen part way
    const ease = (a: number, b: number, f: number) => {
      const t = Math.max(0, Math.min(1, (f - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const pushIn = (f: number) => {
      const e1 = ease(0, 0.5, f);
      const e2 = ease(0.5, 1, f);
      gsap.set(foldCv, {
        xPercent: -(folded.x - 0.5) * 100 * e2,
        yPercent: -(folded.y - 0.5) * 100 * e1,
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
      cordK = Math.min(window.devicePixelRatio || 1, 2);
      cordCv.width = Math.round(SW * cordK);
      cordCv.height = Math.round(SH * cordK);
      // (at half the cord canvas's size: it is blurred anyway)
      shU.width = Math.max(2, Math.round(cordCv.width / 2));
      shU.height = Math.max(2, Math.round(cordCv.height / 2));
      // the whole piece, when the view draws back: 3 : 2, in the middle of the stage, between the corners
      const c = copy.getBoundingClientRect();
      const n = now.getBoundingClientRect();
      const top = c.bottom - r.top + 16;
      const bottom = n.top - r.top - 16;
      const spot = desktop ? { cx: SW / 2, cy: SH * 0.53 } : { cx: SW / 2, cy: Math.min(Math.max(SH * 0.52, top + 60), bottom - 60) };
      const room = Math.min(spot.cy - top, bottom - spot.cy) * 2;
      const tw = desktop
        ? Math.max(320, Math.min(SW * 0.56, SH * 0.66 * 1.5, 860))
        : Math.max(120, Math.min(SW * 0.72, SH * 0.42 * 1.5, room * 1.5, 620));
      // the whole piece, of which the close-up shows a part: the smallest 3 : 2 that covers the stage, so as the
      // view draws back nothing is cropped; the piece only ever grows into view, its edges coming in from off screen
      const ww = Math.max(SW, SH * 1.5);
      const wh = ww / 1.5;
      geo.cx = (SW - ww) / 2;
      geo.cy = (SH - wh) / 2;
      geo.k = tw / (ww * ZOOM);
      geo.dx = spot.cx - SW / 2;
      geo.dy = spot.cy - SH / 2;
      const fw = (tw * FOLD.fw) / FOLD.sw;
      const fh = (fw * FOLD.fh) / FOLD.fw;
      gsap.set(foldCv, { width: fw, height: fh, left: spot.cx - fw / 2, top: spot.cy - fh / 2 });
      pushIn(state.f);
      // the table the piece lies on, drawn at the close-up's scale and moved with it, so drawing back reads as the
      // camera rising: big enough to fill the stage once drawn back and panned across to the basket
      const s = geo.k * ZOOM;
      geo.sx = spot.cx;
      geo.tw = tw;
      geo.sy = spot.cy;
      const bw = tw * BASKET.w;
      const bh = tw * BASKET.h;
      geo.bx = spot.cx + tw * 0.5 + bw * 0.5 + Math.max(16, tw * 0.05);
      geo.by = spot.cy - (desktop ? tw * 0.05 : 0);
      geo.pan = Math.max(0, geo.bx + bw * 0.5 + Math.max(20, SW * 0.04) - SW);
      const TW = (SW + 2 * Math.abs(geo.dx) + 2 * geo.pan) / s + 8;
      const TH = (SH + 2 * Math.abs(geo.dy)) / s + 8;
      // the piece's stitched hem, drawn over the cloth so it meets the fold's first frame exactly (in the table's
      // frame, which moves with the piece)
      const ox = TW / 2 - ww / 2;
      const oy = TH / 2 - wh / 2;
      hem.setAttribute('viewBox', `0 0 ${TW} ${TH}`);
      const hi = ww / 60;
      hemRect.setAttribute('x', String(ox + hi));
      hemRect.setAttribute('y', String(oy + hi));
      hemRect.setAttribute('width', String(ww - 2 * hi));
      hemRect.setAttribute('height', String(wh - 2 * hi));
      hemRect.setAttribute('stroke-width', String(ww / 520));
      hemRect.setAttribute('stroke-dasharray', `${ww / 190} ${ww / 210}`);
      // (and the turned edge, a little darker, right at the edge)
      edgeRect.setAttribute('x', String(ox));
      edgeRect.setAttribute('y', String(oy));
      edgeRect.setAttribute('width', String(ww));
      edgeRect.setAttribute('height', String(wh));
      edgeRect.setAttribute('stroke-width', String(ww / 150));
      gsap.set(table, { width: TW, height: TH, left: SW / 2 - TW / 2, top: SH / 2 - TH / 2, backgroundSize: `${WOOD / s}px ${WOOD / s}px` });
      gsap.set(over, { width: TW, height: TH, left: SW / 2 - TW / 2, top: SH / 2 - TH / 2 });
      // the rest of the piece, beyond what the live cloth covers (the stage): by then it is washed and pressed flat,
      // plain cotton, so it is the cloth's own weave at the same size and lined up with it thread for thread
      const tile = 256 / Math.max(0.5, glCv.width / SW || 1);
      gsap.set(ext, {
        width: ww,
        height: wh,
        left: ox,
        top: oy,
        backgroundSize: `${tile}px ${tile}px`,
        backgroundPosition: `${(ww - SW) / 2}px ${(wh - SH) / 2}px`,
      });
      // (seen from far enough back the threads blend to the cloth's even colour, as the live cloth's do: the drawn
      // weave would shimmer instead, so it gives way to that colour the further back the view goes)
      gsap.set(flat, { width: ww, height: wh, left: ox, top: oy });
      geo.flat = 0.96 * Math.pow(Math.max(0, Math.min(1, (0.85 - s) / 0.6)), 0.8);
      gsap.set(lay, {
        width: ww,
        height: wh,
        left: TW / 2 - ww / 2,
        top: TH / 2 - wh / 2,
        boxShadow: `${2 / s}px ${6 / s}px ${16 / s}px rgba(80, 48, 22, 0.3), 0 ${1 / s}px ${2 / s}px rgba(80, 48, 22, 0.25)`,
      });
      gsap.set(basket, {
        rotation: BASKET.tilt,
        width: bw / s,
        height: bh / s,
        left: TW / 2 + (geo.bx - SW / 2 - geo.dx) / s - bw / s / 2,
        top: TH / 2 + (geo.by - SH / 2 - geo.dy) / s - bh / s / 2,
      });
      // (its rim, over the piece once it has dropped in: where the basket is once the view has panned)
      gsap.set(rim, { rotation: BASKET.tilt, width: bw, height: bh, left: geo.bx - geo.pan - bw / 2, top: geo.by - bh / 2 });
      // the iron's work, a strip at a time across the cloth, as a person irons: tip up, its cord trailing down
      // off the board; pushed a good way up the strip, drawn back a little, pushed on to the top, pulled back
      // down, then set over to the next strip
      ironW = Math.min(desktop ? Math.min(SW * 0.3, SH * 0.44) : SW * 0.7, 540);
      const ironH = ironW / IRON_RATIO;
      // (over the part of the stage on screen: on phones it reaches on under the browser's bottom bar)
      SV = SH - (parseFloat(getComputedStyle(root).getPropertyValue('--skirt')) || 0);
      const cols = Math.min(5, Math.max(3, Math.round(SW / (ironH * 1.15))));
      track = (SW / cols) * 1.08;
      const xs = Array.from({ length: cols }, (_, i) => track * 0.42 + ((SW - track * 0.84) * i) / (cols - 1));
      // (on a phone, kept between the title and the step written at the foot, which it would cover)
      // (top to bottom of the cloth, every part of it pressed: the soleplate's track reaches past both edges)
      const reach = Math.min(track * 0.42, ironW * 0.3);
      const yLow = SV - reach;
      const yHigh = reach;
      const Y = (f: number) => yLow + f * (Math.min(yHigh, yLow) - yLow);
      const R = 90;
      verts = [{ x: xs[0], y: Y(0), r: R }];
      xs.forEach((x, i) => {
        if (i > 0) verts.push({ x, y: Y(0), r: R });
        [0.55, 0.35, 1, 0].forEach((f) => verts.push({ x, y: Y(f), r: R }));
      });
      gsap.set(iron, { width: ironW, height: ironW / IRON_RATIO });
      press(state.p);
      drawFold(state.f);
    };
    layout();

    // ---- the journey, as one timeline with a label at each step -----------------------------------------------
    const L = (i: number) => CLOTH.slice(0, i).reduce((x, y) => x + y, 0);
    const cloth = gsap.timeline({ paused: true, defaults: { ease: 'power1.inOut' } });
    const [c0, w, d, i3, r5] = CLOTH;
    const W0 = L(1);
    cloth
      .addLabel('s0', 0)
      // collect: what it came in with is thrown onto it, one stain after another, and it greys a little
      .to(u, { stain: 1, duration: c0 * 0.92, ease: 'none' }, 0)
      .to(u, { dirt: 1, duration: c0 * 0.9, ease: 'none' }, 0.05)
      .fromTo('.cloth__dirt', { opacity: 0.3 }, { opacity: 1, duration: c0 * 0.9, ease: 'none' }, 0.05)
      .addLabel('s1', W0)
      // wash: lowered in, the water climbing over it and up its threads; rings spread, the dirt and the stains
      // lift away, suds gather, the folds change
      .to(u, { water: 1, duration: w * 0.12, ease: 'power1.out' }, W0)
      .to(u, { dip: 1, duration: w * 0.36, ease: 'sine.inOut' }, W0)
      .to(u, { soak: 1, duration: w * 0.55, ease: 'power1.out' }, W0 + w * 0.08)
      .to(u, { ring: 1, duration: w * 0.6, ease: 'power1.out' }, W0 + w * 0.34)
      .to(u, { lift: 1, duration: w * 0.62, ease: 'sine.inOut' }, W0 + w * 0.36)
      .to(u, { dirt: 0, duration: w * 0.55 }, W0 + w * 0.4)
      .to(u, { clean: 1, duration: w * 0.58 }, W0 + w * 0.4)
      .to(u, { fold: 1, duration: w * 0.55 }, W0 + w * 0.4)
      .to(u, { foam: 1, duration: w * 0.5, ease: 'power2.out' }, W0 + w * 0.48)
      .to('.cloth__crumple', { opacity: 0, duration: w * 0.55 }, W0 + w * 0.4)
      .to('.cloth__dirt', { opacity: 0, duration: w * 0.55 }, W0 + w * 0.4)
      .addLabel('s2', L(2))
      // dry: the water drains, the suds burst away, then the damp leaves it patch by patch
      .to(u, { pop: 1, duration: d * 0.5, ease: 'sine.in' }, L(2))
      .to(u, { water: 0, duration: d * 0.55, ease: 'sine.inOut' }, L(2) + d * 0.05)
      .to(u, { dry: 1, duration: d * 0.8, ease: 'sine.inOut' }, L(2) + d * 0.18)
      .to(u, { fluff: 1, duration: d * 0.45 }, L(2) + d * 0.55)
      .addLabel('s3', L(3))
      // iron: set down on the cloth, pushed and drawn back across it, lifted away
      .fromTo(iron, { autoAlpha: 0, scale: 1.14 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power2.out', onUpdate: () => cord(ironAt(state.p)) }, L(3))
      .fromTo(cordCv, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, L(3))
      .to(state, { p: 1, duration: i3 - 0.75, ease: 'none', onUpdate: () => press(state.p) }, L(3) + 0.35)
      .to(iron, { autoAlpha: 0, scale: 1.12, duration: 0.4, ease: 'power2.in', onUpdate: () => cord(ironAt(state.p)) }, L(4) - 0.4)
      .to(cordCv, { autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, L(4) - 0.4)
      .addLabel('s4', L(4))
      // return: the camera draws back, the piece as it was and the table coming into view round it; it is folded,
      // softly, brought to the middle as it folds, slid across to the basket with the view following, and dropped in
      .fromTo([table, over], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, L(4))
      .fromTo(
        [table, over],
        { x: 0, y: 0, scale: ZOOM },
        { x: () => geo.dx, y: () => geo.dy, scale: () => geo.k * ZOOM, duration: r5 * 0.24, ease: 'power2.inOut', immediateRender: false },
        L(4),
      )
      .to(
        piece,
        {
          x: () => geo.dx,
          y: () => geo.dy,
          scale: () => geo.k * ZOOM,
          duration: r5 * 0.24,
          ease: 'power2.inOut',
        },
        L(4),
      )
      // (the live cloth handed over to the fold's first frame, the one fading into the other where they lie)
      // (only once the view has settled, so the two lie exactly over each other)
      .fromTo(foldCv, { autoAlpha: 0 }, { autoAlpha: 1, duration: r5 * 0.04, ease: 'none' }, L(4) + r5 * 0.245)
      .fromTo(flat, { opacity: 0 }, { opacity: () => geo.flat, duration: r5 * 0.24, ease: 'power2.in', immediateRender: false }, L(4))
      .to([piece, ext, flat, over], { autoAlpha: 0, duration: 0.01 }, L(4) + r5 * 0.285)
      // (the flat piece's shadow on the table goes with it; the folding cloth casts its own)
      .to(lay, { autoAlpha: 0, duration: r5 * 0.08, ease: 'none' }, L(4) + r5 * 0.29)
      .to(state, { f: 1, duration: r5 * 0.42, ease: 'sine.inOut', onUpdate: () => {
        drawFold(state.f);
        pushIn(state.f);
      } }, L(4) + r5 * 0.29)
      // slid across the table to the basket, the view panning after it
      .to(
        foldCv,
        { x: () => geo.bx - geo.pan - geo.sx + LAND.x * geo.tw, y: () => geo.by - geo.sy + LAND.y * geo.tw, rotation: LAND.r, duration: r5 * 0.18, ease: 'power2.inOut' },
        L(4) + r5 * 0.72,
      )
      .to(table, { x: () => geo.dx - geo.pan, duration: r5 * 0.18, ease: 'power2.inOut' }, L(4) + r5 * 0.74)
      // and in: it sinks below the rim, a little smaller and in the basket's shade, its corners under the rim
      .to(foldCv, { scale: 0.8, filter: 'brightness(0.93)', duration: r5 * 0.07, ease: 'power2.in' }, L(4) + r5 * 0.92)
      .fromTo(rim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, L(4) + r5 * 0.93)
      .addLabel('end', L(5));

    // A phone's address bar showing or hiding fires a resize but leaves the stage as it is (it is the large
    // viewport's height): nothing to do then. Re-recording the timeline's values there, mid-journey, would take
    // the current state as every tween's start and break the way back. When the stage really changes (the phone
    // turned), it is rebuilt from the start and brought back to where it was
    let size = `${SW}x${SH}`;
    const onResize = () => {
      const r = stage.getBoundingClientRect();
      if (`${r.width}x${r.height}` === size) return;
      layout();
      size = `${SW}x${SH}`;
      const t = cloth.time();
      cloth.seek(0);
      cloth.invalidate();
      cloth.seek(t);
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
            gsap.delayedCall(0.25 + Math.random() * 0.35, () => gl?.drop(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.7 * u.water));
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

    // ---- the journey follows the scroll: as far along as the page is, as fast or as slow as it is scrolled,
    // and back again going up (a little smoothing, so a flick of the wheel glides rather than jumps)
    const bounds = Array.from({ length: N }, (_, i) => cloth.labels[`s${i}`]);
    let shown = -1;
    let fill = -1;
    const follow = () => {
      const t = cloth.time();
      let k = 0;
      while (k < N - 1 && t >= bounds[k + 1] - 0.001) k++;
      if (k !== shown) {
        shown = k;
        setStep(k);
      }
      const len = (k < N - 1 ? bounds[k + 1] : cloth.duration()) - bounds[k];
      const f = Math.round(Math.min(1, Math.max(0, (t - bounds[k]) / len)) * 200) / 200;
      if (f !== fill) {
        fill = f;
        root.style.setProperty('--fill', String(f));
      }
    };
    cloth.eventCallback('onUpdate', follow);
    const st = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: 'bottom bottom',
      animation: cloth,
      scrub: 0.7,
    });
    follow();

    return () => {
      st.kill();
      drip?.kill();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onResize);
      vis.kill();
      cloth.kill();
      glCv.removeEventListener('webglcontextlost', onLost);
      glCv.removeEventListener('webglcontextrestored', onRestored);
      gl?.destroy();
      piece.classList.remove('has-gl');
    };
  });

  return (
    <section className="wash" ref={ref} aria-labelledby="care-title" style={CLOTH_VARS}>
      <div className="wash__stage">
        {/* the cloth, close up, and what happens to it */}
        <div className="cloth" aria-hidden="true">
          <div className="cloth__table">
            <i className="cloth__lay" />
            <i className="cloth__ext" />
            <img className="cloth__basket" src={basketImg} alt="" />
          </div>
          <div className="cloth__piece">
            <i className="cloth__weave" />
            <i className="cloth__crumple" />
            <i className="cloth__dirt" />
            <canvas className="cloth__gl" />
          </div>
          <div className="cloth__over">
            <i className="cloth__flat" />
            <svg className="cloth__hem" preserveAspectRatio="none">
              <rect className="edge" fill="none" />
              <rect className="stitch" fill="none" />
            </svg>
          </div>
          <canvas className="cloth__fold" />
          <img className="cloth__rim" src={basketRimImg} alt="" />
          <canvas className="cloth__cord" />
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
