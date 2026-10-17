// Shocks, selling up, buying a rival out, and the branch depot, against the prototype on real careers.

import { describe, expect, it } from 'vitest';
import {
  BR_SLOTS, DIFFICULTY, YARDS, askSellUp, brCrews, brRaise, brTender, brTenderCard, branchWeek, buyOutAll, buyOutBest, buyOutOffer,
  buyOutPay, canBranch, canBuyOut, closeBranch, collapseCard, collapseClaim, collapseSell, costIdx, insureBroker, int, meStretched,
  odLimit, openBranch, pick, seedRand, sellAll, sellBest, sellBuyer, sellPrice, sellTwo, sellUpWeek, shockWeek, stars, toBranch,
  toHome, walkAway, workshopCtx, lendCap, fleetValue, taxMode, gstInBank,
  type BranchEvent, type Difficulty, type HireEvent, type ShockEvent,
} from '../src';
import { accFromProto, playProto } from './bot';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const LOAN_D: Record<number, Difficulty> = { 80000: 'hard', 180000: 'normal', 350000: 'easy' };
const diffOf = (S: any): Difficulty => (S.hardcore ? 'hc' : LOAN_D[S.loanStart] ?? 'normal');

function snapshots(n: number, seed: number): any[] {
  const R = seedRand(seed), out: any[] = [];
  for (let i = 0; i < n; i++) {
    const loan = pick(R, [80000, 180000, 350000]), town = pick(R, ['gdi', 'ct'] as const), hc = R() < 0.3, weeks = int(R, 30, 160);
    const at = new Set([int(R, 10, weeks), int(R, 10, weeks), int(R, 10, weeks)]);
    playProto(P, int(R, 1, 1e9), { loan, town, hc, weeks, each: (S, w) => { if (at.has(w)) out.push(clone(S)); } });
  }
  return out;
}
const SNAPS = snapshots(40, 211);

/** Both sides of a snapshot: the prototype's, and the engine's (accounts renamed). */
function pair(S0: any) {
  const S = clone(S0), b = clone(S0);
  b.acc = accFromProto(S.acc);
  return { S, b };
}
const roomOf = (b: any) => () => YARDS[b.yard as keyof typeof YARDS].slots - b.fleet.filter((m: any) => m.status !== 'branch').length;

describe('shocks', () => {
  it('the same shocks hit the same businesses', () => {
    const R = seedRand(212);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      S.won = b.won = true;
      S.won2 = b.won2 = R() < 0.5;
      // the last shock long ago, or 20 to 30 weeks back so the 26-week gap is tested
      S.shockLast = b.shockLast = R() < 0.5 ? 0 : S.week - int(R, 20, 30);
      // a head contractor owing plenty, sometimes
      if (R() < 0.5) { const x = { id: 'big', client: pick(R, ['Border Civil', 'Hartley Bros']), amt: int(R, 10, 60) * 1000, due: S.week + 3, lateRolled: false }; S.recv.push(clone(x)); b.recv.push(clone(x)); }
      // Hardcore, where shocks come most often
      S.hardcore = b.hardcore = true;
      const d: Difficulty = 'hc', seed = int(R, 1, 1e9);
      P.setS(S);
      P.withRNG(P.seedRand(seed), () => P.shockWeek({ events: [] }));
      const ev: ShockEvent[] = [], hev: HireEvent[] = [];
      shockWeek(seedRand(seed), b, d, ev, hev);
      expect(b.recv).toEqual(S.recv);
      expect(b.jobs).toEqual(S.jobs);
      expect(b.tenders).toEqual(S.tenders);
      expect(b.blocked).toEqual(S.blocked);
      expect(b.queue).toEqual(S.queue);
      expect(b.freeze ?? 0).toBe(S.freeze ?? 0);
      expect(b.insHard ?? 0).toBe(S.insHard ?? 0);
      expect(b.acc.badDebts).toBe(S.acc.bd);
      for (const e of ev) seen[e.k] = (seen[e.k] || 0) + 1;
    }
    for (const k of ['collapse', 'freeze', 'insure']) expect(seen[k] ?? 0, k).toBeGreaterThan(5);
  });

  it('the shock cards: a claim or a collector, and the insurance broker', () => {
    const R = seedRand(213);
    for (let i = 0; i < 600; i++) {
      const { S, b } = pair(pick(R, SNAPS)), debt = int(R, 15, 200) * 1000, sd = int(R, 1, 1e9), seed = int(R, 1, 1e9);
      P.setS(S);
      if (R() < 0.6) {
        const c = P.curve({ k: 'collapse', name: 'Border Civil', debt, sd }), opt = int(R, 0, 1);
        c.opts[opt].go();
        const cc = collapseCard(seedRand(sd), debt);
        if (opt === 0) collapseClaim(b, 'Border Civil', cc.dividend); else collapseSell(b, cc.sell);
      } else {
        const c = P.curve({ k: 'insure', sd });
        P.withRNG(P.seedRand(seed), () => c.opts[1].go());
        insureBroker(seedRand(seed), b);
      }
      expect(b.bank).toBe(S.bank);
      expect(b.recv).toEqual(S.recv);
      expect(b.insX ?? 0).toBe(S.insX ?? 0);
      expect(b.acc.collections).toBe(S.acc.coll);
      expect(b.acc.badDebts).toBe(S.acc.bd);
    }
  });
});

describe('selling up', () => {
  it('who is stretched, who would buy, and when they ring', () => {
    const R = seedRand(214);
    let rang = 0;
    for (let i = 0; i < 3000; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      S.bank = b.bank = pick(R, [S.bank, -50000, -300000]);
      S.loan.missed = b.loan.missed = int(R, 0, 1);
      S.sellAsk = b.sellAsk = [undefined, S.week - 5, S.week - 20][int(R, 0, 2)];
      P.setS(S);
      const od = odLimit(b);
      expect(meStretched(b, od)).toBe(P.meStretched());
      expect(sellBuyer(b.rivals)?.name).toBe(P.sellBuyer()?.name);
      const seed = int(R, 1, 1e9);
      P.withRNG(P.seedRand(seed), () => P.sellUpWeek());
      sellUpWeek(seedRand(seed), b, od);
      expect(b.queue).toEqual(S.queue);
      expect(b.sellAsk).toBe(S.sellAsk);
      if (b.queue.some((q: any) => q.k === 'sellup')) rang++;
    }
    expect(rang).toBeGreaterThan(100);
  });

  it('selling two machines, or the whole business', () => {
    const R = seedRand(215);
    let two = 0, all = 0;
    for (let i = 0; i < 1500; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      S.bank = b.bank = -60000;
      P.setS(S);
      if (!P.askSellUp(true)) continue;
      askSellUp(b, true);
      const q = S.queue.find((x: any) => x.k === 'sellup'), x = b.rivals.find((y: any) => y.name === q.name);
      const mood = (S.mkt?.mood ?? 'steady'), c = P.curve({ ...q, sd: 1 });
      if (!c) continue;
      const mode = taxMode(S.loanStart, !!S.hardcore), held = S.gst && gstInBank(mode) ? S.gst.held : 0;
      expect(sellPrice(b, mood, stars(b.rep))).toEqual(P.sellPrice());
      expect(walkAway(b, sellPrice(b, mood, stars(b.rep)).price, held)).toBe(P.walkAway(P.sellPrice().price));
      expect(sellBest(b).map((m) => m.id)).toEqual(P.sellBest().map((m: any) => m.id));
      const label = (k: string) => c.opts.findIndex((o: any) => o.label.startsWith(k));
      if (R() < 0.6 && label('Sell them two') >= 0) {
        c.opts[label('Sell them two')].go();
        sellTwo(b, x, mood);
        two++;
      } else {
        const rung = P.rung();
        c.opts[label('Sell them the whole')].go();
        sellAll(b, x, mood, stars(b.rep), held, { stage: rung, peak: rung });
        expect(b.phase).toBe('sold');
        const { to, price, walk, week, fleet, earned } = S.soldUp;
        expect(b.soldUp).toEqual({ to, price, walk, week, stage: rung, peak: rung, fleet, earned });
        all++;
      }
      expect(b.bank).toBe(S.bank);
      expect(b.fleet).toEqual(S.fleet);
      expect(b.jobs).toEqual(S.jobs);
      expect(b.rivals).toEqual(S.rivals);
      expect(b.acc.capital).toBe(S.acc.cap);
    }
    expect(two).toBeGreaterThan(100);
    expect(all).toBeGreaterThan(100);
  });
});

describe('buying a rival out', () => {
  it('their yard, the price, how you pay, and what you get', () => {
    const R = seedRand(216);
    let whole = 0, best = 0;
    for (let i = 0; i < 1500; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      S.won2 = b.won2 = true;
      S.loan.missed = b.loan.missed = 0;
      S.bank = b.bank = pick(R, [S.bank, 150000, 600000]);
      const k = int(R, 0, S.rivals.length - 1), x = b.rivals[k], sd = int(R, 1, 1e9), seed = int(R, 1, 1e9);
      P.setS(S);
      expect(canBuyOut(b)).toBe(P.canBuyOut());
      const c = P.curve({ k: 'buyout', name: x.name, sd });
      const o = buyOutOffer(seedRand(sd), b, x);
      expect(o.yard).toEqual(S.rivals[k].yard);
      const cap = lendCap(fleetValue(b.fleet, b.week), !!b.won, !!b.won2, !!b.won3);
      expect(buyOutPay(b, o.price, o.v, cap)).toEqual(P.buyOutPay(o.price, o.v));
      const iw = c.opts.findIndex((op: any) => op.label.startsWith('Buy the whole')), ib = c.opts.findIndex((op: any) => op.label.startsWith('Just buy'));
      const take = R() < 0.6 ? iw : ib;
      if (take < 0) continue;
      P.withRNG(P.seedRand(seed), () => c.opts[take].go());
      if (take === iw) { buyOutAll(seedRand(seed), b, x, o, buyOutPay(b, o.price, o.v, cap), roomOf(b)); whole++; }
      else { buyOutBest(seedRand(seed), b, x, o, buyOutPay(b, o.bprice, o.bv, cap), roomOf(b)); best++; }
      expect(b.bank).toBe(S.bank);
      expect(b.loan).toEqual(S.loan);
      expect(b.fleet).toEqual(S.fleet);
      expect(b.staff).toEqual(S.staff);
      expect(b.rivals).toEqual(S.rivals);
      expect(b.rep).toBe(S.rep);
      expect(b.gone ?? []).toEqual(S.gone ?? []);
      expect(b.acc.capital).toBe(S.acc.cap);
    }
    expect(whole).toBeGreaterThan(100);
    expect(best).toBeGreaterThan(100);
  });
});

describe('the branch depot', () => {
  it('opening it, floating gear there, a year of its weeks, and its cards', () => {
    const R = seedRand(217);
    let weeks = 0, cards = 0;
    for (let i = 0; i < 120; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      Object.assign(S, { won3: true, yard: 'hub', bank: 900000 }); Object.assign(b, { won3: true, yard: 'hub', bank: 900000 });
      delete S.season; delete b.season;
      // enough gear for crews
      for (let k = 0; k < 9; k++) { const m = { id: 'x' + k, type: ['grader', 'roller', 'cart'][k % 3], year: 2015, cond: int(R, 40, 90), hours: 9000, svcAt: 9000 - int(R, 0, 260), status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null }; S.fleet.push(clone(m)); b.fleet.push(clone(m)); }
      P.setS(S);
      expect(canBranch(b)).toBe(P.canBranch());
      const kind = pick(R, ['gun', 'green'] as const), s0 = int(R, 1, 1e9);
      P.withRNG(P.seedRand(s0), () => P.openBranch(kind));
      openBranch(seedRand(s0), b, kind);
      for (const m of S.fleet.filter((m: any) => m.status === 'idle' && R() < 0.8).slice(0, BR_SLOTS)) { P.toBranch(m.id); toBranch(b, m.id); }
      expect(b.branch).toEqual(S.branch);
      expect(brCrews(b.fleet)).toEqual(P.brCrews());
      const d = diffOf(S);
      for (let wk = 0; wk < 52; wk++) {
        const seed = int(R, 1, 1e9), prep = { costs: 0, invoiced: 0, events: [] as string[] }, rep = { worked: 0, lost: 0, invoiced: 0, paid: 0, costs: 0 }, ev: BranchEvent[] = [];
        P.setS(S);
        P.withRNG(P.seedRand(seed), () => P.branchWeek(prep));
        const w = workshopCtx(b.staff, b.fleet.filter((m: any) => m.status !== 'branch').length, YARDS.hub.svc, DIFFICULTY[d].brk, costIdx(b.week, d));
        branchWeek(seedRand(seed), b, w, P.fmul(), DIFFICULTY[d].mg, costIdx(b.week, d), (S.whs?.sys ?? 0), rep, b.acc, ev);
        expect(b.branch).toEqual(S.branch);
        expect(b.fleet).toEqual(S.fleet);
        expect(b.bank).toBeCloseTo(S.bank, 4);
        expect(b.recv).toEqual(S.recv);
        expect(b.queue).toEqual(S.queue);
        expect(rep.costs).toBe(prep.costs);
        weeks++;
        // the manager's cards, answered at random
        const q = S.queue.find((x: any) => x.k === 'brtender' || x.k === 'brraise');
        if (q) {
          const sd = int(R, 1, 1e9), s2 = int(R, 1, 1e9), c = P.curve({ ...q, sd });
          if (c) {
            const opt = int(R, 0, c.opts.length - 1);
            P.withRNG(P.seedRand(s2), () => c.opts[opt].go());
            if (q.k === 'brtender') { if (opt < 2) brTender(seedRand(s2), b, brTenderCard(seedRand(sd)), opt === 0); }
            else brRaise(seedRand(s2), b, opt === 0);
            expect(b.branch).toEqual(S.branch);
            cards++;
          }
          S.queue = S.queue.filter((x: any) => x !== q);
          b.queue = b.queue.filter((x: any) => x.k !== q.k);
        }
        for (const m of b.fleet) if (m.down > 0 && m.down < 99) m.down--;
        for (const m of S.fleet) if (m.down > 0 && m.down < 99) m.down--;
        S.week++; b.week++;
      }
      const home = S.fleet.find((m: any) => m.status === 'branch');
      if (home) { P.setS(S); P.toHome(home.id); toHome(b, home.id, roomOf(b)()); }
      if (R() < 0.5) { P.setS(S); P.closeBranch(); closeBranch(b); }
      expect(b.fleet).toEqual(S.fleet);
      expect(b.bank).toBeCloseTo(S.bank, 4);
      expect(b.branch ?? null).toEqual(S.branch ?? null);
    }
    expect(weeks).toBeGreaterThan(5000);
    expect(cards).toBeGreaterThan(50);
  });
});
