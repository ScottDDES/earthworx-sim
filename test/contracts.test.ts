// Running contracts against the prototype. The prototype sets each business up (signing subbie jobs, council
// packages and programs through its own code), then both run the same weeks side by side through the
// prototype's own week-loop code: staffing, the working days, hand-overs, claims, retention, damages, finishing.

import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY, NAMES, YARDS, addDays, autoPlan, canTakeBack, costIdx, dmap, dryDamBore, dryDamFar, dryDamFarMore, endOfDay,
  cutWork, programCheck, gravelArgue, gravelCart, gravelWork, int, jobDay, mgrIs, mkRivals, newAccounts, newLoan, newWhs, pick, pitFar, pitFarmer,
  seedRand, settleJob, staffOwn, staffSubs, startWeek, subOut, subQuotes, swapCardKeep, swapIn, takeBack, terminateWeek,
  variationFree, variationLodge, variationWriting, wetDay, workshopCtx,
  type ContractBiz, type ContractEvent, type Difficulty, type Job, type Machine, type MachineType, type Person, type Role,
  type TownId, type WeekReport,
} from '../src';
import { sameLines, jobPairs } from './docketWords';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const LOAN_FOR: Record<Difficulty, number> = { easy: 350000, normal: 180000, hard: 80000, hc: 80000 };
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function protoCareer(o: Record<string, unknown>): any {
  return { week: 30, town: 'gdi', wxStart: 0, fleet: [], staff: [], yard: 'depot', jobs: [], queue: [], log: [], news: [], bank: 300000, recv: [], seq: 0,
    co: 'Black Soil Earthmoving', loanStart: 180000, hardcore: false, ins: 1, rep: 15, blocked: {}, loan: newLoan(0), tenders: [], ctenders: [],
    subsWon: 0, ownWon: 0, tix: {}, stats: { earned: 0 }, whs: { ...newWhs(true), sys: 2 }, youJob: null, youBlocked: 0, opCover: 0, coverFor: null,
    won: true, won2: true, offers: [], payables: [], mkt: { f: 1.1, mood: 'steady' }, subsDone: 0, lds: 0, ownDone: 0, ownLate: 0, ...o };
}

function randomFleet(R: () => number): Machine[] {
  const out: Machine[] = [], add = (type: MachineType, n: number) => { for (let i = 0; i < n; i++) out.push({ id: 'm' + out.length, type, year: int(R, 2005, 2022), cond: int(R, 35, 95), hours: 9000, svcAt: 9000 - int(R, 0, 240), status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null, ...(type === 'grader' && R() < 0.4 ? { gps: true } : {}), ...(type === 'roller' && R() < 0.4 ? { multi: true } : {}) }); };
  add('grader', int(R, 1, 4)); add('roller', int(R, 1, 3)); add('cart', int(R, 1, 5)); add('truck', int(R, 0, 4));
  return out;
}

function randomStaff(R: () => number): Person[] {
  const roles: Role[] = ['grader', 'roller', 'cart', 'cart', 'truck'];
  const out: Person[] = Array.from({ length: int(R, 0, 6) }, (_, i) => ({ id: 'p' + i, name: NAMES[i]!, role: pick(R, roles), skill: 'solid' as const, wage: 1800, off: 0, jobId: null }));
  if (R() < 0.4) out.push({ id: 'sup', name: 'Leanne', role: 'super', skill: 'solid', wage: 2700, off: 0, jobId: null });
  if (R() < 0.3) out.push({ id: 'ops', name: 'Bec', role: 'ops', skill: 'solid', wage: 3400, off: 0, jobId: null, trait: pick(R, ['oldhand', 'numbers', 'younggun']) });
  return out;
}

/** A business with contracts on, set up by the prototype's own tender and signing code. */
function contractBusiness(R: () => number, opts: { empty?: boolean } = {}) {
  const town: TownId = pick(R, ['gdi', 'ct']), d: Difficulty = pick(R, ['easy', 'normal', 'hard', 'hc']);
  // 'empty': the gear's all listed for sale (still yours, so you can tender, but none free) and you're busy,
  // so whatever's signed waits to start
  const fleet = randomFleet(R);
  if (opts.empty) for (const m of fleet) m.status = 'listed';
  const S = protoCareer({ town, wxStart: int(R, 0, 10000), week: int(R, 20, 120), fleet, staff: randomStaff(R), youJob: opts.empty ? 'busy' : null,
    loanStart: LOAN_FOR[d], hardcore: d === 'hc', won3: R() < 0.4 });
  S.rivals = mkRivals(seedRand(int(R, 1, 1e9)), town);
  P.setS(S);
  P.withRNG(P.seedRand(int(R, 1, 1e9)), () => {
    P.dmap();
    // subbie jobs
    for (let n = 0, want = int(R, 0, 2); n < want; n++) {
      for (let g = 0; g < 40 && !S.tenders.length; g++) P.genTenders();
      const t = S.tenders.shift(); if (!t) break;
      t.bid = Math.round(P.tCost(t, 4250) * (1 + R() * 0.4) / 100) * 100;
      P.signSub(t);
    }
    // a council package or program
    if (R() < 0.75) {
      const major = S.won3 && R() < 0.5;
      for (let g = 0; g < 80 && !S.ctenders.length; g++) major ? P.genMajor() : P.genCouncil();
      const t = S.ctenders.shift();
      if (t && !P.capFull()) {
        if (t.major && R() < 0.7) t.pl.prog = P.autoPlan(t, int(R, 2, 4));
        S.ctenders.push(t); P.submitCouncil(t.id); S.ctenders = [];
        if (t.bid) P.signOwn(t);
      }
    }
  });
  if (R() < 0.2) S.youBlocked = 1;
  S.acc = { b0: 0, jc: 0, jco: 0, ws: 0, cap: 0, loan: 0, coll: 0, md: 0, brk: 0, bd: 0 };
  const b = clone(S) as ContractBiz;
  b.acc = newAccounts(0);
  return { S, b, d, wx: { town, wxStart: S.wxStart } };
}

function expectSame(b: ContractBiz, S: any) {
  expect(b.bank).toBeCloseTo(S.bank, 4);
  expect(b.fleet).toEqual(S.fleet);
  expect(b.staff).toEqual(S.staff);
  expect(b.jobs).toEqual(S.jobs);
  expect(b.recv).toEqual(S.recv);
  expect(b.payables).toEqual(S.payables);
  expect(b.rep).toBe(S.rep);
  expect(b.blocked).toEqual(S.blocked);
  expect(b.rel ?? {}).toEqual(S.rel ?? {});
  expect(b.youJob ?? null).toBe(S.youJob ?? null);
  expect(b.queue).toEqual(S.queue);
  expect(b.dmap).toEqual(S.dmap);
  expect(b.acc.jobCosts).toBeCloseTo(S.acc.jc, 4);
  expect(b.acc.jobCostsOwed).toBeCloseTo(S.acc.jco, 4);
  expect(b.acc.machineDays).toBe(S.acc.md);
  expect(b.acc.breakdowns).toBe(S.acc.brk);
  for (const k of ['subsDone', 'lds', 'ownDone', 'ownLate', 'majorDone', 'prestigeDone']) expect((b as any)[k] ?? 0, k).toBe(S[k] ?? 0);
}

/** One week of contracts on both sides. */
function runWeek(b: ContractBiz, S: any, d: Difficulty, wx: { town: TownId; wxStart: number }, seed: number, seen: Record<string, number>) {
  const prep: any = { worked: 0, lost: 0, invoiced: 0, paid: 0, costs: 0, events: [] }, pdd: Record<string, number> = {}, pairs = jobPairs(S, b);
  P.setS(S);
  P.withRNG(P.seedRand(seed), () => {
    P.__weekStart(prep);
    P.__startWeek();
    for (let day = 0; day < 5; day++) {
      const wet = P.wetDay(S.week, day);
      S.jobs.forEach((j: any) => P.__day(j, day, wet, prep, pdd));
      P.__afterDay(day, prep);
    }
    S.jobs.slice().forEach((j: any) => P.__settle(j, prep, pdd));
  });
  const rand = seedRand(seed), rep: WeekReport = { worked: 0, lost: 0, invoiced: 0, paid: 0, costs: 0 }, dd: Record<string, number> = {}, ev: ContractEvent[] = [];
  staffSubs(b, null);
  staffOwn(b, null);
  terminateWeek(b, ev);
  startWeek(b);
  for (let day = 0; day < 5; day++) {
    const wet = wetDay(wx, b.week, day);
    const w = workshopCtx(b.staff, b.fleet.filter((m) => m.status !== 'branch').length, YARDS[b.yard].svc, DIFFICULTY[d].brk, costIdx(b.week, d));
    for (const j of b.jobs) jobDay(rand, b, j, day, wet, w, rep, dd, ev);
    endOfDay(b, day, ev);
  }
  const oldhand = mgrIs(b.staff, 'oldhand');
  for (const j of b.jobs.slice()) settleJob(rand, b, j, rep, dd, oldhand, ev);
  expect(rep.worked).toBe(prep.worked);
  expect(rep.lost).toBe(prep.lost);
  expect(rep.costs).toBeCloseTo(prep.costs, 4);
  expect(rep.invoiced).toBeCloseTo(prep.invoiced, 4);
  expect(ev.length).toBe(prep.events.length);
  sameLines(b, ev, prep.events, pairs);
  for (const e of ev) seen[e.k] = (seen[e.k] || 0) + 1;
}

/** Between weeks: breakdowns fixed, swap-in cards answered the same way on both sides, the clock moves on. */
function betweenWeeks(R: () => number, b: ContractBiz, S: any, seen: Record<string, number>) {
  for (const q of S.queue.slice()) {
    if (q.k !== 'swapin') continue;
    P.setS(S);
    const c = P.curve({ ...q, sd: 1 });
    const mq = b.queue.find((x) => x.k === 'swapin' && x.id === q.id && x.type === q.type)!;
    if (c) {
      const i = int(R, 0, 1), j = b.jobs.find((x) => x.id === q.id)!;
      const m = b.fleet.find((x) => x.type === q.type && x.status === 'idle' && x.down === 0)!;
      P.withRNG(P.seedRand(1), () => c.opts[i].go());
      if (i === 0) swapIn(b, j, m, q.type); else swapCardKeep(b, j, q.type);
      seen['swap' + i] = (seen['swap' + i] || 0) + 1;
    }
    S.queue.splice(S.queue.indexOf(q), 1);
    b.queue.splice(b.queue.indexOf(mq), 1);
  }
  for (const m of b.fleet) if (m.down === 99) m.down = 0;
  for (const m of S.fleet) if (m.down === 99) m.down = 0;
  b.queue = b.queue.filter((x) => x.k !== 'break');
  S.queue = S.queue.filter((x: any) => x.k !== 'break');
  b.week++; S.week++;
  for (const p of b.staff) if (p.off > 0) p.off--;
  for (const p of S.staff) if (p.off > 0) p.off--;
  if (b.youBlocked > 0) { b.youBlocked--; S.youBlocked--; }
  if (R() < 0.04) { b.youBlocked = S.youBlocked = 1; }
  if (b.staff.length && R() < 0.06) { const k = int(R, 0, b.staff.length - 1); b.staff[k]!.off = S.staff[k].off = 1; }
}

describe('running contracts', () => {
  it('whole businesses run their contracts the same, week after week', () => {
    const R = seedRand(101);
    const seen: Record<string, number> = {};
    let kinds = { sub: 0, own: 0, prog: 0 };
    for (let i = 0; i < 160; i++) {
      const { S, b, d, wx } = contractBusiness(R);
      for (const j of S.jobs) { if (j.kind === 'sub') kinds.sub++; if (j.kind === 'own') { if (j.prog) kinds.prog++; else kinds.own++; } }
      expectSame(b, S);
      for (let wk = 0; wk < 40 && b.jobs.some((j) => j.kind === 'sub' || j.kind === 'own'); wk++) {
        runWeek(b, S, d, wx, int(R, 1, 1e9), seen);
        expectSame(b, S);
        betweenWeeks(R, b, S, seen);
      }
    }
    expect(kinds.sub).toBeGreaterThan(60);
    expect(kinds.own).toBeGreaterThan(20);
    expect(kinds.prog).toBeGreaterThan(5);
    for (const k of ['finished', 'subFinished', 'ownFinished', 'breakdown', 'crewHome', 'halfway', 'finishPoints']) expect(seen[k] ?? 0, k).toBeGreaterThan(2);
  });
});

describe('subbing out', () => {
  it('quotes, handing it over, the subbie working it, and taking it back', () => {
    const R = seedRand(102);
    const seen: Record<string, number> = {};
    let subbed = 0, back = 0;
    for (let i = 0; i < 300; i++) {
      // an empty yard: whatever's signed waits for gear, so it can be subbed out
      const { S, b, d, wx } = contractBusiness(R, { empty: true });
      const waiting = b.jobs.filter((j) => j.state === 'waiting');
      if (!waiting.length) continue;
      const j = pick(R, waiting), seed = int(R, 1, 1e9);
      P.setS(S);
      const theirs = P.withRNG(P.seedRand(seed), () => P.subQuotes(S.jobs.find((x: any) => x.id === j.id)));
      expect(subQuotes(seedRand(seed), b, j)).toEqual(theirs);
      if (!theirs.length) continue;
      const k = int(R, 0, theirs.length - 1);
      // sometimes most of it's already claimed, so the subbie's share hits its 97% cap
      if (j.kind === 'own' && R() < 0.4) { const pj = S.jobs.find((x: any) => x.id === j.id); pj.claimed = (j as any).claimed = Math.round(pj.price * (0.6 + R() * 0.35)); }
      P.subOut(j.id, k);
      subOut(seedRand(seed), b, j.id, k);
      expectSame(b, S);
      subbed++;
      for (let wk = 0; wk < 12; wk++) {
        runWeek(b, S, d, wx, int(R, 1, 1e9), seen);
        expectSame(b, S);
        betweenWeeks(R, b, S, seen);
        if (R() < 0.15 && !S.jobs.find((x: any) => x.id === j.id)?.finished) {
          // gear turns up: take it back
          const g = randomFleet(R);
          for (const m of g) { m.id = 'n' + wk + m.id; }
          b.fleet.push(...clone(g)); S.fleet.push(...clone(g));
          b.youJob = S.youJob = null; // and you're free again
          P.setS(S);
          const can = P.canTakeBack(S.jobs.find((x: any) => x.id === j.id) ?? {});
          const mj = b.jobs.find((x) => x.id === j.id);
          if (mj) expect(canTakeBack(b, mj)).toBe(can);
          P.takeBack(j.id);
          if (takeBack(b, j.id)) back++;
          expectSame(b, S);
        }
      }
    }
    expect(subbed).toBeGreaterThan(50);
    expect(back).toBeGreaterThan(5);
    expect(seen.subPulled ?? 0).toBeGreaterThan(2);
  });
});

describe('the council checks a program', () => {
  it('halfway and at the deadline: the same cuts, track record and events', () => {
    const R = seedRand(104);
    let cuts = 0, fine = 0, deadline = 0;
    for (let i = 0; i < 1500; i++) {
      const { S, b } = contractBusiness(R);
      const pj = S.jobs.find((x: any) => x.major);
      if (!pj) continue;
      const j = b.jobs.find((x) => x.id === pj.id)!;
      // anywhere from barely started to nearly done, at the halfway mark or past the deadline
      const left = R();
      pj.gLeft = (j as any).gLeft = pj.g0 * left; pj.sLeft = (j as any).sLeft = pj.s0 * left;
      S.week = b.week = R() < 0.7 ? pj.half : pj.due + 1;
      P.setS(S);
      const prep = { events: [] as string[] }, ev: ContractEvent[] = [];
      P.programCheck(pj, prep);
      programCheck(b, j, ev);
      expect(j).toEqual(pj);
      expect(b.rep).toBe(S.rep);
      expect(ev.length).toBe(prep.events.length);
      sameLines(b, ev, prep.events, [{ pj, bj: j }]);
      for (const e of ev) { if (e.k === 'halfway') { if (e.cut) cuts++; else fine++; } if (e.k === 'deadline') deadline++; }
    }
    expect(cuts).toBeGreaterThan(30);
    expect(fine).toBeGreaterThan(30);
    expect(deadline).toBeGreaterThan(30);
    const a: any = { g0: 10, s0: 2200, gLeft: 4, sLeft: 900, price: 500000, prog: null }, c = clone(a);
    expect(cutWork(a, 0.3)).toBe(P.cutWork(c, 0.3));
    expect(a).toEqual(c);
  });
});

describe('the contract cards', () => {
  it('variations, failed gravel, a dry dam and a worked-out pit', () => {
    const R = seedRand(103);
    let n = 0;
    for (let i = 0; i < 600; i++) {
      const { S, b } = contractBusiness(R);
      const live = b.jobs.filter((j) => (j.kind === 'sub' || j.kind === 'own') && j.state === 'running' && !j.prog);
      if (!live.length) continue;
      const j = pick(R, live), pj = S.jobs.find((x: any) => x.id === j.id), seed = int(R, 1, 1e9);
      const cards = j.kind === 'own' ? ['variation', 'gravel', 'drydam', 'pitout'] : ['variation', 'gravel'];
      const k = pick(R, cards);
      P.setS(S);
      const c = P.curve({ k, id: j.id, sd: 1 });
      const i2 = int(R, 0, c.opts.length - 1);
      P.withRNG(P.seedRand(seed), () => c.opts[i2].go());
      const rand = seedRand(seed);
      if (k === 'variation') [() => variationLodge(rand, j), () => variationWriting(j), () => variationFree(b, j)][i2]!();
      if (k === 'gravel') [() => gravelCart(b, j), () => gravelWork(rand, j), () => gravelArgue(rand, b, j)][i2]!();
      if (k === 'drydam') [() => dryDamBore(b, j), () => dryDamFar(j), () => dryDamFarMore(j)][i2]!();
      if (k === 'pitout') [() => pitFar(j, false), () => pitFar(j, true), () => pitFarmer(b, j)][i2]!();
      // the card marks the job as asked, as the prototype does when it's drawn
      for (const f of ['varAsked', 'gravAsked', 'damAsked', 'pitAsked']) if (pj[f]) (j as any)[f] = pj[f];
      expect(j).toEqual(pj);
      expect(b.bank).toBe(S.bank);
      expect(b.rep).toBe(S.rep);
      expect(b.rel ?? {}).toEqual(S.rel ?? {});
      expect(b.acc.jobCosts).toBe(S.acc.jc);
      n++;
    }
    expect(n).toBeGreaterThan(300);
    const j: any = { kind: 'own', gLeft: -2, days: 5 };
    addDays(j, 3);
    P.addDays(j, 0);
    expect(j.gLeft).toBe(3);
  });
});
