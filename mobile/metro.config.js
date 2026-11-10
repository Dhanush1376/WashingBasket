// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// On iOS and Android the app's own files get a `react-native` whose Text and TextInput ignore the phone's
// system font size, so the app looks exactly as designed on every phone. See src/lib/reactNativeFixed.js.
// Libraries in node_modules, and the web build, keep the real module.
const shim = path.join(__dirname, 'src', 'lib', 'reactNativeFixed.js');
const nodeModules = `${path.sep}node_modules${path.sep}`;
const upstream = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react-native' &&
    platform !== 'web' &&
    context.originModulePath !== shim &&
    context.originModulePath.startsWith(__dirname) &&
    !context.originModulePath.includes(nodeModules)
  ) {
    return { type: 'sourceFile', filePath: shim };
  }
  return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
