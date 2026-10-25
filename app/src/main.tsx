import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// the font ships inside the app, so it works offline and nothing is fetched from Google
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './prototype.css';
import './phone.css';
import { App } from './App';
import { WebGate } from './WebGate';
import { startAds } from './ads';
import { refreshShop } from './shop';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <WebGate>
      <App />
    </WebGate>
  </StrictMode>,
);

// what's been bought, then ads (Google's consent and Apple's tracking question come up the first time)
void refreshShop().finally(() => startAds());
