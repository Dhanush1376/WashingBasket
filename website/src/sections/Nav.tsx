/**
 * Navigation, as two quiet objects rather than a bar: a tab pill at the top left (the mark and the four
 * chapters of the page) and a toggle-shaped "Get the app" at the top right, which in the hero sits in a
 * notch cut out of the picture. Both step aside while you read downwards and return when you scroll up.
 * On phones the pill holds the mark and a menu button that opens a full-screen sheet.
 */
import React, { useEffect, useState } from 'react';

import { Arrow, BrandName, Logo } from '../components';
import { CONTACT, NAV } from '../content';
import { scrollToTarget } from '../motion';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      setScrolled(y > 40);
      if (y > 320 && y > last + 4) setHidden(true);
      else if (y < last - 4 || y <= 320) setHidden(false);
      last = y;
      const probe = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const n of NAV) {
        const r = document.getElementById(n.id)?.getBoundingClientRect();
        if (r && r.top <= probe && r.bottom > probe) current = n.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add('is-locked');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onResize = () => window.innerWidth >= 900 && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.documentElement.classList.remove('is-locked');
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    scrollToTarget(id === 'top' ? 0 : `#${id}`, id === 'top' ? 0 : -20);
  };

  const cls = ['nav', scrolled && 'is-scrolled', hidden && !open && 'is-hidden', open && 'is-open'].filter(Boolean).join(' ');

  return (
    <header className={cls}>
      <div className="nav__pill">
        <a className="nav__brand" href="#top" onClick={go('top')} aria-label="Washing Basket, back to top">
          <Logo className="nav__mark" knockout="#ffffff" />
          <span className="nav__name"><BrandName /></span>
        </a>
        <nav className="nav__links" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} onClick={go(n.id)} aria-current={active === n.id ? 'location' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <button
          className="nav__menu"
          type="button"
          aria-expanded={open}
          aria-controls="nav-sheet"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      <a className="toggle nav__toggle" href="#download" onClick={go('download')}>
        <span>Get the app</span>
        <i aria-hidden="true">
          <Arrow dir="upRight" />
        </i>
      </a>

      <div className="nav__sheet" id="nav-sheet" hidden={!open}>
        <nav aria-label="Menu">
          <ol>
            {NAV.map((n, i) => (
              <li key={n.id} style={{ '--i': i } as React.CSSProperties}>
                <a href={`#${n.id}`} onClick={go(n.id)}>
                  <small>{String(i + 1).padStart(2, '0')}</small>
                  {n.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <p className="nav__sheet-foot">
          <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}>{CONTACT.phone}</a>
          <span>{CONTACT.hours}</span>
        </p>
      </div>
    </header>
  );
}
