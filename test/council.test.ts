// Council tenders and job planning against the prototype.

import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY, MOB, NAMES, autoPlan, canPrestige, cartLoads, closeCouncil, councilPrice, crewPeople, dmap, flow,
  genCouncil, genMajor, int, juneWeek, mkRivals, newLoan, newWhs, pick, planCounts, planEval, progAct, seedRand, setHm,
  setPlan, signOwn, stdPlan, submitCouncil, truckM3, weeksFor,
  type CouncilEvent, type CouncilTender, type CouncilWorld, type Difficulty, type Machine, type MachineType, type Mood,
  type Person, type PlanCtx, type PlanEval, type ProgOp, type Role, type Standing, type TownId, type YardId,
} from '../src';
import { diaryMark, diarySame } from './diaryCheck';
import { loadPrototype } from './prototype';
import { bottText, issueText } from '../src/text/plan';

const P = loadPrototype();
const LOAN_FOR: Record<Difficulty, number> = { easy: 350000, normal: 180000, hard: 80000, hc: 80000 };
const MOOD_IDS: Mood[] = ['boom', 'steady', 'tight', 'bust'];
const strip = (o: any) => { const c = { ...o }; delete c.title; delete c.nm; return c; };
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function protoCareer(o: Record<string, unknown>): any {
  return { week: 1, town: 'gdi', fleet: [], staff: [], yard: 'home', jobs: [], queue: [], log: [], news: [], bank: 100000, recv: [], seq: 0,
    co: 'Black Soil Earthmoving', loanStart: 180000, hardcore: false, ins: 1, rep: 10, blocked: {}, loan: newLoan(0), tenders: [], ctenders: [],
    subsWon: 0, ownWon: 0, tix: {}, stats: { earned: 0 }, whs: newWhs(true), youJob: null, ...o };
}

/** A business big enough for council work, in both shapes. */
function randomCouncil(R: () => number) {
  const town: TownId = pick(R, ['gdi', 'ct']), d: Difficulty = pick(R, ['easy', 'normal', 'hard', 'hc']), yard: YardId = pick(R, ['fenced', 'depot', 'regional', 'hub']);
  const week = int(R, 20, 300), seq = int(R, 0, 900);
  const kinds: MachineType[] = ['grader', 'grader', 'roller', 'cart', 'cart', 'truck'];
  const fleet: Machine[] = Array.from({ length: int(R, 2, 14) }, (_, i) => ({ id: 'm' + i, type: pick(R, kinds), year: 2012, cond: int(R, 30, 95), hours: 9000, svcAt: 8900,
    status: pick(R, ['idle', 'idle', 'idle', 'job', 'listed']), down: 0, cover: 0, warranty: 0, jobId: null, sale: null }));
  const jobs: any[] = [];
  for (const m of fleet) if (m.status === 'job') { const j = { id: 'j' + m.id, kind: pick(R, ['wet', 'sub', 'own', 'dry']), days: int(R, 5, 40), done: int(R, 0, 5), finished: false }; m.jobId = j.id; jobs.push(j); }
  const staff: Person[] = Array.from({ length: int(R, 0, 6) }, (_, i) => ({ id: 'p' + i, name: NAMES[i]!, role: pick(R, ['grader', 'roller', 'cart', 'truck', 'super'] as Role[]), skill: 'solid' as const, wage: 1800, off: 0, jobId: R() < 0.2 ? pick(R, jobs.map((j) => j.id).concat([null as any])) : null }));
  const won3 = R() < 0.5;
  const st: CouncilWorld = { town, week, seq, rep: int(R, 5, 30), blocked: {}, rivals: mkRivals(seedRand(int(R, 1, 1e9)), town), tenders: [], ctenders: [], queue: [], subsWon: 0, jobs, won2: true, won3 };
  dmap(seedRand(int(R, 1, 1e9)), st);
  const S = protoCareer({ ...clone(st), fleet: clone(fleet), staff: clone(staff), yard, loanStart: LOAN_FOR[d], hardcore: d === 'hc', mkt: { f: 1.1, mood: 'steady' }, youJob: R() < 0.3 ? 'busy' : null });
  const p = (): PlanCtx => ({ town, week: st.week, yard, fleet, jobs: st.jobs as any, staff, youJob: S.youJob });
  return { st, S, d, p, fleet, staff };
}

/** Everything in a plan's evaluation except the words; issues compared by kind of numbers. */
function evalCore(e: any) {
  const { bott, issues, ...rest } = e;
  return { ...rest, issues: (issues || []).map((x: any) => ({ lost: x.lost, crew: x.crew })) };
}
const BOTT_K: Record<string, string> = { roller: 'roller', water: 'water', gravel: 'gravel', idle: 'idle', ok: 'ok' };

describe('crews, water and gravel', () => {
  it('flow, loads, weeks and the calendar match', () => {
    const R = seedRand(91);
    for (let i = 0; i < 5000; i++) {
      const mul = int(R, 1, 2), carts = int(R, 1, 4), trucks = int(R, 1, 8), wk = int(R, 1, 40), haul = int(R, 1, 50);
      expect(flow(mul, carts, trucks, wk, haul)).toEqual(P.flow(mul, carts, trucks, wk, haul));
      expect(cartLoads(wk)).toBe(P.cartLoads(wk));
      expect(truckM3(haul)).toBe(P.truckM3(haul));
      // 3 is wetter than the game ever asks for, so the 90% cap on lost days gets tested too
      const town: TownId = pick(R, ['gdi', 'ct']), days = R() * 200, w = int(R, 1, 400), wet = pick(R, [1, 1.6, 3]);
      P.setS(protoCareer({ town }));
      expect(weeksFor(town, days, w, wet)).toBe(P.weeksFor(days, w, wet));
    }
    for (let y = 2027; y < 2040; y++) expect(juneWeek(y)).toBe(P.juneWeek(y));
  });

  it("who's free for a plan, and who could crew it", () => {
    const R = seedRand(92);
    for (let i = 0; i < 2000; i++) {
      const { S, p } = randomCouncil(R), start = S.week + int(R, 0, 10);
      P.setS(S);
      expect(planCounts(p(), start)).toEqual(P.planCounts(start));
      for (const free of [false, true]) expect(crewPeople(p(), free)).toEqual(P.crewPeople(free));
    }
  });
});

describe('council packages', () => {
  it('the same packages come up, with the same standard plan and deadline', () => {
    const R = seedRand(93);
    let made = 0;
    for (let i = 0; i < 1500; i++) {
      const { st, S, p } = randomCouncil(R), f = pick(R, [0.7, 1.1, 1.6]), seed = int(R, 1, 1e9);
      S.mkt = { f, mood: 'steady' };
      if (R() < 0.3) { const t0 = { id: 'cx', close: S.week + 1, roads: [], q: {}, pits: [] }; st.ctenders.push(t0 as any); S.ctenders.push(clone(t0)); }
      // sometimes the map hasn't been made yet: making it rolls, so the order has to match too
      if (R() < 0.3) { delete st.dmap; delete S.dmap; }
      P.setS(S);
      P.withRNG(P.seedRand(seed), () => P.genCouncil());
      const t = genCouncil(seedRand(seed), st, p(), Math.max(0.5, Math.min(1.5, f / 1.1)));
      expect(st.ctenders).toEqual(S.ctenders.map(strip));
      expect(st.dmap).toEqual(S.dmap);
      expect(st.seq).toBe(S.seq);
      if (t) made++;
    }
    expect(made).toBeGreaterThan(300);
  });

  it('flood recovery programs: both towns, lots, deadlines and the prestige version', () => {
    const R = seedRand(94);
    let made = 0, prest = 0, let_ = 0;
    for (let i = 0; i < 600; i++) {
      const { st, S, p } = randomCouncil(R), seed = int(R, 1, 1e9);
      st.won3 = S.won3 = true;
      if (R() < 0.4) { S.majorDone = st.majorDone = 2; S.whs.sys = 3; S.yard = 'hub'; }
      S.mkt = { f: 1.6, mood: 'boom' };
      P.setS(S);
      const ok = P.canPrestige();
      expect(canPrestige(st, S.whs.sys, S.yard)).toBe(ok);
      const mk = diaryMark(P, st);
      P.withRNG(P.seedRand(seed), () => P.genMajor());
      const pc = { ...p(), yard: S.yard };
      const t = genMajor(seedRand(seed), st, pc, P.fmul(), ok);
      if (diarySame(P, st, mk).includes('programLet')) let_++;
      expect(st.ctenders).toEqual(S.ctenders.map(strip));
      expect(st.seq).toBe(S.seq);
      if (t) { made++; if (t.prestige) prest++; }
    }
    expect(made).toBeGreaterThan(50);
    expect(prest).toBeGreaterThan(5);
    expect(let_).toBe(made);
  });
});

describe('planning', () => {
  it('a package plan: crew-days, weeks, cost and what holds it up', () => {
    const R = seedRand(95);
    const botts: Record<string, number> = {};
    for (let i = 0; i < 1500; i++) {
      const { st, S, p } = randomCouncil(R);
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => { for (let g = 0; g < 40 && !S.ctenders.length; g++) P.genCouncil(); });
      if (!S.ctenders.length) continue;
      const t: CouncilTender = clone(strip(S.ctenders[0]));
      expect(stdPlan(p(), t).pl).toEqual(P.stdPlan(S.ctenders[0]).pl);
      // a random plan, changed through the same controls the player has
      for (let k = 0; k < 6; k++) {
        const key = pick(R, ['subs', 'crews', 'graders', 'rollers', 'carts', 'trucks', 'pit', 'own:grader', 'own:cart', 'own:truck'] as const), dlt = key === 'pit' ? int(R, 0, 1) : pick(R, [-1, 1, 2]);
        P.setPlan(S.ctenders[0].id, key, dlt);
        setPlan(p(), t, key, dlt);
      }
      if (R() < 0.5) { const k = pick(R, ['grader', 'roller', 'cart']), v = pick(R, ['wet', 'dry']); P.setHm(S.ctenders[0].id, k, v); setHm(t, k, v); }
      expect(t.pl).toEqual(S.ctenders[0].pl);
      const mine = planEval(p(), t, t.pl), theirs = P.planEval(S.ctenders[0], S.ctenders[0].pl);
      expect(evalCore(mine)).toEqual(evalCore(theirs));
      expect(mine.bott.k).toBe(BOTT_K[theirs.bott.k]);
      expect(bottText(mine.bott, t)).toBe(theirs.bott.t);
      botts[mine.bott.k] = (botts[mine.bott.k] || 0) + 1;
      // the price
      const ov = P.overheads(), n = P.otherContracts();
      expect(councilPrice(t, mine, ov, n)).toEqual(P.councilPrice(S.ctenders[0], theirs));
    }
    for (const k of ['roller', 'water', 'gravel', 'idle', 'ok']) expect(botts[k], k).toBeGreaterThan(10);
  });

  it('a program plan: crew by crew, road by road, floats and problems', () => {
    const R = seedRand(96);
    let issues = 0;
    for (let i = 0; i < 400; i++) {
      const { st, S, p } = randomCouncil(R);
      st.won3 = S.won3 = true;
      S.mkt = { f: 1.6, mood: 'boom' };
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => { for (let g = 0; g < 80 && !S.ctenders.some((x: any) => x.major); g++) P.genMajor(); });
      const pt = S.ctenders.find((x: any) => x.major);
      if (!pt) continue;
      const t: CouncilTender = clone(strip(pt)), n = int(R, 1, 5);
      pt.pl.prog = P.autoPlan(pt, n);
      t.pl.prog = autoPlan(t, n);
      expect(t.pl.prog).toEqual(pt.pl.prog);
      // the player rearranges it
      for (let k = 0; k < 8; k++) {
        const c = t.pl.prog!.crews, ci = int(R, 0, c.length - 1), road = int(R, 0, t.roads.length - 1);
        const ops: [ProgOp, string][] = [
          [{ op: 'add' }, 'add'], [{ op: 'addsub' }, 'addsub'], [{ op: 'del', i: ci }, 'del:' + ci],
          [{ op: 'cfg', i: ci, k: 'ca', d: 1 }, 'cfg:' + ci + ':ca:1'], [{ op: 'cfg', i: ci, k: 'tr', d: -1 }, 'cfg:' + ci + ':tr:-1'],
          [{ op: 'mv', i: ci, j: 0, d: 1 }, 'mv:' + ci + ':0:1'], [{ op: 'un', i: ci, j: 0 }, 'un:' + ci + ':0'],
          [{ op: 'as', road, to: ci }, 'as:' + road + ':' + ci], [{ op: 'auto' }, 'auto'], [{ op: 'tidy' }, 'tidy'],
        ];
        const [mineOp, theirOp] = pick(R, ops);
        P.progAct(pt.id, theirOp);
        progAct(t, mineOp);
      }
      expect(t.pl).toEqual(pt.pl);
      const mine = planEval(p(), t, t.pl), theirs = P.planEval(pt, pt.pl);
      expect(evalCore(mine)).toEqual(evalCore(theirs));
      expect(mine.issues!.map((x) => issueText(x, t))).toEqual(theirs.issues.map((x: any) => x.t));
      expect(bottText(mine.bott, t)).toBe(theirs.bott.t);
      issues += mine.issues!.length;
    }
    expect(issues).toBeGreaterThan(100);
  });
});

describe('closing and signing', () => {
  it('the same prices, method points, scores and winner, and what it does to the rivals and the map', () => {
    const R = seedRand(97);
    let won = 0, lost = 0;
    for (let i = 0; i < 1500; i++) {
      const { st, S, p, d } = randomCouncil(R);
      const mood = pick(R, MOOD_IDS), major = R() < 0.3;
      if (major) { st.won3 = S.won3 = true; }
      S.mkt = { f: major ? 1.6 : 1.1, mood };
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => { for (let g = 0; g < 80 && !S.ctenders.length; g++) major ? P.genMajor() : P.genCouncil(); });
      if (!S.ctenders.length) continue;
      // prestige work is rare in play; mark half the programs here so its pricing gets tested
      if (S.ctenders[0].major && R() < 0.5) S.ctenders[0].prestige = true;
      st.ctenders = clone(S.ctenders.map(strip)); st.seq = S.seq; st.dmap = clone(S.dmap);
      const t = st.ctenders[0]!, pt = S.ctenders[0];
      if (R() < 0.75) {
        P.submitCouncil(pt.id);
        submitCouncil(p(), st, t.id, P.overheads(), P.otherContracts(), P.capFull());
        expect(t.bid).toBe(pt.bid);
        expect(t.mine).toEqual(pt.mine);
      }
      const seed = int(R, 1, 1e9), ev: CouncilEvent[] = [];
      const me: Standing = { rep: S.rep, whs: clone(S.whs), week: S.week, stretched: P.playerStretched(), contracts: P.otherContracts(), soft: !!DIFFICULTY[d].soft, rel: S.rel };
      P.setS(S);
      P.withRNG(P.seedRand(seed), () => P.closeCouncil(pt));
      closeCouncil(seedRand(seed), st, p(), t, me, S.co, mood, DIFFICULTY[d].ef, ev);
      expect(t.result).toEqual(pt.result);
      expect(st.rivals).toEqual(S.rivals);
      expect(st.dmap).toEqual(S.dmap);
      expect(st.tb).toEqual(S.tb);
      if (t.bid) { if (t.result![0]!.you) won++; else lost++; }
    }
    expect(won).toBeGreaterThan(50);
    expect(lost).toBeGreaterThan(100);
  });

  it('signing a council win sets up the same contract', () => {
    const R = seedRand(98);
    let signed = 0;
    for (let i = 0; i < 600; i++) {
      const { st, S, p } = randomCouncil(R), major = R() < 0.3;
      if (major) st.won3 = S.won3 = true;
      S.mkt = { f: 1.6, mood: 'boom' };
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => { for (let g = 0; g < 80 && !S.ctenders.length; g++) major ? P.genMajor() : P.genCouncil(); });
      if (!S.ctenders.length) continue;
      const pt = S.ctenders[0];
      if (major && R() < 0.6) pt.pl.prog = P.autoPlan(pt, int(R, 2, 4));
      st.ctenders = clone(S.ctenders.map(strip)); st.seq = S.seq; st.dmap = clone(S.dmap);
      const t = st.ctenders[0]!;
      P.setS(S);
      if (P.capFull()) continue; // at the two-contract limit: no price, nothing to sign
      P.submitCouncil(pt.id);
      submitCouncil(p(), st, t.id, P.overheads(), P.otherContracts(), false);
      // you're busy and there's no supervisor, so the prototype's staffing step leaves it waiting
      S.youJob = 'busy'; S.staff = S.staff.filter((x: any) => x.role !== 'super' && x.role !== 'ops');
      const staffNow = S.staff.map((x: any) => x.id);
      P.setS(S);
      P.signOwn(pt);
      const pc = { ...p(), staff: p().staff.filter((x) => staffNow.includes(x.id)), youJob: 'busy' };
      signOwn(st as CouncilWorld & { jobs: any[] }, pc, t);
      expect(st.jobs.map(strip)).toEqual(S.jobs.map(strip));
      expect(st.dmap).toEqual(S.dmap);
      expect(st.ownWon).toBe(S.ownWon);
      signed++;
    }
    expect(signed).toBeGreaterThan(200);
    expect(MOB).toBe(2500);
  });
});
