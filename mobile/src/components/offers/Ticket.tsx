import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { dateParts } from '../../lib/format';
import { fonts } from '../../theme';
import type { Offer } from '../../types/models';

/*
 * The coupon ticket from the Offers page (stub with DISCOUNT, side notches, big value, mono labels, barcode, VIEW /
 * REDEEM), as a shared piece so Home's offer deck shows the very same coupons.
 */

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace' });

export type TicketTheme = { paper: string; stub: string; ink: string };
const THEMES: TicketTheme[] = [
  { paper: '#54B6F8', stub: '#3CA5EE', ink: '#0A1C3E' }, // soft brand blue
  { paper: '#FFA742', stub: '#F5962A', ink: '#0A1C3E' }, // soft brand orange
  { paper: '#FED843', stub: '#ECC72E', ink: '#0A1C3E' }, // soft warm gold
  { paper: '#62D487', stub: '#4DC474', ink: '#0A1C3E' }, // soft fresh green
  { paper: '#F87C87', stub: '#E86672', ink: '#0A1C3E' }, // soft brand red
  { paper: '#DE73F0', stub: '#CE5EE0', ink: '#0A1C3E' }, // soft lilac purple
  { paper: '#FFA07A', stub: '#F08B63', ink: '#0A1C3E' }, // soft coral
];
const SUN: TicketTheme = { paper: '#FED843', stub: '#ECC72E', ink: '#0A1C3E' }; // soft brand warm gold
const THEME_BY_CODE: Record<string, TicketTheme> = { FREEDEL: THEMES[0], CLEAN15: SUN, WINTER10: THEMES[2], MONSOON: THEMES[3], FIRSTWASH: THEMES[5] };

/** The same colour per coupon as on the Offers page. */
export const ticketTheme = (o: Offer, i: number) => THEME_BY_CODE[o.code ?? ''] ?? THEMES[i % THEMES.length];

/** A coupon's height for a given width: the Offers page's proportions. */
export const ticketHeight = (w: number) => Math.round(w * 0.56);

/** The value the eye lands on, and its small label: 15% / OFF, FREE / DELIVERY. */
export function headline(o: Offer) {
  const badge = (o.discountBadge ?? o.discountValue ?? 'DEAL').toUpperCase();
  const pct = badge.match(/(\d+)\s*%/);
  if (pct) return { big: `${pct[1]}%`, small: 'OFF' };
  if (badge.startsWith('FREE')) return { big: 'FREE', small: badge.slice(4).trim() || 'OFFER' };
  const [first, ...rest] = badge.split(' ');
  return { big: first, small: rest.join(' ') || 'OFFER' };
}

const short = (iso: string) => {
  const p = dateParts(iso);
  return `${p.day} ${p.month}`;
};
const validity = (o: Offer) =>
  (o.status === 'expired' ? `Ended ${short(o.validUntil)}` : o.status === 'upcoming' ? `From ${short(o.validFrom)}` : `Till ${short(o.validUntil)}`).toUpperCase();
const codeOf = (o: Offer) => o.code ?? o.id.toUpperCase();

function ticketPath(w: number, h: number, r: number, n: number, y: number) {
  return (
    `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${y - n}A${n} ${n} 0 0 0 ${w} ${y + n}V${h - r}` +
    `A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${y + n}A${n} ${n} 0 0 0 0 ${y - n}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
  );
}

function stubPath(sw: number, h: number, r: number, n: number, y: number) {
  return `M${sw} 0H${r}A${r} ${r} 0 0 0 0 ${r}V${y - n}A${n} ${n} 0 0 1 0 ${y + n}V${h - r}A${r} ${r} 0 0 0 ${r} ${h}H${sw}Z`;
}

function bars(code: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const c = code.charCodeAt(i % code.length) + i * 7;
    return { w: 1 + (c % 3), gap: 1 + ((c >> 2) % 2) };
  });
}

export function Ticket({ offer, theme, no, w, h, onRedeem }: { offer: Offer; theme: TicketTheme; no: number; w: number; h: number; onRedeem?: () => void }) {
  const u = w / 330;
  const stubW = Math.round(56 * u);
  const d = ticketPath(w, h, 16 * u, 11 * u, h / 2);
  const { big, small } = headline(offer);
  const code = codeOf(offer);
  const ink = theme.ink;
  const pad = 14 * u;
  const bigSize = (big.length > 3 ? 50 : 66) * u;

  const isExpired = offer.status === 'expired';
  const faded = offer.status !== 'active';
  const textOpacity = isExpired ? 0.35 : faded ? 0.45 : 1;

  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Path d={d} fill={theme.paper} />
        <Path d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={1.5} />
        <Path d={stubPath(stubW, h, 16 * u, 11 * u, h / 2)} fill={theme.stub} />
        <Line x1={stubW} y1={0} x2={stubW} y2={h} stroke={ink} strokeWidth={1.2} strokeDasharray={`${3 * u} ${3 * u}`} strokeOpacity={textOpacity} />
      </Svg>

      <View style={[styles.stub, { width: stubW, opacity: textOpacity }]}>
        <View style={[styles.stubTurn, { width: h, height: 18 * u, left: (stubW - h) / 2, top: (h - 18 * u) / 2 }]}>
          <Text style={[styles.stubText, { color: ink, fontSize: 13 * u, lineHeight: 18 * u, letterSpacing: 5 * u }]} numberOfLines={1}>
            DISCOUNT
          </Text>
        </View>
      </View>

      <View style={[styles.main, { left: stubW, padding: pad, paddingRight: pad + 6 * u, opacity: textOpacity }]}>
        <View style={styles.mainTop}>
          <View>
            <Text style={[styles.big, { color: ink, fontSize: bigSize, lineHeight: bigSize * 1.02, letterSpacing: -3 * u }]} numberOfLines={1}>
              {big}
            </Text>
            <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 10 * u, letterSpacing: 4 * u, marginTop: -2 * u }]}>{small}</Text>
          </View>
          <View style={[styles.labels, { marginLeft: 12 * u }]}>
            <View style={[styles.ruleRow, { borderColor: ink, paddingBottom: 3 * u }]}>
              <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 9 * u }]}>Nº {String(no).padStart(2, '0')}</Text>
              <Text style={[styles.mono, { color: ink, fontSize: 9 * u }]}>{(offer.badgeLabel ?? 'OFFER').toUpperCase()}</Text>
            </View>
            <Text style={[styles.mono, { color: ink, fontSize: 9.5 * u, lineHeight: 13 * u, marginTop: 5 * u }]} numberOfLines={3}>
              {offer.title.toUpperCase()}
            </Text>
            <View style={[styles.ruleRow, { borderColor: ink, borderTopWidth: 1, borderBottomWidth: 0, paddingTop: 3 * u, marginTop: 'auto' }]}>
              <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 9 * u }]}>{validity(offer)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.mainBottom}>
          <View>
            <View style={[styles.barcode, { height: 22 * u }]}>
              {bars(code, 30).map((b, i) => (
                <View key={i} style={{ width: b.w * u, marginRight: b.gap * u, backgroundColor: ink }} />
              ))}
            </View>
            <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 10 * u, letterSpacing: 3 * u, marginTop: 3 }]}>{code}</Text>
          </View>
          <View style={[styles.links, { gap: 14 * u }]}>
            <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 10.5 * u }]}>VIEW</Text>
            {offer.status === 'active' && onRedeem ? (
              <Pressable
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onRedeem();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Redeem ${offer.title}`}
                style={webCursor}
              >
                <Text style={[styles.mono, styles.monoBold, styles.underline, { color: ink, fontSize: 10.5 * u }]}>REDEEM</Text>
              </Pressable>
            ) : (
              <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 10.5 * u, opacity: 0.55 }]}>{offer.status === 'upcoming' ? 'SOON' : 'ENDED'}</Text>
            )}
          </View>
        </View>
      </View>

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
    </View>
  );
}

function Stamp({ size, color, top, word, date, style }: { size: number; color: string; top: string; word: string; date: string; style: object }) {
  const k = size / 100;
  return (
    <View pointerEvents="none" style={[styles.stamp, { width: size, height: size, borderRadius: size / 2, borderColor: color }, style]}>
      <View style={[styles.stampInner, { borderRadius: size, borderColor: color, margin: 5 * k }]}>
        <Text style={[styles.stampSmall, { color, fontSize: 8 * k, letterSpacing: 2.4 * k }]}>★ {top} ★</Text>
        <Text style={[styles.stampWord, { color, fontSize: (word.length > 4 ? 15 : 20) * k, letterSpacing: 1.5 * k }]} numberOfLines={1}>
          {word}
        </Text>
        <View style={[styles.stampRule, { backgroundColor: color, width: 46 * k }]} />
        <Text style={[styles.stampSmall, { color, fontSize: 8.5 * k, letterSpacing: 1.6 * k }]}>{date.toUpperCase()}</Text>
      </View>
    </View>
  );
}

/** The printed-card drop shadow the Offers page gives its coupons. */
export const ticketShadow =
  Platform.OS === 'web'
    ? ({ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08)) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.12)) drop-shadow(0 16px 24px rgba(0, 0, 0, 0.10))' } as object)
    : { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8 };

const styles = StyleSheet.create({
  stub: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  stubTurn: { position: 'absolute', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-90deg' }] },
  stubText: { fontFamily: MONO, fontWeight: '700', textAlign: 'center' },
  main: { position: 'absolute', top: 0, right: 0, bottom: 0, justifyContent: 'space-between' },
  mainTop: { flexDirection: 'row', flex: 1 },
  big: { fontFamily: fonts.extrabold },
  labels: { flex: 1 },
  ruleRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1 },
  mono: { fontFamily: MONO },
  monoBold: { fontWeight: '700' },
  underline: { textDecorationLine: 'underline' },
  mainBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 },
  barcode: { flexDirection: 'row', alignItems: 'stretch' },
  links: { flexDirection: 'row', alignItems: 'center', paddingBottom: 1 },
  stamp: { position: 'absolute', borderWidth: 2.5, opacity: 0.88, transform: [{ rotate: '-14deg' }] },
  stampInner: { flex: 1, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  stampSmall: { fontFamily: MONO, fontWeight: '700' },
  stampWord: { fontFamily: fonts.extrabold, marginVertical: 1 },
  stampRule: { height: 1, marginVertical: 2, opacity: 0.8 },
});
