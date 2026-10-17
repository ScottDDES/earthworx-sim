// Safety against the prototype: the weekly roll, the register, tender points, and the three safety cards.

import { describe, expect, it } from 'vitest';
import {
  NAMES, hurtPick, int, nearMissCard, nearMissReport, nearMissShrug, newLoan, nextWhs, pick, quietDaysOff, quietLeave,
  quietYarn, riskMult, safetyWeek, seedRand, seriousCard, seriousHide, seriousNotify, swmsPay, swmsSelf, upgradeWhs,
  whsNp, whsNpSub, type Difficulty, type Incident, type Person, type Role, type SafetyEvent, type SafetyState, type Whs,
} from '../src';
import { LTI_MACHINES, LTI_STORIES, NEAR_MISS_STORIES, QUIET_REPLIES, SERIOUS_STORIES } from '../src/text/safety';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'hc'];
const LOAN_FOR: Record<Difficulty, number> = { easy: 350000, normal: 180000, hard: 80000, hc: 80000 };

function protoCareer(o: Record<string, unknown>): any {
  return { week: 1, town: 'gdi', fleet: [], staff: [], yard: 'home', jobs: [], queue: [], log: [], news: [], bank: 1e6, recv: [], seq: 0,
    loanStart: 180000, hardcore: false, ins: 1, rep: 10, tix: {}, stats: {}, coach: { off: true }, loan: newLoan(0), blocked: {}, youJob: null, youBlocked: 0, ...o };
}

function randomWhs(R: () => number, week: number): Whs {
  const inc: Incident[] = [];
  for (let i = 0, n = int(R, 0, 4); i < n; i++) inc.push({ w: week - int(R, 0, 120), sev: pick(R, ['lti', 'serious', 'medical', 'first aid'] as const), who: '' });
  return { sys: int(R, 0, 3), talks: R() < 0.4, cult: int(R, 0, 100), hz: pick(R, [0, 0, 0.1, 0.35, 0.8]), inc, nm: 0 };
}

function randomCrew(R: () => number): Person[] {
  return Array.from({ length: int(R, 0, 6) }, (_, i) => ({
    id: 'p' + i, name: NAMES[i]!, role: pick(R, ['grader', 'roller', 'cart', 'truck', 'fitter', 'super'] as Role[]),
    skill: 'solid' as const, wage: 1800, off: R() < 0.15 ? 2 : 0, jobId: R() < 0.7 ? 'j1' : null,
  }));
}

function randomState(R: () => number) {
  const d: Difficulty = pick(R, DIFFS), week = int(R, 1, 400);
  const st: SafetyState = { week, bank: 200000, ins: pick(R, [1, 1.1, 1.3]), rep: int(R, 0, 25), whs: randomWhs(R, week), staff: randomCrew(R),
    youJob: R() < 0.6 ? 'j1' : null, youBlocked: R() < 0.2 ? 1 : 0, blocked: {} };
  const S = protoCareer({ ...JSON.parse(JSON.stringify(st)), loanStart: LOAN_FOR[d], hardcore: d === 'hc' });
  return { st, S, d };
}

/** The prototype writes names and words into the register; the engine writes ids and story codes. */
function asProtoName(st: SafetyState, who: string | null): string {
  if (!who) return 'A casual';
  if (who === 'you') return 'You';
  return st.staff.find((p) => p.id === who)!.name;
}
function asProtoIncident(st: SafetyState, x: Incident): any {
  let t = '';
  if (x.story?.k === 'lti') t = LTI_STORIES[x.story.i]!(LTI_MACHINES[x.story.machine]!);
  if (x.story?.k === 'serious') t = SERIOUS_STORIES[x.story.i]! + (x.hidden ? ' (not notified)' : '');
  if (x.story?.k === 'nearmiss') t = NEAR_MISS_STORIES[x.story.i]!;
  const who = x.sev === 'near miss' ? '' : x.who || x.sev === 'serious' ? asProtoName(st, x.who || null) : 'A casual';
  return { w: x.w, sev: x.sev, who, t };
}

describe('the safety week', () => {
  it('risk and tender points match', () => {
    const R = seedRand(51);
    for (let i = 0; i < 3000; i++) {
      const { st, S, d } = randomState(R);
      P.setS(S);
      expect(riskMult(st.whs, d)).toBeCloseTo(P.riskMult(), 12);
      expect(whsNp(st.whs, st.week)).toBe(P.whsNp());
      expect(whsNpSub(st.whs, st.week)).toBe(P.npOf('sub', null, null).saf);
    }
  });

  it('the same incidents, the same people hurt, the same costs and register', () => {
    const R = seedRand(52);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) {
      const { st, S, d } = randomState(R);
      // a hazardous week, so incidents turn up often enough to test
      st.whs.hz = S.whs.hz = pick(R, [0, 2, 6]);
      const worked = int(R, 0, 60), seed = int(R, 1, 1e9);
      P.setS(S);
      const rep = { events: [] as string[], costs: 0, worked };
      P.withRNG(P.seedRand(seed), () => P.safetyWeek(rep));
      const ev: SafetyEvent[] = [], queue: any[] = [];
      const cost = safetyWeek(seedRand(seed), st, worked, d, queue, ev);
      expect(cost).toBe(rep.costs);
      expect(st.bank).toBe(S.bank);
      expect(st.ins).toBeCloseTo(S.ins, 12);
      expect(st.rep).toBe(S.rep);
      expect(st.youBlocked).toBe(S.youBlocked);
      expect(st.staff).toEqual(S.staff);
      expect(st.whs.hz).toBeCloseTo(S.whs.hz, 12);
      expect(st.whs.cult).toBeCloseTo(S.whs.cult, 12);
      // new entries go on the front: translate those; the ones already there are unchanged
      const added = ev.filter((e) => e.k !== 'serious').length; // a serious one is recorded later, from its card
      expect(st.whs.inc.length).toBe(S.whs.inc.length);
      expect(st.whs.inc.slice(0, added).map((x) => asProtoIncident(st, x))).toEqual(S.whs.inc.slice(0, added).map((x: any) => ({ w: x.w, sev: x.sev, who: x.who, t: x.t })));
      expect(st.whs.inc.slice(added)).toEqual(S.whs.inc.slice(added));
      expect(queue).toEqual(S.queue);
      for (const e of ev) seen[e.k] = (seen[e.k] || 0) + 1;
    }
    expect(seen.serious).toBeGreaterThan(30);
    expect(seen.lti).toBeGreaterThan(100);
    expect(seen.medical).toBeGreaterThan(100);
    expect(seen.firstAid).toBeGreaterThan(100);
  });

  it('who gets hurt is picked the same way', () => {
    const R = seedRand(53);
    for (let i = 0; i < 3000; i++) {
      const { st, S } = randomState(R), seed = int(R, 1, 1e9);
      P.setS(S);
      expect(hurtPick(seedRand(seed), st)).toBe(P.withRNG(P.seedRand(seed), () => P.hurtPick()));
    }
  });

  it('stepping up the safety system: same rules, same cost, culture +5', () => {
    const R = seedRand(54);
    for (let i = 0; i < 2000; i++) {
      const { st, S } = randomState(R);
      const won = R() < 0.6, won2 = won && R() < 0.5, bank = pick(R, [1000, 3000, 15000, 30000]);
      st.bank = S.bank = bank;
      S.won = won; S.won2 = won2; S.unl = {};
      P.setS(S);
      const swms = P.unlocked('swms');
      P.upgradeWhs();
      upgradeWhs(st, { swms, won, won2 });
      expect(st.bank).toBe(S.bank);
      expect(st.whs).toEqual(S.whs);
      expect(['max', 'locked', 'cash', 'ok']).toContain(nextWhs(st, { swms, won, won2 }));
    }
  });
});

describe('the safety cards', () => {
  /** Runs a prototype card: its setup on the card's seed, the choice on the career's stream. */
  function protoChoose(S: any, q: any, i: number, streamSeed: number): string {
    P.setS(S);
    const c = P.curve(q);
    return P.withRNG(P.seedRand(streamSeed), () => c.opts[i].go());
  }

  it('a serious incident: the same fine, reported or kept quiet', () => {
    const R = seedRand(55);
    let found = 0, quiet = 0;
    for (let i = 0; i < 3000; i++) {
      const { st, S } = randomState(R);
      const fleetSize = int(R, 1, 15), running = R() < 0.6, sd = int(R, 1, 1e9), seed = int(R, 1, 1e9), opt = int(R, 0, 1);
      S.fleet = Array.from({ length: fleetSize }, (_, k) => ({ id: 'm' + k }));
      S.jobs = running ? [{ id: 'j1', state: 'running', finished: false, kind: 'sub', title: 'Job' }] : [];
      const who = hurtPick(seedRand(int(R, 1, 1e9)), st), q = { k: 'serious', who, sd };
      protoChoose(S, q, opt, seed);
      const c = seriousCard(seedRand(sd), who, st.whs.sys, fleetSize, running ? 'j1' : null);
      if (opt === 0) seriousNotify(st, c);
      else { const r = seriousHide(seedRand(seed), st, c, 'Goondiwindi council'); if (r.found) found++; else quiet++; }
      expect(st.bank).toBe(S.bank);
      expect(st.ins).toBeCloseTo(S.ins, 12);
      expect(st.rep).toBe(S.rep);
      expect(st.staff).toEqual(S.staff);
      expect(st.youBlocked).toBe(S.youBlocked);
      expect(st.blocked).toEqual(S.blocked);
      expect(st.whs.cult).toBe(S.whs.cult);
      expect(st.whs.hz).toBeCloseTo(S.whs.hz, 12);
      expect(asProtoIncident(st, st.whs.inc[0]!)).toEqual(S.whs.inc[0]);
      if (opt === 0 && running) expect(S.jobs[0].stood).toBe(1);
    }
    expect(found).toBeGreaterThan(300);
    expect(quiet).toBeGreaterThan(200);
  });

  it('a near miss: reported or shrugged off', () => {
    const R = seedRand(56);
    for (let i = 0; i < 2000; i++) {
      const { st, S } = randomState(R);
      const crews = int(R, 0, 3), sd = int(R, 1, 1e9), opt = int(R, 0, 1);
      S.jobs = Array.from({ length: crews }, (_, k) => ({ id: 'j' + k, kind: 'sub', state: 'running', finished: false, title: 'Job' }));
      protoChoose(S, { k: 'nearmiss', sd }, opt, 1);
      const c = nearMissCard(seedRand(sd), crews);
      if (opt === 0) nearMissReport(st, c); else nearMissShrug(st);
      expect(st.bank).toBe(S.bank);
      expect(st.whs.nm).toBe(S.whs.nm);
      expect(st.whs.hz).toBeCloseTo(S.whs.hz, 12);
      expect(st.whs.cult).toBe(S.whs.cult);
      if (opt === 0) expect(asProtoIncident(st, st.whs.inc[0]!)).toEqual(S.whs.inc[0]);
    }
  });

  it("someone's been quiet: a yarn, days off, or leave it", () => {
    const R = seedRand(57);
    for (let i = 0; i < 3000; i++) {
      const { st, S } = randomState(R);
      if (!st.staff.length) continue;
      const k = int(R, 0, st.staff.length - 1), id = st.staff[k]!.id, opt = int(R, 0, 2), seed = int(R, 1, 1e9);
      S.staff[k].yarn = undefined; delete st.staff[k]!.yarn;
      const said = protoChoose(S, { k: 'quiet', id, sd: 1 }, opt, seed);
      const p = st.staff[k]!;
      if (opt === 0) expect(QUIET_REPLIES[quietYarn(seedRand(seed), st, p)]!(p.name)).toBe(said);
      if (opt === 1) quietDaysOff(st, p);
      if (opt === 2) quietLeave(seedRand(seed), st, p);
      expect(st.bank).toBe(S.bank);
      expect(st.staff).toEqual(S.staff);
      expect(st.whs.cult).toBe(S.whs.cult);
      expect(st.whs.hz).toBeCloseTo(S.whs.hz, 12);
    }
  });

  it('head contractors want SWMS: pay for them or write them yourself', () => {
    for (const opt of [0, 1]) {
      const R = seedRand(58 + opt), { st, S } = randomState(R);
      st.whs.sys = S.whs.sys = 0;
      protoChoose(S, { k: 'swms', sd: 1 }, opt, 1);
      if (opt === 0) swmsPay(st); else swmsSelf(st);
      expect(st.bank).toBe(S.bank);
      expect(st.whs.sys).toBe(S.whs.sys);
      expect(st.youBlocked).toBe(S.youBlocked);
    }
  });
});
