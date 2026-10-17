// The career, kept in one place. Screens call act() to change it through the engine; the career is saved on
// this device after every change, and the screen redraws. There are three saves side by side: each keeps its
// own career, and a short summary of each is kept so the saved-games list can show them without loading them.

import { useCallback, useEffect, useRef, useState } from 'react';
import { game } from '@engine';
import { demoCareer } from './demo';

type Setup = game.Setup;
type Career = game.Career;

const KEY = 'sim-career-v1';
export const SLOTS = 3;

/** What the saved-games list shows for a save. */
export interface SlotMeta {
  co: string;
  week: number;
  town: string;
  loan: number;
  hc: boolean;
  /** Net worth. */
  nw: number;
  /** Sold up or gone under. */
  over: boolean;
  at: number;
}

// save 1 keeps the original key, so careers from before there were saves carry on in it
const slotKey = (n: number) => (n === 1 ? KEY : KEY + '-' + n);

function readSlot(): number {
  try {
    const n = Number(localStorage.getItem(KEY + '-slot')) || 1;
    return n >= 1 && n <= SLOTS ? n : 1;
  } catch {
    return 1;
  }
}

export function slotMetaAll(): Record<number, SlotMeta> {
  try {
    return JSON.parse(localStorage.getItem(KEY + '-slots') || '{}') || {};
  } catch {
    return {};
  }
}

function writeMeta(n: number, c: Career | null): void {
  const M = slotMetaAll();
  if (!c) delete M[n];
  else {
    let nw = 0;
    try {
      nw = game.worth(c);
    } catch {
      // a half-set-up career has no worth yet
    }
    M[n] = { co: c.co, week: c.week, town: c.town, loan: c.loanStart || 0, hc: !!c.hardcore, nw, over: c.phase === 'sold' || c.phase === 'bust', at: Date.now() };
  }
  localStorage.setItem(KEY + '-slots', JSON.stringify(M));
}

function load(n: number): Career | null {
  try {
    const s = localStorage.getItem(slotKey(n));
    return s ? (JSON.parse(s) as Career) : null;
  } catch {
    return null;
  }
}

/** Save the career in save n. False when the device won't keep it (storage full, or a private window). */
function save(n: number, c: Career | null): boolean {
  try {
    if (c) localStorage.setItem(slotKey(n), JSON.stringify(c));
    else localStorage.removeItem(slotKey(n));
    writeMeta(n, c);
    return true;
  } catch {
    return false;
  }
}

export interface Store {
  career: Career | null;
  /** The save being played, 1 to 3. */
  slot: number;
  /** The device couldn't save the last change. */
  saveFailed: boolean;
  /** A demo career: never saved, so it can't overwrite a real one. */
  demo: boolean;
  /** Run an engine call on the career, then save and redraw. */
  act: (fn: (c: Career) => unknown) => void;
  start: (setup: Setup) => void;
  /** Wipe this save's career and go back to setting one up. */
  quit: () => void;
  /** Save where you are, then switch to save n (an empty one goes to setting up a career). */
  switchSlot: (n: number) => void;
  /** A business handed on: the next generation takes it over, in the same save. */
  nextGen: () => void;
}

export function useGame(): Store {
  // ?demo=council starts a ready-made career for looking at later screens
  const demoKind = new URLSearchParams(location.search).get('demo');
  const demoRef = useRef(demoKind ? demoCareer(demoKind) : null);
  const slotRef = useRef(readSlot());
  const ref = useRef<Career | null>(demoRef.current ?? load(slotRef.current));
  const [failed, setFailed] = useState(false);
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (demoRef.current) return;
    const ok = save(slotRef.current, ref.current);
    if (ok === failed) setFailed(!ok);
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

  const switchSlot = useCallback((n: number) => {
    if (!(n >= 1 && n <= SLOTS) || n === slotRef.current) return;
    if (!demoRef.current) save(slotRef.current, ref.current);
    // switching leaves the demo behind for real saves
    demoRef.current = null;
    slotRef.current = n;
    try {
      localStorage.setItem(KEY + '-slot', String(n));
    } catch {
      // blocked: this switch still holds until the page is reloaded
    }
    ref.current = load(n);
    bump();
  }, [bump]);

  const nextGen = useCallback(() => {
    if (!ref.current) return;
    const next = game.nextGeneration(ref.current, 1 + Math.floor(Math.random() * 2147483646));
    if (next) ref.current = next;
    bump();
  }, [bump]);

  return { career: ref.current, slot: slotRef.current, saveFailed: failed, demo: !!demoRef.current, act, start, quit, switchSlot, nextGen };
}
