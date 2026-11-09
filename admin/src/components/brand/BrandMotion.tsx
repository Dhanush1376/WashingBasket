import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { LOGO_ASPECT, LogoLayer, Wordmark } from './LogoLayers';

/*
 * The customer app's brand motion on the web, in CSS (see styles/brand.css):
 * - BrandIntro: the opening lockup (mobile IntroSplashScreen + CinematicLogoLockup + AnimatedLogo). The basket
 *   glides in and settles, the towel drapes over the rim, the red and orange cloths drop in, the sparkles pop,
 *   then the logo slides left as "WashingBasket" emerges from behind it. Same timings as the app.
 * - LogoLoader / LoadingOverlay: the looping logo loader with its sliding bar, over a soft blur.
 */

/** Same timeline as the app (ms): the lockup settles at 3800 and holds until 5800; the intro leaves at +500. */
const COMPLETE_MS = 5800;
const LEAVE_MS = 400;
const GAP = 12;

export function BrandIntro({ onDone, logoWidth = 92, fontSize = 26 }: { onDone: () => void; logoWidth?: number; fontSize?: number }) {
  const wordRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const left = useRef(false);

  // the logo starts dead centre: shifted right by half of (gap + wordmark), the wordmark hidden behind it
  useLayoutEffect(() => {
    const measure = () => setShift((GAP + (wordRef.current?.offsetWidth ?? 0)) / 2);
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
  }, []);

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    setLeaving(true);
    window.setTimeout(onDone, LEAVE_MS);
  }, [onDone]);

  // a click or key jumps straight to the finished lockup, then fades out
  const skip = useCallback(() => {
    setSkipped(true);
    leave();
  }, [leave]);

  useEffect(() => {
    const t = window.setTimeout(leave, COMPLETE_MS + 500);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [leave, skip]);

  const W = logoWidth;
  const vars = { '--w': `${W}px`, '--shift': `${shift}px`, '--font': `${fontSize}px` } as CSSProperties;

  return (
    <div
      className={`wb-intro${skipped ? ' wb-intro--skip' : ''}${leaving ? ' wb-intro--leaving' : ''}`}
      style={vars}
      onClick={skip}
      role="presentation"
    >
      <div className="wb-intro__lockup" aria-label="Washing Basket" role="img">
        <div className="wbi-glide">
          <div className="wb-logo" style={{ width: W, height: W * LOGO_ASPECT }}>
            <div className="wbi-fill wbi-slide">
              <div className="wbi-shadow" />
              <div className="wbi-fill wbi-tilt">
                <div className="wbi-fill wbi-give">
                  <LogoLayer name="basket" width={W} />
                  <LogoLayer name="towel" width={W} className="wbi-towel" artClassName="wbi-towel__art" />
                </div>
              </div>
            </div>
            <div className="wbi-fill wbi-give-small">
              <LogoLayer name="clothRed" width={W} className="wbi-cloth wbi-red" />
            </div>
            <LogoLayer name="clothOrange" width={W} className="wbi-cloth wbi-orange" />
            <LogoLayer name="sparkleLarge" width={W} className="wbi-sparkle wbi-sp1" />
            <LogoLayer name="sparkleSmall" width={W} className="wbi-sparkle wbi-sp2" />
          </div>
        </div>
        <span ref={wordRef} className="wbi-word">
          <Wordmark />
        </span>
      </div>
      <p className="wb-intro__hint">Click anywhere to skip</p>
    </div>
  );
}

/** The looping logo loader: the basket fills, sparkles, clears and starts again, with a bar sliding beneath. */
export function LogoLoader({ size = 72 }: { size?: number }) {
  const vars = { '--w': `${size}px` } as CSSProperties;
  return (
    <div className="wbl" style={vars} role="progressbar" aria-label="Loading">
      <div className="wb-logo wbl-logo" style={{ width: size, height: size * LOGO_ASPECT }}>
        <div className="wbi-fill wbl-basket">
          <LogoLayer name="basket" width={size} />
        </div>
        <LogoLayer name="towel" width={size} className="wbl-towel" knockout="#FAF7F0" />
        <LogoLayer name="clothRed" width={size} className="wbl-red" />
        <LogoLayer name="clothOrange" width={size} className="wbl-orange" />
        <LogoLayer name="sparkleLarge" width={size} className="wbl-sp1" />
        <LogoLayer name="sparkleSmall" width={size} className="wbl-sp2" />
      </div>
      <div className="wbl-track">
        <span className="wbl-bar" />
      </div>
    </div>
  );
}

/** Full-screen loader over a calm blur of the page; fades in and out as `visible` changes. */
export function LoadingOverlay({ visible, message }: { visible: boolean; message?: string }) {
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) return;
    const t = window.setTimeout(() => setMounted(false), 380);
    return () => window.clearTimeout(t);
  }, [visible]);

  if (!mounted) return null;
  return (
    <div className={`wb-overlay${visible ? '' : ' wb-overlay--out'}`} aria-live="polite" aria-busy={visible}>
      <LogoLoader />
      {message ? <p className="wb-overlay__message">{message}</p> : null}
    </div>
  );
}
