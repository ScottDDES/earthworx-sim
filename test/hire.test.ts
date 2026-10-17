// Hire work against the prototype: offers, taking them, booking the next one in, the working days,
// the week's invoices, getting paid, and the late-payer card. The big test runs whole businesses
// through weeks of hire work side by side, using the prototype's own week-loop code.

import { describe, expect, it } from 'vitest';
import {
  CLIENTS, DIFFICULTY, HEAD_CONTRACTORS, NAMES, YARDS, accept, askWait, bookable, costIdx, endOfDay, genOffers, hireDay,
  int, lateChase, lateFriendly, latePark, lateWait, newAccounts, newLoan, pick, rateFactor, recvWeek, relAdd, relPts,
  relTier, relWeek, seedRand, settleJob, startWeek, stars, waitOdds, wetDay, whyNot, workshopCtx,
  type Biz, type ContractBiz, type Difficulty, type HireEvent, type Machine, type MachineType, type Person, type Role, type TownId, type WeekReport,
} from '../src';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const LOAN_FOR: Record<Difficulty, number> = { easy: 350000, normal: 180000, hard: 80000, hc: 80000 };
const TEXT = ['title', 'detail', 'catch', 'pay'];

const strip = (o: any) => { const c = { ...o }; for (const k of TEXT) delete c[k]; return c; };
/** The prototype's job log carries a title and short key names; the engine's doesn't. */
const jlogAsEngine = (x: any) => ({ w: x.w, kind: x.k, client: x.c, rev: x.rev, cost: x.cost, plan: x.plan, oh: x.oh, cut: x.cut, sub: x.sub, part: x.part });

function randomFleet(R: () => number): Machine[] {
  const kinds: MachineType[] = ['grader', 'grader', 'roller', 'cart', 'cart', 'truck'];
  return Array.from({ length: int(R, 1, 7) }, (_, i) => ({
    id: 'm' + i, type: pick(R, kinds), year: int(R, 2005, 2020), cond: int(R, 30, 92), hours: int(R, 5000, 15000), svcAt: 0,
    status: 'idle', down: R() < 0.1 ? int(R, 1, 3) : 0, cover: 0, warranty: 0, jobId: null, sale: null,
  })).map((m) => ({ ...m, svcAt: m.hours - int(R, 0, 240) }));
}

function randomStaff(R: () => number): Person[] {
  return Array.from({ length: int(R, 0, 4) }, (_, i) => ({
    id: 'p' + i, name: NAMES[i]!, role: pick(R, ['grader', 'roller', 'cart', 'truck'] as Role[]), skill: pick(R, ['green', 'solid', 'gun'] as const),
    wage: 1800, off: R() < 0.1 ? int(R, 1, 2) : 0, jobId: null,
  }));
}

/** A random hire business, as the engine's Biz and as the prototype's career. */
function randomBiz(R: () => number) {
  const d: Difficulty = pick(R, ['easy', 'normal', 'hard', 'hc']), town: TownId = pick(R, ['gdi', 'ct']);
  const b: Biz = {
    week: int(R, 1, 300), town, bank: 80000, seq: int(R, 0, 400), fleet: randomFleet(R), staff: randomStaff(R), jobs: [], offers: [], recv: [],
    rep: int(R, 0, 25), blocked: R() < 0.2 ? { [pick(R, HEAD_CONTRACTORS)]: 9999 } : {}, youJob: null, youBlocked: R() < 0.1 ? 1 : 0, opCover: 0, coverFor: null,
    acc: newAccounts(80000), queue: [], stats: { earned: 0 }, freeze: R() < 0.1 ? 9999 : 0,
  };
  const wxStart = int(R, 0, 10000), won = R() < 0.6, won2 = won && R() < 0.5, fm = pick(R, [0.6, 1, 1.3]);
  const S: any = {
    ...JSON.parse(JSON.stringify(b)), wxStart, won, won2, loanStart: LOAN_FOR[d], hardcore: d === 'hc', mkt: { f: fm * 1.1, mood: 'steady' },
    yard: 'home', log: [], news: [], tix: {}, coach: { off: true }, loan: newLoan(0), ins: 1, acc: { b0: 80000, jc: 0, jco: 0, ws: 0, cap: 0, loan: 0, coll: 0, md: 0, brk: 0, bd: 0 },
  };
  // how busy the work is, with the funding freeze's cut when one's on (market.ts fmul)
  return { b, S, d, wx: { town, wxStart }, won, won2, fm: fm * ((b.freeze ?? 0) > b.week ? 0.35 : 1) };
}

function expectSame(b: Biz, S: any) {
  expect(b.bank).toBeCloseTo(S.bank, 6);
  expect(b.fleet).toEqual(S.fleet);
  expect(b.staff).toEqual(S.staff);
  expect(b.jobs).toEqual(S.jobs.map(strip));
  expect(b.offers).toEqual(S.offers.map(strip));
  expect(b.recv).toEqual(S.recv);
  expect(b.rep).toBe(S.rep);
  expect(b.youJob ?? null).toBe(S.youJob ?? null);
  expect(b.queue).toEqual(S.queue);
  expect(b.blocked).toEqual(S.blocked);
  expect(b.acc.jobCosts).toBeCloseTo(S.acc.jc, 6);
  expect(b.acc.machineDays).toBe(S.acc.md);
  expect(b.acc.breakdowns).toBe(S.acc.brk);
  expect((b.jlog || []).map(({ tn, ...x }) => x)).toEqual((S.jlog || []).map(jlogAsEngine));
}

describe('offers', () => {
  it('tables and rates match', () => {
    expect(CLIENTS).toEqual(P.CLIENTS);
    const R = seedRand(61);
    for (let i = 0; i < 500; i++) {
      const rep = int(R, 0, 30), fm = pick(R, [0.5, 1, 1.4]);
      P.setS({ rep, mkt: { f: fm * 1.1, mood: 'steady' }, week: 1 });
      expect(stars(rep)).toBe(P.stars());
      expect(rateFactor(rep, fm)).toBeCloseTo(P.rateFactor(), 12);
    }
  });

  it('the same offers come up, and the same reasons you can or can\'t take them', () => {
    const R = seedRand(62);
    const kinds: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      const { b, S, won, won2, fm } = randomBiz(R), seed = int(R, 1, 1e9);
      P.setS(S);
      P.withRNG(P.seedRand(seed), () => P.genOffers());
      b.offers = genOffers(seedRand(seed), b, fm, won, won2);
      expect(b.offers).toEqual(S.offers.map(strip));
      expect(b.seq).toBe(S.seq);
      for (const o of b.offers) {
        const theirs = P.whyNot(S.offers.find((x: any) => x.id === o.id));
        const mine = whyNot(b, o);
        expect(!!mine).toBe(!!theirs);
        { const k = o.enq ? 'enq' : o.kind; kinds[k] = (kinds[k] || 0) + 1; }
      }
    }
    for (const k of ['wet', 'dry', 'council', 'private']) expect(kinds[k]).toBeGreaterThan(300);
  });
});

describe('a few weeks of hire work', () => {
  it('whole businesses run the same, week after week', () => {
    const R = seedRand(63);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 400; i++) {
      const { b, S, d, wx, won, won2, fm } = randomBiz(R);
      const ctx = () => workshopCtx(b.staff, b.fleet.length, YARDS.home.svc, DIFFICULTY[d].brk, costIdx(b.week, d));
      for (let wk = 0; wk < 6; wk++) {
        // the offers, and take a few
        const so = int(R, 1, 1e9);
        P.setS(S);
        P.withRNG(P.seedRand(so), () => P.genOffers());
        b.offers = genOffers(seedRand(so), b, fm, won, won2);
        for (const o of b.offers.slice()) {
          if (R() < 0.5) continue;
          if (R() < 0.3 && bookable(b, o)) {
            // ring and ask them to wait
            const sw = int(R, 1, 1e9);
            P.setS(S);
            const theirs = P.bookable(S.offers.find((x: any) => x.id === o.id));
            expect(theirs?.id).toBe(bookable(b, o)?.id);
            expect(waitOdds(b, wx, o, bookable(b, o)!)).toEqual(P.waitOdds(o, theirs));
            P.withRNG(P.seedRand(sw), () => P.askWait(o.id));
            const ans = askWait(seedRand(sw), b, wx, o.id);
            seen[ans?.yes ? 'booked' : 'refused'] = (seen[ans?.yes ? 'booked' : 'refused'] || 0) + 1;
          } else {
            P.setS(S);
            P.accept(o.id);
            if (accept(b, o.id)) seen.taken = (seen.taken || 0) + 1;
          }
        }
        // sometimes someone's off sick
        if (b.staff.length && R() < 0.15) { const k = int(R, 0, b.staff.length - 1); b.staff[k]!.off = S.staff[k].off = 1; }
        expectSame(b, S);

        // the working week
        const sw = int(R, 1, 1e9), rep: WeekReport = { worked: 0, lost: 0, invoiced: 0, paid: 0, costs: 0 };
        const prep: any = { worked: 0, lost: 0, invoiced: 0, paid: 0, costs: 0, events: [] };
        const dd: Record<string, number> = {}, pdd: Record<string, number> = {}, ev: HireEvent[] = [];
        P.setS(S);
        P.withRNG(P.seedRand(sw), () => {
          P.__startWeek();
          for (let day = 0; day < 5; day++) {
            const wet = P.wetDay(S.week, day);
            S.jobs.forEach((j: any) => P.__day(j, day, wet, prep, pdd));
            P.__afterDay(day, prep);
          }
          S.jobs.slice().forEach((j: any) => P.__settle(j, prep, pdd));
          P.__recv(prep);
        });
        const rand = seedRand(sw), lateMult = DIFFICULTY[d].late;
        startWeek(b);
        for (let day = 0; day < 5; day++) {
          const wet = wetDay(wx, b.week, day), w = ctx();
          for (const j of b.jobs) hireDay(rand, b, j, day, wet, w, rep, dd, ev);
          endOfDay(b as ContractBiz, day, ev);
        }
        for (const j of b.jobs.slice()) settleJob(rand, b as ContractBiz, j, rep, dd, false, ev);
        recvWeek(rand, b, rep, lateMult, false, ev);

        expectSame(b, S);
        expect(rep.worked).toBe(prep.worked);
        expect(rep.lost).toBe(prep.lost);
        expect(rep.invoiced).toBeCloseTo(prep.invoiced, 6);
        expect(rep.paid).toBe(prep.paid);
        expect(rep.costs).toBeCloseTo(prep.costs, 6);
        expect(b.stats.earned).toBe(S.stats.earned);
        for (const e of ev) seen[e.k] = (seen[e.k] || 0) + 1;

        // a late payer's card waits for the player: settle it the friendly way so the week can go on
        for (const q of b.queue.filter((x) => x.k === 'late')) {
          const x = b.recv.find((y) => y.id === q.id)!, px = S.recv.find((y: any) => y.id === q.id);
          lateFriendly(b, x);
          P.setS(S);
          P.withRNG(P.seedRand(1), () => P.curve({ k: 'late', id: q.id, sd: 1 }).opts[1].go());
          expect(x).toEqual(px);
        }
        b.queue = b.queue.filter((x) => x.k !== 'late');
        S.queue = S.queue.filter((x: any) => x.k !== 'late');
        // breakdowns get fixed straight away here, so jobs carry on
        for (const m of b.fleet) if (m.down === 99) m.down = 0;
        for (const m of S.fleet) if (m.down === 99) m.down = 0;
        b.queue = b.queue.filter((x) => x.k !== 'break');
        S.queue = S.queue.filter((x: any) => x.k !== 'break');
        b.week++;
        S.week++;
        for (const p of b.staff) if (p.off > 0) p.off--;
        for (const p of S.staff) if (p.off > 0) p.off--;
        if (b.youBlocked > 0) { b.youBlocked--; S.youBlocked--; }
      }
    }
    for (const k of ['taken', 'booked', 'refused', 'finished', 'late', 'breakdown']) expect(seen[k], k).toBeGreaterThan(10);
  });
});

describe('getting paid', () => {
  it('one late card per client every 8 weeks, over 30 weeks of weekly invoices', () => {
    const R = seedRand(66);
    let late = 0;
    for (let i = 0; i < 300; i++) {
      const { b, S, d } = randomBiz(R);
      const numbers = R() < 0.3;
      if (numbers) S.staff.push({ id: 'ops', name: 'Bec', role: 'ops', skill: 'solid', wage: 3400, off: 0, jobId: null, trait: 'numbers' });
      for (let wk = 0; wk < 30; wk++) {
        // every head contractor has an invoice falling due this week
        for (const c of HEAD_CONTRACTORS) {
          const x = { id: 'r' + wk + c, client: c, amt: 5000, due: b.week, lateRolled: false };
          b.recv.push({ ...x }); S.recv.push({ ...x });
        }
        const seed = int(R, 1, 1e9), rep: WeekReport = { worked: 0, lost: 0, invoiced: 0, paid: 0, costs: 0 };
        P.setS(S);
        P.withRNG(P.seedRand(seed), () => P.__recv({ paid: 0, events: [] }));
        recvWeek(seedRand(seed), b, rep, DIFFICULTY[d].late, numbers, []);
        expect(b.recv).toEqual(S.recv);
        expect(b.lateCd ?? {}).toEqual(S.lateCd ?? {});
        expect(b.queue).toEqual(S.queue);
        expect(b.bank).toBe(S.bank);
        b.week++; S.week++;
      }
      late += b.queue.length;
    }
    expect(late).toBeGreaterThan(500);
  });
});

describe('the late-payer card', () => {
  it('chase it, ring the boss, park the machine, or wait it out', () => {
    const R = seedRand(64);
    for (let i = 0; i < 2000; i++) {
      const { b, S } = randomBiz(R);
      const client = pick(R, HEAD_CONTRACTORS), amt = int(R, 20, 400) * 100;
      const x = { id: 'r1', client, amt, due: 9999, lateRolled: true };
      b.recv.push({ ...x }); S.recv.push({ ...x });
      const onHire = R() < 0.4;
      if (onHire) {
        const m = b.fleet[0]!;
        const j: any = { id: 'j1', kind: 'wet', type: m.type, client, place: 'Talwood', days: 10, done: 3, rate: 1500, fixed: 0, terms: 4, fuelPaid: false, mId: m.id, who: null, rollerId: null, hireIn: 0, extra: 0, earned: 0, idleWeeks: 0 };
        m.status = 'job'; m.jobId = 'j1'; S.fleet[0].status = 'job'; S.fleet[0].jobId = 'j1';
        b.jobs.push({ ...j }); S.jobs.push({ ...j, title: 'Wet hire' });
      }
      const opt = int(R, 0, 2), seed = int(R, 1, 1e9);
      P.setS(S);
      P.withRNG(P.seedRand(seed), () => P.curve({ k: 'late', id: 'r1', sd: 1 }).opts[opt].go());
      const mine = b.recv.find((y) => y.id === 'r1')!;
      if (opt === 0) lateChase(b, mine);
      if (opt === 1) lateFriendly(b, mine);
      if (opt === 2) { if (onHire) latePark(b, mine, b.jobs[0]!, []); else lateWait(seedRand(seed), b, mine); }
      expect(b.bank).toBe(S.bank);
      expect(b.recv).toEqual(S.recv);
      expect(b.blocked).toEqual(S.blocked);
      expect(b.rel ?? {}).toEqual(S.rel ?? {});
      expect(b.jobs).toEqual(S.jobs.map(strip));
      expect(b.fleet).toEqual(S.fleet);
    }
  });
});

describe('standing with head contractors', () => {
  it('tiers, points and fading match', () => {
    const R = seedRand(65);
    for (let i = 0; i < 3000; i++) {
      const c = pick(R, [...HEAD_CONTRACTORS, 'Goondiwindi council']), st: any = { rel: R() < 0.8 ? { [c]: int(R, -10, 10) } : undefined, week: int(R, 1, 100), log: [] };
      const S = JSON.parse(JSON.stringify(st));
      P.setS(S);
      expect(relTier(st.rel, c)).toBe(P.relTier(c).k);
      expect(relPts(st.rel, c)).toBe(P.relPts(c));
      const dlt = int(R, -5, 5);
      P.relAdd(c, dlt); relAdd(st, c, dlt);
      expect(st.rel ?? null).toEqual(S.rel ?? null);
      P.relWeek(); relWeek(st);
      expect(st.rel ?? null).toEqual(S.rel ?? null);
    }
  });
});
