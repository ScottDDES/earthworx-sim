// A flood recovery program planned in more detail (Scott, 23 Oct): each road's gravel from the nearest pit
// (borderline, $5/m³) or the good pit further out ($3/m³), its water from the usual point or a landholder's bore,
// and each crew's own cost, pace and people.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BORE_FEE, BORE_KM, ROY_GOOD, ROY_NEAR, compat, game, genMajor, roadAs, seedRand, signOwn } from '../src';

const program = (seed = 11) => {
  const c = game.newCareer({ co: 'Program', loan: 350000, town: 'gdi' }, seed);
  c.phase = 'play';
  c.won = c.won2 = c.won3 = true;
  c.ctenders = [];
  let t = null;
  for (let s = seed; !t && s < seed + 50; s++) t = genMajor(seedRand(s), c as never, game.planCtx(c), 50, false);
  game.openProgram(c, t!.id);
  return { c, t: t! };
};

describe('program planning, road by road', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it("a road's gravel and water: the good pit is further and cheaper a m³, a bore is closer for a fee", () => {
    const { c, t } = program();
    const ri = t.roads.findIndex((r) => r.resheet > 0 && (r.water ?? 0) > BORE_KM);
    expect(ri).toBeGreaterThanOrEqual(0);
    const near = roadAs(t, t.pl.prog, ri);
    expect([near.roy, near.good, near.bore]).toEqual([ROY_NEAR, false, false]);
    const before = game.evaluate(c, t.id)!.e;
    game.programAct(c, t.id, { op: 'pit', road: ri, v: 1 });
    game.programAct(c, t.id, { op: 'bore', road: ri, v: 1 });
    const good = roadAs(t, t.pl.prog, ri), after = game.evaluate(c, t.id)!.e;
    expect(good.roy).toBe(ROY_GOOD);
    expect(good.haul!).toBeGreaterThanOrEqual(near.haul! + 6);
    expect(good.water).toBe(BORE_KM);
    const rd = t.roads[ri]!;
    expect(before.c.royalty - after.c.royalty).toBe(rd.resheet * (ROY_NEAR - ROY_GOOD));
    expect(after.c.site - before.c.site).toBeGreaterThanOrEqual(BORE_FEE);
    // and back again
    game.programAct(c, t.id, { op: 'pit', road: ri, v: 0 });
    game.programAct(c, t.id, { op: 'bore', road: ri, v: 0 });
    expect(game.evaluate(c, t.id)!.e.c.royalty).toBe(before.c.royalty);
  });

  it("each crew's cost, people and share: the crews add up to the job, less what they share (mobilisation, site, loader)", () => {
    const { c, t } = program(17);
    game.programAct(c, t.id, { op: 'add' });
    game.programAct(c, t.id, { op: 'auto' });
    const e = game.evaluate(c, t.id)!.e;
    const crews = e.res!.reduce((a, R) => a + (R.cost ?? 0), 0), shared = e.c.mob + e.c.site + (e.c.loader ?? 0) - (e.c.site - 1200 * e.wks);
    for (const R of e.res!) expect(R.cost).toBeGreaterThan(0);
    expect(Math.abs(crews + shared - e.cost)).toBeLessThan(e.cost * 0.02);
  });

  it("once won, the gravel is borderline only if most of it comes from the nearest pits", () => {
    const won = (good: boolean) => {
      const { c, t } = program(23);
      if (good) for (let i = 0; i < t.roads.length; i++) game.programAct(c, t.id, { op: 'pit', road: i, v: 1 });
      game.submitCouncil(c, t.id);
      return signOwn(c as never, game.planCtx(c), t).marginal;
    };
    expect(won(false)).toBe(true);
    expect(won(true)).toBe(false);
  });

  it('the prototype works every road as it comes', () => {
    compat.prototype = true;
    const { t } = program();
    const r = roadAs(t, { crews: [], pits: { 0: 1 }, bores: { 0: 1 } }, 0);
    expect(r.haul).toBe(t.roads[0]!.haul);
    expect(r.water).toBe(t.roads[0]!.water);
    compat.prototype = false;
  });
});
