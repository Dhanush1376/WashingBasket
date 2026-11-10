/**
 * `react-native`, as the app's own files see it on iOS and Android: the same module, except Text and TextInput
 * always render at the sizes in the design.
 *
 * Android scales all text by the phone's system font size, and many phones (Samsung in particular) ship with that
 * set above 100%. The app then looked zoomed in, and text spilled out of the pills, cards and tabs it was sized
 * for. Android also pads each line of text above and below, which iOS doesn't.
 *
 * metro.config.js points the app's `import ... from 'react-native'` here. Libraries in node_modules still get the
 * real module. Everything except Text and TextInput is passed straight through, read lazily as React Native does.
 *
 * Never assign to React Native's own exports to do this. In release builds they are read-only getters, so the
 * assignment throws as the app starts and the app closes straight away. That is what broke the earlier
 * version of this fix.
 */
const React = require('react');
const RN = require('react-native');

const isAndroid = RN.Platform.OS === 'android';
// Android only: the extra line padding that iOS doesn't add. A style on the element still wins.
const noPad = isAndroid ? { includeFontPadding: false } : null;

function fixed(Original, padStyle, name, defaults) {
  // React 19 passes `ref` as an ordinary prop, so spreading the props forwards it too
  function Fixed(props) {
    return React.createElement(Original, {
      maxFontSizeMultiplier: 1,
      ...defaults,
      ...props,
      allowFontScaling: false,
      style: padStyle ? [padStyle, props.style] : props.style,
    });
  }
  // keep statics such as TextInput.State
  for (const key of Object.keys(Original)) Fixed[key] = Original[key];
  Fixed.displayName = name;
  return Fixed;
}

// The app is light-only, so its keyboard is too (iOS honours this; Android keyboards follow their own theme)
const INPUT_DEFAULTS = { keyboardAppearance: 'light' };

let Text;
let TextInput;
const shim = {};
for (const key of Object.keys(RN)) {
  if (key === 'Text' || key === 'TextInput') continue;
  Object.defineProperty(shim, key, { enumerable: true, get: () => RN[key] });
}
Object.defineProperty(shim, 'Text', {
  enumerable: true,
  get: () => Text || (Text = fixed(RN.Text, noPad, "Text")),
});
Object.defineProperty(shim, 'TextInput', {
  enumerable: true,
  get: () => TextInput || (TextInput = fixed(RN.TextInput, null, "TextInput", INPUT_DEFAULTS)),
});

module.exports = shim;
