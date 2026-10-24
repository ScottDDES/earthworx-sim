// Rival outfits against the prototype: who they are, how they price, and four years of them
// growing, struggling, selling up, folding and starting up.

import { describe, expect, it } from 'vitest';
import {
  BID_ODDS, DIFFICULTY, MOODS, NEW_NAMES, RIVALS, TIER, int, mkRivals, newLoan, newRival, pick, rivalsWeek, rvForm, rvFree,
  rvOH, rvOHFor, rvPhase, rvWhs, rvWin, seedRand, whoPrices,
  type Difficulty, type Mood, type Rival, type RivalEvent, type RivalWorld, type TenderKind, type TownId,
} from '../src';
import { sameLines, jobPairs } from './docketWords';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const LOAN_FOR: Record<Difficulty, number> = { easy: 350000, normal: 180000, hard: 80000, hc: 80000 };
const MOOD_IDS: Mood[] = ['boom', 'steady', 'tight', 'bust'];

function protoCareer(o: Record<string, unknown>): any {
  return { week: 1, town: 'gdi', fleet: [], staff: [], jobs: [], queue: [], log: [], news: [], bank: 1e6, recv: [], seq: 0,
    loanStart: 180000, hardcore: false, loan: newLoan(0), ...o };
}

/** The prototype's words for a rival's form, back to the engine's codes. */
function formCode(t: string): string {
  if (/^Flat out/.test(t)) return 'flatOut';
  if (/^New in town/.test(t)) return 'new';
  if (/^Short of cash/.test(t)) return 'stretched';
  if (/^No work for/.test(t)) return 'hungry';
  if (/^Pricing sharp/.test(t)) return 'sharp';
  if (/^Pricing high/.test(t)) return 'high';
  if (/^Winning work/.test(t)) return 'growing';
  return 'steady';
}

/** A rival in any state: flush, broke, idle, flat out, new. */
function randomRival(R: () => number, i: number): Rival {
  const tier = pick(R, ['small', 'mid', 'big'] as const);
  const x: Rival = {
    name: 'Rival ' + i, stars: int(R, 0, 3), eff: 0.9 + R() * 0.15, margin: -0.03 + R() * 0.25, wins: int(R, 0, 12), jobs: [], tier,
    fleet: int(R, 1, 20), cash: int(R, -100, 600) * 1000, debt: int(R, 0, 900) * 1000, idle: int(R, 0, 10), low: int(R, 0, 3), age: int(R, 0, 300), last: [],
  };
  for (let k = 0, n = int(R, 0, TIER[tier].cap); k < n; k++) x.jobs.push({ wk: int(R, 1, 10), pw: int(R, -5, 15) * 1000, p: 0 });
  for (let k = 0, n = int(R, 0, 3); k < n; k++) x.last.push(int(R, -50, 120) * 1000);
  return x;
}

describe('the outfits', () => {
  it('tables match, and a new career starts with the same rivals', () => {
    expect({ gdi: RIVALS.gdi, ct: RIVALS.ct }).toEqual(P.RIVALS);
    expect(TIER).toEqual(P.TIER);
    expect({ gdi: NEW_NAMES.gdi, ct: NEW_NAMES.ct }).toEqual(P.NEW_NAMES);
    expect(BID_ODDS).toEqual(P.BID_ODDS);
    for (const town of ['gdi', 'ct'] as TownId[]) for (let seed = 1; seed < 100; seed++) {
      P.setS(protoCareer({ town }));
      expect(mkRivals(seedRand(seed), town)).toEqual(P.withRNG(P.seedRand(seed), () => P.mkRivals(town)));
    }
  });

  it('phase, form, office costs and safety systems match', () => {
    const R = seedRand(71);
    for (let i = 0; i < 5000; i++) {
      const x = randomRival(R, i), y = JSON.parse(JSON.stringify(x)), wks = int(R, 0, 40), seed = int(R, 1, 1e9);
      P.setS(protoCareer({}));
      expect(rvPhase(x)).toBe(P.rvPhase(y));
      expect(rvFree(x)).toBe(P.rvFree(y));
      expect(rvForm(x, false)).toBe(formCode(P.rvForm(y, false)));
      const district = P.rvForm(y, true).replace(/^On \d+ jobs? · /, '');
      expect(rvForm(x, true)).toBe(district === 'Steady' ? 'steady' : formCode(district));
      expect(rvOH(x)).toBe(P.rvOH(y));
      expect(rvOHFor(x, wks)).toBe(P.rvOHFor(y, wks));
      expect(rvWhs(seedRand(seed), x)).toBe(P.withRNG(P.seedRand(seed), () => P.rvWhs(y)));
    }
  });

  it('the same outfits price each kind of tender', () => {
    const R = seedRand(72);
    for (let i = 0; i < 3000; i++) {
      const rivals = Array.from({ length: int(R, 1, 8) }, (_, k) => randomRival(R, k)), kind: TenderKind = pick(R, ['sub', 'council', 'major']);
      const S = protoCareer({ rivals: JSON.parse(JSON.stringify(rivals)) }), seed = int(R, 1, 1e9);
      P.setS(S);
      const theirs = P.withRNG(P.seedRand(seed), () => P.whoPrices(kind)).map((x: Rival) => x.name);
      expect(whoPrices(seedRand(seed), rivals, kind).map((x) => x.name)).toEqual(theirs);
    }
  });

  it('a win plays out the same: profit, stars, margin', () => {
    const R = seedRand(73);
    for (let i = 0; i < 3000; i++) {
      const x = randomRival(R, i), y = JSON.parse(JSON.stringify(x)), mood = pick(R, MOOD_IDS), seed = int(R, 1, 1e9);
      const price = int(R, 50, 900) * 1000, cost = int(R, 40, 800) * 1000, weeks = int(R, 0, 30);
      P.setS(protoCareer({ mkt: { f: 1, mood } }));
      P.withRNG(P.seedRand(seed), () => P.rvWin(y, price, cost, weeks));
      rvWin(seedRand(seed), x, price, cost, weeks, mood);
      expect(x).toEqual(y);
    }
  });

  it('new outfits get the same names and books', () => {
    const R = seedRand(74);
    for (let i = 0; i < 2000; i++) {
      const town: TownId = pick(R, ['gdi', 'ct']), rivals = mkRivals(seedRand(i + 1), town), gone = R() < 0.5 ? ['Brigalow Grading'] : [];
      const tier = pick(R, ['small', 'mid', 'big'] as const), seed = int(R, 1, 1e9);
      P.setS(protoCareer({ town, rivals: JSON.parse(JSON.stringify(rivals)), gone }));
      expect(newRival(seedRand(seed), rivals, gone, town, tier)).toEqual(P.withRNG(P.seedRand(seed), () => P.newRival(tier)));
    }
  });
});

describe('the rivals week', () => {
  it('four years of rivals run the same in every market and difficulty', () => {
    const R = seedRand(75);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 60; i++) {
      const town: TownId = pick(R, ['gdi', 'ct']), d: Difficulty = pick(R, ['easy', 'normal', 'hard', 'hc']);
      // a third of the runs start with small outfits only, so the bigger ones have to arrive or grow
      const start = mkRivals(seedRand(i + 7), town).filter((x) => i % 3 || x.tier === 'small');
      const w: RivalWorld = { week: 1, town, rivals: start, gone: [], rivSell: [], clear: [], queue: [] };
      const S = protoCareer({ town, rivals: JSON.parse(JSON.stringify(w.rivals)), gone: [], rivSell: [], clear: [], loanStart: LOAN_FOR[d], hardcore: d === 'hc' });
      let mood: Mood = 'steady', f = 1.1;
      for (let wk = 1; wk <= 208; wk++) {
        // the market moves in spells, and the player's career steps up as it goes
        if (wk % 20 === 1) { mood = pick(R, MOOD_IDS); f = { boom: 1.6, steady: 1.1, tight: 0.85, bust: 0.6 }[mood]; }
        const frozen = R() < 0.03;
        const won2 = wk > 60, won3 = wk > 150, missed = R() < 0.1 ? 1 : 0;
        const fm = Math.max(0.5, Math.min(1.5, f / 1.1)) * (frozen ? 0.35 : 1);
        // sometimes a rival wins a job this week, as tenders would make happen
        if (R() < 0.3 && w.rivals.length) {
          const k = int(R, 0, w.rivals.length - 1), price = int(R, 50, 500) * 1000, cost = price * (0.7 + R() * 0.4), weeks = int(R, 2, 20), seed = int(R, 1, 1e9);
          P.setS(S); S.mkt = { f, mood };
          P.withRNG(P.seedRand(seed), () => P.rvWin(S.rivals[k], price, cost, weeks));
          rvWin(seedRand(seed), w.rivals[k]!, price, cost, weeks, mood);
        }
        Object.assign(S, { week: wk, mkt: { f, mood }, freeze: frozen ? wk + 1 : 0, won2, won3, loan: { ...newLoan(0), missed } });
        w.week = wk;
        const seed = int(R, 1, 1e9), rep = { events: [] as string[] }, ev: RivalEvent[] = [];
        P.setS(S);
        P.withRNG(P.seedRand(seed), () => P.rivalsWeek(rep));
        rivalsWeek(seedRand(seed), w, { fmul: fm, mood, mg: DIFFICULTY[d].mg, spawn: DIFFICULTY[d].spawn, canBuyOut: won2 && !missed, won2, won3 }, ev);
        expect(w.rivals).toEqual(S.rivals);
        expect(w.gone).toEqual(S.gone);
        expect(w.rivSell).toEqual(S.rivSell);
        expect(w.clear).toEqual(S.clear);
        expect(w.queue).toEqual(S.queue);
        expect(ev.length).toBe(rep.events.length);
        sameLines(w, ev, rep.events);
        for (const e of ev) seen[e.k] = (seen[e.k] || 0) + 1;
        // the market sells what they dump, and the player deals with buy-out offers
        w.rivSell.length = 0; S.rivSell.length = 0;
        w.queue.length = 0; S.queue.length = 0;
      }
    }
    for (const k of ['sellingGear', 'wentUnder', 'newSmall', 'newMid']) expect(seen[k], k).toBeGreaterThan(5);
  });
});

describe('rivals growing, in words', () => {
  it('a small outfit grows, a mid one becomes a big player, and a big firm moves in: the docket reads the same', () => {
    const R = seedRand(77);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 400; i++) {
      const town: TownId = pick(R, ['gdi', 'ct']), rivals = mkRivals(seedRand(i + 3), town);
      for (const x of rivals) {
        if (x.tier === 'small' && R() < 0.5) { x.fleet = int(R, 8, 12); x.stars = 2; x.cash = 400000; }
        if (x.tier === 'mid' && R() < 0.5) { x.fleet = int(R, 16, 20); x.stars = 3; x.cash = 900000; }
      }
      const w: RivalWorld = { week: 40, town, rivals: rivals.filter((x) => R() < 0.7 || x.tier !== 'big'), gone: [], rivSell: [], clear: [], queue: [] };
      const S = protoCareer({ town, week: 40, rivals: JSON.parse(JSON.stringify(w.rivals)), gone: [], rivSell: [], clear: [], loanStart: 180000, won2: true, won3: true, mkt: { f: 1.1, mood: 'steady' }, loan: { ...newLoan(0), missed: 0 } });
      const seed = int(R, 1, 1e9), rep = { events: [] as string[] }, ev: RivalEvent[] = [];
      P.setS(S);
      P.withRNG(P.seedRand(seed), () => P.rivalsWeek(rep));
      rivalsWeek(seedRand(seed), w, { fmul: 1, mood: 'steady', mg: DIFFICULTY.normal.mg, spawn: DIFFICULTY.normal.spawn, canBuyOut: true, won2: true, won3: true }, ev);
      expect(w.rivals).toEqual(S.rivals);
      sameLines(w, ev, rep.events);
      for (const e of ev) seen[e.k] = (seen[e.k] || 0) + 1;
    }
    for (const k of ['grewMid', 'grewBig']) expect(seen[k], k).toBeGreaterThan(20);
  });
});

describe('rivals in the real game', () => {
  it("find other work while you're not tendering: nobody sits idle for months on end", async () => {
    const { compat, game, choose } = await import('../src');
    compat.prototype = false;
    try {
      let worst = 0, side = 0;
      for (const seed of [3, 17, 41]) {
        const c = game.newCareer({ co: 'Quiet Earthmoving', loan: 180000, town: 'gdi' }, seed);
        const g = c.market!.listings.find((m) => m.type === 'grader')!;
        game.buy(c, g.id);
        game.open(c);
        for (let w = 0; w < 104 && c.phase === 'play'; w++) {
          for (let k = 0; c.queue.length && k < 30; k++) choose(c, 0);
          game.endWeek(c);
          for (const x of c.rivals) { worst = Math.max(worst, x.idle); if (x.side) side++; }
        }
      }
      expect(side).toBeGreaterThan(0);
      expect(worst).toBeLessThan(26);
    } finally {
      compat.prototype = true;
    }
  });
});
