import React from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Icon } from '../../components/app/Icon';
import { QrCode } from '../../components/laundry/QrCode';
import { WashingBasketLogo } from '../../components/logo/WashingBasketLogo';
import { fonts } from '../../theme';

const NAVY = '#1B2A5E';
const INK = '#14234F';
const MUTED = '#6B7280';
const PEACH = '#F9E7D6';

export type IdCardData = {
  name: string;
  designation: string;
  employeeId: string;
  joined: string; // e.g. "Sep 2026"
  location: string;
};

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * My staff ID card, sitting in a clear card holder with its clip. Drawn to the 2:3 badge layout — logo, photo,
 * name and role, staff ID, joined and branch, and a QR that carries only the employee ID.
 */
export function IdCard({ data }: { data: IdCardData }) {
  const { width } = useWindowDimensions();
  const W = Math.min(300, width - 96); // card width
  const H = Math.round(W * 1.5);
  const k = W / 446; // the layout is drawn on a 446 × 669 card
  const s = (v: number) => Math.round(v * k);

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Staff ID card. ${data.name}, ${data.designation}. Staff ID ${data.employeeId}. Joined ${data.joined}. ${data.location}.`}>
      {/* the clip and the strap stub */}
      <View style={styles.clipArea}>
        <View style={styles.strap} />
        <View style={styles.clip}>
          <View style={styles.clipShine} />
        </View>
      </View>

      {/* the clear holder */}
      <View style={styles.holder}>
        <View style={styles.holderSlot} />
        <View style={[styles.card, { width: W, height: H, borderRadius: s(34) }]}>
          <Svg width={W} height={H} viewBox="0 0 446 669" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="idBg" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FDF8F3" />
                <Stop offset="1" stopColor="#F8EEE5" />
              </LinearGradient>
              <LinearGradient id="idOrange" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFB547" />
                <Stop offset="1" stopColor="#FF9326" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="446" height="669" fill="url(#idBg)" />
            {/* orange corner */}
            <Path d="M300 0 H446 V190 C436 130 410 92 372 64 C340 40 316 24 300 0 Z" fill="url(#idOrange)" />
            {/* soft cream wave behind the middle */}
            <Path d="M0 250 C70 228 140 262 196 300 C150 340 70 344 0 330 Z" fill="#F3E3D3" opacity={0.55} />
            <Path d="M446 420 C380 410 330 440 300 470 C360 480 410 470 446 460 Z" fill="#F3E3D3" opacity={0.45} />
            {/* navy base */}
            <Path d="M0 600 C70 572 130 604 210 598 C300 590 360 548 446 530 V669 H0 Z" fill={NAVY} />
          </Svg>

          <View style={[styles.body, { paddingTop: s(36) }]}>
            {/* logo lockup */}
            <View style={[styles.logoRow, { gap: s(12) }]}>
              <WashingBasketLogo width={s(54)} shine={false} />
              <Text style={[styles.wordmark, { fontSize: s(27), lineHeight: s(34) }]} numberOfLines={1}>
                <Text style={[styles.wordmarkCap, { fontSize: s(31) }]}>W</Text>ashing<Text style={[styles.wordmarkCap, { fontSize: s(31) }]}>B</Text>asket
              </Text>
            </View>

            {/* round profile photo with the role badge */}
            <View style={{ marginTop: s(22) }}>
              <View style={[styles.photo, { width: s(174), height: s(174), borderRadius: s(87), borderWidth: Math.max(3, s(5)) }]}>
                <Text style={[styles.photoText, { fontSize: s(64) }]}>{initials(data.name)}</Text>
              </View>
              <View style={[styles.badge, { width: s(52), height: s(52), borderRadius: s(26), right: -s(2), bottom: -s(2), borderWidth: Math.max(2, s(4)) }]}>
                <Icon name="shirt" size={s(24)} color="#FFFFFF" />
              </View>
            </View>

            <Text style={[styles.name, { fontSize: s(38), lineHeight: s(46), marginTop: s(12) }]} numberOfLines={1} adjustsFontSizeToFit>
              {data.name}
            </Text>
            <Text style={[styles.role, { fontSize: s(20), lineHeight: s(26) }]} numberOfLines={1}>
              {data.designation}
            </Text>

            {/* staff ID pill */}
            <View style={[styles.pill, { marginTop: s(14), height: s(42), paddingHorizontal: s(22), gap: s(10) }]}>
              <Icon name="user" size={s(20)} color={MUTED} />
              <Text style={[styles.pillLabel, { fontSize: s(18) }]}>Staff ID</Text>
              <Text style={[styles.pillValue, { fontSize: s(22) }]}>{data.employeeId}</Text>
            </View>

            {/* joined | location */}
            <View style={[styles.rule, { marginTop: s(14), marginHorizontal: s(36) }]} />
            <View style={[styles.infoRow, { marginTop: s(10), paddingHorizontal: s(40) }]}>
              <Info icon="calendar" label="Joined" value={data.joined} s={s} />
              <View style={[styles.infoRule, { height: s(46), marginHorizontal: s(18) }]} />
              <Info icon="mapPin" label="Location" value={data.location} s={s} />
            </View>
          </View>

          {/* QR — the employee ID only */}
          <View style={[styles.qr, { bottom: s(20), padding: s(10), borderRadius: s(18) }]}>
            <QrCode value={`WB-STAFF:${data.employeeId}`} size={s(84)} color={INK} />
          </View>
        </View>
      </View>
    </View>
  );
}

function Info({ icon, label, value, s }: { icon: 'calendar' | 'mapPin'; label: string; value: string; s: (v: number) => number }) {
  return (
    <View style={[styles.info, { gap: s(12) }]}>
      <Icon name={icon} size={s(28)} color={INK} />
      <View style={styles.flex}>
        <Text style={[styles.infoLabel, { fontSize: s(17) }]}>{label}</Text>
        <Text style={[styles.infoValue, { fontSize: s(21) }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const shadow = (web: string, native: object) => (Platform.OS === 'web' ? ({ boxShadow: web } as object) : native);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'center' },
  clipArea: { alignItems: 'center', zIndex: 2, marginBottom: -14 },
  strap: { width: 30, height: 16, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: NAVY },
  clip: {
    width: 74,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#E3E6EB',
    borderWidth: 1,
    borderColor: '#BFC4CC',
    marginTop: -3,
    overflow: 'hidden',
    ...shadow('0 2px 4px rgba(20,35,79,0.18)', { shadowColor: '#14234F', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3 }),
  },
  clipShine: { position: 'absolute', left: 6, right: 6, top: 4, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.85)' },

  holder: {
    padding: 9,
    paddingTop: 24,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(20,35,79,0.10)',
    alignItems: 'center',
    ...shadow('0 1px 2px rgba(20,35,79,0.06), 0 18px 40px rgba(60,40,10,0.14)', { shadowColor: '#3C280A', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.14, shadowRadius: 24, elevation: 8 }),
  },
  holderSlot: { position: 'absolute', top: 8, width: 60, height: 8, borderRadius: 4, backgroundColor: 'rgba(20,35,79,0.08)' },

  card: { overflow: 'hidden', backgroundColor: '#FDF8F3' },
  body: { alignItems: 'center', flex: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  logoRule: { width: 1.5, backgroundColor: 'rgba(20,35,79,0.18)' },
  wordmark: { fontFamily: fonts.displayBold, color: '#0A1C3E', letterSpacing: -0.4, includeFontPadding: false },
  wordmarkCap: { fontFamily: fonts.display, color: '#0A1C3E' },

  photo: {
    backgroundColor: '#FFE3C7',
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow('0 4px 16px rgba(20,35,79,0.12)', { shadowColor: '#14234F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 }),
  },
  photoText: { fontFamily: fonts.bold, color: INK, letterSpacing: -1 },
  apron: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: NAVY, borderTopWidth: 4, borderColor: '#FF9A2E' },
  badge: { position: 'absolute', backgroundColor: NAVY, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

  name: { fontFamily: fonts.bold, color: INK, letterSpacing: -0.6, paddingHorizontal: 12 },
  role: { fontFamily: fonts.medium, color: MUTED },
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: PEACH },
  pillLabel: { fontFamily: fonts.medium, color: MUTED },
  pillValue: { fontFamily: fonts.bold, color: INK, letterSpacing: 0.3, fontVariant: ['tabular-nums'] },

  rule: { alignSelf: 'stretch', height: 1, backgroundColor: 'rgba(20,35,79,0.10)' },
  infoRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  infoRule: { width: 1, backgroundColor: 'rgba(20,35,79,0.14)' },
  infoLabel: { fontFamily: fonts.medium, color: MUTED },
  infoValue: { fontFamily: fonts.bold, color: INK },
  flex: { flex: 1, minWidth: 0 },

  qr: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    ...shadow('0 6px 16px rgba(20,35,79,0.18)', { shadowColor: '#14234F', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 6 }),
  },
});
