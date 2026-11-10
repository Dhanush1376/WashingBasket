/**
 * The motion core: GSAP + ScrollTrigger driven by Lenis smooth scrolling, and `useScene`, the one way a
 * scene sets up its animation. Every scene builds inside a gsap.context + gsap.matchMedia, so it is
 * rebuilt when the layout crosses the phone/desktop line and fully reverted on unmount.
 *
 * Reduced motion: no smooth scrolling and no scene motion at all; every section reads as laid out.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useLayoutEffect, type RefObject } from 'react';

gsap.registerPlugin(ScrollTrigger);
// the phone address bar showing and hiding should not re-measure (and jolt) the page
ScrollTrigger.config({ ignoreMobileResize: true });
gsap.defaults({ ease: 'power3.out' });

export { gsap, ScrollTrigger };

export const DESKTOP = '(min-width: 900px) and (prefers-reduced-motion: no-preference)';
export const MOBILE = '(max-width: 899px) and (prefers-reduced-motion: no-preference)';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───────────── the opening intro ───────────── */

let introOver: () => void = () => {};
/** Settles when the opening intro has lifted (at once when it does not play), so the hero enters after it. */
export const introDone = new Promise<void>((resolve) => {
  introOver = resolve;
});
export const finishIntro = () => introOver();

/* ───────────── smooth scrolling ───────────── */

let lenis: Lenis | null = null;
/** True while the page is travelling to a link's target, so scenes that pace the scroll let it pass. */
let jumping = false;
export const getLenis = () => lenis;
export const isJumping = () => jumping;
export function startSmoothScroll() {
  if (lenis || prefersReducedMotion()) return () => {};
  lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
  };
}

/** Scrolls to a part of the page, smoothly unless reduced motion is on. */
export function scrollToTarget(target: string | HTMLElement | number, offset = 0) {
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (el === null) return;
  if (lenis) {
    jumping = true;
    lenis.scrollTo(el as HTMLElement | number, {
      offset,
      duration: 1.6,
      onComplete: () => {
        jumping = false;
      },
    });
    window.setTimeout(() => (jumping = false), 2200);
    return;
  }
  const top = typeof el === 'number' ? el : el.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/* ───────────── scenes ───────────── */

export type Scene = {
  root: HTMLElement;
  desktop: boolean;
  q: <T extends HTMLElement = HTMLElement>(sel: string) => T[];
  one: <T extends Element = HTMLElement>(sel: string) => T;
};

/*
 * Setting a scene up measures the page and builds its tweens, a few hundred milliseconds of the main thread on a
 * phone for the larger ones. Done for every section at once on opening, that held the intro on its first frame
 * for a second or more. So only the scene in view on opening (the hero, `eager`) is set up at once; the rest wait
 * until the intro has lifted and the hero has come in, and are then set up one at a time, each when the browser
 * has a moment to spare, and the page measured again once they are all in.
 */
const waiting: (() => void)[] = [];
let pumping = false;
const later = (f: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout: 400 });
  else window.setTimeout(f, 30);
};
const pump = () => {
  const job = waiting.shift();
  if (!job) {
    pumping = false;
    ScrollTrigger.refresh();
    return;
  }
  job();
  later(pump);
};
let opened = false;
introDone.then(() => window.setTimeout(() => {
  opened = true;
  if (waiting.length && !pumping) {
    pumping = true;
    later(pump);
  }
}, 900));
/** Runs a job a little after opening, once the intro has lifted, one job per spare moment (see above). */
export function whenFree(job: () => void) {
  waiting.push(job);
  if (opened && !pumping) {
    pumping = true;
    later(pump);
  }
}

/**
 * Sets up a scene's motion for whichever layout applies (desktop or phone, motion allowed). The setup may
 * return a cleanup for anything GSAP does not own (listeners, canvases); GSAP's own tweens and triggers
 * are reverted automatically. Scenes below the fold are set up a little after opening (see above); `eager`
 * sets one up at once.
 */
export function useScene(ref: RefObject<HTMLElement | null>, setup: (s: Scene) => void | (() => void), opts?: { eager?: boolean }) {
  const eager = !!opts?.eager;
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const q = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
    const one = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T;
    let ctx: gsap.Context | null = null;
    let gone = false;
    const run = () => {
      if (gone) return;
      ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        mm.add({ desktop: DESKTOP, mobile: MOBILE }, (c) => setup({ root, desktop: !!c.conditions?.desktop, q, one }));
      }, root);
    };
    if (eager) run();
    else whenFree(run);
    return () => {
      gone = true;
      ctx?.revert();
    };
    // setup is defined inline by each scene and only depends on refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, eager]);
}

/** Splits a string into masked characters for type reveals. */
export function chars(text: string) {
  return Array.from(text).map((ch) => (ch === ' ' ? ' ' : ch));
}
