/**
 * The app, and booking with it.
 *
 * App · the real screens in phones, five in staggered columns, drifting at slightly different speeds
 * as the page moves. On phones they become one level row: the section holds while the row slides across
 * with the scroll, and the page moves on only once the last phone has come into view.
 *
 * Booking · the whole journey in one view: five connected steps, from choosing services to getting the
 * laundry back, all visible together.
 */
import React, { useEffect, useRef } from 'react';

import { Lines, Phone } from '../components';
import { APP, BOOKING } from '../content';
import { gsap, useScene } from '../motion';

const DRIFT = [-110, 80, -150, 60, -95];

export function AppShowcase() {
  const ref = useRef<HTMLElement>(null);
  const wallRef = useRef<HTMLUListElement>(null);
  const fillRef = useRef<HTMLElement>(null);

  // Desktop drift animation
  useScene(ref, ({ q, desktop }) => {
    if (!desktop || window.innerWidth < 960) return;
    q('.wall__col').forEach((col, i) => {
      gsap.fromTo(
        col,
        { y: -DRIFT[i] },
        { y: DRIFT[i], ease: 'none', scrollTrigger: { trigger: '.wall', start: 'top bottom', end: 'bottom top', scrub: 0.6 } },
      );
    });
  });

  // Mobile horizontal swipe progress bar sync
  useEffect(() => {
    const wall = wallRef.current;
    const fill = fillRef.current;
    if (!wall || !fill) return;

    const onScroll = () => {
      const maxScroll = wall.scrollWidth - wall.clientWidth;
      const progress = maxScroll > 0 ? wall.scrollLeft / maxScroll : 0;
      const scale = 0.2 + 0.8 * Math.min(Math.max(progress, 0), 1);
      fill.style.transform = `scaleX(${scale.toFixed(3)})`;
    };

    wall.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    return () => {
      wall.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <section className="app" ref={ref} id="app" aria-labelledby="app-title">
      <div className="app__head">
        <p className="index">
          <span>02</span>
          {APP.label}
        </p>
        <h2 className="h2 title" id="app-title">
          <Lines lines={APP.title} />
        </h2>
        <div className="app__aside" data-reveal>
          <p className="app__lead">{APP.body}</p>
          <ul className="app__tabs" aria-label="Screens shown">
            {APP.screens.map((s, i) => (
              <li key={s.name}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {s.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ul className="wall" ref={wallRef}>
        {APP.screens.map((s, i) => (
          <li className="wall__col" key={s.name} style={{ '--i': i } as React.CSSProperties}>
            <figure>
              <Phone src={s.src} alt={`The ${s.name} screen of the Washing Basket app`} className="wall__phone" eager />
              <figcaption>
                <span className="wall__no">{String(i + 1).padStart(2, '0')}</span>
                <strong>{s.name}</strong>
                <span className="wall__desc">{s.note}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      <span className="app__progress" aria-hidden="true">
        <i ref={fillRef} />
      </span>
    </section>
  );
}

/**
 * How booking works · the whole journey at once. Five stations, each with the real app screen for that
 * step rising out of a plate in the step's colour; beneath them one path of numbered stops, arrows pointing
 * the way and a small pulse travelling along it. Read left to right on wide screens and top to bottom on
 * phones. Every step is there at once; as the journey comes into view the five phones rise out of their
 * plates together, and the path and the words settle in after them.
 */
export function Booking() {
  const ref = useRef<HTMLElement>(null);
  const last = BOOKING.steps.length - 1;

  useScene(ref, ({ q, one, desktop }) => {
    const rise = (steps: HTMLElement[], trigger: Element, start: string) => {
      const pick = (sel: string) => steps.map((s) => s.querySelector(sel)).filter(Boolean) as Element[];
      const phones = pick('.journey__phone');
      // the phones rise out of their plates with the scroll itself, so the rise is always seen, however fast
      // the page moves; the phones' hover transition would smooth every frame into a lag, so it is off meanwhile
      gsap.set(phones, { transition: 'none' });
      gsap
        .timeline({
          scrollTrigger: {
            trigger,
            start,
            end: desktop ? 'top 30%' : 'top 45%',
            scrub: 0.7,
            onLeave: () => gsap.set(phones, { clearProps: 'transition' }),
            onEnterBack: () => gsap.set(phones, { transition: 'none' }),
          },
        })
        .fromTo(pick('.journey__plate'), { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out', stagger: 0.08 }, 0)
        .fromTo(phones, { yPercent: 78, rotation: 4 }, { yPercent: 0, rotation: 0, duration: 1, ease: 'power3.out', stagger: 0.08 }, 0.05);
      // the numbers, links and words come in once, as the row arrives
      gsap
        .timeline({ scrollTrigger: { trigger, start: desktop ? 'top 55%' : 'top 70%', once: true } })
        .from(pick('.journey__no'), { scale: 0.4, opacity: 0, duration: 0.5, ease: 'back.out(2.2)', stagger: 0.08 }, 0)
        .from(pick('.journey__link'), { opacity: 0, x: desktop ? -14 : 0, y: desktop ? 0 : -10, duration: 0.5, ease: 'power2.out', stagger: 0.08 }, 0.1)
        .from(pick('.journey__text'), { opacity: 0, y: 16, duration: 0.6, ease: 'power2.out', stagger: 0.06 }, 0.05);
    };
    const steps = q('.journey__step');
    if (desktop) rise(steps, one('.journey'), 'top 92%');
    else steps.forEach((s) => rise([s], s, 'top 95%'));
  });

  return (
    <section className="book" id="how" aria-labelledby="book-title" ref={ref}>
      <div className="book__head">
        <p className="index">
          <span>04</span>
          {BOOKING.label}
        </p>
        <h2 className="h2 title" id="book-title">
          <Lines lines={BOOKING.title} />
        </h2>
        <p className="book__lead">{BOOKING.body}</p>
      </div>

      <ol className="journey">
        {BOOKING.steps.map((s, i) => (
          <li className={`journey__step${i === last ? ' journey__step--end' : ''}`} key={s.title} style={{ '--i': i } as React.CSSProperties}>
            <div className="journey__plate">
              <Phone src={s.screen} alt={`The ${s.title.toLowerCase()} screen of the Washing Basket app`} className="journey__phone" eager />
            </div>
            <div className="journey__stop">
              <span className="journey__no" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              {i < last ? (
                <span className="journey__link" aria-hidden="true">
                  <i className="journey__run" />
                  <svg viewBox="0 0 12 12" className="journey__arrow">
                    <path d="M4 2.5 7.5 6 4 9.5" />
                  </svg>
                </span>
              ) : null}
            </div>
            <div className="journey__text">
              <h3 className="journey__title">
                <span className="sr">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="journey__body">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
