// Roadtrains: a side tipper with a second trailer (the real game only).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crewRoad, rtRoad, rtShare, RT_COST, RT_HIRE_DAY, TRUCK_DAY, choose, setPlan, compat, game, genCouncil, planEval, rtM3, rtWorth, seedRand, signOwn, truckM3, value, type CouncilTender, type Machine } from '../src';

const truck = (id: string, rt = false): Machine => ({ id, type: 'truck', year: 2016, cond: 85, hours: 9000, svcAt: 9000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null, ...(rt ? { rt: true } : {}) });

function withTender(seed: number, rts: boolean, own = true) {
  const c = game.newCareer({ co: 'Haul Test', loan: 350000, town: 'gdi' }, seed);
  game.open(c);
  c.won = c.won2 = true;
  if (own) c.fleet.push(truck('T1', rts), truck('T2', rts));
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

  it('the hired trucks can be roadtrains: dearer a day, more gravel in, and the job gets done sooner', () => {
    const a = withTender(6, false, false), b = withTender(6, false, false);
    setPlan(game.planCtx(b.c), b.t, 'rtHire', 1);
    expect(b.t.pl.rtHire).toBe(1);
    const ea = planEval(game.planCtx(a.c), a.t, a.t.pl), eb = planEval(game.planCtx(b.c), b.t, b.t.pl);
    expect(eb.hiredTrucks).toBeGreaterThan(0);
    expect(eb.sDays).toBeLessThan(ea.sDays * 0.9);
    expect(eb.c.trucks / eb.sDays).toBeCloseTo((ea.c.trucks / ea.sDays) * (RT_HIRE_DAY / TRUCK_DAY), -1);
    const ja = work(a.c, a.t), jb = work(b.c, b.t);
    expect(ja.finished && jb.finished).toBe(true);
    expect(jb.done).toBeLessThan(ja.done * 0.92);
  });

  it("some roads aren't rated for roadtrains: there they cart as singles", () => {
    const names = Array.from({ length: 400 }, (_, i) => 'Test Rd ' + i), rated = names.filter(rtRoad).length / names.length;
    expect(rated).toBeGreaterThan(0.5);
    expect(rated).toBeLessThan(0.8);
    const unrated = names.filter((n) => !rtRoad(n));
    const a = withTender(4, false), b = withTender(4, true), c = withTender(4, true);
    c.t.roads.forEach((r, i) => { r.name = unrated[i]!; });
    expect(rtShare(c.t)).toBe(0);
    const pa = game.planCtx(a.c), pb = game.planCtx(b.c), pc = game.planCtx(c.c);
    const ea = planEval(pa, a.t, a.t.pl), eb = planEval(pb, b.t, b.t.pl), ec = planEval(pc, c.t, c.t.pl);
    expect(eb.sDays).toBeLessThan(ea.sDays);
    expect(ec.sDays).toBeCloseTo(ea.sDays, 6);
    // and on the job: a package of unrated roads takes as long with roadtrains as with singles
    const ja = work(a.c, a.t), jc = work(c.c, c.t);
    expect(Math.abs(jc.done - ja.done)).toBeLessThan(ja.done * 0.08);
    compat.prototype = true;
    expect(unrated.every(rtRoad)).toBe(true);
    compat.prototype = false;
  });

  it('on a program each road is checked: roadtrains speed the rated ones only', () => {
    const names = Array.from({ length: 50 }, (_, i) => 'Prog Rd ' + i), yes = names.find(rtRoad)!, no = names.find((n) => !rtRoad(n))!;
    const rd = (name: string) => ({ name, L: 5, hfg: 5, mfg: 0, lfg: 0, resheet: 1500, haul: 25, water: 6 }) as any, crew = { sub: false, gr: 1, ro: 1, ca: 2, tr: 1 };
    expect(crewRoad({}, crew, rd(yes), true, 1).s).toBeLessThan(crewRoad({}, crew, rd(yes), true, 0).s);
    expect(crewRoad({}, crew, rd(no), true, 1).s).toBe(crewRoad({}, crew, rd(no), true, 0).s);
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
