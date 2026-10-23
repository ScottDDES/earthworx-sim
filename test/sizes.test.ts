// Scott, 23 Oct: a flood recovery program (one lot) came out at 29.5 km while council packages ran past 40 km.
// In the real game a package is a handful of short roads and a program's lot is split by km: always bigger.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compat, game, genCouncil, genMajor, seedRand } from '../src';

describe('package and program sizes', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('council packages stay under 40 km; every program lot is 55 km or more', () => {
    const pk: number[] = [], pr: number[] = [];
    for (const town of ['gdi', 'ct'] as const) {
      for (let s = 1; s <= 120; s++) {
        const c = game.newCareer({ co: 'Size', loan: 350000, town }, s);
        c.phase = 'play';
        c.won = c.won2 = c.won3 = true;
        const ctx = game.planCtx(c);
        c.ctenders = [];
        const t = genCouncil(seedRand(s), c as never, ctx, 5);
        if (t) pk.push(t.km);
        c.ctenders = [];
        const m = genMajor(seedRand(s * 7), c as never, ctx, 50, false);
        if (m) pr.push(m.km);
      }
    }
    expect(pk.length).toBeGreaterThan(150);
    expect(pr.length).toBeGreaterThan(150);
    expect(Math.max(...pk)).toBeLessThanOrEqual(40);
    expect(Math.min(...pr)).toBeGreaterThanOrEqual(55);
  });
});
