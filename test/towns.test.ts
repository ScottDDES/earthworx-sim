// The rest of Queensland (Scott, 24 Oct): St George, Dalby, Emerald, Moranbah, Mackay, Mount Isa and Weipa, each with
// 30 years of its own real rain, its own places, roads, council, rivals and mines, and its own mix of work.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BULK_RIVALS, MINES, genMajor, NEW_NAMES, PITS, PLACE_POS, RIVALS, ROADS, TOWNS, bulkWeek, compat, game, genOffers, meanYearMm, monthIdx, seedRand, townKm, wetDay, wxStartFor,
  type TownId,
} from '../src';
import { playWeeks, startCareer } from './saveBot';

const NEW: TownId[] = ['stg', 'dby', 'emd', 'mbh', 'mky', 'isa', 'wei'];
const ALL = Object.keys(TOWNS) as TownId[];

describe('across Queensland', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('every town has its places on the map, roads, pits, rivals, bulk outfits and a council', () => {
    for (const k of ALL) {
      const T = TOWNS[k];
      expect(T.places.length).toBeGreaterThanOrEqual(6);
      for (const p of T.places) expect(PLACE_POS[k][p], `${T.name}: ${p}`).toBeTruthy();
      expect(RIVALS[k].length).toBe(5);
      expect(NEW_NAMES[k].length).toBe(12);
      expect(BULK_RIVALS[k].length).toBe(4);
      expect(T.council).toMatch(/council$/);
      if (k !== 'gdi') {
        expect(ROADS[k].length).toBe(30);
        expect(new Set(ROADS[k]).size).toBe(30);
        expect(PITS[k].length).toBe(8);
      }
    }
    // nobody's in two towns at once
    const names = ALL.flatMap((k) => [...RIVALS[k].map((x) => x[0]), ...BULK_RIVALS[k].map((x) => x[0])]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('real rain: Mackay and Weipa are the wet ones, Mount Isa and St George the dry ones', () => {
    const mm = Object.fromEntries(ALL.map((k) => [k, meanYearMm(k)]));
    expect(mm.wei).toBeGreaterThan(1200);
    expect(mm.mky).toBeGreaterThan(1000);
    expect(mm.isa).toBeLessThan(500);
    expect(mm.stg).toBeLessThan(550);
    expect(Math.min(...ALL.map((k) => mm[k]!))).toBeGreaterThan(300);
  });

  it("Weipa's wet season stops nearly everything; its dry season hardly stops at all", () => {
    const wx = { town: 'wei' as TownId, wxStart: wxStartFor(2000) }, by = Array.from({ length: 12 }, () => [0, 0]);
    for (let w = 1; w < 52 * 20; w++) for (let d = 0; d < 5; d++) { const m = by[monthIdx(w)]!; m[1]++; if (wetDay(wx, w, d)) m[0]++; }
    const pc = (m: number) => by[m]![0] / by[m]![1];
    expect(pc(1)).toBeGreaterThan(0.6); // February
    expect(pc(7)).toBeLessThan(0.05); // August
  });

  it('the mines ring more around Moranbah and Mount Isa, never around St George', () => {
    const mines = (town: TownId) => {
      const c = game.newCareer({ co: 'Mines', loan: 900000, town }, 3);
      c.phase = 'play';
      c.won = c.won2 = true;
      c.fleet = [{ id: 'm0', type: 'd10', year: 2030, cond: 90, hours: 500, svcAt: 500, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null } as never];
      let n = 0;
      for (let s = 0; s < 600; s++) n += genOffers(seedRand(s), c as never, 1, true, true).filter((o) => o.mine).length;
      return n;
    };
    const g = mines('gdi');
    expect(mines('stg')).toBe(0);
    expect(mines('mbh')).toBeGreaterThan(g * 1.8);
    expect(mines('isa')).toBeGreaterThan(g * 1.4);
    expect(MINES.mbh.length).toBeGreaterThan(0);
  });

  it('St George hears about more farm work than Moranbah', () => {
    const calls = (town: TownId) => {
      let n = 0;
      for (let s = 0; s < 300; s++) {
        const c = game.newCareer({ co: 'Farms', loan: 900000, town, path: 'bulk' }, 5);
        c.phase = 'play';
        c.fleet = [];
        c.bulk = { enq: [] };
        bulkWeek(seedRand(s), c as never, 1, []);
        n += c.bulk!.enq.length;
      }
      return n;
    };
    expect(calls('stg')).toBeGreaterThan(calls('mbh') * 1.6);
  });

  it('a road career and a bulk career play two years in every new town', () => {
    for (const town of NEW) {
      for (const bulk of [false, true]) {
        const c = startCareer(41, { town, loan: 350000, bulk });
        playWeeks(c, 104);
        expect(c.week, `${town} ${bulk ? 'bulk' : 'roads'}`).toBeGreaterThan(20);
        expect(c.dmap!.roads.length).toBe(30);
        // nothing from the old towns leaks in
        const other = [...TOWNS.gdi.places, ...TOWNS.ct.places];
        for (const j of c.jobs) expect(other).not.toContain(j.place);
      }
    }
  }, 300000);

  it("a flood program in a new town is that town's roads, around its own places", () => {
    for (const town of NEW) {
      const c = game.newCareer({ co: 'Program', loan: 350000, town }, 11);
      c.phase = 'play';
      c.won = c.won2 = c.won3 = true;
      c.ctenders = [];
      let t = null;
      for (let s = 0; !t && s < 80; s++) t = genMajor(seedRand(s), c as never, game.planCtx(c), 50, false);
      expect(t, town).toBeTruthy();
      expect(TOWNS[town].places).toContain(t!.area);
      for (const r of t!.roads) expect(ROADS[town as Exclude<TownId, 'gdi'>].map((n) => n + ' Rd')).toContain(r.name);
      for (const p of t!.pits) expect(PITS[town as Exclude<TownId, 'gdi'>]).toContain(p.name);
    }
  });

  it('distances between towns are the real ones, near enough', () => {
    expect(townKm('gdi', 'stg')).toBeGreaterThan(150);
    expect(townKm('gdi', 'stg')).toBeLessThan(220);
    expect(townKm('gdi', 'wei')).toBeGreaterThan(1800);
    expect(townKm('mbh', 'mky')).toBeLessThan(200);
  });
});
