// A loader at the gravel pit (the real game only).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TYPES, choose, compat, game, genCouncil, loaderDay, planEval, seedRand, setPlan, signOwn, truckM3, type CouncilTender, type Machine } from '../src';

const loader = (id: string): Machine => ({ id, type: 'loader', year: 2016, cond: 85, hours: 9000, svcAt: 9000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null });

/** A career with a council package in front of it that has gravel in it. */
function withTender(seed: number) {
  const c = game.newCareer({ co: 'Pit Test', loan: 350000, town: 'gdi' }, seed);
  game.open(c);
  c.won = c.won2 = true;
  for (let g = 0; g < 200 && !c.ctenders.some((t) => t.q.resheet > 2000 && !t.major); g++) genCouncil(seedRand(seed * 1000 + g), c as never, game.planCtx(c), 1);
  const t = c.ctenders.find((x) => x.q.resheet > 2000 && !x.major)!;
  return { c, t };
}

/** Sign it as planned and work it through; what it took. */
function work(c: ReturnType<typeof withTender>['c'], t: CouncilTender) {
  t.bid = 900000;
  t.mine = { method: 0, oh: 0, cost: 0, pl: t.pl };
  const j = signOwn(c as never, game.planCtx(c), t);
  let costs = 0, w = 0, ldrBusy = false;
  for (; w < 40 && !j.finished && c.phase === 'play'; w++) {
    c.bank = 2e6;
    for (let k = 0; c.queue.length && k < 30; k++) choose(c, 0);
    const r = game.endWeek(c);
    if (r) costs += r.costs;
    if (c.fleet.some((m) => m.type === 'loader' && m.jobId === j.id)) ldrBusy = true;
  }
  return { j, w, costs, ldrBusy };
}

describe('a loader at the gravel pit', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('without one the trucks wait their turn on the pit loader, so each brings in less', () => {
    expect(truckM3(10, false)).toBeLessThan(truckM3(10) * 0.65);
    compat.prototype = true;
    expect(truckM3(10, false)).toBe(truckM3(10));
    compat.prototype = false;
  });

  it('the plan prices it on carting days: dry hire, a subbie, or your own if one is free', () => {
    const { c, t } = withTender(3);
    const pc = game.planCtx(c);
    const dry = planEval(pc, t, t.pl);
    expect(dry.c.loader).toBeGreaterThan(0);
    t.pl.hm = { ...(t.pl.hm || {}), loader: 'wet' };
    const wet = planEval(pc, t, t.pl);
    expect(wet.c.loader! / dry.c.loader!).toBeCloseTo(loaderDay('wet').cost / loaderDay('dry').cost, 1);
    c.fleet.push(loader('L1'));
    const own = planEval(pc, t, t.pl);
    expect(own.c.loader).toBeLessThan(dry.c.loader!);
    c.fleet.pop();
    setPlan(pc, t, 'loader', -1);
    expect(t.pl.loader).toBe(0);
    const none = planEval(pc, t, t.pl);
    expect(none.c.loader).toBe(0);
    expect(none.sDays).toBeGreaterThan(dry.sDays);
  });

  it('on the job: no loader takes longer, and your own goes out to the pit and comes home after', () => {
    const a = withTender(5), b = withTender(5);
    b.t.pl.loader = 0;
    a.c.fleet.push(loader('L1'));
    const withL = work(a.c, a.t), without = work(b.c, b.t);
    expect(withL.j.finished && without.j.finished).toBe(true);
    expect(without.j.done).toBeGreaterThan(withL.j.done * 1.15);
    expect(withL.ldrBusy).toBe(true);
    expect(a.c.fleet.find((m) => m.id === 'L1')!.jobId).toBeNull();
    expect(a.c.fleet.find((m) => m.id === 'L1')!.hours).toBeGreaterThan(9000);
  });

  it('the market turns one up now and then', () => {
    const c = game.newCareer({ co: 'Pit Test', loan: 350000, town: 'gdi' }, 8);
    game.open(c);
    let seen = 0;
    for (let w = 0; w < 30 && c.phase === 'play'; w++) {
      c.bank = 2e6;
      for (let k = 0; c.queue.length && k < 30; k++) choose(c, 0);
      game.endWeek(c);
      if (c.market!.listings.some((l) => l.type === 'loader')) seen++;
    }
    expect(seen).toBeGreaterThan(3);
    expect(TYPES.loader).toMatchObject({ wet: 1700, fuel: 600, dry: 4000 });
  });
});
