// Run inside an old build's worktree by scripts/make-saves.sh: plays a few careers with that build and writes their saves.
import { beforeAll, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { compat, game } from '../src';
import { playWeeks, startCareer } from './saveBot';

beforeAll(() => { compat.prototype = false; });
it('makes saves', () => {
  const OUT = process.env.SAVES_OUT!, TAG = process.env.SAVES_TAG!;
  mkdirSync(OUT, { recursive: true });
  const bulk = typeof (game as any).setPack === 'function';
  const cases: [string, any, number][] = [
    ['roads-gdi', { town: 'gdi', loan: 180000 }, 120],
    ['roads-ct-hard', { town: 'ct', loan: 120000, hc: true }, 70],
    ['roads-big', { town: 'gdi', loan: 400000 }, 200],
    ...(bulk ? [['bulk', { town: 'gdi', loan: 250000, bulk: true }, 80] as [string, any, number]] : []),
  ];
  for (const [name, o, weeks] of cases) {
    const c = startCareer(7, o);
    let live = '';
    for (let w = 0; w < weeks; w += 10) {
      playWeeks(c, 10);
      if (c.phase === 'play') live = JSON.stringify(c);
    }
    if (live) writeFileSync(OUT + '/' + TAG + '-' + name + '.json', live);
  }
});
