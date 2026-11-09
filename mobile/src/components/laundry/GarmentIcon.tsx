import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { GarmentIcon as GarmentIconName } from '../../mock/types';
import { colors } from '../../theme';

const rect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

/** Line drawings of each garment, in the same stroke style as the app's icons. */
const PATHS: Record<GarmentIconName, string[]> = {
  shirt: ['M9 3 4 5.5l1.6 4.2L8 8.8V21h8V8.8l2.4.9L20 5.5 15 3l-3 3.2z', 'M12 6.2V21', 'M12 10.5h.01M12 14h.01M12 17.5h.01'],
  tshirt: ['M8.5 3 3 6.2l2.3 3.6L8 8.7V21h8V8.7l2.7 1.1L21 6.2 15.5 3a3.6 3.6 0 0 1-7 0z'],
  trousers: ['M6.5 3h11l1.3 18h-5.1L12 10.5 10.3 21H5.2z', 'M6.3 6.2h11.4'],
  jeans: ['M6.5 3h11l1.3 18h-5.1L12 10.5 10.3 21H5.2z', 'M6.3 6.2h11.4', 'M8.4 6.2c.2 1.8 1.2 2.6 2.4 2.8M15.6 6.2c-.2 1.8-1.2 2.6-2.4 2.8'],
  shorts: ['M5.5 5h13l1.3 10.5h-6.2L12 10l-1.6 5.5H4.2z', 'M5.3 8h13.4'],
  kurta: ['M9.3 3h5.4l4.3 3-1.6 3.2-1.4-.9V21H8V8.3l-1.4.9L5 6z', 'M12 3v5.5', 'M8 17h8'],
  bedsheet: [rect(3, 5, 18, 14, 2.5), 'M3 9.5h18', 'M7 14h10'],
  towel: ['M6.5 3h11v15.5a2.5 2.5 0 0 1-2.5 2.5H9a2.5 2.5 0 0 1-2.5-2.5z', 'M6.5 14.5h11', 'M6.5 17h11', 'M4.5 3h15'],
  pillow: ['M4.5 7.5C4.5 5 5.5 4 8 4h8c2.5 0 3.5 1 3.5 3.5v9c0 2.5-1 3.5-3.5 3.5H8c-2.5 0-3.5-1-3.5-3.5z', 'M8.5 9.5h7'],
  jacket: ['M8.5 3 4 6v15h5.2L12 12.5l2.8 8.5H20V6l-4.5-3L12 8z', 'M12 8v4.5', 'M7 13h2M15 13h2'],
  saree: ['M7 3h6.5l3.5 18H6z', 'M13.5 3c-3 4.5-3.8 10-1.2 18', 'M8 9h6'],
  blanket: [rect(3, 5, 18, 5, 2), rect(4, 10, 16, 4.5, 2), rect(3, 14.5, 18, 5, 2)],
  shoe: ['M3 16V9.5l4.2 1 2.8-3 3.3 3.8h3.2c2.9 0 4.5 1.9 4.5 3.7V16z', 'M3 18.5h18', 'M10.5 11.5l1.2 1.3M12.6 10.6l1.2 1.3'],
  bag: [rect(4, 8, 16, 13, 3), 'M9 8V6.5a3 3 0 0 1 6 0V8', 'M4 12.5h16'],
  stain: ['M12 3.5s5.5 5.6 5.5 10a5.5 5.5 0 0 1-11 0c0-4.4 5.5-10 5.5-10z', 'M9.6 14.2a2.4 2.4 0 0 0 2.4 2.3', 'M19 4l.6 1.7 1.7.6-1.7.6L19 8.6l-.6-1.7-1.7-.6 1.7-.6z'],
  dye: ['M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z', 'M6.5 12.5h11', 'M7.3 16h9.4'],
  wash: ['M12 2.7s-6 7.2-6 11.3a6 6 0 0 0 12 0c0-4.1-6-11.3-6-11.3z', 'M9 14.5a3 3 0 0 0 3 3'],
};

/** Soft background per garment family, so the list reads at a glance. */
const TINT: Record<GarmentIconName, string> = {
  shirt: '#EEF3FB',
  tshirt: '#EEF3FB',
  trousers: '#EEF3FB',
  jeans: '#E8EEF8',
  shorts: '#EEF3FB',
  kurta: '#FFF1E0',
  bedsheet: '#F4F5F7',
  towel: '#F4F5F7',
  pillow: '#F4F5F7',
  jacket: '#F3EEFB',
  saree: '#FFF1E0',
  blanket: '#FFF4D9',
  shoe: '#E3F7E6',
  bag: '#E3F7E6',
  stain: '#FDECEE',
  dye: '#FDECEE',
  wash: '#EEF3FB',
};

const ALIASES: Record<string, GarmentIconName> = {
  suit: 'jacket',
  pants: 'trousers',
};

export const GarmentIcon = memo(function GarmentIcon({ name, size = 44, color = colors.ink }: { name: string; size?: number; color?: string }) {
  const resolved = ALIASES[name] ?? (name in PATHS ? (name as GarmentIconName) : 'shirt');
  const icon = Math.round(size * 0.56);
  const paths = PATHS[resolved] ?? PATHS.shirt;
  const bg = TINT[resolved] ?? TINT.shirt;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Svg width={icon} height={icon} viewBox="0 0 24 24" fill="none">
        {paths.map((d, i) => (
          <Path key={i} d={d} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    </View>
  );
});
