import React, { memo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { AnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { brand, colors } from '../../theme';
import { Box, LOGO_PARTS, LOGO_VIEWBOX } from './logoGeometry';

export type LayerName = 'basket' | 'towel' | 'clothOrange' | 'clothRed' | 'sparkleLarge' | 'sparkleSmall';

const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

export const LAYER_BOX: Record<LayerName, Box> = {
  basket: union(LOGO_PARTS.basketRim.box, LOGO_PARTS.basket.box),
  towel: LOGO_PARTS.towel.box,
  clothOrange: LOGO_PARTS.clothOrange.box,
  clothRed: LOGO_PARTS.clothRed.box,
  sparkleLarge: LOGO_PARTS.sparkleLarge.box,
  sparkleSmall: LOGO_PARTS.sparkleSmall.box,
};

/** Layout of a layer inside a logo of `width` px, in px. */
export function layerFrame(name: LayerName, width: number) {
  const s = width / LOGO_VIEWBOX.w;
  const b = LAYER_BOX[name];
  return { left: (b.x - LOGO_VIEWBOX.x) * s, top: (b.y - LOGO_VIEWBOX.y) * s, width: b.w * s, height: b.h * s };
}

function LayerArt({ name, tint }: { name: LayerName; tint?: string }) {
  const c = (brandColor: string) => tint ?? brandColor;
  switch (name) {
    case 'basket':
      return (
        <>
          <Path d={LOGO_PARTS.basket.d} fill={c(brand.logoOrange)} fillRule="evenodd" />
          <Path d={LOGO_PARTS.basketRim.d} fill={c(brand.logoOrange)} />
        </>
      );
    case 'towel':
      // The background-coloured outline reproduces the logo's knockout gap where
      // the towel drapes over the rim.
      return (
        <>
          <Path d={LOGO_PARTS.towel.d} fill={colors.background} stroke={colors.background} strokeWidth={16} strokeLinejoin="round" />
          <Path d={LOGO_PARTS.towel.d} fill={c(colors.navy)} />
        </>
      );
    case 'clothOrange':
      return <Path d={LOGO_PARTS.clothOrange.d} fill={c(brand.logoOrange)} />;
    case 'clothRed':
      return <Path d={LOGO_PARTS.clothRed.d} fill={c(colors.red)} />;
    case 'sparkleLarge':
      return <Path d={LOGO_PARTS.sparkleLarge.d} fill={c(colors.navy)} />;
    case 'sparkleSmall':
      return <Path d={LOGO_PARTS.sparkleSmall.d} fill={c(colors.navy)} />;
  }
}

type Props = {
  name: LayerName;
  width: number;
  /** Renders a soft white light-catch of the layer's silhouette instead of its art. */
  sheen?: boolean;
  /** Paints every shape in one colour (e.g. a neutral silhouette). */
  tint?: string;
  style?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
};

/**
 * One independently animatable piece of the logo. Each layer is its own native
 * view sized to the part's bounds, so transforms pivot on the part itself and
 * run on the UI thread as plain view transforms.
 */
export const LogoLayer = memo(function LogoLayer({ name, width, sheen, tint, style }: Props) {
  const b = LAYER_BOX[name];
  const isSparkle = name === 'sparkleLarge' || name === 'sparkleSmall';
  const gradId = `sheen-${name}`;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, layerFrame(name, width), style]}>
      <Svg width="100%" height="100%" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}>
        {sheen ? (
          <>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2={isSparkle ? '1' : '0'} y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={isSparkle ? 0.45 : 0.15} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={LOGO_PARTS[name].d} fill={`url(#${gradId})`} />
          </>
        ) : (
          <LayerArt name={name} tint={tint} />
        )}
      </Svg>
    </Animated.View>
  );
});
