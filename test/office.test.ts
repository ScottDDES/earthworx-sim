// The office against the prototype, on careers the prototype played itself.

import { describe, expect, it } from 'vitest';
import {
  bankCalls, bankMoreTime, basPay, basPlan, claimFinance, closeBooks, debtors, gstInBank, hardcoreWeek, int, netWorth, odLimit,
  payablesWeek, pick, plOf, repossess, rvWorth, seedRand, taxMode, taxWeek, utilOf, weeklyRepay, workInHand, yearEnd, release, newLoan,
  type BankCallEvent, type HardcoreEvent, type TaxEvent, type TaxMode,
} from '../src';
import { accFromProto, playProto } from './bot';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const QNAME: Record<number, string> = { 6: 'April to June', 9: 'July to September', 0: 'October to December', 3: 'January to March' };

/** Snapshots of real careers: a few per career, across difficulties, towns and Hardcore. */
function snapshots(n: number, seed: number): any[] {
  const R = seedRand(seed), out: any[] = [];
  for (let i = 0; i < n; i++) {
    const loan = pick(R, [80000, 180000, 350000]), town = pick(R, ['gdi', 'ct'] as const), hc = R() < 0.25, weeks = int(R, 20, 160);
    const at = new Set([int(R, 5, weeks), int(R, 5, weeks), int(R, 5, weeks)]);
    playProto(P, int(R, 1, 1e9), { loan, town, hc, weeks, each: (S, w) => { if (at.has(w)) out.push(clone(S)); } });
  }
  return out;
}

const SNAPS = snapshots(40, 111);

describe('the business on paper', () => {
  it('net worth, work in hand, debtors and the overdraft limit match', () => {
    expect(SNAPS.length).toBeGreaterThan(80);
    for (const S of SNAPS) {
      P.setS(clone(S));
      const mode: TaxMode = taxMode(S.loanStart, !!S.hardcore);
      expect(mode).toBe(P.taxMode());
      expect(gstInBank(mode)).toBe(P.gstInBank());
      expect(netWorth(S, mode)).toBe(P.netWorth());
      expect(workInHand(S.jobs)).toBeCloseTo(P.workInHand(), 6);
      expect(debtors(S.recv)).toBe(P.debtors());
      expect(claimFinance(S.recv, S.town)).toBe(P.claimFinance());
      expect(odLimit(S)).toBe(P.odLimit());
      // the bot's careers are young: try every step of the ladder for the overdraft limit
      for (const [won, won2, won3] of [[false, false, false], [true, false, false], [true, true, false], [true, true, true]]) {
        const T = { ...clone(S), won, won2, won3 };
        P.setS(T);
        expect(odLimit(T)).toBe(P.odLimit());
      }
    }
  });
});

describe('the end of the week in the office', () => {
  it('paying subbies and the tax office, and the bank ringing', () => {
    const R = seedRand(112);
    let calls = 0;
    for (const S0 of SNAPS) {
      for (let k = 0; k < 4; k++) {
        const S = clone(S0), mine = clone(S0);
        // money troubles: deep in the overdraft, missed repayments, bills falling due
        S.bank = mine.bank = pick(R, [S0.bank, -30000, -200000, -400000]);
        const missed = int(R, 0, 3);
        S.loan.missed = mine.loan.missed = missed;
        S.odOver = mine.odOver = int(R, 0, 2);
        const due = [{ to: 'Doherty Grading', amt: 5000, due: S.week }, { to: 'Tax office', amt: 3000, due: S.week, ato: true }, { to: 'Two Gates Plant', amt: 900, due: S.week + 3 }];
        S.payables = clone(due); mine.payables = clone(due);
        S.acc.gst = 0;
        mine.acc = accFromProto(S.acc);
        P.setS(S);
        const BK = { pays: 0 }, prep = { costs: 0, events: [] as string[] };
        P.__payables(prep, BK);
        P.__bankCalls(prep);
        const rep = { costs: 0 }, ev: BankCallEvent[] = [];
        const pays = payablesWeek(mine, rep);
        bankCalls(mine, odLimit(mine), ev);
        expect(pays).toBe(BK.pays);
        expect(rep.costs).toBe(prep.costs);
        expect(mine.bank).toBe(S.bank);
        expect(mine.acc.gst).toBe(S.acc.gst);
        expect(mine.payables).toEqual(S.payables);
        expect(mine.odOver).toBe(S.odOver);
        expect(mine.queue).toEqual(S.queue);
        expect(ev.length).toBe(prep.events.length);
        calls += mine.queue.filter((q: any) => q.k === 'repo' || q.k === 'bankcall').length;
      }
    }
    expect(calls).toBeGreaterThan(50);
  });

  it('closing the books: GST, the history row, a fresh set of accounts', () => {
    const R = seedRand(113);
    for (const S0 of SNAPS) {
      const S = clone(S0);
      // half the time, two full years of history already, so the oldest week drops off
      if (R() < 0.5 && (S.hist || []).length) while (S.hist.length < 104) S.hist.unshift({ ...S.hist[0], w: S.hist[0].w - 1 });
      const mine = clone(S);
      mine.acc = accFromProto(S.acc);
      const rep = { week: S.week - 1, invoiced: int(R, 0, 60000), paid: int(R, 0, 60000), rain: int(R, 0, 5) }, over = int(R, 1500, 9000);
      const BK = { pays: int(R, 0, 8000), odi: int(R, 0, 900), lc: int(R, 0, 4000), li: int(R, 0, 1500) };
      P.setS(S);
      const prem = P.premium(), rent = ({ home: 0, fenced: 250, depot: 700, regional: 1600, hub: 3200 } as any)[S.yard || 'home'];
      P.closeBooks(clone(rep), BK, over);
      closeBooks(mine, { w: rep.week, invoiced: rep.invoiced, paid: rep.paid, rain: rep.rain, over, premium: prem, rent, wages: P.wages(), staffN: (S.staff || []).length, mode: taxMode(S.loanStart, !!S.hardcore) }, BK);
      expect(mine.bank).toBe(S.bank);
      expect(mine.gst).toEqual(S.gst);
      expect(mine.hist).toEqual(S.hist);
      expect(mine.acc).toEqual(accFromProto(S.acc));
    }
  });

  it('GST quarters, the BAS falling due, and 30 June', () => {
    let quarters = 0, years = 0;
    for (const S0 of SNAPS) {
      // the week each month closes, with something owing
      for (let back = 0; back < 3; back++) {
        const S = clone(S0), mine = clone(S0);
        S.gst = S.gst || { held: 0, qIn: 0, qOut: 0, due: [], plans: 0 };
        S.gst.qIn += 20000; S.gst.qOut += 12000;
        S.gst.due.push({ id: 'old', amt: back === 1 ? -500 : 4000, qIn: 9000, qOut: 5000, q: 'January to March 2028', due: S.week });
        // the prototype names a quarter in words; the engine keeps its month and year
        const qm = (q: string) => +Object.keys(QNAME).find((k) => q.startsWith(QNAME[+k]!))!, qy = (q: string) => +q.slice(-4);
        mine.gst = clone({ ...S.gst, due: S.gst.due.map((d: any) => ({ id: d.id, amt: d.amt, qIn: d.qIn, qOut: d.qOut, qm: qm(d.q), qy: qy(d.q), due: d.due })) });
        mine.acc = accFromProto(S.acc);
        const w0 = S.week - 1 - back * 2;
        P.setS(S);
        let reviewed = false;
        const ev: TaxEvent[] = [];
        P.taxWeek({ week: w0, events: [] });
        const done = taxWeek(mine, w0, taxMode(S.loanStart, !!S.hardcore), ev);
        expect(mine.bank).toBe(S.bank);
        expect(mine.gst.held).toBe(S.gst.held);
        expect(mine.gst.qIn).toBe(S.gst.qIn);
        expect(mine.gst.due.map(({ qm: m, qy: y, ...d }: any) => ({ ...d, q: QNAME[m] + ' ' + y }))).toEqual(S.gst.due);
        if (done) {
          Object.assign(mine, { staffN: (S0.staff || []).length, fleetN: S0.fleet.length });
          const y = yearEnd(mine, w0, netWorth(mine, taxMode(S.loanStart, !!S.hardcore)));
          reviewed = !!y;
          years += y ? 1 : 0;
        }
        expect(reviewed).toBe(S.queue.some((q: any) => q.k === 'yearend'));
        expect(mine.queue).toEqual(S.queue);
        if (ev.some((e) => e.k === 'quarterClosed')) quarters++;
      }
    }
    expect(quarters).toBeGreaterThan(5);
  });

  it('the year in review', () => {
    let reviews = 0;
    for (const S0 of SNAPS) {
      if (!(S0.hist || []).length) continue;
      const S = clone(S0), mine = clone(S0), w = S.hist[S.hist.length - 1].w;
      P.setS(S);
      P.yearEnd(w);
      Object.assign(mine, { staffN: (S0.staff || []).length, fleetN: S0.fleet.length });
      const y = yearEnd(mine, w, P.netWorth());
      const theirs = (S.years || [])[(S.years || []).length - 1];
      if (!y) { expect(S.queue.some((q: any) => q.k === 'yearend')).toBe(false); continue; }
      reviews++;
      const { fy, best, worst, ...rest } = theirs;
      const { first, best: b2, worst: w2, ...mineRest } = y;
      expect(mineRest).toEqual(rest);
      expect(first).toBe(/^Your first/.test(fy));
      expect(b2 ? { rev: b2.rev, m: b2.m } : null).toEqual(best ? { rev: best.rev, m: best.m } : null);
      expect(w2 ? { rev: w2.rev, m: w2.m } : null).toEqual(worst ? { rev: worst.rev, m: worst.m } : null);
      expect(mine.tbYear).toEqual(S.tbYear);
    }
    expect(reviews).toBeGreaterThan(15);
    const H = SNAPS.find((S) => (S.hist || []).length > 20).hist;
    P.setS(clone(SNAPS[0]));
    expect(plOf(H)).toEqual(P.plOf(H));
    expect(utilOf(H)).toBe(P.utilOf(H));
    for (const x of SNAPS[0].rivals) expect(rvWorth(x)).toBe(P.rvWorth(x));
  });

  it('Hardcore: under water, back above, or the administrators', () => {
    const R = seedRand(114);
    let busts = 0;
    for (const S0 of SNAPS) {
      const S = clone(S0), mine = clone(S0);
      S.hardcore = mine.hardcore = true;
      S.under = mine.under = int(R, 0, 3);
      S.bank = mine.bank = pick(R, [S0.bank, -900000]);
      S.lb = null;
      P.setS(S);
      const nw = P.netWorth(), rung = P.rung(), prep = { events: [] as string[] }, ev: HardcoreEvent[] = [];
      P.hardcoreWeek(prep);
      hardcoreWeek(mine, nw, () => ({ stage: rung, peak: rung, earned: Math.round(S0.stats.earned), fleet: S0.fleet.length, tix: Object.keys(S0.tix || {}).length }), ev);
      expect(mine.under).toBe(S.under);
      expect(mine.phase).toBe(S.phase);
      expect(mine.bustOut ?? null).toEqual(S.bustOut ?? null);
      expect(ev.length).toBe(prep.events.length);
      if (mine.phase === 'bust') busts++;
    }
    expect(busts).toBeGreaterThan(5);
  });
});

describe("the office's cards", () => {
  it('the bank: more time, or a machine taken', () => {
    const R = seedRand(115);
    let taken = 0;
    for (const S0 of SNAPS) {
      if (!S0.fleet.length) continue;
      const od = R() < 0.5, S = clone(S0), mine = clone(S0);
      // each side gets its own loan object, or one would pay off the other's
      S.loan = { ...newLoan(int(R, 50, 400) * 1000), missed: 2 };
      mine.loan = clone(S.loan);
      S.odOver = mine.odOver = 2;
      mine.acc = accFromProto(S.acc);
      if (R() < 0.5) {
        P.setS(S);
        const c = P.curve({ k: 'bankcall', od, sd: 1 });
        if (c.opts[0].label.startsWith('Ask for more time')) { c.opts[0].go(); bankMoreTime(mine, od); }
      } else {
        P.setS(S);
        P.curve({ k: 'repo', od, sd: 1 }).opts[0].go();
        repossess(mine, (j) => release(mine, j, []), weeklyRepay);
        taken++;
      }
      expect(mine.bank).toBe(S.bank);
      expect(mine.loan).toEqual(S.loan);
      expect(mine.fleet).toEqual(S.fleet);
      expect(mine.jobs).toEqual(S.jobs);
      expect(mine.rep).toBe(S.rep);
      expect(mine.odOver).toBe(S.odOver);
      expect(mine.repos ?? 0).toBe(S.repos ?? 0);
    }
    expect(taken).toBeGreaterThan(20);
  });

  it('the BAS: pay it, or a payment plan', () => {
    const R = seedRand(116);
    for (const S0 of SNAPS) {
      const S = clone(S0), mine = clone(S0), amt = int(R, 2, 40) * 1000;
      S.gst = { held: amt, qIn: 0, qOut: 0, due: [{ id: 'b1', amt, qIn: amt * 3, qOut: amt * 2, q: 'April to June 2029', due: S.week }], plans: int(R, 0, 1) };
      mine.gst = { ...clone(S.gst), due: [{ id: 'b1', amt, qIn: amt * 3, qOut: amt * 2, qm: 6, qy: 2029, due: S.week }] };
      mine.acc = accFromProto(S.acc);
      P.setS(S);
      const c = P.curve({ k: 'bas', id: 'b1', sd: 1 }), i = int(R, 0, c.opts.length - 1), label = c.opts[i].label as string;
      c.opts[i].go();
      const mode = taxMode(S.loanStart, !!S.hardcore);
      if (label.startsWith('Ask for a payment plan')) basPlan(mine, mine.gst.due[0], mode);
      else basPay(mine, mine.gst.due[0], label.startsWith('Pay it anyway'));
      expect(mine.bank).toBe(S.bank);
      expect(mine.payables ?? []).toEqual(S.payables ?? []);
      expect(mine.rep).toBe(S.rep);
      expect({ ...mine.gst, due: [] }).toEqual({ ...S.gst, due: [] });
      expect(mine.gst.due.length).toBe(S.gst.due.length);
    }
  });
});
