// A branch depot in the other town, once you're a regional contractor with a regional depot or plant hub.
// Your crews there work the other town's real rain; a manager runs it, and its local reputation fills its order book.

import { book, type Accounts } from './ledger';
import { TYPES, breaks, svcLeft, wear, type Machine, type WorkshopCtx } from './machines';
import { invoice, type Biz, type WeekReport } from './hire';
import { int, pick, type Rand } from './rng';
import { NAMES } from './staff';
import { TOWNS, type TownId } from './towns';
import { wetDay } from './weather';

export const BR_SETUP = 120000;
export const BR_RENT = 1200;
export const BR_SLOTS = 12;
/** What a crew-day earns there, and costs. */
export const BR_RATE = 5600;
export const BR_COST = 4250;
/** Floating a machine there or back. */
export const BR_FLOAT = 6500;

export type BranchMgrKind = 'gun' | 'green';
export const BR_MGR: Record<BranchMgrKind, { t: string; wage: number; d: string }> = {
  gun: { t: 'An old hand', wage: 3200, d: 'Twenty years running crews. Knows every shire engineer by name.' },
  green: { t: 'A keen young manager', wage: 2400, d: 'Sharp and hungry, still learning how to win work.' },
};

export interface Branch {
  town: TownId;
  w0: number;
  mgr: { name: string; skill: 'green' | 'solid' | 'gun'; wage: number } | null;
  /** Local reputation, 0 to 100. */
  rep: number;
  hist: { w: number; days: number; rev: number; cost: number; crews: number; dry: number }[];
  /** A council package won there: extra each week until it ends. */
  boost: { until: number; extra: number } | null;
  /** The week the manager last rang. */
  ask: number;
}

export interface BranchState extends Biz {
  yard: string;
  wxStart: number;
  won3?: boolean;
  season?: unknown;
  branch?: Branch | null;
}

const round = (n: number, to: number) => Math.round(n / to) * to;

export function brTown(home: TownId): TownId {
  return home === 'gdi' ? 'ct' : 'gdi';
}
export function canBranch(b: BranchState): boolean {
  return !!b.won3 && (b.yard === 'regional' || b.yard === 'hub') && !b.branch && !b.season;
}
export function brMachines(fleet: readonly Machine[]): Machine[] {
  return fleet.filter((m) => m.status === 'branch');
}
/** Full crews there (a grader, roller and cart each), at a slower pace without two carts a crew. */
export function brCrews(fleet: readonly Machine[]): { n: number; pace: number } {
  const c = { grader: 0, roller: 0, cart: 0, truck: 0 };
  for (const m of brMachines(fleet)) if (m.down === 0) c[m.type]++;
  const n = Math.min(c.grader, c.roller, c.cart);
  return { n, pace: c.cart >= 2 * n ? 1 : 0.85 };
}

export function openBranch(rand: Rand, b: BranchState, k: BranchMgrKind): boolean {
  const M = BR_MGR[k];
  if (!M || !canBranch(b) || b.bank < BR_SETUP) return false;
  b.bank -= BR_SETUP;
  book(b.acc, 'capital', BR_SETUP);
  b.branch = { town: brTown(b.town), w0: b.week, mgr: { name: pick(rand, NAMES), skill: k, wage: M.wage }, rep: 15, hist: [], boost: null, ask: b.week };
  return true;
}
export function hireBrMgr(rand: Rand, b: BranchState, k: BranchMgrKind): void {
  const B = b.branch, M = BR_MGR[k];
  if (!B || B.mgr || !M) return;
  B.mgr = { name: pick(rand, NAMES), skill: k, wage: M.wage };
}
export function toBranch(b: BranchState, id: string): boolean {
  const m = b.fleet.find((x) => x.id === id);
  if (!b.branch || !m || m.status !== 'idle' || m.down > 0 || brMachines(b.fleet).length >= BR_SLOTS || b.bank < BR_FLOAT) return false;
  m.status = 'branch';
  b.bank -= BR_FLOAT;
  book(b.acc, 'branch', BR_FLOAT);
  return true;
}
export function toHome(b: BranchState, id: string, room: number): boolean {
  const m = b.fleet.find((x) => x.id === id);
  if (!m || m.status !== 'branch' || room <= 0 || b.bank < BR_FLOAT) return false;
  m.status = 'idle';
  b.bank -= BR_FLOAT;
  book(b.acc, 'branch', BR_FLOAT);
  return true;
}
/** Close it: the gear comes home (paying at most three floats). */
export function closeBranch(b: BranchState): void {
  if (!b.branch) return;
  for (const m of brMachines(b.fleet)) m.status = 'idle';
  b.bank -= BR_FLOAT * Math.min(3, brMachines(b.fleet).length);
  b.branch = null;
}

export type BranchEvent = { k: 'branchWeek'; town: TownId; days: number; rev: number; crews: number; broke: number };

/**
 * The branch's week. Work comes in by reputation, how busy the work is and the manager (none: 60%).
 * Its gear works the other town's dry days; breakdowns there are fixed on the spot (and cost reputation).
 * mg: the difficulty's margin shift; costIdx: inflation; whsSys: your safety system, which helps reputation.
 */
export function branchWeek(rand: Rand, b: BranchState, w: WorkshopCtx, fmul: number, mg: number, costIdx: number, whsSys: number, rep: WeekReport, acc: Accounts, events: BranchEvent[]): void {
  const B = b.branch;
  if (!B) return;
  const C = brCrews(b.fleet), sk = B.mgr ? { green: 0.85, solid: 1, gun: 1.12 }[B.mgr.skill] : 0.6;
  const util = Math.max(0.15, Math.min(0.95, (0.5 + (0.4 * B.rep) / 100) * Math.min(1.25, fmul) * sk));
  let dry = 0;
  for (let d = 0; d < 5; d++) if (!wetDay({ town: B.town, wxStart: b.wxStart }, b.week, d)) dry++;
  const days = Math.round(C.n * dry * util * 10) / 10;
  const rev = Math.round(days * BR_RATE * C.pace * (1 + mg * 0.5)) + (B.boost && B.boost.until >= b.week ? B.boost.extra : 0);
  const cost = Math.round((days * BR_COST * (C.pace < 1 ? 0.95 : 1) + BR_RENT + (B.mgr ? B.mgr.wage : 0)) * costIdx);
  let ws = 0, broke = 0;
  if (B.boost && B.boost.until < b.week) B.boost = null;
  for (const m of brMachines(b.fleet)) {
    if (m.down > 0) continue;
    const n = C.n ? Math.round(dry * util) : 0;
    for (let i = 0; i < n; i++) {
      wear(m, 1, acc);
      if (breaks(rand, m, 1, w)) {
        ws += round(int(rand, 1500, 6500) * 0.7 * costIdx, 100);
        m.down = int(rand, 2, 5);
        broke++;
        B.rep = Math.max(0, B.rep - 0.5);
        break;
      }
    }
    if (svcLeft(m) < 0) {
      ws += round(TYPES[m.type].svc * 0.7 * costIdx, 50);
      m.svcAt = m.hours;
      m.cond = Math.min(92, m.cond + 12);
    }
  }
  if (rev > 0) invoice(b, 'Branch clients, ' + TOWNS[B.town].name, rev, 4, rep);
  b.bank -= cost + ws;
  rep.costs += cost + ws;
  book(acc, 'branch', cost + ws);
  B.rep = Math.min(100, B.rep + (C.n ? (util > 0.5 ? 0.6 : 0.25) + whsSys * 0.1 : -0.3));
  B.hist.push({ w: b.week, days, rev, cost: cost + ws, crews: C.n, dry });
  if (B.hist.length > 26) B.hist.shift();
  if (C.n || cost) events.push({ k: 'branchWeek', town: B.town, days, rev, crews: C.n, broke });
  // the manager rings now and then
  if (b.week - (B.ask || 0) >= 8 && rand() < 0.12 && !b.queue.some((q) => q.k.indexOf('br') === 0)) {
    const pool: string[] = [];
    if (C.n >= 2 && !B.boost) pool.push('brtender', 'brtender');
    if (B.mgr) pool.push('brraise');
    if (pool.length) {
      B.ask = b.week;
      b.queue.push({ k: pick(rand, pool) });
    }
  }
}

/** The branch manager has a council package: its size and length, from the card's own seed. */
export function brTenderCard(cardRand: Rand): { val: number; wk: number } {
  return { val: round(int(cardRand, 250, 700) * 1000, 10000), wk: int(cardRand, 8, 16) };
}
/** Go in sharp (65% to win, 7% margin) or price it properly (40%, 14%). */
export function brTender(rand: Rand, b: BranchState, c: { val: number; wk: number }, sharp: boolean): boolean {
  const B = b.branch!;
  if (rand() < (sharp ? 0.65 : 0.4)) {
    B.boost = { until: b.week + c.wk, extra: Math.round((c.val * (sharp ? 0.07 : 0.14)) / c.wk) };
    B.rep = Math.min(100, B.rep + 3);
    return true;
  }
  return false;
}
/** The manager wants $400 a week more: pay it (half the time they step up a level) or say no (35% they walk). */
export function brRaise(rand: Rand, b: BranchState, pay: boolean): 'stepUp' | 'stays' | 'quit' {
  const B = b.branch!, M = B.mgr!;
  if (pay) {
    M.wage += 400;
    if (M.skill !== 'gun' && rand() < 0.5) {
      M.skill = M.skill === 'green' ? 'solid' : 'gun';
      return 'stepUp';
    }
    return 'stays';
  }
  if (rand() < 0.35) {
    B.mgr = null;
    return 'quit';
  }
  return 'stays';
}
