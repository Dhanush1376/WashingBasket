import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { fonts } from '../../theme';

const WORDS: { text: string; color: string }[] = [
  { text: 'Washing', color: '#0A1C3E' },
  { text: 'Basket', color: '#0A1C3E' },
];
const STAGGER_MS = 38;
const LETTER_MS = 520;
const LETTER_COUNT = WORDS.reduce((n, w) => n + w.text.length, 0);
/** Time from start until the last letter is at rest. */
export const WORDMARK_DURATION = (LETTER_COUNT - 1) * STAGGER_MS + LETTER_MS;

/** Line height used for layout; the lockup reserves this much space. */
export const wordmarkLineHeight = (fontSize: number) => Math.round(fontSize * 1.35);

function Letter({ char, color, index, clock, fontSize }: { char: string; color: string; index: number; clock: SharedValue<number>; fontSize: number }) {
  const isCap = char === 'W' || char === 'B';
  const charSize = isCap ? Math.round(fontSize * 1.28) : fontSize;
  const lineH = wordmarkLineHeight(Math.round(fontSize * 1.28));
  const style = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, (clock.value - index * STAGGER_MS) / LETTER_MS));
    const e = 1 - Math.pow(1 - k, 4);
    return { opacity: Math.min(1, k * 2.5), transform: [{ translateY: (1 - e) * lineH * 0.85 }] };
  });
  return (
    <View style={{ height: lineH, overflow: 'hidden', justifyContent: 'flex-end' }}>
      <Animated.Text
        style={[
          styles.letter,
          {
            color,
            fontSize: charSize,
            lineHeight: charSize * 1.15,
            fontWeight: isCap ? '800' : '700',
          },
          style,
        ]}
      >
        {char}
      </Animated.Text>
    </View>
  );
}

type Props = {
  fontSize: number;
  /** When false the wordmark renders at rest. */
  play: boolean;
  /** ms before the first letter starts rising. */
  delay?: number;
  /** Set when the intro is skipped: settles any letters still in flight. */
  finished?: boolean;
};

/** "WashingBasket" brand wordmark; letters rise into place from a baseline mask. */
export const Wordmark = memo(function Wordmark({ fontSize, play, delay = 0, finished }: Props) {
  const clock = useSharedValue(play ? 0 : WORDMARK_DURATION);

  useEffect(() => {
    if (!play) return;
    clock.value = withDelay(delay, withTiming(WORDMARK_DURATION, { duration: WORDMARK_DURATION, easing: Easing.linear }));
    return () => cancelAnimation(clock);
  }, [play, delay, clock]);

  useEffect(() => {
    if (finished) clock.value = withTiming(WORDMARK_DURATION, { duration: 260 });
  }, [finished, clock]);

  let i = 0;
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel="WashingBasket">
      {WORDS.map((word) => (
        <React.Fragment key={word.text}>
          {[...word.text].map((ch) => (
            <Letter key={i} char={ch} color={word.color} index={i++} clock={clock} fontSize={fontSize} />
          ))}
        </React.Fragment>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  letter: { fontFamily: fonts.displayBold, letterSpacing: -0.35, includeFontPadding: false },
});
