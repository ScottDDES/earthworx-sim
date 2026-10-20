// Roadtrains: a side tipper with a second trailer (the real game only).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RT_COST, choose, compat, game, genCouncil, planEval, rtM3, rtWorth, seedRand, signOwn, truckM3, value, type CouncilTender, type Machine } from '../src';

const truck = (id: string, rt = false): Machine => ({ id, type: 'truck', year: 2016, cond: 85, hours: 9000, svcAt: 9000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null, ...(rt ? { rt: true } : {}) });

function withTender(seed: number, rts: boolean) {
  const c = game.newCareer({ co: 'Haul Test', loan: 350000, town: 'gdi' }, seed);
  game.open(c);
  c.won = c.won2 = true;
  c.fleet.push(truck('T1', rts), truck('T2', rts));
  for (let g = 0; g < 200 && !c.ctenders.some((t) => t.q.resheet > 2000 && !t.major); g++) genCouncil(seedRand(seed * 1000 + g), c as never, game.planCtx(c), 1);
  const t = c.ctenders.find((x) => x.q.resheet > 2000 && !x.major)!;
  t.pl.trucks = 1;
  t.pl.pit = t.pits[1] && t.pits[1].haul > t.pits[0]!.haul ? 1 : 0;
  return { c, t };
}

function work(c: ReturnType<typeof withTender>['c'], t: CouncilTender) {
  t.bid = 900000;
  t.mine = { method: 0, oh: 0, cost: 0, pl: t.pl };
  const j = signOwn(c as never, game.planCtx(c), t);
  for (let w = 0; w < 40 && !j.finished && c.phase === 'play'; w++) {
    c.bank = 2e6;
    for (let k = 0; c.queue.length && k < 30; k++) choose(c, 0);
    game.endWeek(c);
  }
  return j;
}

describe('roadtrains', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('carts about half as much again as a single on a normal haul, a bit less without a loader', () => {
    expect(rtWorth(10)).toBeGreaterThan(1.4);
    expect(rtWorth(10, false)).toBeLessThan(rtWorth(10));
    expect(rtM3(10)).toBeGreaterThan(truckM3(10));
  });

  it('a side tipper can be upgraded, for a price, and is worth more for it', () => {
    const c = game.newCareer({ co: 'Haul Test', loan: 350000, town: 'gdi' }, 2);
    c.fleet.push(truck('T1'), { ...truck('G1'), type: 'grader' });
    const bank = c.bank = 200000, before = value(c.fleet[c.fleet.length - 2]!, c.week);
    expect(game.upgradeRoadtrain(c, 'G1')).toBe(false);
    expect(game.upgradeRoadtrain(c, 'T1')).toBe(true);
    expect(c.bank).toBe(bank - RT_COST);
    expect(game.upgradeRoadtrain(c, 'T1')).toBe(false);
    const m = c.fleet.find((x) => x.id === 'T1')!;
    expect(m.rt).toBe(true);
    expect(value(m, c.week)).toBeGreaterThan(before);
    compat.prototype = true;
    c.fleet.push(truck('T3'));
    expect(game.upgradeRoadtrain(c, 'T3')).toBe(false);
    compat.prototype = false;
  });

  it('on a council plan your roadtrains go first, cart more and burn more', () => {
    const a = withTender(4, false), b = withTender(4, true);
    const ea = planEval(game.planCtx(a.c), a.t, a.t.pl), eb = planEval(game.planCtx(b.c), b.t, b.t.pl);
    expect(eb.sDays).toBeLessThan(ea.sDays * 0.9);
    expect(eb.c.fuel / eb.sDays).toBeGreaterThan(ea.c.fuel / ea.sDays);
  });

  it('on the job they get the gravel in sooner', () => {
    const a = withTender(6, false), b = withTender(6, true);
    const ja = work(a.c, a.t), jb = work(b.c, b.t);
    expect(ja.finished && jb.finished).toBe(true);
    expect(jb.done).toBeLessThan(ja.done * 0.92);
  });

  it('they come up in the market, and buying one gets you a roadtrain', () => {
    const c = game.newCareer({ co: 'Haul Test', loan: 350000, town: 'gdi' }, 9);
    game.open(c);
    let bought = false;
    for (let w = 0; w < 30 && !bought && c.phase === 'play'; w++) {
      c.bank = 2e6;
      const l = c.market!.listings.find((x) => x.rt);
      if (l) { game.buy(c, l.id); bought = c.fleet.some((m) => m.rt); break; }
      for (let k = 0; c.queue.length && k < 30; k++) choose(c, 0);
      game.endWeek(c);
    }
    expect(bought).toBe(true);
  });
});
