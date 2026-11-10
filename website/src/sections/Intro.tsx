/**
 * The opening intro: the app's logo animation, told again in under three seconds.
 *
 *   0.00  the basket glides in from the right, leaning with its momentum, and settles on its base
 *   0.42  the towel unrolls over the rim and sways
 *   0.72  the red cloth drops in, squashes, and the basket gives under it; 1.00 the orange one
 *   1.30  the sparkles pop
 *   1.52  the logo glides left as the name slides out from behind it
 *   2.05  the curtain lifts, and the hero enters beneath it
 *
 * It plays once per visit (not again on a reload in the same tab), never for people who ask for less
 * motion, and a click, tap or key skips it.
 */
import { useEffect, useRef, useState } from 'react';

import { BrandName, LOGO_COLORS, LOGO_VB } from '../components';
import { LOGO_PARTS } from '../logoGeometry';
import { finishIntro, getLenis, gsap, prefersReducedMotion } from '../motion';

const SEEN = 'wb-intro-seen';
const IVORY = '#FBF9F4';

function shouldPlay() {
  if (prefersReducedMotion()) return false;
  try {
    return sessionStorage.getItem(SEEN) !== '1';
  } catch {
    return true;
  }
}

export function Intro() {
  const [on, setOn] = useState(shouldPlay);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!on) {
      finishIntro();
      return;
    }
    const root = ref.current!;
    const html = document.documentElement;
    html.classList.add('is-intro');
    getLenis()?.stop();
    window.scrollTo(0, 0);

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const one = (s: string) => q(s)[0];
      const logo = one('.intro__logo') as HTMLElement;
      const row = one('.intro__row') as HTMLElement;
      // the logo starts dead centre; the name waits behind it
      const shift = (row.offsetWidth - logo.offsetWidth) / 2;
      const drop = 270; // logo units a cloth falls

      gsap.set(logo, { x: shift });
      gsap.set(q('.intro__name > *'), { xPercent: -104, opacity: 0 });
      gsap.set(q('.ib-basket'), { x: 1000, opacity: 0, rotation: -2.6, svgOrigin: '625 990' });
      gsap.set(q('.ib-towel'), { scaleY: 0, opacity: 0, transformOrigin: '50% 0%' });
      gsap.set(q('.ib-red, .ib-orange'), { y: -drop, opacity: 0, transformOrigin: '50% 100%' });
      gsap.set(q('.ib-spark'), { scale: 0, rotation: -45, opacity: 0, transformOrigin: '50% 50%' });
      gsap.set(q('.ib-all'), { svgOrigin: '625 990' });

      // a cloth falling under gravity, then squashing like fabric and settling; the basket gives under it
      const fall = (sel: string, tilt: number) => {
        const t = gsap.timeline();
        t.fromTo(q(sel), { rotation: tilt }, { y: 0, rotation: 0, duration: 0.26, ease: 'power2.in' })
          .to(q(sel), { opacity: 1, duration: 0.06 }, 0)
          .to(q(sel), { keyframes: [{ scaleY: 0.8, scaleX: 1.1, duration: 0.08, ease: 'power2.out' }, { scaleY: 1, scaleX: 1, duration: 0.42, ease: 'elastic.out(1, 0.42)' }] })
          .to(q('.ib-all'), { keyframes: [{ y: 30, scaleY: 0.94, scaleX: 1.03, duration: 0.08, ease: 'power2.out' }, { y: 0, scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1, 0.35)' }] }, '<')
          .to(q('.ib-towel'), { keyframes: [{ scaleY: 1.14, rotation: 3, duration: 0.1 }, { scaleY: 1, rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' }] }, '<');
        return t;
      };

      const tl = gsap.timeline({ delay: 0.1 });
      tl.to(q('.ib-basket'), { x: 0, duration: 0.5, ease: 'expo.out' }, 0)
        .to(q('.ib-basket'), { opacity: 1, duration: 0.18 }, 0)
        .to(q('.ib-basket'), { keyframes: [{ rotation: -2.6, duration: 0.22 }, { rotation: 0.8, duration: 0.14, ease: 'sine.inOut' }, { rotation: 0, duration: 0.1, ease: 'sine.out' }] }, 0)
        .to(q('.intro__shadow'), { opacity: 1, scaleX: 1, duration: 0.5, ease: 'expo.out' }, 0)
        .to(q('.ib-towel'), { scaleY: 1, opacity: 1, duration: 0.24, ease: 'power2.out' }, 0.42)
        .to(q('.ib-towel'), { keyframes: [{ rotation: 4, duration: 0.12 }, { rotation: -2, duration: 0.12 }, { rotation: 0, duration: 0.16 }], ease: 'sine.inOut' }, 0.62)
        .add(fall('.ib-red', -6), 0.72)
        .add(fall('.ib-orange', 5), 1.0)
        .to(q('.ib-spark'), { scale: 1, rotation: 0, opacity: 1, duration: 0.42, ease: 'back.out(3)', stagger: 0.1 }, 1.3)
        .to(logo, { x: 0, duration: 0.7, ease: 'expo.out' }, 1.52)
        .to(q('.intro__name > *'), { xPercent: 0, duration: 0.7, ease: 'expo.out' }, 1.52)
        .to(q('.intro__name > *'), { opacity: 1, duration: 0.45, ease: 'power2.out' }, 1.58)
        .add('lift', 2.05)
        .add(() => finishIntro(), 'lift')
        .to(q('.intro__row'), { y: -24, opacity: 0, duration: 0.5, ease: 'power2.in' }, 'lift')
        .to(root, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: 'expo.inOut' }, 'lift')
        .add(() => end(), '>');

      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        try {
          sessionStorage.setItem(SEEN, '1');
        } catch {
          /* private windows may refuse; it simply plays again next time */
        }
        html.classList.remove('is-intro');
        getLenis()?.start();
        setOn(false);
      };
      // a click, tap or key goes straight to the lift
      const skip = () => {
        if (tl.time() >= tl.labels.lift) return;
        tl.seek('lift');
        finishIntro();
      };
      root.addEventListener('pointerdown', skip);
      window.addEventListener('keydown', skip);
      // and whatever happens, the page is never left behind it: if the animation has not run its course in a few
      // seconds (a slow phone, or a browser that holds back animation frames, as some apps' built-in browsers and
      // tabs opened in the background do), it is put away and the page let go
      const guard = window.setTimeout(() => {
        if (ended) return;
        finishIntro();
        end();
      }, 6000);
      return () => {
        window.clearTimeout(guard);
        root.removeEventListener('pointerdown', skip);
        window.removeEventListener('keydown', skip);
      };
    }, root);

    return () => {
      ctx.revert();
      html.classList.remove('is-intro');
      getLenis()?.start();
    };
  }, [on]);

  if (!on) return null;
  return (
    <div className="intro" ref={ref} role="presentation">
      <div className="intro__row">
        <div className="intro__logo">
          <i className="intro__shadow" />
          <svg viewBox={LOGO_VB} aria-hidden="true">
            <g className="ib-all">
              <g className="ib-red">
                <path d={LOGO_PARTS.clothRed.d} fill={LOGO_COLORS.red} />
              </g>
              <g className="ib-orange">
                <path d={LOGO_PARTS.clothOrange.d} fill={LOGO_COLORS.orange} />
              </g>
              <g className="ib-basket">
                <path d={LOGO_PARTS.basket.d} fill={LOGO_COLORS.orange} fillRule="evenodd" />
                <path d={LOGO_PARTS.basketRim.d} fill={LOGO_COLORS.orange} />
                <g className="ib-towel">
                  <path d={LOGO_PARTS.towel.d} fill={IVORY} stroke={IVORY} strokeWidth={16} strokeLinejoin="round" />
                  <path d={LOGO_PARTS.towel.d} fill={LOGO_COLORS.navy} />
                </g>
              </g>
            </g>
            <g className="ib-spark">
              <path d={LOGO_PARTS.sparkleLarge.d} fill={LOGO_COLORS.navy} />
            </g>
            <g className="ib-spark">
              <path d={LOGO_PARTS.sparkleSmall.d} fill={LOGO_COLORS.navy} />
            </g>
          </svg>
        </div>
        <div className="intro__name" aria-label="Washing Basket">
          <BrandName />
        </div>
      </div>
    </div>
  );
}
