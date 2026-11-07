import React, { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Mask, Path, Pattern, Rect, Stop } from 'react-native-svg';

type Props = {
  cell?: number;
  color?: string;
  fadeBottom?: boolean;
};

/**
 * A quiet square grid filling its parent.
 * On Web: uses native CSS linear-gradient background for 100% reliable, crisp rendering.
 * On Native: uses react-native-svg pattern.
 */
export const GridBackground = memo(function GridBackground({
  cell = 24,
  color = 'rgba(20, 33, 61, 0.09)',
  fadeBottom = true,
}: Props) {
  if (Platform.OS === 'web') {
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
            backgroundSize: `${cell}px ${cell}px`,
            ...(fadeBottom
              ? {
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 65%, rgba(0,0,0,0) 95%)',
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 65%, rgba(0,0,0,0) 95%)',
                }
              : {}),
          } as any,
        ]}
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id="wbGrid" width={cell} height={cell} patternUnits="userSpaceOnUse">
            <Path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke={color} strokeWidth={1} />
          </Pattern>
          {fadeBottom ? (
            <LinearGradient id="wbGridFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="65%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="95%" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          ) : null}
          {fadeBottom ? (
            <Mask id="wbGridMask">
              <Rect width="100%" height="100%" fill="url(#wbGridFade)" />
            </Mask>
          ) : null}
        </Defs>
        <Rect
          width="100%"
          height="100%"
          fill="url(#wbGrid)"
          mask={fadeBottom ? 'url(#wbGridMask)' : undefined}
        />
      </Svg>
    </View>
  );
});
