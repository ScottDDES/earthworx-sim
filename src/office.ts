// The office: paying what's owed, the bank's patience, GST and the BAS, closing the books each week,
// the year in review, and (on Hardcore) trading insolvent.

import { mRef, news, note } from './diary';
import { monthIdx, yearOf } from './calendar';
import { book, newAccounts, type Accounts } from './ledger';
import type { Loan } from './bank';
import { TYPES, value, type Machine } from './machines';
import { uid, type Job, type JobLog, type Receivable } from './hire';
import { RV_MACH, type Rival } from './rivals';
import type { Whs } from './safety';
import { TOWNS, type TownId } from './towns';

const round = (n: number, to: number) => Math.round(n / to) * to;

// ---------- the bank ----------

/** 80% of what the council owes you on approved claims, the way a bank's debtor finance works. */
export function claimFinance(recv: readonly Receivable[], town: TownId): number {
  const c = TOWNS[town].council;
  return round(0.8 * recv.reduce((a, x) => a + (x.client === c && x.due < 9999 ? x.amt : 0), 0), 1000);
}

/** How far into the overdraft the bank lets you go: it grows as you climb, plus finance on council claims. */
export function odLimit(st: { won?: boolean; won2?: boolean; won3?: boolean; recv: Receivable[]; town: TownId }): number {
  return st.won2 ? (st.won3 ? 250000 : 150000) + claimFinance(st.recv, st.town) : st.won ? 40000 : 20000;
}

export interface Payable {
  to: string;
  amt: number;
  due: number;
  /** Owed to the tax office (a BAS payment plan). */
  ato?: boolean;
}

/** This week's bills from subbies and the tax office. Returns what went to subbies (not the tax office). */
export function payablesWeek(st: { week: number; bank: number; payables?: Payable[]; acc: Accounts }, rep: { costs: number }): number {
  let pays = 0;
  for (const x of (st.payables || []).slice()) {
    if (x.due > st.week) continue;
    st.bank -= x.amt;
    rep.costs += x.amt;
    if (x.ato) book(st.acc, 'gst', x.amt);
    else pays += x.amt;
    st.payables = st.payables!.filter((y) => y !== x);
  }
  return pays;
}

export type BankCallEvent = { k: 'overLimit'; weeks: number; limit: number };

/**
 * After the week at the bank: two missed repayments and the bank rings; three and it takes a machine.
 * Over the overdraft limit two weeks running it rings; three and it calls the overdraft in.
 */
export function bankCalls(st: { bank: number; loan: Loan; odOver?: number; fleet: Machine[]; queue: { k: string; od?: boolean }[] }, od: number, events: BankCallEvent[]): void {
  const L = st.loan;
  if (L.bal > 0) {
    if (L.missed >= 3 && !st.queue.some((q) => q.k === 'repo')) st.queue.unshift({ k: 'repo' });
    else if (L.missed === 2 && !st.queue.some((q) => q.k === 'bankcall')) st.queue.push({ k: 'bankcall' });
  }
  if (st.bank < -od) {
    st.odOver = (st.odOver || 0) + 1;
    events.push({ k: 'overLimit', weeks: st.odOver, limit: od });
  } else st.odOver = 0;
  if (st.odOver >= 3 && st.fleet.length && !st.queue.some((q) => q.k === 'repo')) st.queue.unshift({ k: 'repo', od: true });
  else if (st.odOver === 2 && st.fleet.length && !st.queue.some((q) => q.k === 'bankcall')) st.queue.push({ k: 'bankcall', od: true });
}

// ---------- what the business is worth ----------

export interface Books {
  week: number;
  bank: number;
  fleet: Machine[];
  recv: Receivable[];
  payables?: Payable[];
  loan: Loan;
  jobs: Job[];
  gst?: GstState;
  hardcore?: boolean;
  loanStart?: number;
}

/** Bank, plus gear, plus what you're owed (overdue invoices at half), less what you owe, the loan and GST you're holding. */
export function netWorth(b: Books, taxMode: TaxMode): number {
  return Math.round(b.bank + b.fleet.reduce((a, m) => a + value(m, b.week), 0) + b.recv.reduce((a, x) => a + (x.due < 9999 ? x.amt : x.amt * 0.5), 0)
    - (b.payables || []).reduce((a, x) => a + x.amt, 0) - b.loan.bal - (b.gst && gstInBank(taxMode) ? b.gst.held : 0));
}

/** Work signed and not yet claimed. */
export function workInHand(jobs: readonly Job[]): number {
  return jobs.reduce((a, j) => {
    if (j.finished) return a;
    if (j.kind === 'own') return a + Math.max(0, (j.price as number) - (j.claimed as number)) + ((j.retained as number) || 0);
    if (j.kind === 'sub') return a + Math.max(0, (j.base as number) - (j.paid as number)) * j.rate + ((j.retained as number) || 0);
    if (j.kind === 'private') return a + (j.fixed || 0) + (j.extra || 0);
    return a + Math.max(0, j.days - j.done) * (j.rate || 0);
  }, 0);
}

export function debtors(recv: readonly Receivable[]): number {
  return recv.reduce((a, x) => a + x.amt, 0);
}

// ---------- GST ----------

/** off: Easy, no GST. auto: Normal, a bookkeeper sets it aside. full / hardcore: it's in your bank and you pay the BAS. */
export type TaxMode = 'off' | 'auto' | 'full' | 'hardcore';

export function taxMode(loanStart: number, hardcore: boolean): TaxMode {
  if (hardcore) return 'hardcore';
  const d = !loanStart ? null : loanStart <= 100000 ? 'hard' : loanStart >= 300000 ? 'easy' : 'normal';
  return d === 'easy' ? 'off' : d === 'hard' ? 'full' : 'auto';
}

/** GST sits in your bank account (you have to keep it aside yourself). */
export function gstInBank(m: TaxMode): boolean {
  return m === 'full' || m === 'hardcore';
}

export interface BasDue {
  id: string;
  amt: number;
  qIn: number;
  qOut: number;
  /** Quarter it's for: the month it closed, and the year. */
  qm: number;
  qy: number;
  due: number;
}

export interface GstState {
  held: number;
  qIn: number;
  qOut: number;
  due: BasDue[];
  plans: number;
  lastPlan?: number;
}

export function newGst(): GstState {
  return { held: 0, qIn: 0, qOut: 0, due: [], plans: 0 };
}

/** The months that open a new quarter: a BAS closes at the end of the month before. */
export const QUARTER_OPENS = [6, 9, 0, 3] as const;

export type TaxEvent = { k: 'bookkeeperLodged'; qm: number; qy: number; amt: number } | { k: 'gstRefund'; qm: number; qy: number; amt: number } | { k: 'quarterClosed'; qm: number; qy: number; amt: number; due: number };

/**
 * After the week's rolled over: if a month that closes a quarter has just ended, the BAS is worked out
 * (due in 4 weeks, 8 over Christmas). Returns true when 30 June has passed, so the year can be reviewed.
 * Due BAS: the bookkeeper lodges it from what's set aside; or a refund comes in; or it's a card for you.
 */
export function taxWeek(st: { week: number; bank: number; seq: number; acc: Accounts; queue: { k: string; id?: string }[]; gst?: GstState }, w0: number, mode: TaxMode, events: TaxEvent[], yearEndNow?: () => void): boolean {
  const G = (st.gst = st.gst || newGst()), m1 = monthIdx(st.week), quarter = monthIdx(w0) !== m1 && (QUARTER_OPENS as readonly number[]).includes(m1);
  let yearDone = false;
  // the year's reviewed at the same moment the prototype does it: before any BAS card goes in the queue
  if (quarter && mode === 'off' && m1 === 6) {
    yearDone = true;
    yearEndNow?.();
  }
  if (quarter && mode !== 'off') {
    const amt = G.qIn - G.qOut, yr = m1 === 0 ? yearOf(w0) : yearOf(st.week), due = st.week + (m1 === 0 ? 8 : 4);
    G.due.push({ id: uid(st), amt, qIn: G.qIn, qOut: G.qOut, qm: m1, qy: yr, due });
    G.qIn = 0;
    G.qOut = 0;
    events.push({ k: 'quarterClosed', qm: m1, qy: yr, amt, due });
    note(st, { k: 'quarterClosed', qm: m1, amt, due });
    if (m1 === 6) {
      yearDone = true;
      yearEndNow?.();
    }
  }
  for (const d of G.due.slice()) {
    if (d.due > st.week) continue;
    if (!gstInBank(mode)) {
      G.held -= d.amt;
      G.due = G.due.filter((x) => x !== d);
      events.push({ k: 'bookkeeperLodged', qm: d.qm, qy: d.qy, amt: d.amt });
      continue;
    }
    if (d.amt <= 0) {
      st.bank -= d.amt;
      book(st.acc, 'gst', d.amt);
      G.held -= d.amt;
      G.due = G.due.filter((x) => x !== d);
      events.push({ k: 'gstRefund', qm: d.qm, qy: d.qy, amt: -d.amt });
      continue;
    }
    if (!st.queue.some((q) => q.k === 'bas' && q.id === d.id)) st.queue.push({ k: 'bas', id: d.id });
  }
  return yearDone;
}

// ---------- closing the week's books ----------

/** One week in the history: what the Office charts and the year in review read. */
export interface WeekRow {
  w: number; b: number; gst: number; nw: number; inv: number; pd: number; jc: number; ws: number; oh: number; fin: number; ot: number;
  bd: number; br: number; cap: number; md: number; fl: number; rain: number; brk: number; wih: number; dr: number; wg: number; st: number;
}

export interface BankBits {
  /** Paid to subbies this week. */
  pays: number;
  /** Overdraft interest. */
  odi: number;
  /** Loan repayments, and the interest in them. */
  lc: number;
  li: number;
}

export interface CloseInputs {
  /** The week that's just been worked. */
  w: number;
  invoiced: number;
  paid: number;
  rain: number;
  /** This week's running costs, insurance premium and yard rent. */
  over: number;
  premium: number;
  rent: number;
  wages: number;
  staffN: number;
  mode: TaxMode;
}

/**
 * The week's books close. GST: clients pay 10% on top, suppliers charge it too, and you hold the difference
 * for the tax office until the BAS is due (in your bank on Hard and Hardcore). The week goes in the history
 * (two years kept), and a fresh set of accounts opens.
 */
export function closeBooks(st: Books & { acc: Accounts; hist?: WeekRow[] }, x: CloseInputs, BK: BankBits): void {
  const A = st.acc, out = A.openingBank - st.bank + x.paid + A.collections;
  const other = out - A.jobCosts - BK.pays - A.workshop - x.over - BK.odi - BK.lc - A.capital - A.loan - (A.gst || 0) - (A.branch || 0);
  const G = (st.gst = st.gst || newGst()), TM = x.mode;
  const inG = TM === 'off' ? 0 : Math.round(0.1 * (x.paid + A.collections + Math.max(0, -A.capital)));
  const outG = TM === 'off' ? 0 : Math.round(0.1 * (A.jobCosts + BK.pays + A.workshop + (A.branch || 0) + Math.max(0, A.capital) + x.premium + x.rent));
  if (gstInBank(TM)) st.bank += inG - outG;
  G.held += inG - outG;
  G.qIn += inG;
  G.qOut += outG;
  const H = (st.hist = st.hist || []);
  H.push({
    w: x.w, b: Math.round(st.bank), gst: gstInBank(TM) ? inG - outG : 0, nw: netWorth(st, TM), inv: Math.round(x.invoiced), pd: Math.round(x.paid),
    jc: Math.round(A.jobCosts + A.jobCostsOwed), ws: Math.round(A.workshop), oh: Math.round(x.over), fin: Math.round(BK.odi + BK.li), ot: Math.round(other),
    bd: Math.round(A.badDebts || 0), br: Math.round(A.branch || 0), cap: Math.round(A.capital), md: A.machineDays, fl: st.fleet.length, rain: x.rain,
    brk: A.breakdowns, wih: Math.round(workInHand(st.jobs)), dr: Math.round(debtors(st.recv)), wg: x.wages, st: x.staffN,
  });
  if (H.length > 104) H.splice(0, H.length - 104);
  st.acc = newAccounts(st.bank);
}

// ---------- the year in review ----------

export const hsum = (a: readonly WeekRow[], k: keyof WeekRow) => a.reduce((s, x) => s + ((x[k] as number) || 0), 0);
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export interface Pl { rev: number; jc: number; ws: number; oh: number; fin: number; ot: number; bd: number; br: number; cap: number; pd: number; cost: number; profit: number }

/** Profit and loss over some weeks of history. */
export function plOf(a: readonly WeekRow[]): Pl {
  const r = { rev: hsum(a, 'inv'), jc: hsum(a, 'jc'), ws: hsum(a, 'ws'), oh: hsum(a, 'oh'), fin: hsum(a, 'fin'), ot: hsum(a, 'ot'), bd: hsum(a, 'bd'), br: hsum(a, 'br'), cap: hsum(a, 'cap'), pd: hsum(a, 'pd') } as Pl;
  r.cost = r.jc + r.ws + r.oh + r.fin + r.ot + r.bd + r.br;
  r.profit = r.rev - r.cost;
  return r;
}

/** Share of dry days your gear actually worked, %. */
export function utilOf(a: readonly WeekRow[]): number {
  const can = a.reduce((s, x) => s + x.fl * Math.max(0, 5 - (x.rain || 0)), 0);
  return can ? Math.min(100, Math.round((hsum(a, 'md') / can) * 100)) : 0;
}

export function rvWorth(x: Rival): number {
  return x.fleet * RV_MACH + x.cash - x.debt;
}

export interface YearJob { kind: string; client: string; rev: number; m: number }

export interface YearReview {
  w: number;
  /** A first year longer than 56 weeks is reported as "your first n weeks"; otherwise the financial year ending yearOf(w). */
  first: boolean;
  weeks: number;
  rev: number; profit: number; cost: number; oh: number; ws: number; cap: number;
  nw0: number; nw: number; util: number;
  best: YearJob | null; worst: YearJob | null; jobs: number;
  ltis: number; inc: number; ltifr: number | null;
  rank: number; of: number;
  wonS: number; bidS: number; wonC: number; bidC: number;
  staff: number; fleet: number;
}

export interface YearInputs {
  hist?: WeekRow[];
  years?: YearReview[];
  jlog?: JobLog[];
  whs: Whs;
  rivals: Rival[];
  tb?: { s: [number, number]; c: [number, number]; since: number };
  tbYear?: { s: [number, number]; c: [number, number] };
  staffN: number;
  fleetN: number;
  queue: { k: string; i?: number }[];
}

/**
 * 30 June has passed: review the year (the weeks since the last review, up to week w). A short first year
 * (under 26 weeks) rolls into the next review. nw is your net worth now.
 */
export function yearEnd(st: YearInputs, w: number, nw: number): YearReview | null {
  const H = st.hist || [], last = (st.years || []).length ? st.years![st.years!.length - 1]!.w : 0, Y = H.filter((x) => x.w > last && x.w <= w);
  if (Y.length < 6 || (!last && Y.length < 26)) return null;
  const P = plOf(Y);
  const J = (st.jlog || []).filter((j) => j.w > last && j.w <= w + 1 && !j.part && j.rev >= 5000).map((j) => ({ kind: j.kind, client: j.client, rev: j.rev, m: pct(j.rev - j.cost, j.rev) }));
  J.sort((a, b) => b.m - a.m);
  const inc = st.whs.inc.filter((x) => x.w > last && x.w <= w), ltis = inc.filter((x) => x.sev === 'lti' || x.sev === 'serious').length, hrs = hsum(Y, 'md') * 9;
  const all = st.rivals.map(rvWorth).concat([nw]).sort((a, b) => b - a);
  const TB = st.tb || { s: [0, 0], c: [0, 0], since: 0 }, t0 = st.tbYear || { s: [0, 0], c: [0, 0] };
  const y: YearReview = {
    w, first: Y.length > 56, weeks: Y.length, rev: P.rev, profit: P.profit, cost: P.cost, oh: P.oh, ws: P.ws, cap: P.cap, nw0: Y[0]!.nw, nw, util: utilOf(Y),
    best: J[0] || null, worst: J.length > 1 ? J[J.length - 1]! : null, jobs: J.length, ltis, inc: inc.filter((x) => x.sev !== 'near miss').length,
    ltifr: hrs >= 2000 ? Math.round((ltis * 1e7) / hrs) / 10 : null, rank: all.indexOf(nw) + 1, of: all.length,
    wonS: TB.s[1] - t0.s[1], bidS: TB.s[0] - t0.s[0], wonC: TB.c[1] - t0.c[1], bidC: TB.c[0] - t0.c[0], staff: st.staffN, fleet: st.fleetN,
  };
  st.tbYear = JSON.parse(JSON.stringify({ s: TB.s, c: TB.c, since: TB.since }));
  (st.years = st.years || []).push(y);
  if (st.years.length > 30) st.years.shift();
  st.queue.push({ k: 'yearend', i: st.years.length - 1 });
  return y;
}

// ---------- Hardcore ----------

export const HC_WEEKS = 4;

export type HardcoreEvent = { k: 'backAbove'; nw: number } | { k: 'insolvent'; nw: number; weeks: number };

/** Hardcore: four weeks running worth less than you owe and the administrators move in. */
export function hardcoreWeek(st: { hardcore?: boolean; phase: string; under?: number; week: number; queue: unknown[]; bustOut?: unknown }, nw: number, info: () => Record<string, number>, events: HardcoreEvent[]): void {
  if (!st.hardcore || st.phase !== 'play') return;
  if (nw >= 0) {
    if (st.under) events.push({ k: 'backAbove', nw });
    st.under = 0;
    return;
  }
  st.under = (st.under || 0) + 1;
  if (st.under >= HC_WEEKS) {
    st.bustOut = { week: st.week, nw, ...info() };
    st.phase = 'bust';
    st.queue = []; // the career's over: phase 'bust' is the signal, and bustOut has the numbers
    note(st, { k: 'administration' });
    news(st, { k: 'wentBust' });
    return;
  }
  events.unshift({ k: 'insolvent', nw, weeks: st.under });
  note(st, { k: 'insolventWeek', weeks: st.under });
}

// ---------- the office's cards ----------

/** The bank's ringing: more time ($750, once in 26 weeks, never on Hardcore). */
export function bankMoreTime(st: { bank: number; week: number; bankGrace?: number; odOver?: number; loan: Loan }, od: boolean): void {
  st.bank -= 750;
  st.bankGrace = st.week;
  if (od) st.odOver = 0;
  else st.loan.missed = 1;
}
export function bankMoreTimeOk(st: { week: number; bankGrace?: number; hardcore?: boolean }): boolean {
  return !(st.bankGrace != null && st.week - st.bankGrace < 26) && !st.hardcore;
}

/** The machine the bank takes: one that's not on a job first, then the most valuable. */
export function repoPick(fleet: readonly Machine[], week: number): Machine | undefined {
  return fleet.slice().sort((a, b) => Number(a.status === 'job') - Number(b.status === 'job') || value(b, week) - value(a, week))[0];
}

/**
 * The bank takes a machine and sells it for 60% of its value, off the loan. If it was on your own contract a
 * hire-in replaces it; on any other job, that job ends and track record −1. Returns what it fetched.
 */
export function repossess(st: { week: number; bank: number; fleet: Machine[]; jobs: Job[]; loan: Loan; acc: Accounts; rep: number; odOver?: number; repos?: number },
  release: (j: Job) => void, weeklyRepay: (amt: number) => number): number {
  const best = repoPick(st.fleet, st.week), L = st.loan;
  let got = 0;
  if (best) {
    got = Math.round(value(best, st.week) * 0.6);
    if (best.jobId) {
      const bj = st.jobs.find((j) => j.id === best.jobId);
      if (bj && bj.kind === 'own') {
        bj.ownedIds = (bj.ownedIds as string[]).filter((x) => x !== best.id);
        bj.hireWeek = (bj.hireWeek as number) + TYPES[best.type].dry;
      } else if (bj) {
        release(bj);
        st.rep = Math.max(0, st.rep - 1);
      }
    }
    st.fleet = st.fleet.filter((x) => x.id !== best.id);
    L.bal -= got;
    if (L.bal < 0) {
      st.bank += -L.bal;
      book(st.acc, 'capital', L.bal);
      L.bal = 0;
    }
    L.weekly = L.bal > 0 ? weeklyRepay(L.bal) : 0;
    note(st, { k: 'repossessed', m: mRef(best), got });
  }
  L.missed = 0;
  L.arrears = 0;
  st.odOver = 0;
  if (best) st.repos = (st.repos || 0) + 1;
  return got;
}

/** The BAS card: pay it, pay it anyway (no plan left: track record −2), or a payment plan (3 payments over 12 weeks). */
export function basInterest(amt: number, mode: TaxMode): number {
  return round(amt * (mode === 'hardcore' ? 0.06 : 0.03), 10);
}
export function basPlanOk(G: GstState, mode: TaxMode, week: number): boolean {
  return !(mode === 'hardcore' && G.lastPlan != null && week - G.lastPlan < 52);
}
export function basPay(st: { bank: number; acc: Accounts; gst?: GstState; rep: number }, d: BasDue, anyway: boolean): void {
  const G = st.gst!;
  st.bank -= d.amt;
  book(st.acc, 'gst', d.amt);
  G.held -= d.amt;
  G.due = G.due.filter((x) => x !== d);
  if (anyway) st.rep = Math.max(0, st.rep - 2);
}
export function basPlan(st: { week: number; gst?: GstState; payables?: Payable[]; rep: number }, d: BasDue, mode: TaxMode): number {
  const G = st.gst!, each = round((d.amt + basInterest(d.amt, mode)) / 3, 10);
  for (const k of [4, 8, 12]) (st.payables = st.payables || []).push({ to: 'Tax office', amt: each, due: st.week + k, ato: true });
  G.held -= d.amt;
  G.due = G.due.filter((x) => x !== d);
  G.plans++;
  G.lastPlan = st.week;
  if (G.plans > 1) st.rep = Math.max(0, st.rep - 1);
  return each;
}
