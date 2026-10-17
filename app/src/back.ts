// Android's back button, inside the phone app. While a card or sheet is up it does nothing (a card has to be
// answered, and a sheet has its own close button); otherwise it goes back to the Yard, and from the Yard it
// sends the app to the background, the way other games do. In a browser this does nothing.

import { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function useBackButton(onTab: string, toYard: () => void): void {
  const at = useRef(onTab), go = useRef(toYard);
  at.current = onTab;
  go.current = toYard;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = CapApp.addListener('backButton', () => {
      if (document.querySelector('.overlay')) return;
      if (at.current !== 'yard') go.current();
      else void CapApp.minimizeApp();
    });
    return () => { void h.then((x) => x.remove()); };
  }, []);
}
