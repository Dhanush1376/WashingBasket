import React, { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../../theme';

/** Circle and rounded-rect helpers, so every icon is plain path data in one stroke style. */
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const rect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const PATHS = {
  home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  calendar: [rect(3, 4.5, 18, 16.5, 3), 'M16 2.5v4M8 2.5v4M3 10h18'],
  bag: ['M6 7h12l1 13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z', 'M9 7V6a3 3 0 0 1 6 0v1'],
  user: [circle(12, 8, 4), 'M4 21a8 8 0 0 1 16 0'],
  bell: ['M18 8.5a6 6 0 0 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5', 'M13.7 20.5a2 2 0 0 1-3.4 0'],
  menu: ['M4 7h16M4 12h16M4 17h10'],
  chevronRight: ['M9 18l6-6-6-6'],
  chevronLeft: ['M15 18l-6-6 6-6'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M18 15l-6-6-6 6'],
  arrowUpRight: ['M7 17 17 7M8 7h9v9'],
  arrowRight: ['M5 12h14M13 6l6 6-6 6'],
  mapPin: ['M20 10.5c0 6-8 11.5-8 11.5s-8-5.5-8-11.5a8 8 0 0 1 16 0z', circle(12, 10.5, 3)],
  store: ['M3 9l1-5h16l1 5M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z', 'M9 19v-6h6v6'],
  wallet: [rect(3, 6, 18, 14, 3), 'M3 10h18', 'M16 15h1.5', 'M7 6V5a2 2 0 0 1 2-2h8'],
  tag: ['M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z', 'M7.5 7.5h.01'],
  gift: ['M20 12v9H4v-9', 'M2.5 7.5h19V12h-19z', 'M12 21V7.5', 'M12 7.5H8a2.5 2.5 0 1 1 0-5c3 0 4 5 4 5z', 'M12 7.5h4a2.5 2.5 0 1 0 0-5c-3 0-4 5-4 5z'],
  list: [rect(4, 3, 16, 18, 3), 'M8 8h8M8 12h8M8 16h5'],
  headset: ['M4 17v-5a8 8 0 0 1 16 0v5', rect(3, 13, 5, 7, 2), rect(16, 13, 5, 7, 2)],
  logout: ['M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  copy: [rect(9, 9, 12, 12, 2.5), 'M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5'],
  share: ['M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6', 'M16 7l-4-4-4 4', 'M12 3v12'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  clock: [circle(12, 12, 9), 'M12 7v5l3 2'],
  lock: [rect(5, 11, 14, 10, 2.5), 'M8 11V7.5a4 4 0 0 1 8 0V11'],
  truck: ['M2 5h12v11H2z', 'M14 9h4l3 3.5V16h-7z', circle(6, 18, 2), circle(17, 18, 2)],
  shirt: ['M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z'],
  sparkle: ['M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z', 'M19 15l.7 2 2 .7-2 .6-.7 2-.6-2-2-.6 2-.7z'],
  shield: ['M12 21.5s8-3.5 8-10V5l-8-2.5L4 5v6.5c0 6.5 8 10 8 10z', 'M9 12l2 2 4-4'],
  package: ['M21 16V8l-9-5-9 5v8l9 5z', 'M3.3 7.2 12 12l8.7-4.8', 'M12 21.5V12', 'M7.5 4.6l9 5'],
  phone: ['M21 16.5v3a1.5 1.5 0 0 1-1.6 1.5A17 17 0 0 1 3 4.6 1.5 1.5 0 0 1 4.5 3h3a1.5 1.5 0 0 1 1.5 1.3c.1 1 .4 2 .7 2.9a1.5 1.5 0 0 1-.4 1.6L7.9 10.2a13 13 0 0 0 5.9 5.9l1.4-1.4a1.5 1.5 0 0 1 1.6-.4c.9.3 1.9.6 2.9.7a1.5 1.5 0 0 1 1.3 1.5z'],
  mail: [rect(3, 5, 18, 14, 3), 'M3.5 7l8.5 6 8.5-6'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  x: ['M18 6 6 18M6 6l12 12'],
  info: [circle(12, 12, 9), 'M12 16v-4.5M12 8h.01'],
  alert: [circle(12, 12, 9), 'M12 7.5V13M12 16.5h.01'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z'],
  sliders: ['M4 20v-6M4 10V4M12 20v-8M12 8V4M20 20v-4M20 12V4M2 14h4M10 8h4M18 16h4'],
  search: [circle(11, 11, 7), 'M20 20l-4-4'],
  star: ['M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z'],
  droplet: ['M12 3s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z'],
  grid: [rect(3, 3, 7.5, 7.5, 2), rect(13.5, 3, 7.5, 7.5, 2), rect(3, 13.5, 7.5, 7.5, 2), rect(13.5, 13.5, 7.5, 7.5, 2)],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  receipt: ['M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z', 'M9 8h6M9 12h6'],
  bookmark: ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  sun: [circle(12, 12, 4), 'M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4'],
  moon: ['M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z'],
  spray: [
    rect(8, 11, 8, 10, 2),
    'M10 11V7.5h4V11',
    'M7 4.5h7a1.5 1.5 0 0 1 1.5 1.5v1.5H9',
    'M10 7.5L8 11',
    'M4 4.5L2.5 4',
    'M2 7h2',
    'M4 9.5L2.5 10',
  ],
  // staff app
  scan: ['M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8', 'M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8', 'M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16', 'M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16', 'M7 12h10'],
  flash: ['M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z'],
  wind: ['M3 8h11a3 3 0 1 0-3-3', 'M3 12h16a3 3 0 1 1-3 3', 'M3 16h7'],
  users: [circle(9, 8, 3.5), 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.6a3.5 3.5 0 0 1 0 6.8', 'M18.5 14.2a6.5 6.5 0 0 1 3 5.8'],
  megaphone: ['M3 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l7 4.5V4.5L7 9H4.5A1.5 1.5 0 0 0 3 10.5z', 'M18 9a4 4 0 0 1 0 6', 'M8 15l1.2 5'],
} as const;

export type IconName = keyof typeof PATHS;

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

/** Line icons in one consistent style: 24 grid, round caps and joins, 1.8 stroke. */
export const Icon = memo(function Icon({ name, size = 22, color = colors.ink, strokeWidth = 1.8 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {PATHS[name].map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
});

export const isIconName = (n: string): n is IconName => n in PATHS;
