// Machines, yards and difficulty against the prototype.

import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY, PARTS, TYPES, YARDS, YARD_ORDER, baseValue, breakChance, breakdown, breaks, costIdx,
  difficultyOf, int, serviced, machineName, newAccounts, newMachine, overdue, pick, seedRand, serviceFind, svcCost,
  svcLeft, value, wear, type Difficulty, type Machine, type MachineType, type WorkshopCtx, type YardId,
} from '../src';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const KINDS: MachineType[] = ['grader', 'roller', 'cart', 'truck'];
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'hc'];
// A starting loan for each difficulty, the way the prototype records it.
const LOAN_FOR: Record<Difficulty, number> = { easy: 350000, normal: 180000, hard: 80000, hc: 80000 };

/** A bare prototype career with just what the machine code reads. */
function protoCareer(o: Record<string, unknown>): any {
  return { week: 1, town: 'gdi', fleet: [], staff: [], yard: 'home', jobs: [], queue: [], log: [], bank: 1e6, recv: [], seq: 0, loanStart: 180000, hardcore: false, ...o };
}

/** A random machine, the same shape in both engines. */
function randomMachine(R: () => number, i: number): Machine {
  const m: Machine = {
    id: 'm' + i, type: pick(R, KINDS), year: int(R, 1998, 2027), cond: int(R, 10, 100), hours: int(R, 2000, 20000),
    svcAt: 0, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null,
  };
  m.svcAt = m.hours - int(R, 0, 400); // some due, some overdue
  if (R() < 0.2) m.gps = true;
  if (m.type === 'roller' && R() < 0.3) m.multi = true;
  if (R() < 0.15) m.band = { part: 'worn kingpins', fix: int(R, 12, 55) * 100, w: 1 };
  return m;
}

/** A random workshop set-up, in both engines' terms. */
function randomWorkshop(R: () => number) {
  const yard: YardId = pick(R, YARD_ORDER);
  const d: Difficulty = pick(R, DIFFS);
  const week = int(R, 1, 400);
  const fleetN = int(R, 1, 20), fitters = int(R, 0, 3), wsm = pick(R, [null, null, 'dealer', 'diesel', 'planner'] as const);
  const fleet = Array.from({ length: fleetN }, (_, i) => randomMachine(R, i));
  const staff: any[] = Array.from({ length: fitters }, (_, i) => ({ id: 'f' + i, role: 'fitter', off: 0 }));
  if (wsm) staff.push({ id: 'w', role: 'wsm', off: 0, trait: wsm });
  const S = protoCareer({ week, yard, fleet: JSON.parse(JSON.stringify(fleet)), staff, loanStart: LOAN_FOR[d], hardcore: d === 'hc' });
  P.setS(S);
  const ctx: WorkshopCtx = { yardSvc: YARDS[yard].svc, fitCov: P.fitCov(), wsm, bigNoWsm: P.bigNoWsm(), brk: DIFFICULTY[d].brk, costIdx: costIdx(week, d) };
  return { S, ctx, fleet, week };
}

describe('tables', () => {
  it('machine types, yards, difficulties and parts are the same', () => {
    expect(TYPES).toEqual(P.TYPES);
    expect(YARDS).toEqual(P.YARDS);
    expect(DIFFICULTY).toEqual(P.DIFF_P);
    expect(PARTS).toEqual(P.PARTS);
  });

  it('the starting loan sets the same difficulty, and inflation runs the same', () => {
    for (let loan = 0; loan <= 500_000; loan += 10_000) {
      P.setS(protoCareer({ loanStart: loan }));
      expect(difficultyOf(loan)).toBe(P.diffOf(loan) || 'normal');
    }
    for (const d of DIFFS) for (let w = 1; w <= 520; w += 7) {
      P.setS(protoCareer({ week: w, loanStart: LOAN_FOR[d], hardcore: d === 'hc' }));
      expect(costIdx(w, d)).toBe(P.costIdx());
    }
  });
});

describe('machines', () => {
  it('values match for 5,000 machines across 10 years', () => {
    const R = seedRand(11);
    for (let i = 0; i < 5000; i++) {
      const m = randomMachine(R, i), week = int(R, 1, 520);
      P.setS(protoCareer({ week }));
      expect(baseValue(m, week)).toBe(P.baseValue(m));
      expect(value(m, week)).toBe(P.value(m));
      expect(machineName(m)).toBe(P.mName(m));
      expect(overdue(m)).toBe(P.overdue(m));
      expect(svcLeft(m)).toBe(P.svcLeft(m));
    }
  });

  it('a new machine comes off the same roll', () => {
    for (let seed = 1; seed < 200; seed++) {
      P.setS(protoCareer({}));
      const theirs = P.withRNG(P.seedRand(seed), () => P.newMachine('grader', 2012, 64, 9100));
      const mine = newMachine(seedRand(seed), theirs.id, 'grader', 2012, 64, 9100);
      expect(mine).toEqual(theirs);
    }
  });

  it('service prices match in every yard, difficulty and year', () => {
    const R = seedRand(12);
    for (let i = 0; i < 2000; i++) {
      const { ctx, fleet } = randomWorkshop(R);
      for (const m of fleet) expect(svcCost(m, ctx)).toBe(P.svcCost(m));
    }
  });

  it('wear matches over eight weeks of work, overdue services included', () => {
    const R = seedRand(13);
    let above = 0;
    for (let i = 0; i < 200; i++) {
      const mine = randomMachine(R, i), theirs = JSON.parse(JSON.stringify(mine));
      const acc = newAccounts(0), S: any = protoCareer({});
      S.acc = { md: 0 };
      P.setS(S);
      // short enough that most machines stay above the floor of 10, so a wrong rate shows
      for (let d = 0; d < 40; d++) {
        const mult = pick(R, [1, 1, 1.8, 0.6]);
        wear(mine, mult, acc);
        P.wear(theirs, mult);
      }
      expect(mine).toEqual(theirs);
      expect(acc.machineDays).toBe(S.acc.md);
      if (mine.cond > 10) above++;
    }
    expect(above).toBeGreaterThan(100);
  });

  it('breakdowns: same odds, same rolls, same repair bills', () => {
    const R = seedRand(14);
    let broke = 0;
    for (let i = 0; i < 3000; i++) {
      const { S, ctx, fleet } = randomWorkshop(R);
      const k = int(R, 0, fleet.length - 1), mult = pick(R, [1, 1.5, 1.8]);
      const mine = fleet[k]!, theirs = S.fleet[k];
      const seed = int(R, 1, 1e9), mr = seedRand(seed);
      P.withRNG(P.seedRand(seed), () => {
        const a = breaks(mr, mine, mult, ctx), b = P.breaks(theirs, mult);
        expect(a).toBe(b);
        // break it anyway, to check the repair bill every time
        const acc = newAccounts(0);
        breakdown(mr, mine, ctx, acc);
        P.breakdown(theirs, { events: [] });
        if (a) broke++;
      });
      expect(mine).toEqual(theirs);
      expect(breakChance(mine, mult, ctx)).toBeGreaterThan(0);
    }
    expect(broke).toBeGreaterThan(20); // the roll did come up sometimes
  });

  it('a service turns up the same faults at the same price', () => {
    const R = seedRand(15);
    let found = 0;
    for (let i = 0; i < 3000; i++) {
      const { S, ctx, fleet } = randomWorkshop(R);
      // the prototype's workshop manager fixes finds themselves in a workshop: that's the workshop module's job, not this one
      if (ctx.wsm && ctx.yardSvc < 1) continue;
      const m = fleet[0]!, theirs = S.fleet[0];
      m.band = theirs.band = null;
      const by = R() < 0.5, seed = int(R, 1, 1e9);
      const mine = serviceFind(seedRand(seed), m, ctx, by);
      P.withRNG(P.seedRand(seed), () => P.svcFind(theirs, by ? 'Dave' : undefined));
      const q = S.queue.find((x: any) => x.k === 'svcfind');
      expect(mine).toEqual(q ? { part: q.part, fix: q.fix } : null);
      if (mine) found++;
    }
    expect(found).toBeGreaterThan(50);
  });
  it('a dealer service and a fitter service do the same as the prototype', () => {
    const R = seedRand(16);
    for (let i = 0; i < 300; i++) {
      // the Service button: a dealer service
      const { S, ctx, fleet } = randomWorkshop(R);
      const m = fleet[0]!, theirs = S.fleet[0];
      S.acc = null; S.won = S.won2 = S.won3 = false; S.tix = {}; S.stats = {}; S.coach = { off: true };
      const bank0 = S.bank;
      P.withRNG(seedRand(1), () => P.service(theirs.id));
      serviced(m, 'dealer');
      expect(m.cond).toBe(theirs.cond);
      expect(m.svcAt).toBe(theirs.svcAt);
      expect(bank0 - S.bank).toBe(svcCost(m, ctx));

      // a fitter in the workshop: one machine, due now
      const f = randomMachine(R, 99); f.svcAt = f.hours - 260; f.band = null;
      const S2: any = protoCareer({ yard: 'depot', fleet: [JSON.parse(JSON.stringify(f))], staff: [{ id: 'f', name: 'Dave', role: 'fitter', off: 0 }] });
      P.setS(S2);
      P.withRNG(seedRand(2), () => P.fitterWeek({ events: [], costs: 0 }));
      serviced(f, 'fitter');
      expect(f.cond).toBe(S2.fleet[0].cond);
      expect(f.svcAt).toBe(S2.fleet[0].svcAt);
    }
  });
});
