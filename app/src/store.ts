// The career, kept in one place. Screens call act() to change it through the engine; the career is saved on
// this device after every change, and the screen redraws.

import { useCallback, useEffect, useRef, useState } from 'react';
import { game } from '@engine';
import { demoCareer } from './demo';

type Setup = game.Setup;

type Career = game.Career;

const KEY = 'sim-career-v1';

function load(): Career | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Career) : null;
  } catch {
    return null;
  }
}

function save(c: Career | null): void {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    // storage full or blocked (a private window): the game carries on, it just won't be kept
  }
}

export interface Store {
  career: Career | null;
  /** Run an engine call on the career, then save and redraw. */
  act: (fn: (c: Career) => unknown) => void;
  start: (setup: Setup) => void;
  quit: () => void;
}

export function useGame(): Store {
  // ?demo=council starts a ready-made career for looking at later screens
  const demo = new URLSearchParams(location.search).get('demo');
  const ref = useRef<Career | null>(demo ? demoCareer(demo) ?? load() : load());
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    save(ref.current);
  });

  const act = useCallback((fn: (c: Career) => unknown) => {
    if (!ref.current) return;
    fn(ref.current);
    bump();
  }, [bump]);

  const start = useCallback((setup: Setup) => {
    // a new career's seed; everything in it rolls from here
    ref.current = game.newCareer(setup, 1 + Math.floor(Math.random() * 2147483646));
    bump();
  }, [bump]);

  const quit = useCallback(() => {
    ref.current = null;
    bump();
  }, [bump]);

  return { career: ref.current, act, start, quit };
}
