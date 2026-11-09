/**
 * The brand moment, between the story and the services. Three bands of colour sweep across the screen
 * like folded cloth, each carrying one word of what the service does. The words blow away, and the bands
 * gather in towards the logo, folding as they come, then draw down to slim bars lying exactly where their
 * pieces belong (the orange cloth, the red cloth, the basket's rim). Each bar opens into its piece: the
 * rim first, the basket is woven down from it, the cloths drop in, the towel swings over the edge and the
 * sparkles pop.
 *
 * Then, like the app's intro lockup, the finished mark makes room for the name: on wide screens it glides
 * left while "Washing Basket" slides out from behind it; on phones the mark rises and the name comes up
 * beneath it.
 */
import { useRef } from 'react';

import { BrandName, Logo, LOGO_COLORS } from '../components';
import { BRAND } from '../content';
import { LOGO_PARTS, LOGO_VIEWBOX } from '../logoGeometry';
import { gsap, useScene } from '../motion';

// band i becomes this logo piece
const PIECES = [
  { sel: '.lg-orange', box: LOGO_PARTS.clothOrange.box, color: LOGO_COLORS.orange },
  { sel: '.lg-red', box: LOGO_PARTS.clothRed.box, color: LOGO_COLORS.red },
  { sel: '.lg-rim', box: LOGO_PARTS.basketRim.box, color: LOGO_COLORS.orange },
];
const COLORS = ['#fe8701', '#d30d24', '#013e86'];
const SLIM = 0.1; // how thin a bar gets, as a share of its piece's height
const BASKET = LOGO_PARTS.basket.box;
const BURST = 10; // specks of light around the sparkles

export function Brand() {
  const ref = useRef<HTMLElement>(null);

  useScene(ref, ({ q, one, desktop }) => {
    const stage = one('.brand__stage');
    const mark = one('.brand__mark');
    const logo = one('.brand__logo');
    const wordmark = one('.brand__wordmark');
    const bands = q('.brand__band');
    const W = () => stage.clientWidth;
    const H = () => stage.clientHeight;
    const bandH = () => H() * (desktop ? 0.17 : 0.12);
    const rowY = (i: number) => H() * (0.28 + i * 0.22) - bandH() / 2;

    const piece = (sel: string) => one(`.brand__logo ${sel}`);
    const weave = one('.brand__weave');
    const sparks = q('.brand__logo .lg-spark-l, .brand__logo .lg-spark-s');
    const specks = q('.brand__speck');

    /**
     * The logo is built dead centre on the screen, then makes room for the name: on wide screens it glides
     * left while the name slides out from behind it; on phones it rises while the name comes up beneath it.
     */
    const getMetrics = () => {
      gsap.set([mark, wordmark], { x: 0, y: 0 });
      const st = stage.getBoundingClientRect();
      const m = mark.getBoundingClientRect();
      const w = wordmark.getBoundingClientRect();
      const shiftMx = desktop ? st.left + st.width / 2 - (m.left + m.width / 2) : 0;
      const shiftMy = desktop ? 0 : st.top + st.height * 0.46 - (m.top + m.height / 2);
      const shiftW = desktop ? st.left + st.width / 2 - (w.left + w.width / 2) : 0;

      const l = logo.getBoundingClientRect();
      const k = l.width / LOGO_VIEWBOX.w;
      const pieceTargets = PIECES.map((p) => {
        const bx = p.box;
        return {
          x: l.left + shiftMx - st.left + (bx.x - LOGO_VIEWBOX.x) * k,
          y: l.top + shiftMy - st.top + (bx.y - LOGO_VIEWBOX.y) * k,
          w: bx.w * k,
          h: bx.h * k,
        };
      });
      return { shiftMx, shiftMy, shiftW, pieceTargets };
    };

    let metrics = getMetrics();

    // the logo waits at the centre; the name waits hidden (behind the logo on wide screens, below it on phones)
    gsap.set(mark, { x: () => metrics.shiftMx, y: () => metrics.shiftMy });
    gsap.set(wordmark, { x: () => metrics.shiftW, y: desktop ? 0 : 28, opacity: 0 });

    // the logo waits in place, every piece folded away
    gsap.set(PIECES.map((p) => piece(p.sel)), { scaleY: SLIM, autoAlpha: 0, transformOrigin: '50% 50%' });
    piece('.lg-basket').setAttribute('clip-path', 'url(#brand-weave)');
    gsap.set(weave, { attr: { height: 0 } });
    gsap.set(piece('.lg-towel'), { scaleY: 0, rotation: -18, transformOrigin: '50% 0%' });
    gsap.set(sparks, { scale: 0, rotation: -120, transformOrigin: '50% 50%' });
    gsap.set(specks, { x: 0, y: 0, scale: 0, opacity: 0 });
    gsap.set(one('.brand__ring'), { scale: 0.5, opacity: 0 });
    gsap.set(one('.brand__body'), { opacity: 0, y: 24 });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: ref.current,
        // the bands sweep in while the section is still coming up the screen, so they are in place (words
        // readable) by the time it settles, instead of an empty screen first
        start: desktop ? 'top 60%' : 'top 55%',
        end: 'bottom bottom',
        scrub: 0.8,
        invalidateOnRefresh: true,
        onRefreshInit: () => {
          metrics = getMetrics();
        },
      },
    });

    // 1 · the bands sweep in, each carrying a word (no border radius at ends)
    bands.forEach((band, i) => {
      const from = i % 2 === 0 ? -1 : 1;
      tl.fromTo(
        band,
        {
          autoAlpha: 1,
          x: () => from * W() * 1.15 - W() * 0.05,
          y: () => rowY(i),
          width: () => W() * 1.1,
          height: bandH,
          rotation: 0,
          borderRadius: 0,
          backgroundColor: COLORS[i],
        },
        { x: () => -W() * 0.05, duration: 1, ease: 'power3.out' },
        i * 0.32,
      );
      tl.fromTo(band.querySelector('.brand__word'), { xPercent: from * 30 }, { xPercent: from * -12, duration: 2.0 }, i * 0.32);
    });

    // 2 · the words blow away, each the way its band came from
    bands.forEach((band, i) => {
      const from = i % 2 === 0 ? -1 : 1;
      tl.to(band.querySelector('.brand__word'), { xPercent: from * -60, opacity: 0, filter: 'blur(8px)', duration: 0.4, ease: 'power2.in' }, 2.05 + i * 0.05);
    });

    // 3 · the bands gather in towards the centered logo, folding as they come
    bands.forEach((band, i) => {
      tl.to(
        band,
        {
          x: () => metrics.pieceTargets[i].x - metrics.pieceTargets[i].w * 0.35,
          y: () => metrics.pieceTargets[i].y + metrics.pieceTargets[i].h / 2 - bandH() * 0.22 + (i - 1) * bandH() * 0.5,
          width: () => metrics.pieceTargets[i].w * 1.7,
          height: () => bandH() * 0.44,
          borderRadius: 0,
          rotation: (i - 1) * -5,
          duration: 0.7,
          ease: 'power2.inOut',
        },
        2.15 + (2 - i) * 0.08,
      );
    });

    // 4 · and draw down to slim bars on their pieces' centre lines, taking the pieces' colours
    bands.forEach((band, i) => {
      const at = 2.85 + (2 - i) * 0.08;
      tl.to(
        band,
        {
          x: () => metrics.pieceTargets[i].x,
          y: () => metrics.pieceTargets[i].y + (metrics.pieceTargets[i].h * (1 - SLIM)) / 2,
          width: () => metrics.pieceTargets[i].w,
          height: () => metrics.pieceTargets[i].h * SLIM,
          borderRadius: 0,
          rotation: 0,
          duration: 0.6,
          ease: 'power3.inOut',
        },
        at,
      );
      tl.to(band, { backgroundColor: PIECES[i].color, duration: 0.15 }, at + 0.45);
    });

    // 5 · the bars open into the real pieces at dead-center
    const open = (i: number, at: number) =>
      tl
        .set(bands[i], { autoAlpha: 0 }, at)
        .set(piece(PIECES[i].sel), { autoAlpha: 1 }, at)
        .to(piece(PIECES[i].sel), { scaleY: 1, duration: 0.45, ease: 'back.out(2.2)' }, at);
    open(2, 3.55);
    tl.to(weave, { attr: { height: BASKET.h + 40 }, duration: 0.7, ease: 'power2.inOut' }, 3.65);
    open(1, 3.7);
    open(0, 3.82);
    tl.fromTo(piece('.lg-red'), { y: -26 }, { y: 0, duration: 0.5, ease: 'bounce.out' }, 3.75)
      .fromTo(piece('.lg-orange'), { y: -40 }, { y: 0, duration: 0.55, ease: 'bounce.out' }, 3.87)
      .to(piece('.lg-towel'), { scaleY: 1, duration: 0.35, ease: 'power2.out' }, 4.15)
      .to(piece('.lg-towel'), { rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.45)' }, 4.2)
      .to(sparks, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.4)', stagger: 0.1 }, 4.35)
      .to(one('.brand__ring'), { scale: 1.25, opacity: 0.55, duration: 0.3, ease: 'power2.out' }, 4.35)
      .to(one('.brand__ring'), { scale: 1.6, opacity: 0, duration: 0.5, ease: 'power1.out' }, 4.65);
    specks.forEach((sp, k) => {
      const a = (k / BURST) * Math.PI * 2;
      const r = (desktop ? 120 : 96) * (0.75 + (k % 3) * 0.2);
      tl.to(sp, { x: Math.cos(a) * r, y: Math.sin(a) * r, scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' }, 4.4).to(
        sp,
        { scale: 0, opacity: 0, duration: 0.35 },
        4.7,
      );
    });

    // 6 · once the burst has settled, the logo makes room and the name arrives
    const AT = 5.0;
    tl.fromTo(mark, { x: () => metrics.shiftMx, y: () => metrics.shiftMy }, { x: 0, y: 0, duration: 0.85, ease: 'expo.out' }, AT)
      .fromTo(
        wordmark,
        { x: () => metrics.shiftW, y: desktop ? 0 : 28, opacity: 0 },
        { x: 0, y: 0, opacity: 1, duration: 0.85, ease: 'expo.out' },
        AT + (desktop ? 0 : 0.15),
      )
      .to(one('.brand__body'), { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, AT + 0.4)
      .to({}, { duration: desktop ? 0.35 : 0.05 });
  });

  return (
    <section className="brand" ref={ref} aria-labelledby="brand-title">
      <div className="brand__stage">
        {BRAND.bands.map((b) => (
          <div className="brand__band" key={b} aria-hidden="true">
            <span className="brand__word">{b}</span>
          </div>
        ))}
        <div className="brand__lockup">
          <div className="brand__row">
            <div className="brand__mark">
              <span className="brand__ring" aria-hidden="true" />
              <span className="brand__burst" aria-hidden="true">
                {Array.from({ length: BURST }, (_, k) => (
                  <i key={k} className="brand__speck" />
                ))}
              </span>
              <Logo className="brand__logo" knockout="#f5f2ec" title="The Washing Basket logo">
                <defs>
                  <clipPath id="brand-weave">
                    <rect className="brand__weave" x={BASKET.x - 20} y={BASKET.y} width={BASKET.w + 40} height={BASKET.h + 40} />
                  </clipPath>
                </defs>
              </Logo>
            </div>
            <div className="brand__wordmark">
              <h2 id="brand-title" className="brand__name">
                <BrandName />
              </h2>
            </div>
          </div>
          <p className="brand__body">
            <span>{BRAND.body[0]}</span>
            <br />
            <span>{BRAND.body[1]}</span>
          </p>
          <p className="sr">{BRAND.bands.join(' ')}</p>
        </div>
      </div>
    </section>
  );
}
