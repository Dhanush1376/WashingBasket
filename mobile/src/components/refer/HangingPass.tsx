import React, { useEffect, useMemo, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { haptic } from '../../lib/haptics';
import { fonts } from '../../theme';
import { Icon } from '../app/Icon';

const NAVY = '#0A1C3E';
const STOCK = '#FFFFFF'; // bright white card stock
const STUB = NAVY; // the tear-off stub: the app's dark navy, as on the Home card
const INK70 = 'rgba(10,28,62,0.72)';
const INK50 = 'rgba(10,28,62,0.55)';
const METAL = '#C3CAD6';
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace' });
const isWeb = Platform.OS === 'web';
const web = (o: object) => (isWeb ? (o as object) : null);

const TICKET_W = 268;
const ROD_Y = 24; // the hanger rail, measured from the top of the header
const STRAP_H = 104; // the lanyard, from the rail to the bottom of the clasp
const SWING = { damping: 3.2, stiffness: 46, mass: 1 }; // light damping: it rocks a few times before it settles
const MAX_DEG = 26;

/** A barcode for the code: bar widths come from the characters, so the same code always prints the same bars. */
function bars(code: string) {
  const out: { x: number; w: number }[] = [];
  let x = 0;
  const src = `*${code}*`;
  for (let i = 0; i < src.length; i++) {
    let c = src.charCodeAt(i) * 7 + i * 13;
    for (let k = 0; k < 4; k++) {
      const w = 1 + (c % 3);
      out.push({ x, w });
      x += w + 1 + ((c >> 2) % 2);
      c = Math.floor(c / 3) + 5;
    }
  }
  return { list: out, width: x };
}

/** The security print behind the amount: a rosette of thin ellipses, like the guilloché on a real ticket. */
function Guilloche({ w, h }: { w: number; h: number }) {
  const n = 22;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <G x={w / 2} y={h * 0.44}>
        {Array.from({ length: n }, (_, i) => (
          <Ellipse key={i} rx={104} ry={38} fill="none" stroke={NAVY} strokeOpacity={0.07} strokeWidth={0.8} transform={`rotate(${(180 / n) * i})`} />
        ))}
        {Array.from({ length: n }, (_, i) => (
          <Ellipse key={`s${i}`} rx={56} ry={20} fill="none" stroke={NAVY} strokeOpacity={0.06} strokeWidth={0.6} transform={`rotate(${(180 / n) * i + 4})`} />
        ))}
      </G>
    </Svg>
  );
}

/**
 * Your invite pass, hanging from a lanyard. Printed card stock with a security pattern, a metal eyelet and swivel
 * clip, a holographic seal, real perforations and a barcode stub. It swings in when the page opens and sways a
 * little while idle; grab it and swing it, or tap it for a nudge. Tap the stub to copy your code.
 */
export function HangingPass({
  id,
  width,
  canvas,
  reward,
  friendReward,
  code,
  serial,
  copied,
  onCopy,
}: {
  id: string;
  width: number;
  /** The colour behind the pass: the eyelet and the perforations show it. */
  canvas: string;
  reward: string;
  friendReward: string;
  code: string;
  serial: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const reduced = useReducedMotion();
  const angle = useSharedValue(reduced ? 0 : -18);
  const sway = useSharedValue(0);
  const start = useSharedValue(0);
  const reach = STRAP_H + 180; // pivot to the middle of the pass, for turning a sideways drag into an angle

  useEffect(() => {
    if (reduced) return;
    angle.set(withSpring(0, SWING));
    const ease = Easing.inOut(Easing.sin);
    sway.set(withRepeat(withSequence(withTiming(1, { duration: 2600, easing: ease }), withTiming(-1, { duration: 2600, easing: ease })), -1, true));
  }, [angle, sway, reduced]);

  const toAngle = (dx: number) => (Math.atan2(dx, reach) * 180) / Math.PI;
  const clamp = (d: number) => Math.max(-MAX_DEG, Math.min(MAX_DEG, d));
  const release = (vx: number) => angle.set(withSpring(0, { ...SWING, velocity: -vx * 180 }));
  const nudge = () => {
    const dir = angle.get() > 0 ? -1 : 1;
    angle.set(withSequence(withTiming(dir * 8, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(0, SWING)));
  };

  // tap the card to turn it over (it rocks a little on its ring as it turns), tap again to turn it back
  const [flipped, setFlipped] = useState(false);
  const flip = useSharedValue(0);
  const turn = () => {
    haptic.tap();
    const next = !flipped;
    setFlipped(next);
    flip.set(reduced ? (next ? 180 : 0) : withSpring(next ? 180 : 0, { damping: 15, stiffness: 110, mass: 1 }));
    if (!reduced) nudge();
  };
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 1100 }, { rotateY: `${flip.get()}deg` }] }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 1100 }, { rotateY: `${flip.get() + 180}deg` }] }));

  // touch: drag sideways to swing
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => start.set(angle.get()),
        onPanResponderMove: (_, g) => angle.set(clamp(start.get() - toAngle(g.dx))),
        onPanResponderRelease: (_, g) => release(g.vx),
        onPanResponderTerminate: () => release(0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [angle],
  );

  // mouse and pen on web, where the responder system doesn't see drags
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    const node = document.getElementById(id);
    if (!node) return;
    let x0 = 0;
    let lastX = 0;
    let lastT = 0;
    let vx = 0;
    let active = false;
    let dragging = false;
    const move = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - x0;
      if (!dragging && Math.abs(dx) > 5) {
        dragging = true;
        start.set(angle.get());
        document.body.style.cursor = 'grabbing';
      }
      if (!dragging) return;
      const now = performance.now();
      vx = 0.7 * ((e.clientX - lastX) / Math.max(1, now - lastT)) + 0.3 * vx;
      lastX = e.clientX;
      lastT = now;
      angle.set(clamp(start.get() - toAngle(dx)));
      e.preventDefault();
    };
    const up = () => {
      if (!active) return;
      active = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      if (!dragging) return;
      release(vx);
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      active = true;
      dragging = false;
      x0 = lastX = e.clientX;
      lastT = performance.now();
      vx = 0;
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
    };
    node.addEventListener('pointerdown', down);
    return () => {
      node.removeEventListener('pointerdown', down);
      up();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const hang = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get() + sway.get() * 1.2}deg` }] }));
  // light slides across the stock and the seal shimmers as the pass turns
  const sheen = useAnimatedStyle(() => ({ opacity: 0.04 + Math.min(0.1, Math.abs(angle.get()) / 180), transform: [{ translateX: angle.get() * 4 }, { rotate: '22deg' }] }));
  const holo = useAnimatedStyle(() => ({ transform: [{ rotate: `${(angle.get() + sway.get() * 2) * 9}deg` }] }));

  const bc = useMemo(() => bars(code), [code]);
  const bcScale = Math.min(1, 150 / Math.max(bc.width, 1));
  const holes = Math.floor((TICKET_W - 44) / 11);
  const W = width;
  const cx = W / 2;

  return (
    <View style={[styles.root, { width: W, paddingTop: ROD_Y }]}>
      {/* ── the hanger: one straight steel bar running edge to edge ── */}
      {/* wider than the page on both sides; the header clips it, so it reads as one bar across the screen */}
      <Svg width={W + 1200} height={ROD_Y + 12} style={[styles.rail, { left: -600 }]} pointerEvents="none">
        <Defs>
          <LinearGradient id="rod" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.3" stopColor="#D9DEE6" />
            <Stop offset="0.75" stopColor="#9AA3B2" />
            <Stop offset="1" stopColor="#6F7A8B" />
          </LinearGradient>
        </Defs>
        {/* soft shadow the bar throws on the wall */}
        <Rect x={0} y={ROD_Y + 5} width={W + 1200} height={4} fill={NAVY} opacity={0.08} />
        <Rect x={0} y={ROD_Y - 4} width={W + 1200} height={8} fill="url(#rod)" />
      </Svg>

      <Animated.View nativeID={id} style={[{ width: W, alignItems: 'center', transformOrigin: 'top' }, hang]} {...pan.panHandlers}>
        {/* ── the ticket: two faces, turned on tap ── */}
        <View style={{ width: TICKET_W, marginTop: STRAP_H + 2 }}>
        <Animated.View style={[styles.ticket, shadow, styles.faceSide, front]} pointerEvents={flipped ? 'none' : 'auto'}>
          <Pressable onPress={turn} accessibilityRole="button" accessibilityLabel="Your invite pass. Tap to turn it over" style={[styles.face, web({ cursor: 'grab' })]}>
            <Guilloche w={TICKET_W} h={232} />
            <Animated.View style={[styles.sheen, sheen]} pointerEvents="none" />
            <View style={styles.frame} pointerEvents="none" />

            {/* eyelet */}
            <View style={styles.eyeletRow}>
              <Text style={styles.brand}>WASHING BASKET</Text>
              <View style={styles.eyelet}>
                <View style={[styles.eyeletHole, { backgroundColor: canvas }]} />
              </View>
              <Text style={styles.serial}>Nº {serial}</Text>
            </View>

            <View style={styles.center}>
              <Text style={styles.kicker}>INVITE PASS</Text>
              <Text style={styles.amount}>{reward}</Text>
              <Text style={styles.per}>for every friend</Text>
            </View>

            <View style={styles.footRow}>
              <View>
                <Text style={styles.footLabel}>FRIEND GETS</Text>
                <Text style={styles.footValue}>{friendReward} off</Text>
              </View>
              {/* holographic seal */}
              <View style={styles.seal}>
                <Animated.View style={[styles.holo, holo]} />
                <View style={styles.sealCore}>
                  <Icon name="star" size={13} color={NAVY} strokeWidth={2.4} />
                </View>
              </View>
            </View>
          </Pressable>

          {/* perforation: side notches and a row of punched holes */}
          <View style={styles.perf}>
            {/* the orange face meets the navy stub right on the tear line */}
            <View style={styles.perfLower} pointerEvents="none" />
            <View style={[styles.notch, { left: -12, backgroundColor: canvas }]} />
            <View style={styles.holes}>
              {Array.from({ length: holes }, (_, i) => (
                <View key={i} style={[styles.hole, { backgroundColor: canvas }]} />
              ))}
            </View>
            <View style={[styles.notch, { right: -12, backgroundColor: canvas }]} />
          </View>

          {/* stub */}
          <Pressable
            onPress={onCopy}
            accessibilityRole="button"
            accessibilityLabel={copied ? 'Code copied' : `Copy code ${code}`}
            style={({ pressed }) => [styles.stub, web({ cursor: 'pointer' }), pressed && { transform: [{ scale: 0.985 }] }]}
          >
            <View style={styles.label}>
              <Svg width={150} height={34}>
                {bc.list.map((b, i) => (
                  <Rect key={i} x={b.x * bcScale} y={0} width={Math.max(0.8, b.w * bcScale)} height={34} fill={NAVY} />
                ))}
              </Svg>
              <Text style={styles.code} numberOfLines={1}>
                {code}
              </Text>
            </View>
            <View style={styles.copyCol}>
              <View style={[styles.copy, copied && styles.copyDone]}>
                <Icon name={copied ? 'check' : 'copy'} size={15} color={copied ? '#FFFFFF' : NAVY} strokeWidth={2.4} />
              </View>
              <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* the back: how it works, in three lines */}
        <Animated.View style={[styles.ticket, styles.backSide, shadow, styles.faceSide, back]} pointerEvents={flipped ? 'auto' : 'none'}>
          <Pressable onPress={turn} accessibilityRole="button" accessibilityLabel="How it works. Tap to turn back" style={[styles.backFill, web({ cursor: 'grab' })]}>
            <View style={[styles.frame, styles.backFrame]} pointerEvents="none" />
            <View style={styles.eyeletRow}>
              <Text style={[styles.brand, styles.backMuted]}>WASHING BASKET</Text>
              <View style={styles.eyelet}>
                <View style={[styles.eyeletHole, { backgroundColor: canvas }]} />
              </View>
              <Text style={[styles.serial, styles.backMuted]}>Nº {serial}</Text>
            </View>
            <Text style={styles.backKicker}>HOW IT WORKS</Text>
            <View style={styles.backSteps}>
              {[
                ['share', 'Share your code'],
                ['truck', 'Friend books a pickup'],
                ['wallet', `You get ${reward}`],
              ].map(([icon, label], i) => (
                <View key={label} style={styles.backStep}>
                  <View style={[styles.backDot, i === 2 && { backgroundColor: STOCK }]}>
                    <Icon name={icon as 'share'} size={14} color={i === 2 ? NAVY : '#FFFFFF'} strokeWidth={2.3} />
                  </View>
                  <Text style={styles.backStepText}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.backFoot}>
              <Text style={styles.backFine}>First order only · No expiry · No limit</Text>
              <View style={styles.backTurn}>
                <Icon name="refresh" size={11} color="rgba(255,255,255,0.6)" strokeWidth={2.4} />
                <Text style={styles.backFine}>Tap to turn</Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
        </View>

        {/* ── the lanyard and its hardware, drawn over the top of the ticket ── */}
        <Svg width={W} height={STRAP_H + 44} style={styles.hardware} pointerEvents="none">
          <Defs>
            <LinearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#7A8494" />
              <Stop offset="0.28" stopColor="#E9EDF2" />
              <Stop offset="0.42" stopColor="#FFFFFF" />
              <Stop offset="0.62" stopColor="#B4BCC9" />
              <Stop offset="1" stopColor="#6C7686" />
            </LinearGradient>
            <LinearGradient id="metalV" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F5F7FA" />
              <Stop offset="0.5" stopColor="#B9C1CD" />
              <Stop offset="1" stopColor="#7E8898" />
            </LinearGradient>
            <LinearGradient id="strap" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#012556" />
              <Stop offset="0.45" stopColor="#0A4C9E" />
              <Stop offset="1" stopColor="#012556" />
            </LinearGradient>
          </Defs>

          {/* the strap: over the rail in a loop, twisted once on the way down so the two strands cross */}
          <Path d={`M${cx + 6} 0 C${cx + 6} 34 ${cx - 9} 52 ${cx - 5} ${STRAP_H - 40}`} stroke="#011F49" strokeWidth={15} fill="none" />
          <Path d={`M${cx + 6} 0 C${cx + 6} 34 ${cx - 9} 52 ${cx - 5} ${STRAP_H - 40}`} stroke="#000000" strokeOpacity={0.22} strokeWidth={15} strokeDasharray="1 2.2" fill="none" />
          <Path d={`M${cx - 6} 0 C${cx - 6} 34 ${cx + 9} 52 ${cx + 5} ${STRAP_H - 40}`} stroke="url(#strap)" strokeWidth={15} fill="none" />
          <Path d={`M${cx - 6} 0 C${cx - 6} 34 ${cx + 9} 52 ${cx + 5} ${STRAP_H - 40}`} stroke="#000000" strokeOpacity={0.12} strokeWidth={15} strokeDasharray="0.8 1.8" fill="none" />
          <Path d={`M${cx - 11} 0 C${cx - 11} 34 ${cx + 4} 52 ${cx} ${STRAP_H - 40}`} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.8} strokeDasharray="3 2.4" fill="none" />
          <Path d={`M${cx - 1} 0 C${cx - 1} 34 ${cx + 14} 52 ${cx + 10} ${STRAP_H - 40}`} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.8} strokeDasharray="3 2.4" fill="none" />

          {/* crimp sleeve that holds both strap ends */}
          <Rect x={cx - 13} y={STRAP_H - 44} width={26} height={14} rx={3} fill="url(#metal)" stroke="#5F6979" strokeWidth={0.7} />
          <Path d={`M${cx - 11} ${STRAP_H - 40} H${cx + 11} M${cx - 11} ${STRAP_H - 37} H${cx + 11} M${cx - 11} ${STRAP_H - 34} H${cx + 11}`} stroke="#6C7686" strokeOpacity={0.45} strokeWidth={0.6} />
          {/* swivel */}
          <Rect x={cx - 4} y={STRAP_H - 30} width={8} height={6} rx={1.5} fill="url(#metal)" />
          <Ellipse cx={cx} cy={STRAP_H - 23} rx={5.5} ry={2.2} fill="url(#metalV)" stroke="#5F6979" strokeWidth={0.5} />
          <Rect x={cx - 2} y={STRAP_H - 22} width={4} height={5} fill="url(#metal)" />

          {/* lobster clasp: a teardrop body with its spring gate on the right */}
          <Path
            d={`M${cx} ${STRAP_H - 18} C${cx + 11} ${STRAP_H - 15} ${cx + 12} ${STRAP_H + 2} ${cx + 3} ${STRAP_H + 10} L${cx - 3} ${STRAP_H + 10} C${cx - 12} ${STRAP_H + 2} ${cx - 11} ${STRAP_H - 15} ${cx} ${STRAP_H - 18} Z M${cx} ${STRAP_H - 12} C${cx + 6} ${STRAP_H - 10} ${cx + 6} ${STRAP_H + 1} ${cx + 1.5} ${STRAP_H + 5} L${cx - 1.5} ${STRAP_H + 5} C${cx - 6} ${STRAP_H + 1} ${cx - 6} ${STRAP_H - 10} ${cx} ${STRAP_H - 12} Z`}
            fill="url(#metal)"
            fillRule="evenodd"
            stroke="#59636F"
            strokeWidth={0.6}
          />
          <Path d={`M${cx + 7.5} ${STRAP_H - 9} L${cx + 10} ${STRAP_H - 13}`} stroke="url(#metalV)" strokeWidth={2.6} strokeLinecap="round" />
          <Path d={`M${cx - 6.5} ${STRAP_H - 10} C${cx - 7.5} ${STRAP_H - 4} ${cx - 6} ${STRAP_H + 2} ${cx - 3} ${STRAP_H + 6}`} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={0.9} fill="none" />

          {/* split ring through the clasp and the card's eyelet: two coils, slightly offset */}
          <Ellipse cx={cx} cy={STRAP_H + 20} rx={9} ry={9.5} fill="none" stroke="#6C7686" strokeWidth={3.2} />
          <Ellipse cx={cx} cy={STRAP_H + 20} rx={9} ry={9.5} fill="none" stroke="url(#metal)" strokeWidth={2.4} />
          <Ellipse cx={cx + 0.8} cy={STRAP_H + 20.6} rx={9} ry={9.5} fill="none" stroke="url(#metal)" strokeWidth={1.6} strokeOpacity={0.9} />
          <Path d={`M${cx - 7} ${STRAP_H + 14} A9 9.5 0 0 1 ${cx + 2} ${STRAP_H + 10.6}`} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={0.9} fill="none" />
          {/* the hardware's soft shadow on the card */}
          <Ellipse cx={cx + 2} cy={STRAP_H + 33} rx={11} ry={2.6} fill={NAVY} opacity={0.16} />
        </Svg>
      </Animated.View>

      {/* the strap's fold over the top of the rod, in front of it */}
      <Svg width={W} height={ROD_Y + 14} style={styles.rail} pointerEvents="none">
        <Defs>
          <LinearGradient id="fold" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#012556" />
            <Stop offset="0.45" stopColor="#0A4C9E" />
            <Stop offset="1" stopColor="#012556" />
          </LinearGradient>
        </Defs>
        {/* where the strap presses on the rod */}
        <Rect x={W / 2 - 12} y={ROD_Y - 4} width={24} height={8} rx={2} fill={NAVY} opacity={0.18} />
        <Path
          d={`M${W / 2 - 9} ${ROD_Y + 9} V${ROD_Y - 3} Q${W / 2 - 9} ${ROD_Y - 10} ${W / 2} ${ROD_Y - 10} Q${W / 2 + 9} ${ROD_Y - 10} ${W / 2 + 9} ${ROD_Y - 3} V${ROD_Y + 9} Z`}
          fill="url(#fold)"
        />
        <Path d={`M${W / 2 - 9} ${ROD_Y + 9} V${ROD_Y - 3} Q${W / 2 - 9} ${ROD_Y - 10} ${W / 2} ${ROD_Y - 10} Q${W / 2 + 9} ${ROD_Y - 10} ${W / 2 + 9} ${ROD_Y - 3} V${ROD_Y + 9}`} fill="none" stroke="#000000" strokeOpacity={0.14} strokeWidth={9} strokeDasharray="0.8 1.8" />
        <Path d={`M${W / 2 - 6} ${ROD_Y + 9} V${ROD_Y - 2} Q${W / 2 - 6} ${ROD_Y - 7} ${W / 2} ${ROD_Y - 7} Q${W / 2 + 6} ${ROD_Y - 7} ${W / 2 + 6} ${ROD_Y - 2} V${ROD_Y + 9}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.8} strokeDasharray="3 2.4" />
        <Path d={`M${W / 2 - 8} ${ROD_Y - 4} Q${W / 2} ${ROD_Y - 11} ${W / 2 + 4} ${ROD_Y - 9}`} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={1.2} fill="none" />
        {/* the curve of the rod shows through as a soft band across the strap */}
        <Rect x={W / 2 - 9} y={ROD_Y + 1} width={18} height={3} fill="#000000" opacity={0.14} />
      </Svg>
    </View>
  );
}

const shadow = isWeb
  ? ({ boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset, 0 28px 44px -18px rgba(10, 28, 62, 0.45), 0 10px 18px -8px rgba(10, 28, 62, 0.22), 0 2px 4px rgba(10, 28, 62, 0.12)' } as object)
  : { shadowColor: NAVY, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.3, shadowRadius: 22, elevation: 12 };

const styles = StyleSheet.create({
  root: { alignSelf: 'center', alignItems: 'center' },
  hardware: { position: 'absolute', top: 0, left: 0, zIndex: 5 },
  rail: { position: 'absolute', top: 0, left: 0 },
  faceSide: { backfaceVisibility: 'hidden' },
  backSide: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: NAVY, ...(isWeb ? ({ backgroundImage: 'radial-gradient(120% 60% at 80% 0%, rgba(255,255,255,0.08), rgba(255,255,255,0) 60%), linear-gradient(170deg, #13284F 0%, #0A1C3E 60%, #081734 100%)' } as object) : null) },
  backFill: { flex: 1 },
  backFrame: { borderColor: 'rgba(255,255,255,0.10)', bottom: 8, borderBottomWidth: 1, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  backMuted: { color: 'rgba(255,255,255,0.5)' },
  backKicker: { alignSelf: 'center', marginTop: 26, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 3.2, color: '#FFFFFF' },
  backSteps: { marginTop: 18, paddingHorizontal: 26, gap: 14 },
  backStep: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  backStepText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: '#FFFFFF' },
  backFoot: { position: 'absolute', left: 22, right: 22, bottom: 22, alignItems: 'center', gap: 8 },
  backFine: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  backTurn: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  ticket: {
    width: TICKET_W,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.08)',
    overflow: 'hidden',
    ...(isWeb
      ? ({
          backgroundImage: [
            'radial-gradient(120% 60% at 20% 0%, rgba(255,255,255,0.95), rgba(255,255,255,0) 60%)',
            'repeating-linear-gradient(45deg, rgba(10,28,62,0.012) 0 1px, rgba(0,0,0,0) 1px 3px)',
            'linear-gradient(170deg, #FFFFFF 0%, #FAFBFD 50%, #F2F5F9 100%)',
          ].join(', '),
        } as object)
      : null),
  },
  face: { height: 232 },
  sheen: { position: 'absolute', top: -80, left: 60, width: 70, height: 420, backgroundColor: '#FFFFFF' },
  frame: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 2, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(10,28,62,0.12)', borderBottomWidth: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },

  eyeletRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16 },
  brand: { width: 90, fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 1.6, color: INK70 },
  serial: { width: 90, textAlign: 'right', fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.6, color: INK50 },
  eyelet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: METAL,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb
      ? ({ backgroundImage: 'linear-gradient(135deg, #F2F4F8 0%, #A9B2C1 55%, #7E8898 100%)', boxShadow: '0 1px 2px rgba(0,0,0,0.35)' } as object)
      : null),
  },
  eyeletHole: { width: 11, height: 11, borderRadius: 6, ...(isWeb ? ({ boxShadow: 'inset 0 1px 2px rgba(10,28,62,0.45)' } as object) : null) },

  center: { alignItems: 'center', marginTop: 22 },
  kicker: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 3.2, color: NAVY, backgroundColor: '#EEF3FB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  amount: {
    fontFamily: fonts.extrabold,
    fontSize: 54,
    lineHeight: 60,
    letterSpacing: -2,
    color: NAVY,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  per: { fontFamily: fonts.medium, fontSize: 12, color: INK70 },

  footRow: { position: 'absolute', left: 20, right: 18, bottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  footLabel: { fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 1.4, color: INK50 },
  footValue: { fontFamily: fonts.bold, fontSize: 14, color: NAVY, marginTop: 2 },
  seal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9E0EC',
    ...(isWeb ? ({ boxShadow: '0 1px 3px rgba(0,0,0,0.3)' } as object) : null),
  },
  holo: {
    position: 'absolute',
    width: 56,
    height: 56,
    ...(isWeb
      ? ({ backgroundImage: 'conic-gradient(from 0deg, #FCE38A, #B6F0FF, #E4C8FF, #FFC9DE, #C8FFE0, #FFF3B0, #B9D7FF, #FCE38A)' } as object)
      : { backgroundColor: '#DCE3F0' }),
  },
  sealCore: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.78)', alignItems: 'center', justifyContent: 'center' },

  perf: { height: 22, justifyContent: 'center' },
  notch: { position: 'absolute', top: -1, width: 24, height: 24, borderRadius: 12, ...(isWeb ? ({ boxShadow: 'inset 0 1px 2px rgba(10,28,62,0.3)' } as object) : null) },
  perfLower: { position: 'absolute', left: 0, right: 0, top: 11, bottom: 0, backgroundColor: STUB },
  holes: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22 },
  hole: { width: 5, height: 5, borderRadius: 3, ...(isWeb ? ({ boxShadow: 'inset 0 1px 1px rgba(10,28,62,0.35)' } as object) : null) },

  stub: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, backgroundColor: STUB },
  label: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 8,
    backgroundColor: '#FBF9F4',
    ...(isWeb ? ({ boxShadow: 'inset 0 0 0 1px rgba(10,28,62,0.06)' } as object) : null),
  },
  code: { fontFamily: MONO, fontWeight: '700', fontSize: 11.5, letterSpacing: 3.5, color: NAVY, marginTop: 4 },
  copyCol: { alignItems: 'center', gap: 4 },
  copy: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  copyDone: { backgroundColor: '#2FAE55' },
  copyText: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.4, color: 'rgba(255,255,255,0.65)' },
});
