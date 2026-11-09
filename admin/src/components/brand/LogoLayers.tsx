import type { CSSProperties } from 'react';

import { LOGO_PARTS, LOGO_VIEWBOX, type Box } from '@customer/components/logo/logoGeometry';

/*
 * The Washing Basket logo, built from the customer app's own traced shapes (mobile/src/components/logo),
 * one absolutely-placed SVG per piece so each can be animated on its own, exactly as the app does.
 */

export type LayerName = 'basket' | 'towel' | 'clothOrange' | 'clothRed' | 'sparkleLarge' | 'sparkleSmall';

export const LOGO_ASPECT = LOGO_VIEWBOX.h / LOGO_VIEWBOX.w;

const ORANGE = '#FE8701';
const RED = '#D30D24';
const NAVY = '#013E86';

const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

const LAYER_BOX: Record<LayerName, Box> = {
  basket: union(LOGO_PARTS.basketRim.box, LOGO_PARTS.basket.box),
  towel: LOGO_PARTS.towel.box,
  clothOrange: LOGO_PARTS.clothOrange.box,
  clothRed: LOGO_PARTS.clothRed.box,
  sparkleLarge: LOGO_PARTS.sparkleLarge.box,
  sparkleSmall: LOGO_PARTS.sparkleSmall.box,
};

function frame(name: LayerName, width: number): CSSProperties {
  const s = width / LOGO_VIEWBOX.w;
  const b = LAYER_BOX[name];
  return { left: (b.x - LOGO_VIEWBOX.x) * s, top: (b.y - LOGO_VIEWBOX.y) * s, width: b.w * s, height: b.h * s };
}

function Art({ name, knockout }: { name: LayerName; knockout: string }) {
  switch (name) {
    case 'basket':
      return (
        <>
          <path d={LOGO_PARTS.basket.d} fill={ORANGE} fillRule="evenodd" />
          <path d={LOGO_PARTS.basketRim.d} fill={ORANGE} />
        </>
      );
    case 'towel':
      // the outline in the background colour recreates the logo's gap where the towel drapes over the rim
      return (
        <>
          <path d={LOGO_PARTS.towel.d} fill={knockout} stroke={knockout} strokeWidth={16} strokeLinejoin="round" />
          <path d={LOGO_PARTS.towel.d} fill={NAVY} />
        </>
      );
    case 'clothOrange':
      return <path d={LOGO_PARTS.clothOrange.d} fill={ORANGE} />;
    case 'clothRed':
      return <path d={LOGO_PARTS.clothRed.d} fill={RED} />;
    case 'sparkleLarge':
      return <path d={LOGO_PARTS.sparkleLarge.d} fill={NAVY} />;
    case 'sparkleSmall':
      return <path d={LOGO_PARTS.sparkleSmall.d} fill={NAVY} />;
  }
}

/** One piece of the logo, positioned inside a logo box of `width` px. */
export function LogoLayer({
  name,
  width,
  className = '',
  artClassName,
  knockout = '#FFFFFF',
}: {
  name: LayerName;
  width: number;
  className?: string;
  /** Class on the inner SVG, for a second, independent animation (e.g. the towel's sway). */
  artClassName?: string;
  /** Colour behind the logo, for the towel's knockout gap. */
  knockout?: string;
}) {
  const b = LAYER_BOX[name];
  return (
    <div className={`wb-layer ${className}`} style={frame(name, width)} aria-hidden>
      <svg className={artClassName} width="100%" height="100%" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}>
        <Art name={name} knockout={knockout} />
      </svg>
    </div>
  );
}

const ORDER: LayerName[] = ['basket', 'towel', 'clothRed', 'clothOrange', 'sparkleLarge', 'sparkleSmall'];

/** The assembled logo, still. */
export function BrandLogo({ width, knockout, className = '' }: { width: number; knockout?: string; className?: string }) {
  return (
    <div className={`wb-logo ${className}`} style={{ width, height: width * LOGO_ASPECT }} role="img" aria-label="Washing Basket">
      {ORDER.map((n) => (
        <LogoLayer key={n} name={n} width={width} knockout={knockout} />
      ))}
    </div>
  );
}

/** "WashingBasket" with the two capitals set larger, as in the app. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wb-wordmark ${className}`} aria-label="WashingBasket">
      <span className="wb-wordmark__cap">W</span>ashing<span className="wb-wordmark__cap">B</span>asket
    </span>
  );
}
