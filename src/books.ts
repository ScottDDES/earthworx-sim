// The owner's office: the numbers on the dashboard. A 12-week cash forecast, how long the cash lasts,
// borrowing against the fleet and paying the loan down, and which machines need the workshop.

import { monthIdx } from './calendar';
import { note } from './diary';
import { book, type Accounts } from './ledger';
import { weeklyRepay, type Loan } from './bank';
import { svcLeft, type Machine } from './machines';
import { QUARTER_OPENS, hsum, workInHand, type GstState, type WeekRow } from './office';
import type { Job, Receivable } from './hire';
import type { Whs } from './safety';

const round = (n: number, to: number) => Math.round(n / to) * to;

export interface ForecastWeek {
  w: number;
  inn: number;
  o: number;
  bal: number;
  /** A BAS falls due this week. */
  bas: boolean;
}

export interface ForecastInputs {
  week: number;
  bank: number;
  hist?: WeekRow[];
  jobs: Job[];
  recv: Receivable[];
  payables?: { amt: number; due: number }[];
  loan: Loan;
  gst?: GstState;
}

/**
 * The next n weeks of cash, on what's owed and signed: invoices as they fall due, the work in hand billed at
 * the last six weeks' rate (paid about four weeks on), overheads, repayments, subbies and, when the GST sits
 * in your account, the BAS. over is the week's overheads; inBank is whether GST is kept in your account.
 */
export function cashForecast(st: ForecastInputs, n: number, over: number, inBank: boolean): ForecastWeek[] {
  const last = (st.hist || []).slice(-6), avg = (k: keyof WeekRow) => (last.length ? hsum(last, k) / last.length : 0);
  const inv = avg('inv'), jc = avg('jc'), wih = workInHand(st.jobs), workWks = inv > 0 ? wih / inv : 0, G = st.gst || { qIn: 0, qOut: 0, held: 0, due: [] as GstState['due'] };
  let bal = st.bank;
  const out: ForecastWeek[] = [];
  // the quarter that's running now: its GST falls due a month after it closes
  let qClose: number | null = null;
  for (let k = 0; k < n + 1 && qClose == null; k++) {
    const a = st.week + k;
    if (monthIdx(a) !== monthIdx(a + 1) && (QUARTER_OPENS as readonly number[]).includes(monthIdx(a + 1))) qClose = a + 1;
  }
  const qEst = G.qIn - G.qOut + (qClose ? (qClose - st.week) * 0.1 * Math.max(0, inv - jc) : 0), qDue = qClose ? qClose + (monthIdx(qClose) === 0 ? 8 : 4) : null;
  for (let i = 0; i < n; i++) {
    const gm = inBank ? 1.1 : 1, w = st.week + i;
    let inn = st.recv.reduce((s, x) => s + (x.due === w ? x.amt * gm : 0), 0);
    if (i >= 4 && i - 4 < workWks) inn += inv * gm;
    let o = over + (st.loan.bal > 0 ? st.loan.weekly : 0) + (i < workWks ? jc * gm : 0);
    o += (st.payables || []).reduce((s, x) => s + (x.due === w ? x.amt : 0), 0);
    const basHere = inBank && (G.due.some((d) => d.due === w) || qDue === w);
    if (inBank) o += G.due.reduce((s, d) => s + (d.due === w ? d.amt : 0), 0) + (qDue === w ? qEst : 0);
    bal += inn - o;
    out.push({ w, inn: Math.round(inn), o: Math.round(o), bal: Math.round(bal), bas: basHere });
  }
  return out;
}

/** What goes out every week before any job costs: overheads and the loan repayment. */
export function fixedWeek(over: number, loan: Loan): number {
  return over + (loan.bal > 0 ? loan.weekly : 0);
}

/** How many weeks of fixed costs the cash and overdraft cover. */
export function runway(bank: number, odLimit: number, fixed: number): number {
  const room = bank + odLimit;
  return room <= 0 ? 0 : Math.floor(room / Math.max(1, fixed));
}

/** How much more the bank will lend against the fleet. */
export function borrowRoom(lendCap: number, loan: Loan): number {
  return Math.max(0, round(lendCap - loan.bal, 1000));
}

/** Borrow against the fleet: a 1% establishment fee, repaid with the loan. Only once you're ready to subcontract. */
export function borrow(st: { week: number; bank: number; loan: Loan; acc: Accounts; won?: boolean }, amt: number, room: number): number {
  const L = st.loan;
  amt = Math.min(amt, room);
  if (!st.won || L.missed > 0 || amt < 5000) return 0;
  const fee = round(amt * 0.01, 10);
  L.bal += amt;
  st.bank += amt - fee;
  book(st.acc, 'loan', -amt);
  L.weekly = weeklyRepay(L.bal);
  L.paidOff = false;
  note(st, { k: 'borrowed', amt, fee, weekly: L.weekly });
  return amt;
}

/** Pay spare cash off the loan. */
export function payDown(st: { week: number; bank: number; loan: Loan; acc: Accounts }, amt: number): number {
  const L = st.loan;
  amt = Math.min(amt, L.bal, Math.max(0, st.bank));
  if (amt <= 0) return 0;
  st.bank -= amt;
  book(st.acc, 'loan', amt);
  L.bal = Math.round(L.bal - amt);
  L.weekly = L.bal > 0 ? weeklyRepay(L.bal) : 0;
  if (L.bal <= 0) {
    L.bal = 0;
    L.paidOff = true;
  }
  note(st, { k: 'paidDown', amt, bal: L.bal, weekly: L.weekly });
  return amt;
}

/** The week of the last incident of these kinds, or null. */
export function lastInc(whs: Whs, sev: string[]): number | null {
  const W = whs.inc.filter((x) => sev.includes(x.sev));
  return W.length ? W[0]!.w : null;
}

/** The branch's profit over its last n weeks. */
export function brProfit(branch: { hist?: { rev: number; cost: number }[] } | null | undefined, n: number): number {
  return (branch?.hist || []).slice(-n).reduce((a, x) => a + x.rev - x.cost, 0);
}

export type MachineAlert =
  | { k: 'overdue'; id: string; hrs: number }
  | { k: 'due'; id: string; hrs: number }
  | { k: 'patched'; id: string; part: string }
  | { k: 'wornOut'; id: string; cond: number }
  | { k: 'badlyWorn'; id: string; cond: number }
  | { k: 'wearing'; id: string; cond: number };

/** What the workshop should look at: services overdue or due, patched-up faults, and wear. Not machines being sold or at the branch. */
export function machineAlerts(fleet: readonly Machine[]): MachineAlert[] {
  const out: MachineAlert[] = [];
  for (const m of fleet) {
    if (m.status === 'auction' || m.status === 'listed' || m.status === 'branch') continue;
    const left = svcLeft(m);
    if (left < 0) out.push({ k: 'overdue', id: m.id, hrs: -left });
    else if (left <= 45) out.push({ k: 'due', id: m.id, hrs: left });
    if (m.band) out.push({ k: 'patched', id: m.id, part: m.band.part });
    const c = Math.round(m.cond);
    if (c < 35) out.push({ k: 'wornOut', id: m.id, cond: c });
    else if (c < 50) out.push({ k: 'badlyWorn', id: m.id, cond: c });
    else if (c < 65) out.push({ k: 'wearing', id: m.id, cond: c });
  }
  return out;
}

/** How many machines need the workshop. */
export function alertMachines(fleet: readonly Machine[]): number {
  return new Set(machineAlerts(fleet).map((a) => a.id)).size;
}
