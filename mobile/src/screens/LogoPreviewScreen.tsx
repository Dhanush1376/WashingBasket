import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedLogo, AnimatedLogoHandle, INTRO_TIMELINE } from '../components/logo/AnimatedLogo';
import { LoadingDots, LogoLoader } from '../components/logo/LogoLoader';
import { WashingBasketLogo } from '../components/logo/WashingBasketLogo';
import { Wordmark } from '../components/logo/Wordmark';
import { colors, fonts, radius, type } from '../theme';

/**
 * Development-only page for checking the logo animations in isolation
 * (web: open the app with `?logo`). Not part of the app's navigation.
 */
export function LogoPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const logoW = Math.min(winW - 96, 220);

  // Remounting with a new key replays the intro from the first frame.
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const logoRef = useRef<AnimatedLogoHandle>(null);

  useEffect(() => {
    setFinished(false);
    setElapsed(0);
    const start = Date.now();
    const id = setInterval(() => {
      const t = Date.now() - start;
      setElapsed(Math.min(t, INTRO_TIMELINE.complete));
      if (t >= INTRO_TIMELINE.complete) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [run]);

  const skip = () => {
    logoRef.current?.finish();
    setFinished(true);
    setElapsed(INTRO_TIMELINE.complete);
  };

  const done = elapsed >= INTRO_TIMELINE.complete;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={type.title}>Logo animation preview</Text>
      <Text style={styles.note}>Development page · open the app without ?logo to return to sign-in.</Text>

      <Section title="Intro: logo + wordmark" caption={`${(elapsed / 1000).toFixed(1)} s / ${(INTRO_TIMELINE.complete / 1000).toFixed(1)} s${done ? ' · at rest' : ''}`}>
        <View style={styles.stage} key={run}>
          <AnimatedLogo ref={logoRef} width={logoW} play enterFromX={winW * 0.6} />
          <View style={styles.wordmark}>
            <Wordmark fontSize={30} play delay={INTRO_TIMELINE.wordmark} finished={finished} />
          </View>
        </View>
        <View style={styles.buttons}>
          <Button label="Replay" onPress={() => setRun((r) => r + 1)} primary />
          <Button label="Skip to end" onPress={skip} />
        </View>
        <Timeline elapsed={elapsed} />
      </Section>

      <Section title="Logo loader (loops)" caption="Full-screen and section loading">
        <View style={styles.row}>
          <LogoLoader size={64} />
          <LogoLoader size={104} />
        </View>
      </Section>

      <Section title="Dot loader (loops)" caption="Inline: buttons, rows, small spaces">
        <View style={styles.row}>
          <LoadingDots size={7} />
          <LoadingDots size={10} />
          <View style={styles.tintedChip}>
            <LoadingDots size={8} />
          </View>
        </View>
      </Section>

      <Section title="Static logo" caption="Resting state with gentle sparkle shine">
        <View style={styles.row}>
          <WashingBasketLogo width={logoW * 0.6} />
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
      {children}
    </View>
  );
}

function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.btn, primary && styles.btnPrimary, pressed && styles.btnPressed]}
    >
      <Text style={[styles.btnText, primary && styles.btnTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const STEPS: [keyof typeof INTRO_TIMELINE, string][] = [
  ['basket', 'Basket slides in'],
  ['towel', 'Towel unrolls & sways'],
  ['red', 'Red cloth lands & basket dips'],
  ['orange', 'Orange cloth lands & basket dips'],
  ['sparkleLarge', 'Sparkles pop & twirl'],
  ['wordmark', 'Wordmark rises'],
  ['complete', 'At rest'],
];

/** Which beat of the choreography is playing, so each one can be checked. */
function Timeline({ elapsed }: { elapsed: number }) {
  return (
    <View style={styles.timeline}>
      {STEPS.map(([key, label]) => {
        const reached = elapsed >= INTRO_TIMELINE[key];
        return (
          <View key={key} style={styles.step}>
            <View style={[styles.dot, reached && styles.dotOn]} />
            <Text style={[styles.stepText, reached && styles.stepTextOn]}>{label}</Text>
            <Text style={styles.stepTime}>{(INTRO_TIMELINE[key] / 1000).toFixed(2)} s</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.subtle },
  content: { paddingHorizontal: 20, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  note: { ...type.helper, marginTop: -8 },
  section: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 16 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  caption: { ...type.helper, fontVariant: ['tabular-nums'] },
  stage: { alignItems: 'center', justifyContent: 'center', minHeight: 320, overflow: 'hidden', paddingVertical: 12 },
  wordmark: { marginTop: 14 },
  buttons: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  btnPrimary: { backgroundColor: colors.cta, borderColor: colors.cta },
  btnPressed: { opacity: 0.8 },
  btnText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  btnTextPrimary: { color: '#FFFFFF' },
  timeline: { gap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.success },
  stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  stepTextOn: { color: colors.ink },
  stepTime: { ...type.helper, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', minHeight: 140 },
  tintedChip: { backgroundColor: colors.subtle, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 14 },
});
