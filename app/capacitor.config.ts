// The phone app: Capacitor wraps the built game (dist/) in an Android and an iPhone app.
// appId is permanent once the app is on a store: confirm it before the first upload.

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'biz.ddes.earthmoving',
  appName: 'Earthworx Sim',
  webDir: 'dist',
  android: {
    // the game is all on the phone; nothing loads over plain http
    allowMixedContent: false,
  },
};

export default config;
