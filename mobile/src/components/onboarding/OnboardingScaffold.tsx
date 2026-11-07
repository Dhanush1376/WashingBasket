import React from 'react';
import {
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors, fonts, type } from '../../theme';
import { GridBackground } from '../ui/GridBackground';
import { WashingBasketLogo } from '../logo/WashingBasketLogo';
import { ChevronLeft } from '../ui/icons';
import { OnboardingProgress } from './OnboardingProgress';

/** Default height of the heading and form block (top bar to the last line). */
const FORM_HEIGHT = 390;

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  step: number;
  onBack?: () => void;
  children: React.ReactNode;
  /** Full-screen layer shown on top (e.g. the success confirmation). */
  overlay?: React.ReactNode;
  /** Illustration anchored to the bottom-left corner, behind the content. */
  art?: {
    source: ImageSourcePropType;
    aspect: number;
    formHeight?: number;
    /** Continue a line in the artwork (a clothesline) to the screen's right edge. In image pixels. */
    extendLine?: { x: number; y: number; slope: number; width: number; color: string; imageWidth: number };
  };
};

/**
 * Shared frame for the steps after sign-in: back + progress, heading, then the form.
 * Keyboard-aware (the content scrolls, nothing hides behind the keyboard) and safe-area aware.
 */
export function OnboardingScaffold({ title, subtitle, step, onBack, children, overlay, art }: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const isReduced = !!reducedMotion;
  // The art fills the space under the form: as wide as the screen allows, shrinking on
  // shorter screens so it never reaches the controls; too small to read, it is left out.
  const formBottom = insets.top + (art?.formHeight ?? FORM_HEIGHT);
  const artW = art ? Math.min(winW * 0.78, 320, (winH - formBottom - insets.bottom) * art.aspect * 0.88) : 0;
  const showArt = !!art && artW >= 160;
  const enter = (delay: number) => (isReduced ? undefined : FadeInDown.duration(420).delay(delay).easing(Easing.out(Easing.cubic)));

  return (
    <View style={styles.root}>
      <GridBackground fadeBottom />
      {showArt && art ? (
        <Animated.View
          style={[styles.art, { bottom: Math.max(0, insets.bottom) - 10 }]}
          pointerEvents="none"
        >
          <Image
            source={art.source}
            style={{ width: artW, height: artW / art.aspect }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          {art.extendLine ? <LineToEdge line={art.extendLine} artW={artW} artH={artW / art.aspect} screenW={winW} /> : null}
        </Animated.View>
      ) : null}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            {/* plain white header band: the grid starts below it, behind a soft fade */}
            <View style={[styles.topBar, { marginTop: -(insets.top + 8), paddingTop: insets.top + 8 }]}>
              <View style={styles.lead}>
                {onBack ? (
                  <Pressable
                    onPress={onBack}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    hitSlop={8}
                    style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
                  >
                    <ChevronLeft color={colors.ink} />
                  </Pressable>
                ) : null}
                {/* the brand mark on its own */}
                <View style={styles.brand} accessible accessibilityLabel="Washing Basket">
                  <WashingBasketLogo width={48} />
                </View>
              </View>
              <OnboardingProgress step={step} />
              <Svg style={styles.headerFade} width="100%" height={28} pointerEvents="none">
                <Defs>
                  <LinearGradient id="wbHeaderFade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.background} stopOpacity={1} />
                    <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height={28} fill="url(#wbHeaderFade)" />
              </Svg>
            </View>

            <Animated.View entering={enter(0)} style={styles.heading}>
              <Text style={type.title} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </Animated.View>

            <Animated.View entering={enter(140)}>{children}</Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {overlay ? (
        <Animated.View entering={isReduced ? undefined : FadeIn.duration(420)} style={styles.overlay}>
          {overlay}
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Carries a line from the artwork out to the right edge of the screen: it leaves the image at
 * the same point, angle, weight and colour, then eases level, as if tied off at the edge.
 */
function LineToEdge({
  line,
  artW,
  artH,
  screenW,
}: {
  line: NonNullable<NonNullable<Props['art']>['extendLine']>;
  artW: number;
  artH: number;
  screenW: number;
}) {
  const k = artW / line.imageWidth;
  const x0 = line.x * k - 1; // overlap the drawn end by a pixel so the join is seamless
  const y0 = line.y * k;
  const run = Math.max(0, screenW - x0);
  if (run < 4) return null;
  const cx = x0 + run * 0.45;
  const cy = y0 + line.slope * run * 0.45;
  const ex = screenW + 2;
  const ey = y0 + line.slope * run * 0.6;
  return (
    <Svg width={screenW + 4} height={artH} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path
        d={`M ${x0} ${y0} Q ${cx} ${cy} ${ex} ${ey}`}
        stroke={line.color}
        strokeWidth={Math.max(0.75, line.width * k)}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  art: { position: 'absolute', left: 0 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingBottom: 8,
    marginHorizontal: -24,
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  headerFade: { position: 'absolute', left: 0, right: 0, top: '100%', height: 28 },
  lead: { flexDirection: 'row', alignItems: 'center' },
  brand: { justifyContent: 'center' },
  back: { width: 44, height: 44, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  backPressed: { backgroundColor: colors.subtle },
  heading: { marginTop: 20, marginBottom: 28 },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.inkSoft,
    marginTop: 6,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden', // the success flood is larger than the screen
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
});
