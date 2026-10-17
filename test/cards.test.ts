// The remaining cards, the rain call, and the career ladder against the prototype, on careers it played.

import { describe, expect, it } from 'vitest';
import {
  UNLOCKS, YARDS, breakCard, breakFix, breakinCamera, breakinClaim, breakinWithout, callGrader, calloutPull, callWork, checkTix,
  checkWin, checks, checks2, checks3, checks4, checks5, clearingBorrow, clearingCash, curveWeek, earlyClient, earlyTake,
  extraAgree, extraAsk, extraFree, hurtCover, hurtHome, hurtKeepGoing, int, netWorth, pick, rainCallCheck, rainCallDay, rainCrews,
  rainDecide, rung, seedRand, svcFindDays, svcFix, svcPatch, swmsWeek, taxMode, turnoverKeep, turnoverSell, unlocked, unlockWeek,
  value, mgrIs, hasWorkshop, stars, ownedCounts,
  type RainCallEvent,
} from '../src';
import { TOWNS, drawCard } from '../src';
import { cardView, resultText } from '../src/text/cardView';
import { BAD_BACK_STORY, LTI_MACHINES, LTI_STORIES } from '../src/text/safety';
import { accFromProto, snapshots } from './bot';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const SNAPS = snapshots(P, 40, 311, seedRand);

function pair(S0: any) {
  const S = clone(S0), b = clone(S0);
  b.acc = accFromProto(S.acc);
  b.cbSeen = b.cbSeen || {};
  return { S, b };
}
const roomOf = (b: any) => YARDS[b.yard as keyof typeof YARDS].slots - b.fleet.filter((m: any) => m.status !== 'branch').length;
const wxOf = (S: any) => ({ town: S.town, wxStart: S.wxStart });

describe('which card turns up', () => {
  it('the same curve ball, or none, from the same week', () => {
    const R = seedRand(312);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      S.queue = []; b.queue = [];
      S.cbLast = b.cbLast = R() < 0.8 ? 0 : S.week - int(R, 1, 4);
      if (R() < 0.3) { const k = pick(R, ['callout', 'variation', 'hurt', 'quiet']); S.cbSeen = { ...(S.cbSeen || {}), [k]: S.week - int(R, 5, 15) }; b.cbSeen = clone(S.cbSeen); }
      if (R() < 0.2) { S.swmsAsked = b.swmsAsked = false; S.whs.sys = b.whs.sys = 0; }
      S.whs.hz = b.whs.hz = pick(R, [0, 0.15, 0.2, 0.25, 0.6]);
      // the bot's contracts have usually had their cards already: clear that half the time
      if (R() < 0.5) for (const J of [S.jobs, b.jobs]) for (const j of J) { delete j.varAsked; delete j.gravAsked; delete j.damAsked; delete j.pitAsked; }
      const seed = int(R, 1, 1e9);
      P.setS(S);
      const hasCrew = P.hasCrew(), st = P.stars();
      P.withRNG(P.seedRand(seed), () => P.__curve());
      const rand = seedRand(seed);
      swmsWeek(b, hasCrew, st);
      const q = curveWeek(rand, b, roomOf(b), YARDS[b.yard as keyof typeof YARDS].theft);
      expect(b.queue).toEqual(S.queue);
      expect(b.cbLast ?? 0).toBe(S.cbLast ?? 0);
      expect(b.cbSeen).toEqual(S.cbSeen ?? {});
      expect(b.swmsAsked ?? false).toBe(S.swmsAsked ?? false);
      if (q) seen[q.k] = (seen[q.k] || 0) + 1;
    }
    for (const k of ['callout', 'breakin', 'quiet', 'nearmiss', 'early']) expect(seen[k] ?? 0, k).toBeGreaterThan(10);
    expect(seen.variation ?? 0, 'variation').toBeGreaterThan(4);
  });

  it('who could take a call-out, and who would pay early', () => {
    for (const S0 of SNAPS) {
      const { S, b } = pair(S0);
      P.setS(S);
      expect(callGrader(b)?.id ?? null).toBe(P.callGrader()?.id ?? null);
      expect(earlyClient(b)).toBe(P.earlyClient());
      expect(rainCrews(b.jobs)).toBe(P.rainCrews());
    }
  });
});

describe('the cards', () => {
  /** A card on the prototype side: its setup on its own seed, the choice on the career's stream. */
  function protoChoose(S: any, q: any, i: number, seed: number) {
    P.setS(S);
    const c = P.curve(q);
    if (!c) return null;
    P.withRNG(P.seedRand(seed), () => c.opts[i].go());
    return c;
  }
  function same(b: any, S: any) {
    expect(b.bank).toBe(S.bank);
    expect(b.fleet).toEqual(S.fleet);
    expect(b.staff).toEqual(S.staff);
    expect(b.jobs).toEqual(S.jobs);
    expect(b.recv).toEqual(S.recv);
    expect(b.loan).toEqual(S.loan);
    expect(b.rep).toBe(S.rep);
    expect(b.ins).toBeCloseTo(S.ins, 12);
    expect(b.camera ?? false).toBe(S.camera ?? false);
    expect(b.youBlocked ?? 0).toBe(S.youBlocked ?? 0);
    expect(b.opCover ?? 0).toBe(S.opCover ?? 0);
    expect(b.whs.cult).toBe(S.whs.cult);
    expect(b.acc.workshop).toBe(S.acc.ws);
    expect(b.acc.capital).toBe(S.acc.cap);
    expect(b.acc.collections).toBe(S.acc.coll);
  }

  it('clearing sale, a bad back, a break-in, a client wanting extra, an early payer', () => {
    const R = seedRand(313);
    const n: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      const { S, b } = pair(pick(R, SNAPS)), seed = int(R, 1, 1e9), rand = seedRand(seed);
      const k = pick(R, ['clearing', 'hurt', 'breakin', 'extra', 'early']);
      if (k === 'clearing') {
        S.bank = b.bank = pick(R, [S.bank, 30000, 60000]);
        const opt = int(R, 0, 2);
        if (!protoChoose(S, { k, sd: 1 }, opt, seed)) continue;
        if (opt === 0) clearingBorrow(rand, b); if (opt === 1) clearingCash(rand, b);
      }
      if (k === 'hurt') {
        const p = b.staff.find((x: any) => x.off === 0);
        if (!p) continue;
        const opt = int(R, 0, 2);
        if (!protoChoose(S, { k, id: p.id, sd: 1 }, opt, seed)) continue;
        [() => hurtHome(p), () => hurtCover(b, p), () => hurtKeepGoing(rand, b, p)][opt]!();
        const pi = S.whs.inc[0], mi = b.whs.inc[0];
        if (opt === 2 && mi?.story?.k === 'badBack') expect(pi.t).toBe(BAD_BACK_STORY);
      }
      if (k === 'breakin') {
        const opt = int(R, 0, 2);
        if (!protoChoose(S, { k, sd: 1 }, opt, seed)) continue;
        [() => breakinClaim(b), () => breakinCamera(b), () => breakinWithout(rand, b)][opt]!();
      }
      if (k === 'extra') {
        const pj = b.jobs.find((j: any) => j.kind === 'private');
        if (!pj) continue;
        const opt = int(R, 0, 2);
        if (!protoChoose(S, { k, id: pj.id, sd: 1 }, opt, seed)) continue;
        [() => extraAsk(rand, pj), () => extraAgree(pj), () => extraFree(b, pj)][opt]!();
      }
      if (k === 'early') {
        const ec = earlyClient(b);
        if (!ec) continue;
        const opt = int(R, 0, 1);
        if (!protoChoose(S, { k, sd: 1 }, opt, seed)) continue;
        if (opt === 0) earlyTake(b, ec);
      }
      same(b, S);
      n[k] = (n[k] || 0) + 1;
    }
    for (const k of ['clearing', 'hurt', 'breakin', 'extra', 'early']) expect(n[k] ?? 0, k).toBeGreaterThan(30);
  });

  it('a storm call-out', () => {
    const R = seedRand(314);
    let n = 0;
    for (let i = 0; i < 1500; i++) {
      const { S, b } = pair(pick(R, SNAPS)), seed = int(R, 1, 1e9);
      const g = callGrader(b);
      if (!g) continue;
      const gj = g.jobId ? b.jobs.find((j: any) => j.id === g.jobId) : null, opt = int(R, 0, 1);
      if (!protoChoose(S, { k: 'callout', sd: 1 }, opt, seed)) continue;
      if (opt === 0) { if (gj) calloutPull(seedRand(seed), b, g, gj); else callWork(b, g); }
      same(b, S);
      n++;
    }
    expect(n).toBeGreaterThan(200);
  });

  it('a breakdown: warranty, mobile mechanic, the dealer, or hire a replacement', () => {
    const R = seedRand(315);
    let n = 0;
    for (let i = 0; i < 2000; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      if (!b.fleet.length) continue;
      const k = int(R, 0, b.fleet.length - 1), m = b.fleet[k], pm = S.fleet[k];
      m.down = pm.down = 99; m.repair = pm.repair = int(R, 15, 65) * 100;
      if (R() < 0.3) m.warranty = pm.warranty = S.week + 3;
      if (R() < 0.2) { m.bandBroke = pm.bandBroke = 'worn kingpins'; }
      const sd = int(R, 1, 1e9);
      P.setS(S);
      const c = P.curve({ k: 'break', id: m.id, sd }), card = breakCard(seedRand(sd), b, m);
      const opt = int(R, 0, c.opts.length - 1), label = c.opts[opt].label as string;
      c.opts[opt].go();
      breakFix(b, m, card, label.startsWith('Claim') ? 'warranty' : label.startsWith('Get a mobile') ? 'mobile' : label.startsWith('Wait') ? 'dealer' : 'hireIn');
      same(b, S);
      n++;
    }
    expect(n).toBeGreaterThan(1000);
  });

  it('a fault found at a service, and turning old gear over', () => {
    const R = seedRand(316);
    let n = 0;
    for (let i = 0; i < 2000; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      const idle = b.fleet.filter((m: any) => m.status === 'idle');
      if (!idle.length) continue;
      const m: any = pick(R, idle), pm = S.fleet.find((x: any) => x.id === m.id), sd = int(R, 1, 1e9), seed = int(R, 1, 1e9);
      if (R() < 0.5) {
        const by = R() < 0.5 ? 'Dave' : null, fix = int(R, 12, 55) * 100, opt = int(R, 0, 1);
        protoChoose(S, { k: 'svcfind', id: m.id, part: 'worn kingpins', fix, by, sd }, opt, seed);
        const dd = svcFindDays(seedRand(sd), by);
        if (opt === 0) svcFix(b, m, fix, dd); else svcPatch(b, m, 'worn kingpins', fix);
      } else {
        const opt = int(R, 0, 2);
        protoChoose(S, { k: 'turnover', id: m.id, by: 'Leanne', sd }, opt, seed);
        if (opt < 2) turnoverSell(seedRand(seed), m, opt === 0 ? 'auction' : 'list', value(m, b.week), mgrIs(b.staff, 'dealer'));
        else turnoverKeep(b, m);
      }
      expect(m).toEqual(pm);
      same(b, S);
      n++;
    }
    expect(n).toBeGreaterThan(1000);
  });
});

describe('the rain call', () => {
  it('the same rain cards, and the same days when you stand down or push on', () => {
    const R = seedRand(317);
    let cards = 0;
    const seen: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      S.queue = []; b.queue = [];
      P.setS(S);
      P.rainCallCheck();
      rainCallCheck(b, wxOf(S));
      expect(b.queue).toEqual(S.queue);
      const q = b.queue[0];
      if (!q) continue;
      cards++;
      const push = R() < 0.5;
      S.rainCall = { w: q.w, d: q.d, push };
      rainDecide(b, q as any, push);
      const prep = { costs: 0, rain: 0, mm: 0, days: [], events: [] as string[] }, rep = { worked: 0, lost: 0, invoiced: 0, paid: 0, costs: 0 }, ev: RainCallEvent[] = [];
      P.setS(S);
      const theirs = P.__rainDay(q.d, prep);
      const mine = rainCallDay(b, wxOf(S), q.d as number, P.wetDay(S.week, q.d), rep, ev);
      expect(mine).toBe(theirs);
      expect(b.bank).toBe(S.bank);
      expect(rep.costs).toBe(prep.costs);
      expect(b.rainCall ?? null).toEqual(S.rainCall ?? null);
      for (const e of ev) seen[e.k] = (seen[e.k] || 0) + 1;
    }
    expect(cards).toBeGreaterThan(300);
    for (const k of ['stoodDown', 'pugged', 'touchUp', 'missedUs']) expect(seen[k] ?? 0, k).toBeGreaterThan(10);
  });

  it('pushing on through every day of ten years of rain', () => {
    const R = seedRand(319);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      for (let w = 1; w <= 520; w++) for (let d = 0; d < 5; d++) {
        S.week = b.week = w;
        const push = (w + d) % 3 !== 0;
        S.rainCall = { w, d, push }; b.rainCall = { w, d, push };
        const prep = { costs: 0, rain: 0, mm: 0, days: [], events: [] as string[] }, rep = { worked: 0, lost: 0, invoiced: 0, paid: 0, costs: 0 }, ev: RainCallEvent[] = [];
        P.setS(S);
        const theirs = P.__rainDay(d, prep);
        expect(rainCallDay(b, wxOf(S), d, P.wetDay(w, d), rep, ev)).toBe(theirs);
        expect(b.bank).toBe(S.bank);
        for (const e of ev) seen[e.k] = (seen[e.k] || 0) + 1;
      }
    }
    expect(seen.pugged ?? 0).toBeGreaterThan(50);
  });
});

describe('the career ladder', () => {
  it('rung, the checks, unlocks, milestones and tickets match', () => {
    const R = seedRand(318);
    for (const S0 of SNAPS) {
      for (let k = 0; k < 6; k++) {
        const { S, b } = pair(S0);
        // move the career around the ladder
        const bump = { subsDone: int(R, 0, 4), ownDone: int(R, 0, 3), majorDone: int(R, 0, 2), prestigeDone: int(R, 0, 1), subsWon: int(R, 0, 5), ownWon: int(R, 0, 3), won2: R() < 0.5, won3: R() < 0.3, yard: pick(R, ['home', 'depot', 'hub']) };
        Object.assign(S, clone(bump)); Object.assign(b, clone(bump));
        S.whs.sys = b.whs.sys = int(R, 0, 3);
        P.setS(S);
        expect(checks(b)).toEqual(P.checks().map((c: any) => c.ok));
        expect(checks2(b)).toEqual(P.checks2().map((c: any) => c.ok));
        expect(checks3(b)).toEqual(P.checks3().map((c: any) => c.ok));
        expect(checks4(b)).toEqual(P.checks4().map((c: any) => c.ok));
        expect(checks5(b)).toEqual(P.checks5().map((c: any) => c.ok));
        expect(rung(b)).toBe(P.rung());
        for (const u of UNLOCKS) expect(unlocked(b, u.id)).toBe(P.unlocked(u.id));
        P.checkWin(); checkWin(b);
        for (const f of ['won', 'won2', 'won3', 'wonWk', 'won2Wk', 'won3Wk']) expect(b[f] ?? null, f).toBe(S[f] ?? null);
        P.unlockWeek(null); unlockWeek(b);
        expect(b.unl).toEqual(S.unl);
        const mode = taxMode(S.loanStart, !!S.hardcore);
        const W = b.whs.inc.filter((x: any) => x.sev === 'lti' || x.sev === 'serious');
        P.checkTix();
        checkTix(b, { netWorth: () => netWorth(b, mode), lastSerious: W.length ? W[0].w : null });
        expect(b.tix).toEqual(S.tix);
        expect(b.tixN ?? 0).toBe(S.tixN ?? 0);
      }
    }
    // a couple of helpers the ladder leans on
    const S = SNAPS[0];
    P.setS(clone(S));
    expect(stars(S.rep)).toBe(P.stars());
    expect(ownedCounts(S.fleet)).toEqual(P.ownedCounts());
    expect(hasWorkshop('depot')).toBe(true);
    expect(LTI_STORIES.length).toBe(4);
    expect(LTI_MACHINES.length).toBe(3);
  });
});

describe('card words', () => {
  it('the turnover call and the branch manager\'s cards read the same, and so does what happened', () => {
    const R = seedRand(317), seen: Record<string, number> = {};
    for (let i = 0; i < 600; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      const kind = pick(R, ['turnover', 'brtender', 'brraise'] as const);
      let q: any;
      if (kind === 'turnover') {
        const idle = b.fleet.filter((m: any) => m.status === 'idle');
        if (!idle.length) continue;
        q = { k: kind, id: (pick(R, idle) as any).id, by: pick(R, ['Leanne', 'Dave']) };
      } else {
        S.branch = { town: pick(R, Object.keys(TOWNS)), mgr: { name: 'Mick', wage: 2400, skill: pick(R, ['green', 'solid', 'gun']) }, rep: 20 };
        b.branch = clone(S.branch);
        q = { k: kind };
      }
      q.sd = int(R, 1, 1e9);
      S.queue = [clone(q)];
      b.queue = [clone(q)];
      P.setS(S);
      const pc = P.curve(S.queue[0]), d = drawCard(b, b.queue[0]);
      expect(!!d).toBe(!!pc);
      if (!pc || !d) continue;
      const v = cardView(b, b.queue[0], d);
      expect([v.tag, v.title, v.body]).toEqual([pc.tag, pc.title, pc.body]);
      expect(v.opts.map((o) => [o.label, o.sub])).toEqual(pc.opts.map((o: any) => [o.label, o.sub]));
      const opt = int(R, 0, pc.opts.length - 1), seed = int(R, 1, 1e9);
      const res = P.withRNG(P.seedRand(seed), () => pc.opts[opt].go());
      b.rngA = seed | 0;
      const result = d.opts[opt]!.go();
      expect(resultText(b, { q: b.queue[0], id: d.opts[opt]!.id, data: d.data, result, tix: [] })).toBe(res);
      seen[kind] = (seen[kind] || 0) + 1;
    }
    expect(Object.values(seen).every((x) => x > 80)).toBe(true);
  });
});
