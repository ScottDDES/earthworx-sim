// The web version is a tool for us (testing, screenshots), not a free copy of the game. On the public web
// address a visitor sees where to get the app; opening it once with ?dev=<key> unlocks this browser for good.
// Phones (the real app) and local development skip this. The key keeps casual visitors out; it isn't a secret.

import type { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';

const DEV_KEY = 'ewx-0a00939f';
const LS = 'ewx-dev';

function unlocked(): boolean {
  if (Capacitor.isNativePlatform() || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return true;
  try {
    if (new URLSearchParams(location.search).get('dev') === DEV_KEY) localStorage.setItem(LS, '1');
    return localStorage.getItem(LS) === '1';
  } catch {
    return new URLSearchParams(location.search).get('dev') === DEV_KEY;
  }
}

export function WebGate({ children }: { children: ReactNode }) {
  if (unlocked()) return <>{children}</>;
  return (
    <div className="wrap setup">
      <div className="hero">
        <h1>Earthworx Sim by DDES</h1>
        <p>Run an earthmoving business: tender for council flood works, plan the job, beat the rain and keep the bank happy.</p>
      </div>
      <div className="card">
        <b>Get it on your phone</b>
        <div className="small muted">Earthworx Sim is a phone game. Search for Earthworx Sim on the App Store. Android is coming.</div>
      </div>
      <div className="tiny muted" style={{ textAlign: 'center' }}>
        <a href="/support">Help</a> · <a href="/privacy">Privacy</a>
      </div>
    </div>
  );
}
