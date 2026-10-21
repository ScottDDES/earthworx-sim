// Saves from older builds keep working. Each file in test/saves is a career saved by an earlier build (made by
// scripts/make-saves.sh with that build's own engine). Each one loads into this build and plays on for a year:
// every card and week's docket is put into words, and nothing may throw or turn to NaN.
// Before each store release, add saves from the build that's out: scripts/make-saves.sh <commit>.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { compat, drawCard, game } from '../src';
import { cardView } from '../src/text/cardView';
import { docketLines, docketStamps } from '../src/text/docket';
import { diaryLines } from '../src/text/diary';
import { playWeeks } from './saveBot';

const DIR = new URL('./saves/', import.meta.url);

// what a player should never read: a broken number or blank, doubled spaces, American spelling, or a brand name
const BAD: [RegExp, string][] = [
  [/NaN|undefined|null|\[object|Infinity/, 'a broken value'],
  [/ {2,}| [,.;:!?](?!\d)/, 'stray spaces'],
  [/\b(colors?|centers?|centered|organiz\w*|realiz\w*|labor|tires?|gray|(kilo)?meters?|liters?|favorite|defense)\b/i, 'American spelling'],
  [/\b(QRA|DRFA|NDRRA|WorkSafe|Safe ?Work|Austroads|QBCC|WHSQ)\b/, 'a brand name'],
];
function checkWords(where: string, t: string, bad: string[]): void {
  for (const [re, why] of BAD) if (re.test(t)) bad.push(where + ' (' + why + '): ' + t.slice(0, 140));
}
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

describe('saves from older builds', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('there are saves to check', () => expect(files.length).toBeGreaterThan(10));

  for (const f of files) {
    it(f + ' loads and plays a year', () => {
      const c = JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as game.Career;
      const w0 = c.week;
      expect(c.phase).toBe('play');
      let cards = 0, weeks = 0;
      const bad: string[] = [];
      playWeeks(c, 52, {
        card: (c, q) => {
          const d = drawCard(c, q);
          if (!d) return;
          const v = cardView(c, q, d);
          expect(v.title, q.k).toBeTruthy();
          for (const t of [v.tag, v.title, v.body, ...v.opts.flatMap((o) => [o.label, o.sub])]) checkWords('card ' + q.k, t, bad);
          cards++;
        },
        report: (c, r) => { for (const t of [...docketLines(c, r), ...docketStamps(c, r)]) checkWords('docket', t, bad); weeks++; },
      });
      for (const l of diaryLines(c)) checkWords('diary', l.t, bad);
      expect(bad, f).toEqual([]);
      expect(c.week).toBeGreaterThan(w0);
      expect(weeks).toBeGreaterThan(0);
      for (const n of [c.bank, game.worth(c), ...c.fleet.map((m) => m.hours)]) expect(Number.isFinite(n), f).toBe(true);
      // and it still saves
      expect(() => JSON.parse(JSON.stringify(c))).not.toThrow();
      expect(cards + weeks).toBeGreaterThan(0);
    });
  }
});
