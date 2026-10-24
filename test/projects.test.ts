// Feedlot and cotton field developments (Scott, 24 Oct): five stages one after another, each paid when it's done.
// A feedlot has a finish date and, done well, a pen-cleaning hire and an expansion; a cotton block must be level for
// planting, or it's docked and there's no next block.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COTTON_BLOCKS, DEV_LD, PLANT_DOCK, choose, compat, freeFor, game, genEnquiry, genOffers, plantWeek, projOdds, seedRand, monthIdx, type FarmEnquiry, type TownId,
} from '../src';
import { bulkLine } from '../src/text/bulk';
import { offerLabel } from '../src/text/work';

type Career = game.Career;
const outfit = (town: TownId = 'gdi') => {
  const c = game.newCareer({ co: 'Developments', loan: 900000, town, path: 'bulk', bulk: true } as never, 3);
  c.phase = 'play';
  c.won = c.won2 = true;
  c.bank = 9e6;
  c.queue = [];
  c.fleet = [];
  const add = (type: string, extra = {}) => c.fleet.push({ id: 'x' + c.fleet.length, type, year: 2024, cond: 90, hours: 1000, svcAt: 1000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null, ...extra } as never);
  ['s651', 's651', 'd9', 'd9', 'c825', 'moxycart', 'grader', 'excavator', 'd8', 'loader'].forEach((t) => add(t, t === 's651' ? { laser: true } : {}));
  c.bulk = { enq: [], att: { laser: true, rake: true } };
  return c;
};
/** Win an enquiry at the price given, with every stage shrunk to a few days' work. */
const win = (c: Career, e: FarmEnquiry, small = 0.05) => {
  for (const s of e.stages!) { s.qty = Math.round(s.qty * small * 100) / 100; s.truth = Math.round(s.truth * small * 100) / 100; }
  e.quoted = Math.round(e.budget * 0.8);
  e.week = c.week - 1;
  c.bulk!.enq = [e];
};
const weeks = (c: Career, n: number, until?: (ev: { k: string }[]) => boolean) => {
  const all: any[] = [];
  for (let i = 0; i < n; i++) {
    const r = game.endWeek(c) as { events?: any[] } | null;
    for (let k = 0; c.queue.length && k < 30; k++) choose(c, 0);
    all.push(...(r?.events ?? []));
    if (until?.(r?.events ?? [])) break;
  }
  return all;
};

describe('feedlot and cotton developments', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('a feedlot is five stages, priced a head, the stages paid in shares that make up the price', () => {
    const e = genEnquiry(seedRand(9), outfit() as never, 1, 'feedlot');
    expect(e.stages!.map((s) => s.id)).toEqual(['strip', 'pens', 'drains', 'pond', 'roads']);
    expect(e.stages!.filter((s) => s.tested).map((s) => s.id)).toEqual(['pens', 'pond']);
    expect(e.vol % 100).toBe(0);
    expect(e.weeks).toBeGreaterThan(6);
    expect(e.stages!.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 6);
    const c = genEnquiry(seedRand(9), outfit() as never, 1, 'cotton');
    expect(c.stages!.map((s) => s.id)).toEqual(['clear', 'level', 'supply', 'tail', 'storage']);
    expect(c.stages!.map((s) => s.dk)).toEqual(['rake', 'laser', 'channel', 'channel', 'ringTank']);
  });

  it('feedlots ring around Dalby, cotton growers around St George; neither around Moranbah; never in the prototype', () => {
    const kinds = (town: TownId) => {
      const c = outfit(town), n: Record<string, number> = {};
      for (let s = 0; s < 600; s++) { const k = genEnquiry(seedRand(s), c as never, 1).kind; n[k] = (n[k] ?? 0) + 1; }
      return n;
    };
    const dby = kinds('dby'), stg = kinds('stg'), mbh = kinds('mbh');
    expect(dby.feedlot ?? 0).toBeGreaterThan((stg.feedlot ?? 0) * 2);
    expect(stg.cotton ?? 0).toBeGreaterThan((dby.cotton ?? 0) * 1.5);
    expect((mbh.cotton ?? 0) + 0).toBe(0);
    expect(projOdds('mbh', 'feedlot')).toBeLessThan(projOdds('dby', 'feedlot'));
    // not before your own contract
    const small = outfit();
    small.won2 = false;
    for (let s = 0; s < 300; s++) expect(['feedlot', 'cotton']).not.toContain(genEnquiry(seedRand(s), small as never, 1).kind);
    compat.prototype = true;
    const p = outfit();
    for (let s = 0; s < 300; s++) expect(['feedlot', 'cotton']).not.toContain(genEnquiry(seedRand(s), p as never, 1).kind);
    compat.prototype = false;
  });

  it('a feedlot is built stage by stage, each paid when done, and done well the feedlot wants its pens cleaned and more pens later', () => {
    const c = outfit('dby'), e = genEnquiry(seedRand(9), c as never, 1, 'feedlot');
    win(c, e);
    const ev = weeks(c, 40, (x) => x.some((y) => y.k === 'damDone'));
    const st = ev.filter((x) => x.k === 'stageDone');
    expect(st.map((x) => x.stage)).toEqual(['strip', 'pens', 'drains', 'pond', 'roads']);
    expect(st.reduce((a, x) => a + x.amt, 0)).toBe(e.quoted);
    expect(ev.filter((x) => x.k === 'damPassed' || x.k === 'damFailed').length).toBe(2);
    expect(bulkLine({ ...st[1], farm: e.farm, place: e.place, n: 2, of: 5 })).toContain('pen pads done, stage 2 of 5');
    // the gear's back in the yard
    expect(c.fleet.every((m) => m.status === 'idle' || m.down > 0)).toBe(true);
    // the pens: a loader on hire, offered once the week comes
    const P = c.bulk!.pens!;
    expect(P.client).toBe(e.farm);
    c.week = P.w;
    const o = genOffers(seedRand(1), c as never, 1, true, true).find((x) => x.pens)!;
    expect(o.type).toBe('loader');
    expect(o.kind).toBe('wet');
    expect(offerLabel(o)).toBe('FEEDLOT, WET');
    c.offers = [o];
    expect(game.accept(c, o.id)).toBe(true);
    expect(c.bulk!.pens).toBeUndefined();
    const j = c.jobs.find((x) => x.pens)!;
    j.done = j.days - 1;
    weeks(c, 2);
    expect(c.bulk!.pens?.client).toBe(e.farm);
    // and more pens, a year or so on
    expect((c as { later?: { k: string }[] }).later!.some((x) => x.k === 'feedlotMore')).toBe(true);
  });

  it('a feedlot finished late pays damages out of the last payment', () => {
    const c = outfit('dby'), e = genEnquiry(seedRand(9), c as never, 1, 'feedlot');
    e.weeks = 1;
    win(c, e, 0.2);
    const ev = weeks(c, 60, (x) => x.some((y) => y.k === 'damDone'));
    const st = ev.filter((x) => x.k === 'stageDone'), done = ev.findIndex((x) => x.k === 'damDone');
    expect(done).toBeGreaterThan(0);
    const paid = st.reduce((a, x) => a + x.amt, 0);
    expect(paid).toBeLessThan(e.quoted!);
    // a whole number of weeks' damages, to the nearest $100
    const wks = (e.quoted! - paid) / (DEV_LD * e.quoted!);
    expect(wks).toBeGreaterThan(0.95);
    expect(Math.abs(wks - Math.round(wks)) * DEV_LD * e.quoted!).toBeLessThanOrEqual(50);
  });

  it('a cotton block levelled in time brings the next block; one not level for planting is docked and that is the last', () => {
    const c = outfit('stg'), e = genEnquiry(seedRand(11), c as never, 1, 'cotton');
    win(c, e);
    const ev = weeks(c, 40, (x) => x.some((y) => y.k === 'damDone'));
    expect(ev.some((x) => x.k === 'plantMissed')).toBe(false);
    expect(ev.filter((x) => x.k === 'stageDone').reduce((a, x) => a + x.amt, 0)).toBe(e.quoted);
    const L = (c as { later?: { k: string; block?: number; w: number }[] }).later!.find((x) => x.k === 'cottonBlock')!;
    expect(L.block).toBe(2);
    c.week = L.w;
    weeks(c, 1);
    const next = c.bulk!.enq.find((x) => x.kind === 'cotton')!;
    expect(next.farm).toBe(e.farm);
    expect(next.block).toBe(2);
    expect(c.bulk!.promise?.farm).toBe(e.farm);
    expect(COTTON_BLOCKS).toBe(3);

    // now one with no laser gear: the fields can't be levelled, and planting comes and goes
    const d = outfit('stg'), f = genEnquiry(seedRand(11), d as never, 1, 'cotton');
    d.fleet = d.fleet.filter((m) => m.type !== 's651');
    win(d, f);
    const ev2 = weeks(d, 50, (x) => x.some((y) => y.k === 'plantMissed'));
    const miss = ev2.find((x) => x.k === 'plantMissed')!;
    expect(miss.dock).toBe(Math.round((f.quoted! * PLANT_DOCK) / 100) * 100);
    const j = d.jobs.find((x) => x.proj === 'cotton')!;
    expect(monthIdx(j.plantBy as number)).toBe(9);
    expect(j.plantBy).toBe(plantWeek(j.won as number));
  });

  it('laser work takes a dozer to push open-bowl scrapers in the real game, not in the prototype', () => {
    const c = outfit();
    expect(freeFor(c as never, 'laser').map((m) => m.type).sort()).toEqual(['d9', 's651', 's651', 'grader'].sort());
    compat.prototype = true;
    expect(freeFor(c as never, 'laser').map((m) => m.type).sort()).toEqual(['s651', 's651', 'grader'].sort());
    compat.prototype = false;
  });
});
