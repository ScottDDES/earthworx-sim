import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// the font ships inside the app, so it works offline and nothing is fetched from Google
import '@fontsource-variable/archivo/wdth.css';
import './prototype.css';
import { App } from './App';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
