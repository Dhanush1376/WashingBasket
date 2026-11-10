/**
 * Makes text render at exactly the sizes in the design on every phone.
 *
 * Android scales all text by the phone's system font size. Many phones (Samsung in particular) ship with that set
 * above 100%. The app then looks zoomed in, and text spills out of the pills, cards and tabs it was sized for.
 * Android also pads each line of text above and below for accents, which iOS doesn't. That makes every label a
 * little taller than it is on an iPhone.
 *
 * React 19 ignores `defaultProps` on function components, so this swaps React Native's own Text and TextInput for
 * thin wrappers before any screen loads. Every `import { Text } from 'react-native'` then picks up the wrappers,
 * because React Native's index reads the default export of these modules on each access. Import this module once,
 * first thing, in index.ts.
 */
import React from 'react';
import { Platform } from 'react-native';

/* eslint-disable @typescript-eslint/no-require-imports */
const textModule = require('react-native/Libraries/Text/Text');
const inputModule = require('react-native/Libraries/Components/TextInput/TextInput');
/* eslint-enable @typescript-eslint/no-require-imports */

// Android only: the extra line padding that iOS doesn't add. A style on the element still wins.
const noPad = Platform.OS === 'android' ? { includeFontPadding: false } : null;

type AnyProps = { style?: unknown; [key: string]: unknown };

function wrap(original: React.ComponentType<AnyProps> & Record<string, unknown>, padStyle: object | null) {
  // React 19 passes `ref` as an ordinary prop, so spreading the props forwards it too
  const Fixed = (props: AnyProps) =>
    React.createElement(original, {
      maxFontSizeMultiplier: 1,
      ...props,
      allowFontScaling: false,
      style: padStyle ? [padStyle, props.style] : props.style,
    });
  // keep statics such as TextInput.State and displayName
  return Object.assign(Fixed, original);
}

if (!textModule.default.__fixedSize) {
  textModule.default = Object.assign(wrap(textModule.default, noPad), { __fixedSize: true });
}
if (!inputModule.default.__fixedSize) {
  inputModule.default = Object.assign(wrap(inputModule.default, null), { __fixedSize: true });
}
