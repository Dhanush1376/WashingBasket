import { dateParts } from '@customer/lib/format';
import type { Offer } from '@/types';

/*
 * The customer app's coupon ticket (mobile/src/components/offers/Ticket.tsx) drawn for the web with the
 * same colours, proportions, wording and stamp, so the preview here is what the customer will see.
 */

type TicketTheme = { paper: string; stub: string; ink: string };
const THEMES: TicketTheme[] = [
  { paper: '#013E86', stub: '#002A5C', ink: '#FFFFFF' },
  { paper: '#FE8701', stub: '#E07405', ink: '#FFFFFF' },
  { paper: '#D30D24', stub: '#A80A1C', ink: '#FFFFFF' },
  { paper: '#FEDB7D', stub: '#F7C35D', ink: '#012A5C' },
  { paper: '#0A4E9E', stub: '#063773', ink: '#FFFFFF' },
  { paper: '#FF6F3C', stub: '#E05322', ink: '#FFFFFF' },
  { paper: '#0284C7', stub: '#0369A1', ink: '#FFFFFF' },
  { paper: '#12AD2B', stub: '#0D8220', ink: '#FFFFFF' },
];
const SUN: TicketTheme = { paper: '#FEC837', stub: '#EFB21C', ink: '#2B2620' };
const THEME_BY_CODE: Record<string, TicketTheme> = { FREEDEL: THEMES[0], CLEAN15: SUN, WINTER10: THEMES[2], MONSOON: THEMES[3], FIRSTWASH: THEMES[5] };

export const ticketTheme = (o: Pick<Offer, 'code'>, i: number) => THEME_BY_CODE[o.code ?? ''] ?? THEMES[i % THEMES.length];

export function headline(o: Pick<Offer, 'discountBadge' | 'discountValue'>) {
  const badge = (o.discountBadge || o.discountValue || 'DEAL').toUpperCase();
  const pct = badge.match(/(\d+)\s*%/);
  if (pct) return { big: `${pct[1]}%`, small: 'OFF' };
  if (badge.startsWith('FREE')) return { big: 'FREE', small: badge.slice(4).trim() || 'OFFER' };
  const [first, ...rest] = badge.split(' ');
  return { big: first, small: rest.join(' ') || 'OFFER' };
}

const short = (iso: string) => {
  if (!iso) return '—';
  const p = dateParts(iso);
  return `${p.day} ${p.month}`;
};

const validity = (o: Offer) =>
  (o.status === 'expired' ? `Ended ${short(o.validUntil)}` : o.status === 'upcoming' ? `From ${short(o.validFrom)}` : `Till ${short(o.validUntil)}`).toUpperCase();

function bars(code: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const c = (code || 'X').charCodeAt(i % (code || 'X').length) + i * 7;
    return { w: 1 + (c % 3), gap: 1 + ((c >> 2) % 2) };
  });
}

function ticketPath(w: number, h: number, r: number, n: number, y: number) {
  return (
    `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${y - n}A${n} ${n} 0 0 0 ${w} ${y + n}V${h - r}` +
    `A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${y + n}A${n} ${n} 0 0 0 0 ${y - n}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
  );
}

function stubPath(sw: number, h: number, r: number, n: number, y: number) {
  return `M${sw} 0H${r}A${r} ${r} 0 0 0 0 ${r}V${y - n}A${n} ${n} 0 0 1 0 ${y + n}V${h - r}A${r} ${r} 0 0 0 ${r} ${h}H${sw}Z`;
}

const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

export function OfferTicket({ offer, index, width = 330, faded }: { offer: Offer; index: number; width?: number; faded?: boolean }) {
  const w = width;
  const h = Math.round(w * 0.56);
  const u = w / 330;
  const theme = ticketTheme(offer, index);
  const stubW = Math.round(56 * u);
  const { big, small } = headline(offer);
  const code = (offer.code || offer.id).toUpperCase();
  const ink = theme.ink;
  const pad = 14 * u;
  const bigSize = (big.length > 3 ? 50 : 66) * u;
  const isExpired = offer.status === 'expired';
  const textOpacity = isExpired ? 0.35 : offer.status !== 'active' ? 0.45 : 1;
  const d = ticketPath(w, h, 16 * u, 11 * u, h / 2);

  return (
    <div
      className="ticket"
      style={{ width: w, height: h, opacity: faded ? 0.45 : 1 }}
      role="img"
      aria-label={`${offer.title}: ${big} ${small}, code ${code}, ${validity(offer).toLowerCase()}`}
    >
      <svg width={w} height={h} className="ticket__shape" aria-hidden>
        <path d={d} fill={theme.paper} />
        <path d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={1.5} />
        <path d={stubPath(stubW, h, 16 * u, 11 * u, h / 2)} fill={theme.stub} />
        <line x1={stubW} y1={0} x2={stubW} y2={h} stroke={ink} strokeWidth={1.2} strokeDasharray={`${3 * u} ${3 * u}`} strokeOpacity={textOpacity} />
      </svg>

      <div className="ticket__stub" style={{ width: stubW, opacity: textOpacity }} aria-hidden>
        <span style={{ color: ink, fontFamily: MONO, fontWeight: 700, fontSize: 13 * u, letterSpacing: 5 * u, transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>DISCOUNT</span>
      </div>

      <div className="ticket__main" style={{ left: stubW, padding: pad, paddingRight: pad + 6 * u, opacity: textOpacity, color: ink }} aria-hidden>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: bigSize, lineHeight: `${bigSize * 1.02}px`, letterSpacing: -3 * u, whiteSpace: 'nowrap' }}>{big}</div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10 * u, letterSpacing: 4 * u, marginTop: -2 * u }}>{small}</div>
          </div>
          <div style={{ flex: 1, marginLeft: 12 * u, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${ink}`, paddingBottom: 3 * u, fontFamily: MONO, fontSize: 9 * u, gap: 4 }}>
              <b>Nº {String(index + 1).padStart(2, '0')}</b>
              <span className="ellipsis">{(offer.badgeLabel || 'OFFER').toUpperCase()}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9.5 * u, lineHeight: `${13 * u}px`, marginTop: 5 * u, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {(offer.title || 'Offer title').toUpperCase()}
            </div>
            <div style={{ borderTop: `1px solid ${ink}`, paddingTop: 3 * u, marginTop: 'auto', fontFamily: MONO, fontWeight: 700, fontSize: 9 * u }}>{validity(offer)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 }}>
          <div>
            <div style={{ display: 'flex', height: 22 * u }}>
              {bars(code, 30).map((b, i) => (
                <span key={i} style={{ width: b.w * u, marginRight: b.gap * u, background: ink }} />
              ))}
            </div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10 * u, letterSpacing: 3 * u, marginTop: 3 }}>{code}</div>
          </div>
          <div style={{ display: 'flex', gap: 14 * u, fontFamily: MONO, fontWeight: 700, fontSize: 10.5 * u }}>
            <span>VIEW</span>
            {offer.status === 'active' ? <span style={{ textDecoration: 'underline' }}>REDEEM</span> : <span style={{ opacity: 0.55 }}>{offer.status === 'upcoming' ? 'SOON' : 'ENDED'}</span>}
          </div>
        </div>
      </div>

      {offer.status !== 'active' ? (
        <Stamp
          size={Math.round(h * 0.62)}
          color={isExpired ? '#B3261E' : ink}
          top={isExpired ? 'OFFER' : 'COMING'}
          word={isExpired ? 'EXPIRED' : 'SOON'}
          date={isExpired ? short(offer.validUntil) : short(offer.validFrom)}
          style={{ top: h * 0.16, right: w * 0.05 }}
        />
      ) : null}
    </div>
  );
}

function Stamp({ size, color, top, word, date, style }: { size: number; color: string; top: string; word: string; date: string; style: React.CSSProperties }) {
  const k = size / 100;
  return (
    <div className="ticket__stamp" style={{ width: size, height: size, borderColor: color, ...style }} aria-hidden>
      <div className="ticket__stamp-inner" style={{ borderColor: color, margin: 5 * k, color }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 8 * k, letterSpacing: 2.4 * k }}>★ {top} ★</span>
        <span style={{ fontWeight: 800, fontSize: (word.length > 4 ? 15 : 20) * k, letterSpacing: 1.5 * k, margin: '1px 0' }}>{word}</span>
        <span style={{ height: 1, width: 46 * k, background: color, margin: '2px 0', opacity: 0.8 }} />
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 8.5 * k, letterSpacing: 1.6 * k }}>{date.toUpperCase()}</span>
      </div>
    </div>
  );
}
