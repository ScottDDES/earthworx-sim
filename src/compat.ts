// Things the prototype does that the real game does better. The engine does them the better way by default;
// the side-by-side tests switch `prototype` on so they can still check every rule against the prototype exactly.

import type { Rand } from './rng';

let proto = false;
const hooks: (() => void)[] = [];

export const compat = {
  /** Behave exactly as the prototype does, quirks included. Tests turn this on; the game leaves it off. */
  get prototype() { return proto; },
  set prototype(v: boolean) {
    if (v === proto) return;
    proto = v;
    for (const h of hooks) h();
  },
};

/** Run fn now and whenever the prototype switch flips: for tables that hold the prototype's numbers or the real game's. */
export function onCompat(fn: () => void): void {
  hooks.push(fn);
  fn();
}

/**
 * A shuffled copy. The prototype sorts with a random comparator, which is biased (some orders come up far more
 * often than others) and depends on the browser's sort. The real game does a fair Fisher–Yates shuffle.
 */
export function shuffled<T>(rand: Rand, list: readonly T[]): T[] {
  const a = list.slice();
  if (compat.prototype) return a.sort(() => rand() - 0.5);
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(rand() * (i + 1));
    [a[i], a[k]] = [a[k]!, a[i]!];
  }
  return a;
}
