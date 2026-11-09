/** Shared pieces: the layered logo, the phone, store badges, the offer ticket, icons. */
import React from 'react';

import { STORE_LABEL, storeHref, type StoreId } from './config';
import { LOGO_PARTS, LOGO_VIEWBOX } from './logoGeometry';
import type { Offer } from './content';

export const LOGO_COLORS = { orange: '#FE8701', red: '#D30D24', navy: '#013E86' } as const;
export const LOGO_VB = `${LOGO_VIEWBOX.x} ${LOGO_VIEWBOX.y} ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`;

/**
 * The Washing Basket logo as separate, animatable layers (traced from the brand PNG, so proportions are
 * exact). `knockout` is the colour behind the logo: the towel's outline in that colour reproduces the
 * gap where it drapes over the rim.
 */
export function LogoParts({ knockout = '#FBF9F4', mono }: { knockout?: string; mono?: string }) {
  const c = (v: string) => mono ?? v;
  return (
    <>
      <g className="lg-red">
        <path d={LOGO_PARTS.clothRed.d} fill={c(LOGO_COLORS.red)} />
      </g>
      <g className="lg-orange">
        <path d={LOGO_PARTS.clothOrange.d} fill={c(LOGO_COLORS.orange)} />
      </g>
      <g className="lg-basket">
        <path d={LOGO_PARTS.basket.d} fill={c(LOGO_COLORS.orange)} fillRule="evenodd" />
      </g>
      <g className="lg-rim">
        <path d={LOGO_PARTS.basketRim.d} fill={c(LOGO_COLORS.orange)} />
      </g>
      <g className="lg-towel">
        <path d={LOGO_PARTS.towel.d} fill={knockout} stroke={knockout} strokeWidth={16} strokeLinejoin="round" />
        <path d={LOGO_PARTS.towel.d} fill={c(LOGO_COLORS.navy)} />
      </g>
      <g className="lg-spark-l">
        <path d={LOGO_PARTS.sparkleLarge.d} fill={c(LOGO_COLORS.navy)} />
      </g>
      <g className="lg-spark-s">
        <path d={LOGO_PARTS.sparkleSmall.d} fill={c(LOGO_COLORS.navy)} />
      </g>
    </>
  );
}

export function Logo({
  className = '',
  knockout,
  mono,
  title,
  children,
}: {
  className?: string;
  knockout?: string;
  mono?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <svg className={`logo ${className}`} viewBox={LOGO_VB} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {children}
      <LogoParts knockout={knockout} mono={mono} />
    </svg>
  );
}

export function Arrow({ dir = 'right' }: { dir?: 'right' | 'left' | 'upRight' | 'down' }) {
  const d = { right: 'M5 12h14M13 6l6 6-6 6', left: 'M19 12H5M11 6l-6 6 6 6', upRight: 'M7 17 17 7M9 7h8v8', down: 'M12 5v14M6 13l6 6 6-6' }[dir];
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A phone with a real app screenshot. Screens are 720 × 1558 (a 390 × 844 phone at 2×). */
export function Phone({
  src,
  alt,
  className = '',
  children,
  eager,
}: {
  src?: string;
  alt?: string;
  className?: string;
  children?: React.ReactNode;
  eager?: boolean;
}) {
  return (
    <div className={`phone ${className}`}>
      <div className="phone__screen">
        {src ? <img src={src} alt={alt ?? ''} width={720} height={1558} loading={eager ? 'eager' : 'lazy'} decoding="async" /> : null}
        {children}
        <StatusBar />
        <span className="phone__home" aria-hidden="true" />
      </div>
      <span className="phone__island" aria-hidden="true" />
    </div>
  );
}

/** The phone's status bar: time on the left, signal, Wi-Fi and battery on the right, on frosted glass. */
function StatusBar() {
  return (
    <div className="phone__status" aria-hidden="true">
      <span className="phone__time">9:41</span>
      <span className="phone__icons">
        <svg viewBox="0 0 18 12">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 16 12">
          <path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.4A10.6 10.6 0 0 0 8 .2 10.6 10.6 0 0 0 .5 3.3l1.3 1.4A8.7 8.7 0 0 1 8 2.2Z" />
          <path d="M8 5.8c1.4 0 2.7.5 3.7 1.4l1.3-1.4A7.3 7.3 0 0 0 8 3.8c-1.9 0-3.7.7-5 2l1.3 1.4c1-.9 2.3-1.4 3.7-1.4Z" />
          <path d="M8 9.2c.6 0 1.1.2 1.5.6L8 11.5 6.5 9.8c.4-.4.9-.6 1.5-.6Z" />
        </svg>
        <svg viewBox="0 0 27 12">
          <rect x="0.5" y="0.5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" strokeOpacity="0.4" />
          <rect x="2" y="2" width="18" height="8" rx="2" />
          <path d="M25 4v4a2 2 0 0 0 0-4Z" fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

function StoreGlyph({ id }: { id: StoreId }) {
  if (id === 'googlePlay') {
    return (
      <svg className="store__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4.2 2.6 13.6 12l-9.4 9.4a1.4 1.4 0 0 1-.7-1.2V3.8c0-.5.3-1 .7-1.2Z" fill="#54B6F8" />
        <path d="m16.8 8.8-3.2 3.2-9.4-9.4c.4-.2.9-.2 1.4.1l11.2 6.1Z" fill="#62D487" />
        <path d="m16.8 15.2-11.2 6.1c-.5.3-1 .3-1.4.1l9.4-9.4 3.2 3.2Z" fill="#F87C87" />
        <path d="m20.3 10.7-3.5-1.9-3.2 3.2 3.2 3.2 3.5-1.9a1.5 1.5 0 0 0 0-2.6Z" fill="#FED843" />
      </svg>
    );
  }
  return (
    <svg className="store__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7a4.5 4.5 0 0 0-3.5-1.9c-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.8-3.2-.8a4.7 4.7 0 0 0-4 2.4c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4a10 10 0 0 0 1.4-2.8c0-.1-2.6-1-2.6-3.9ZM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4Z"
      />
    </svg>
  );
}

export function StoreButton({ id, tone = 'ink' }: { id: StoreId; tone?: 'ink' | 'light' }) {
  const label = STORE_LABEL[id];
  const href = storeHref(id);
  const inner = (
    <>
      <StoreGlyph id={id} />
      <span className="store__text">
        <span className="store__kicker">{href ? label.kicker : 'Coming soon to'}</span>
        <span className="store__name">{label.name}</span>
      </span>
    </>
  );
  // not published yet: a quiet, non-interactive badge rather than a link to nowhere
  if (!href) {
    return (
      <span className={`store store--${tone} store--soon`} aria-label={`Coming soon to ${label.name}`}>
        {inner}
      </span>
    );
  }
  return (
    <a className={`store store--${tone}`} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label.kicker} ${label.name} (opens in a new tab)`}>
      {inner}
    </a>
  );
}

/** A stable pseudo-random barcode for a coupon code. */
function bars(code: string) {
  let seed = Array.from(code).reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);
  const out: number[] = [];
  for (let i = 0; i < 26; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    out.push(1 + Math.floor((seed / 233280) * 3));
  }
  return out;
}

/** The app's coupon ticket: stub, side notches, big value, mono details, barcode, stamp when ended. */
export function Ticket({ offer, no, hidden }: { offer: Offer; no: number; hidden?: boolean }) {
  return (
    <article
      className={`ticket ticket--${offer.status}`}
      style={{ '--paper': offer.paper, '--stub': offer.stub, color: offer.ink || '#FFFFFF' } as React.CSSProperties}
      aria-hidden={hidden || undefined}
    >
      <div className="ticket__stub">
        <span>{offer.status === 'expired' ? 'ENDED' : 'DISCOUNT'}</span>
      </div>
      <div className="ticket__body">
        <div className="ticket__value">
          <span className="ticket__big">{offer.big}</span>
          <span className="ticket__small">{offer.small}</span>
        </div>
        <div className="ticket__meta">
          <span className="ticket__no">Nº {String(no).padStart(2, '0')}</span>
          <span>{offer.badge.toUpperCase()}</span>
          <span className="ticket__title">{offer.title.toUpperCase()}</span>
          <span className="ticket__rule" />
          <span>{offer.validity.toUpperCase()}</span>
        </div>
        <div className="ticket__foot">
          <span className="ticket__bars" aria-hidden="true">
            {bars(offer.code).map((w, i) => (
              <i key={i} style={{ width: w }} />
            ))}
          </span>
          <span className="ticket__code">{offer.code}</span>
          <span className="ticket__cta">{offer.status === 'active' ? 'REDEEM' : offer.status === 'upcoming' ? 'SOON' : 'ENDED'}</span>
        </div>
        <p className="ticket__desc">{offer.body}</p>
      </div>
      {offer.status === 'expired' ? (
        <span className="ticket__stamp" aria-hidden="true">
          <span>★ OFFER ★</span>
          <b>EXPIRED</b>
          <span>31 AUG</span>
        </span>
      ) : null}
    </article>
  );
}

/** A headline set line by line, each line in its own mask so it can rise into view. */
export function Lines({ lines, className = '' }: { lines: readonly string[]; className?: string }) {
  return (
    <>
      {lines.map((line) => (
        <span className={`line ${className}`} key={line}>
          <span className="line__in">{line}</span>
        </span>
      ))}
    </>
  );
}

/** The small label that opens a scene: a dot and a name. */
export function Kicker({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return (
    <p className={`kicker ${tone}`}>
      <span className="kicker__dot" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Universal brand wordmark typography matching the brand style exactly */
export function BrandName({ className = '' }: { className?: string }) {
  return (
    <span className={`brand-title ${className}`}>
      <span className="brand-title__cap brand-title__cap--w">W</span>
      <span className="brand-title__rest brand-title__rest--wash">ashing</span>
      <span className="brand-title__cap brand-title__cap--b">B</span>
      <span className="brand-title__rest brand-title__rest--basket">asket</span>
    </span>
  );
}
