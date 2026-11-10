import { registerRootComponent } from 'expo';

// first, before any screen: text renders at the designed size on every phone (see the file)
import './src/lib/fixedText';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
