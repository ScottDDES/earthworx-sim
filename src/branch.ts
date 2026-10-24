// A branch depot in the other town, once you're a regional contractor with a regional depot or plant hub.
// Your crews there work the other town's real rain; a manager runs it, and its local reputation fills its order book.
// The real game (Scott, 24 Oct): up to three branches anywhere in Queensland, each new one once the others make money,
// floats priced by the distance, and bulk gear works there too, on the town's own mix of farm and mine work.

import { mRef, note } from './diary';
import { book, type Accounts } from './ledger';
import { compat } from './compat';
import { brProfit } from './books';
import { TYPES, breaks, isBulk, isRoad, svcLeft, wear, type Machine, type WorkshopCtx } from './machines';
import { invoice, type Biz, type WeekReport } from './hire';
import { int, pick, type Rand } from './rng';
import { NAMES } from './staff';
import { TOWNS, townKm, type TownId } from './towns';
import { wetDay } from './weather';

export const BR_SETUP = 120000;
export const BR_RENT = 1200;
export const BR_SLOTS = 12;
/** What a crew-day earns there, and costs. */
export const BR_RATE = 5600;
export const BR_COST = 4250;
/** Floating a machine there or back. */
export const BR_FLOAT = 6500;
/** The real game: how many branches at most, and the weeks each must have run in profit before the next. */
export const BR_MAX = 3;
export const BR_PROVE = 13;
/** The real game: a bulk machine's day at a branch earns this much of its wet-hire rate, and costs this share of that. */
export const BRB_RATE = 1.15;
export const BRB_COST = 0.76;

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
  hist: { w: number; days: number; rev: number; cost: number; crews: number; dry: number; bulk?: number; bd?: number }[];
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
  /** The real game: branches after the first. */
  more?: Branch[];
}

const round = (n: number, to: number) => Math.round(n / to) * to;

export function brTown(home: TownId): TownId {
  return home === 'gdi' ? 'ct' : 'gdi';
}
/** Every branch you've got, the first one first. */
export function branches(b: Pick<BranchState, 'branch' | 'more'>): Branch[] {
  return [b.branch, ...(b.more ?? [])].filter((x): x is Branch => !!x);
}
export function brOf(b: Pick<BranchState, 'branch' | 'more'>, town?: TownId | null): Branch | undefined {
  return town ? branches(b).find((x) => x.town === town) : b.branch ?? undefined;
}
/** Why you can't open another branch: not regional yet, no depot, the most you can run, or the last one not paying yet. */
export type BranchWhy = 'notYet' | 'yard' | 'max' | 'proving' | null;
export function branchWhy(b: BranchState): BranchWhy {
  if (!b.won3 || b.season) return 'notYet';
  if (!(b.yard === 'regional' || b.yard === 'hub')) return 'yard';
  const all = branches(b);
  if (compat.prototype) return all.length ? 'max' : null;
  if (all.length >= BR_MAX) return 'max';
  if (all.some((x) => x.hist.length < BR_PROVE || brProfit(x, BR_PROVE) <= 0)) return 'proving';
  return null;
}
export function canBranch(b: BranchState): boolean {
  return branchWhy(b) === null;
}
/** Towns you could open a branch in, nearest first. */
export function brTowns(b: BranchState): TownId[] {
  if (compat.prototype) return [brTown(b.town as TownId)];
  const home = b.town as TownId, have = branches(b).map((x) => x.town);
  return (Object.keys(TOWNS) as TownId[]).filter((t) => t !== home && !have.includes(t)).sort((x, y) => townKm(home, x) - townKm(home, y));
}
/** Floating a machine between home and a branch: flat in the prototype, by the kilometres in the real game. */
export function brFloat(home: TownId, town: TownId): number {
  return compat.prototype ? BR_FLOAT : Math.max(2500, round(1000 + 5.4 * townKm(home, town), 500));
}
/** Machines out at any branch, or at one town's. */
export function brMachines(fleet: readonly Machine[], town?: TownId, first?: TownId): Machine[] {
  return fleet.filter((m) => m.status === 'branch' && (!town || ((m as Machine & { br?: TownId }).br ?? first) === town));
}
/** The machines at one branch. */
export function brAt(b: Pick<BranchState, 'fleet' | 'branch'>, town: TownId): Machine[] {
  return brMachines(b.fleet, town, b.branch?.town);
}
/** Which branch a machine's at. */
export function brTownOf(b: Pick<BranchState, 'branch'>, m: Machine): TownId | undefined {
  return m.status === 'branch' ? (m as Machine & { br?: TownId }).br ?? b.branch?.town : undefined;
}
/** Full crews there (a grader, roller and cart each), at a slower pace without two carts a crew. */
export function brCrews(fleet: readonly Machine[]): { n: number; pace: number } {
  const c = { grader: 0, roller: 0, cart: 0, truck: 0 };
  for (const m of brMachines(fleet)) if (m.down === 0 && isRoad(m.type)) c[m.type]++;
  const n = Math.min(c.grader, c.roller, c.cart);
  return { n, pace: c.cart >= 2 * n ? 1 : 0.85 };
}

export function openBranch(rand: Rand, b: BranchState, k: BranchMgrKind, town?: TownId): boolean {
  const M = BR_MGR[k], at = compat.prototype || !town ? brTown(b.town as TownId) : town;
  if (!M || !canBranch(b) || b.bank < BR_SETUP || !brTowns(b).includes(at)) return false;
  b.bank -= BR_SETUP;
  book(b.acc, 'capital', BR_SETUP);
  const B: Branch = { town: at, w0: b.week, mgr: { name: pick(rand, NAMES), skill: k, wage: M.wage }, rep: 15, hist: [], boost: null, ask: b.week };
  if (!b.branch) b.branch = B;
  else (b.more ??= []).push(B);
  note(b, { k: 'brOpened', town: B.town, cost: BR_SETUP, mgr: B.mgr!.name });
  return true;
}
export function hireBrMgr(rand: Rand, b: BranchState, k: BranchMgrKind, town?: TownId): void {
  const B = brOf(b, town), M = BR_MGR[k];
  if (!B || B.mgr || !M) return;
  B.mgr = { name: pick(rand, NAMES), skill: k, wage: M.wage };
  note(b, { k: 'brMgr', name: B.mgr.name, town: B.town });
}
export function toBranch(b: BranchState, id: string, town?: TownId): boolean {
  const m = b.fleet.find((x) => x.id === id), B = brOf(b, town);
  if (!B || !m || m.status !== 'idle' || m.down > 0) return false;
  const fl = brFloat(b.town as TownId, B.town);
  if ((compat.prototype ? brMachines(b.fleet) : brAt(b, B.town)).length >= BR_SLOTS || b.bank < fl) return false;
  m.status = 'branch';
  if (!compat.prototype) (m as Machine & { br?: TownId }).br = B.town;
  b.bank -= fl;
  book(b.acc, 'branch', fl);
  note(b, { k: 'toBranch', m: mRef(m), town: B.town });
  return true;
}
export function toHome(b: BranchState, id: string, room: number): boolean {
  const m = b.fleet.find((x) => x.id === id), at = m && brTownOf(b, m), fl = at ? brFloat(b.town as TownId, at) : BR_FLOAT;
  if (!m || m.status !== 'branch' || room <= 0 || b.bank < fl) return false;
  m.status = 'idle';
  delete (m as Machine & { br?: TownId }).br;
  b.bank -= fl;
  book(b.acc, 'branch', fl);
  note(b, { k: 'toHome', m: mRef(m) });
  return true;
}
/** Close it: the gear comes home (paying at most three floats). */
export function closeBranch(b: BranchState, town?: TownId): void {
  const B = brOf(b, town);
  if (!B) return;
  // pin every machine to its branch before the first branch changes
  for (const m of brMachines(b.fleet)) (m as Machine & { br?: TownId }).br ??= b.branch?.town;
  const ms = compat.prototype ? brMachines(b.fleet) : brAt(b, B.town);
  for (const m of ms) {
    m.status = 'idle';
    delete (m as Machine & { br?: TownId }).br;
  }
  b.bank -= brFloat(b.town as TownId, B.town) * Math.min(3, compat.prototype ? brMachines(b.fleet).length : ms.length);
  note(b, { k: 'brClosed', town: B.town });
  if (B === b.branch) b.branch = b.more?.shift() ?? null;
  else b.more = (b.more ?? []).filter((x) => x !== B);
  if (compat.prototype) for (const m of b.fleet) delete (m as Machine & { br?: TownId }).br;
}

export type BranchEvent = { k: 'branchWeek'; town: TownId; days: number; rev: number; crews: number; broke: number; bulk?: number; bd?: number };

/**
 * The branch's week. Work comes in by reputation, how busy the work is and the manager (none: 60%).
 * Its gear works the other town's dry days; breakdowns there are fixed on the spot (and cost reputation).
 * mg: the difficulty's margin shift; costIdx: inflation; whsSys: your safety system, which helps reputation.
 */
export function branchWeek(rand: Rand, b: BranchState, w: WorkshopCtx, fmul: number, mg: number, costIdx: number, whsSys: number, rep: WeekReport, acc: Accounts, events: BranchEvent[]): void {
  for (const B of compat.prototype ? [b.branch!].filter(Boolean) : branches(b)) oneBranch(rand, b, B, w, fmul, mg, costIdx, whsSys, rep, acc, events);
}

/** How much bulk work a town's farms and mines find for a branch's dozers, scrapers and diggers. */
export function brBulkWork(town: TownId): number {
  const W = TOWNS[town].work;
  return Math.max(0.3, Math.min(1.2, W.farm * 0.7 + W.mine * 0.4));
}

function oneBranch(rand: Rand, b: BranchState, B: Branch, w: WorkshopCtx, fmul: number, mg: number, costIdx: number, whsSys: number, rep: WeekReport, acc: Accounts, events: BranchEvent[]): void {
  const ms = compat.prototype ? brMachines(b.fleet) : brAt(b, B.town);
  const C = brCrews(ms), sk = B.mgr ? { green: 0.85, solid: 1, gun: 1.12 }[B.mgr.skill] : 0.6;
  const util = Math.max(0.15, Math.min(0.95, (0.5 + (0.4 * B.rep) / 100) * Math.min(1.25, fmul) * sk));
  let dry = 0;
  for (let d = 0; d < 5; d++) if (!wetDay({ town: B.town, wxStart: b.wxStart }, b.week, d)) dry++;
  const days = Math.round(C.n * dry * util * 10) / 10;
  // the real game: bulk gear there works the town's farms and mines, a machine at a time
  const bu = compat.prototype ? [] : ms.filter((m) => isBulk(m.type) && m.down === 0), bd = Math.round(dry * util * brBulkWork(B.town) * 10) / 10;
  const brev = bu.reduce((a, m) => a + bd * TYPES[m.type].wet * BRB_RATE, 0);
  const rev = Math.round(days * BR_RATE * C.pace * (1 + mg * 0.5) + brev * (1 + mg * 0.5)) + (B.boost && B.boost.until >= b.week ? B.boost.extra : 0);
  const cost = Math.round((days * BR_COST * (C.pace < 1 ? 0.95 : 1) + brev * BRB_COST + BR_RENT + (B.mgr ? B.mgr.wage : 0)) * costIdx);
  let ws = 0, broke = 0;
  if (B.boost && B.boost.until < b.week) B.boost = null;
  for (const m of ms) {
    if (m.down > 0) continue;
    const n = isBulk(m.type) && bu.length ? Math.round(bd) : C.n ? Math.round(dry * util) : 0;
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
  const busy = C.n || bu.length;
  B.rep = Math.min(100, B.rep + (busy ? (util > 0.5 ? 0.6 : 0.25) + whsSys * 0.1 : -0.3));
  B.hist.push({ w: b.week, days, rev, cost: cost + ws, crews: C.n, dry, ...(bu.length ? { bulk: bu.length, bd: Math.round(bd * bu.length * 10) / 10 } : {}) });
  if (B.hist.length > 26) B.hist.shift();
  if (busy || cost) events.push({ k: 'branchWeek', town: B.town, days, rev, crews: C.n, broke, ...(bu.length ? { bulk: bu.length, bd: Math.round(bd * bu.length * 10) / 10 } : {}) });
  // the manager rings now and then
  if (b.week - (B.ask || 0) >= 8 && rand() < 0.12 && !b.queue.some((q) => q.k.indexOf('br') === 0)) {
    const pool: string[] = [];
    if (C.n >= 2 && !B.boost) pool.push('brtender', 'brtender');
    if (B.mgr) pool.push('brraise');
    if (pool.length) {
      B.ask = b.week;
      b.queue.push(compat.prototype || B === b.branch ? { k: pick(rand, pool) } : { k: pick(rand, pool), town: B.town });
    }
  }
}

/** The branch manager has a council package: its size and length, from the card's own seed. */
export function brTenderCard(cardRand: Rand): { val: number; wk: number } {
  return { val: round(int(cardRand, 250, 700) * 1000, 10000), wk: int(cardRand, 8, 16) };
}
/** Go in sharp (65% to win, 7% margin) or price it properly (40%, 14%). */
export function brTender(rand: Rand, b: BranchState, c: { val: number; wk: number }, sharp: boolean, town?: TownId): boolean {
  const B = brOf(b, town)!;
  if (rand() < (sharp ? 0.65 : 0.4)) {
    B.boost = { until: b.week + c.wk, extra: Math.round((c.val * (sharp ? 0.07 : 0.14)) / c.wk) };
    B.rep = Math.min(100, B.rep + 3);
    return true;
  }
  return false;
}
/** The manager wants $400 a week more: pay it (half the time they step up a level) or say no (35% they walk). */
export function brRaise(rand: Rand, b: BranchState, pay: boolean, town?: TownId): 'stepUp' | 'stays' | 'quit' {
  const B = brOf(b, town)!, M = B.mgr!;
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
