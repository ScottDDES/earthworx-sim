// The workshop week and the running costs against the prototype.

import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY, MGR, NAMES, WHS_SYS, YARDS, YARD_ORDER, costIdx, fitterWeek, fleetValue, int, newAccounts,
  overheads, pick, premParts, premium, seedRand, wages, workshopCtx, wsmWeek, type Difficulty, type Garage,
  type Machine, type MachineType, type Person, type Role, type Trait, type WorkshopEvent, type YardId,
} from '../src';
import { sameLines, jobPairs } from './docketWords';
import { diaryMark, diarySame } from './diaryCheck';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const KINDS: MachineType[] = ['grader', 'roller', 'cart', 'truck'];
const LOAN_FOR: Record<Difficulty, number> = { easy: 350000, normal: 180000, hard: 80000, hc: 80000 };

function protoCareer(o: Record<string, unknown>): any {
  return { week: 1, town: 'gdi', fleet: [], staff: [], yard: 'home', jobs: [], queue: [], log: [], bank: 1e6, recv: [], seq: 0, loanStart: 180000, hardcore: false, ins: 1, ...o };
}

function randomMachine(R: () => number, i: number): Machine {
  const m: Machine = {
    id: 'm' + i, type: pick(R, KINDS), year: int(R, 1998, 2027), cond: int(R, 15, 95), hours: int(R, 2000, 20000),
    svcAt: 0, status: pick(R, ['idle', 'idle', 'idle', 'working', 'listed', 'branch']), down: R() < 0.1 ? int(R, 1, 4) : 0,
    cover: 0, warranty: 0, jobId: null, sale: null,
  };
  m.svcAt = m.hours - int(R, 150, 320); // most near due, some overdue
  if (R() < 0.2) m.band = { part: 'worn kingpins', fix: int(R, 12, 55) * 100, w: 1 };
  if (R() < 0.1) m.toSnooze = int(R, 1, 300);
  return m;
}

/** A random business: yard, fleet, fitters and maybe a workshop manager, money tight or flush. */
function randomGarage(R: () => number) {
  const d: Difficulty = pick(R, ['easy', 'normal', 'hard', 'hc']);
  const yard: YardId = pick(R, YARD_ORDER), week = int(R, 1, 400);
  const fleet = Array.from({ length: int(R, 1, 22) }, (_, i) => randomMachine(R, i));
  const staff: Person[] = [];
  for (let i = 0, n = int(R, 0, 4); i < n; i++) staff.push({ id: 'f' + i, name: NAMES[i]!, role: 'fitter', skill: 'solid', wage: 1600, off: R() < 0.1 ? 1 : 0, jobId: null });
  if (R() < 0.6) {
    const t = pick(R, ['dealer', 'diesel', 'planner'] as Trait[]);
    staff.push({ id: 'w', name: 'Leanne', role: 'wsm', skill: 'solid', wage: MGR[t].wage, off: 0, jobId: null, trait: t });
  }
  if (R() < 0.3) staff.push({ id: 'g', name: 'Mick', role: pick(R, ['grader', 'roller'] as Role[]), skill: 'solid', wage: 2100, off: 0, jobId: null });
  const bank = pick(R, [-30000, 2000, 15000, 80000, 600000]);
  const won = R() < 0.7, won2 = won && R() < 0.6;
  const queue: any[] = R() < 0.2 ? [{ k: 'turnover', id: 'm0', by: 'Leanne' }] : [];
  return { d, yard, week, fleet, staff, bank, won, won2, queue };
}

function both(R: () => number) {
  const x = randomGarage(R);
  const S = protoCareer({
    week: x.week, yard: x.yard, fleet: JSON.parse(JSON.stringify(x.fleet)), staff: JSON.parse(JSON.stringify(x.staff)), bank: x.bank,
    won: x.won, won2: x.won2, queue: JSON.parse(JSON.stringify(x.queue)), loanStart: LOAN_FOR[x.d], hardcore: x.d === 'hc',
    acc: { b0: x.bank, jc: 0, jco: 0, ws: 0, cap: 0, loan: 0, coll: 0, md: 0, brk: 0, bd: 0 },
  });
  const g: Garage = { week: x.week, bank: x.bank, fleet: x.fleet, staff: x.staff, yard: x.yard, acc: newAccounts(x.bank), queue: x.queue };
  const home = g.fleet.filter((m) => m.status !== 'branch').length;
  const ctx = workshopCtx(g.staff, home, YARDS[g.yard].svc, DIFFICULTY[x.d].brk, costIdx(x.week, x.d));
  return { S, g, ctx, x };
}

function expectSame(g: Garage, S: any) {
  expect(g.fleet).toEqual(S.fleet);
  expect(g.bank).toBeCloseTo(S.bank, 6);
  expect(g.acc.workshop).toBeCloseTo(S.acc.ws, 6);
  expect(g.queue).toEqual(S.queue);
}

/** The kinds of diary line the workshop tests checked. */
const found = new Set<string>();

describe('the workshop week', () => {
  it('fitters service the same machines, find the same faults, and charge the same', () => {
    const R = seedRand(31);
    let work = 0;
    for (let i = 0; i < 3000; i++) {
      const { S, g, ctx } = both(R), seed = int(R, 1, 1e9);
      P.setS(S);
      const rep = { events: [] as string[], costs: 0 };
      const mk = diaryMark(P, g);
      P.withRNG(P.seedRand(seed), () => P.fitterWeek(rep));
      const ev: WorkshopEvent[] = [];
      const cost = fitterWeek(seedRand(seed), g, ctx, ev);
      for (const k of diarySame(P, g, mk)) found.add(k);
      expectSame(g, S);
      expect(cost).toBe(rep.costs);
      expect(ev.some((e) => e.k === 'fitterWork')).toBe(rep.events.some((e) => / in the workshop: /.test(e)));
      sameLines(g, ev, rep.events);
      if (cost) work++;
    }
    expect(work).toBeGreaterThan(300);
  });

  it('the workshop manager books the same services, fixes, fitter requests and turnover calls', () => {
    const R = seedRand(32);
    let turn = 0, short = 0, booked = 0;
    for (let i = 0; i < 3000; i++) {
      const { S, g, ctx } = both(R), seed = int(R, 1, 1e9);
      P.setS(S);
      const od = P.odLimit();
      const rep = { events: [] as string[], costs: 0 };
      const mk = diaryMark(P, g);
      P.withRNG(P.seedRand(seed), () => P.wsmWeek(rep));
      const ev: WorkshopEvent[] = [];
      const cost = wsmWeek(seedRand(seed), g, ctx, od, ev);
      for (const k of diarySame(P, g, mk)) found.add(k);
      expectSame(g, S);
      expect(cost).toBe(rep.costs);
      expect(ev.some((e) => e.k === 'shortFitters')).toBe(rep.events.some((e) => /more fitter/.test(e)));
      sameLines(g, ev, rep.events);
      if (g.queue.some((q) => q.k === 'turnover')) turn++;
      if (ev.some((e) => e.k === 'shortFitters')) short++;
      if (cost) booked++;
    }
    expect(turn).toBeGreaterThan(100);
    expect(short).toBeGreaterThan(20);
    expect(booked).toBeGreaterThan(300);
    console.log('workshop diary: ' + [...found].sort().join(', '));
  });

  it('turnover is called at the same condition for each kind of workshop manager', () => {
    for (const t of ['dealer', 'diesel', 'planner'] as Trait[]) {
      for (let cond = 30; cond <= 55; cond += 0.5) {
        const m: Machine = { id: 'm1', type: 'grader', year: 2010, cond, hours: 9000, svcAt: 9000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null };
        const staff: Person[] = [{ id: 'w', name: 'Leanne', role: 'wsm', skill: 'solid', wage: 3000, off: 0, jobId: null, trait: t }];
        const S = protoCareer({ week: 8, yard: 'depot', fleet: [JSON.parse(JSON.stringify(m))], staff, acc: { ws: 0 } });
        P.setS(S);
        P.withRNG(P.seedRand(1), () => P.wsmWeek({ events: [], costs: 0 }));
        const g: Garage = { week: 8, bank: 1e6, fleet: [m], staff, yard: 'depot', acc: newAccounts(0), queue: [] };
        wsmWeek(seedRand(1), g, workshopCtx(staff, 1, 0.7, 1, 1), 0, []);
        expect(g.queue).toEqual(S.queue);
      }
    }
  });
});

describe('running costs', () => {
  it('insurance and the weekly running costs match', () => {
    const R = seedRand(33);
    for (let i = 0; i < 3000; i++) {
      const { S, g, x } = both(R);
      const sys = int(R, 0, 3), talks = R() < 0.4, ins = pick(R, [1, 1, 1.12, 1.4]);
      const insHard = R() < 0.2 ? x.week + int(R, -5, 30) : undefined, insX = R() < 0.5 ? 1.35 : undefined;
      // crews out: a few running subbie jobs (rain would stop them)
      const crews = int(R, 0, 3);
      S.jobs = Array.from({ length: crews }, (_, k) => ({ id: 'j' + k, kind: 'sub', state: 'running', finished: false }));
      S.whs = { sys, talks, cult: 50, hz: 0, inc: [], nm: 0 };
      Object.assign(S, { ins, insHard, insX });
      P.setS(S);

      const fv = fleetValue(g.fleet, x.week);
      expect(fv).toBe(P.fleetValue());
      const parts = premParts(fv, wages(g.staff));
      expect(parts).toEqual(P.premParts());
      const prem = premium(parts, { ins, insHard, insX }, sys, x.week);
      expect(prem).toBe(P.premium());
      expect(overheads({ premium: prem, rent: YARDS[g.yard].rent, wages: wages(g.staff), whsSys: sys, talks, crews, costIdx: costIdx(x.week, x.d) })).toBe(P.overheads());
    }
    expect([...WHS_SYS]).toEqual(P.WHS_SYS);
  });
});
