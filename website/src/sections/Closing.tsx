/**
 * Handing laundry over, the offers, getting the app, and the footer.
 *
 * Handover · on a soft sky band: the two ways laundry changes hands, side by side under one headline,
 * with the illustration standing on the band's floor and the two campuses beneath.
 * Offers · the app's live coupon codes on two rows of slightly tilted tickets, drifting opposite ways;
 * scrolling carries them faster, and scrolling back turns them round.
 * Download · composed like an app launch page: a small label with the mark and name, the headline and
 * store badges centred beneath it (they read "coming soon" until the app is listed, see config.ts), and
 * three real screens stand in phones on a soft disc, the outer two fanning out from behind the middle one
 * as the page scrolls, cropped by the band's lower edge like a product shot.
 * Footer · a soft sky-blue panel: a short line about the service, three columns (explore, contact,
 * campuses), the name in full colour across the bottom, and the small print beneath it.
 */
import React, { useRef } from 'react';

import { Arrow, BrandName, Lines, Logo, Phone, StoreButton, Ticket } from '../components';
import { CAMPUS, CONTACT, DOWNLOAD, NAV, OFFERS, SCREEN } from '../content';
import { gsap, ScrollTrigger, scrollToTarget, useScene } from '../motion';

/** Brighter papers for the website's coupon rows (the codes and terms are the app's own). */
const VIVID = [
  { paper: '#ff6a2b', stub: '#e8541a' },
  { paper: '#2f9bff', stub: '#1683ea' },
  { paper: '#ffc61a', stub: '#f0b400' },
  { paper: '#22c46b', stub: '#12ad59' },
];
const LIVE = OFFERS.items.filter((o) => o.status !== 'expired').map((o, i) => ({ ...o, ...VIVID[i % VIVID.length] }));
const ROWS = [LIVE, [...LIVE.slice(2), ...LIVE.slice(0, 2)]];
const COPIES = 3; // each row repeats so it can run on without a gap
const BASE = 26; // px per second the rows drift on their own
const PULL = 0.22; // how strongly the scroll speed carries them

export function Offers() {
  const ref = useRef<HTMLElement>(null);

  useScene(ref, ({ root, q }) => {
    // two rows run opposite ways; scrolling speeds them up, and scrolling back turns them round
    const lines = q('.offers__line');
    const rows = lines.map((el, i) => {
      const w = el.scrollWidth / COPIES;
      // the second row starts half a set along, so the two rows never line up
      return { el, dir: i === 0 ? -1 : 1, x: i === 0 ? 0 : -w * 0.5, w, set: gsap.quickSetter(el, 'x', 'px') };
    });
    let vel = 0;
    let on = false;
    const st = ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (s) => (on = s.isActive),
      onUpdate: (s) => (vel = gsap.utils.clamp(-3000, 3000, s.getVelocity())),
      onRefresh: () => rows.forEach((r) => (r.w = r.el.scrollWidth / COPIES)),
    });
    on = st.isActive;
    const tick = (_t: number, dt: number) => {
      vel *= 0.9;
      if (!on) return;
      const speed = BASE + vel * PULL;
      rows.forEach((r) => {
        r.x += (r.dir * speed * dt) / 1000;
        r.x = gsap.utils.wrap(-r.w, 0, r.x);
        r.set(r.x);
      });
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  });

  return (
    <section className="offers" ref={ref} aria-labelledby="offers-title">
      <div className="offers__head">
        <p className="index">
          <span>05</span>
          {OFFERS.label}
        </p>
        <h2 className="h2 title" id="offers-title">
          <Lines lines={OFFERS.title} />
        </h2>
        <p className="offers__lead" data-reveal>
          {OFFERS.body}
        </p>
      </div>
      <div className="offers__rows">
        {ROWS.map((row, r) => (
          <div className="offers__row" key={r}>
            <div className="offers__line">
              {Array.from({ length: COPIES }, (_, c) =>
                row.map((o) => (
                  <div className="offers__slot" key={`${c}-${o.code}`}>
                    <Ticket offer={o} no={OFFERS.items.findIndex((x) => x.code === o.code) + 1} hidden={r > 0 || c > 0} />
                  </div>
                )),
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Short, true notes from the app, floating beside the phones. */
const DL_NOTES = ['Two-hour pickup slots', 'Or drop off with a QR', 'Every step, tracked', 'Free delivery on ₹499+'];

export function Download() {
  const ref = useRef<HTMLElement>(null);

  useScene(ref, ({ q, one, desktop }) => {
    // the little label above the headline settles in, its mark's sparkles popping
    gsap
      .timeline({ scrollTrigger: { trigger: one('.dl__eyebrow'), start: 'top 88%' } })
      .from(one('.dl__eyebrow'), { y: 16, opacity: 0, duration: 0.7, ease: 'power3.out' })
      .from(q('.dl__mark .lg-spark-l, .dl__mark .lg-spark-s'), { scale: 0, transformOrigin: '50% 50%', duration: 0.5, stagger: 0.08, ease: 'back.out(3)' }, '-=0.3');

    // the phones rise slowly together, the orange arc rises like a sun from below, and side phones fan out
    const stage = one<HTMLElement>('.dl__stage');
    const pc = () => one<HTMLElement>('.dl__device--c').offsetWidth;
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: {
        trigger: stage,
        start: 'top 90%',
        end: desktop ? 'center 35%' : 'center 40%',
        scrub: 0.85,
        invalidateOnRefresh: true,
      },
    });
    // Orange arc rises up from bottom while expanding
    tl.fromTo(
      one('.dl__disc'),
      { y: () => pc() * 0.5, scale: 0.65, transformOrigin: '50% 100%' },
      { y: 0, scale: 1, duration: 1 },
      0,
    );
    // Center phone rises steadily
    tl.fromTo(
      one('.dl__device--c'),
      { y: () => pc() * 0.48 },
      { y: 0, duration: 1 },
      0.04,
    );
    // Side phones fan out smoothly with slightly faster, responsive timing
    tl.fromTo(
      one('.dl__device--l'),
      { x: () => pc() * 0.58, y: () => pc() * 0.55, rotation: 0 },
      { x: 0, y: 0, rotation: -6, duration: 1 },
      0.08,
    ).fromTo(
      one('.dl__device--r'),
      { x: () => -pc() * 0.58, y: () => pc() * 0.55, rotation: 0 },
      { x: 0, y: 0, rotation: 6, duration: 1 },
      0.08,
    );
    if (desktop) {
      tl.fromTo(
        q('.dl__note'),
        { y: 35, opacity: 0, scale: 0.92 },
        { y: 0, opacity: 1, scale: 1, stagger: 0.1, duration: 0.45 },
        0.5,
      );
    }
  });

  return (
    <section className="dl" ref={ref} id="download" aria-labelledby="dl-title">
      <div className="dl__inner">
        <div className="dl__head">
          <div className="dl__main">
            <p className="dl__eyebrow">
              <Logo className="dl__mark" knockout="#ffffff" />
              <b><BrandName /></b>
              <i aria-hidden="true" />
              <span>{DOWNLOAD.label}</span>
            </p>
            <h2 className="h2 title dl__title" id="dl-title">
              <Lines lines={DOWNLOAD.title} />
            </h2>
          </div>
          <div className="dl__side">
            <p className="dl__lead">{DOWNLOAD.body}</p>
            <div className="dl__stores">
              <StoreButton id="googlePlay" />
              <StoreButton id="appStore" />
            </div>
          </div>
        </div>

        <div className="dl__stage" aria-hidden="true">
          <span className="dl__disc" />
          <div className="dl__device dl__device--l">
            <Phone src={SCREEN.track} className="dl__phone" eager />
          </div>
          <div className="dl__device dl__device--r">
            <Phone src={SCREEN.wallet} className="dl__phone" eager />
          </div>
          <div className="dl__device dl__device--c">
            <Phone src={SCREEN.home} className="dl__phone" eager />
          </div>
          {DL_NOTES.map((n, i) => (
            <span className={`dl__note dl__note--${i + 1}`} key={n}>
              <i />
              {n}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    scrollToTarget(id === 'top' ? 0 : `#${id}`, -20);
  };
  return (
    <footer className="foot">
      <div className="foot__panel">
        <div className="foot__grid">
          <p className="foot__about">Laundry collected, cared for and brought back, at LPU, NIT Jalandhar and Model Town.</p>
          <nav className="foot__col foot__col--explore" aria-label="Footer">
            <h3>Explore</h3>
            <ul>
              {NAV.map((n) => (
                <li key={n.id}>
                  <a href={`#${n.id}`} onClick={go(n.id)}>
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="foot__col foot__col--contact">
            <h3>Contact</h3>
            <ul>
              <li>
                <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}>{CONTACT.phone}</a>
              </li>
              <li>
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              </li>
              <li>{CONTACT.hours}</li>
            </ul>
          </div>
          <div className="foot__col foot__col--campuses">
            <h3>Locations</h3>
            <ul>
              <li className="foot__campus">
                <img src={CAMPUS.lpu} alt="" width={26} height={26} loading="lazy" />
                Lovely Professional University
              </li>
              <li className="foot__campus">
                <img src={CAMPUS.nitj} alt="" width={26} height={26} loading="lazy" />
                NIT Jalandhar
              </li>
              <li className="foot__campus">
                <span className="foot__campus-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#013E86" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                </span>
                Model Town, Jalandhar
              </li>
            </ul>
          </div>
        </div>

        <p className="foot__word" aria-hidden="true">
          <span className="foot__mark-wrap">
            <Logo className="foot__mark" knockout="#ffffff" />
          </span>
          <span className="foot__brand-title">
            <BrandName />
          </span>
        </p>

        <div className="foot__bottom">
          <p>© {new Date().getFullYear()} <BrandName /></p>
          <a href="#top" onClick={go('top')}>
            Back to top
            <Arrow dir="upRight" />
          </a>
        </div>
      </div>
    </footer>
  );
}
