// The career ladder: eight rungs from owner-operator to prestige contractor, what each needs, what unlocks
// on the way, and the tickets (achievements) earned by doing the real thing. Names and wording live in text/career.ts.

import type { Loan } from './bank';
import type { Machine } from './machines';
import { ownedCounts } from './planning';
import { stars } from './hire';
import type { Person } from './staff';
import type { Whs } from './safety';

/** The parts of a career the ladder reads. */
export interface Ladder {
  phase: string;
  week: number;
  rep: number;
  fleet: Machine[];
  staff: Person[];
  loan: Loan;
  whs: Whs;
  yard: string;
  hardcore?: boolean;
  won?: boolean;
  won2?: boolean;
  won3?: boolean;
  wonWk?: number;
  won2Wk?: number;
  won3Wk?: number;
  subsWon?: number;
  subsDone?: number;
  lds?: number;
  ownWon?: number;
  ownDone?: number;
  majorDone?: number;
  prestigeDone?: number;
  buyouts?: number;
  /** Ticket counters. */
  tc?: Record<string, unknown>;
  tix?: Record<string, { w: number; no: number }>;
  tixN?: number;
  tixNew?: string[];
  /** Week each unlock was first seen. */
  unl?: Record<string, number>;
}

function owns(st: Ladder, t: string): boolean {
  return st.fleet.some((m) => m.type === t && m.status !== 'auction');
}

/** Ready to subcontract: a grader, roller and water cart, a star, no missed repayments, SWMS. */
export function checks(st: Ladder): boolean[] {
  return [owns(st, 'grader') && owns(st, 'roller') && owns(st, 'cart'), st.rep >= 5, st.loan.missed === 0, st.whs.sys >= 1];
}
/** Your own contract: 3 subcontracts finished and two stars. */
export function checks2(st: Ladder): boolean[] {
  return [(st.subsDone || 0) >= 3, stars(st.rep) >= 2];
}
/** Regional contractor: 2 council contracts finished and two full crews owned. */
export function checks3(st: Ladder): boolean[] {
  const o = ownedCounts(st.fleet);
  return [(st.ownDone || 0) >= 2, o.grader >= 2 && o.roller >= 2 && o.cart >= 2];
}
/** Flood recovery contractor: a program delivered by 30 June. */
export function checks4(st: Ladder): boolean[] {
  return [(st.majorDone || 0) >= 1];
}
/** Prestige contractor: 2 programs, ISO 45001, a plant hub, and a state road program delivered. */
export function checks5(st: Ladder): boolean[] {
  return [(st.majorDone || 0) >= 2, st.whs.sys >= 3, st.yard === 'hub', (st.prestigeDone || 0) >= 1];
}

/** Where you are on the ladder, 1 to 8. */
export function rung(st: Ladder): number {
  if (st.won3 && (st.prestigeDone || 0) >= 1) return 8;
  if (st.won3 && (st.majorDone || 0) >= 1) return 7;
  if (st.won2 && (st.ownWon || 0) > 0 && checks3(st).every(Boolean)) return 6;
  if ((st.subsWon || 0) > 0 && checks2(st).every(Boolean)) return 5;
  if ((st.subsWon || 0) > 0) return 4;
  if (checks(st).every(Boolean)) return 3;
  if (st.fleet.length >= 2 || st.staff.length) return 2;
  return 1;
}

/** The career's milestones, once reached, stay reached. */
export function checkWin(st: Ladder): void {
  if (st.phase !== 'play') return;
  const g = rung(st);
  if (!st.won && g >= 3) {
    st.won = true;
    st.wonWk = st.week;
  }
  if (!st.won2 && g >= 5) {
    st.won2 = true;
    st.won2Wk = st.week;
  }
  if (!st.won3 && g >= 6) {
    st.won3 = true;
    st.won3Wk = st.week;
  }
}

export type UnlockId = 'swms' | 'won' | 'won2' | 'won3';
export const UNLOCKS: readonly { id: UnlockId; ok: (st: Ladder) => boolean }[] = [
  { id: 'swms', ok: (st) => rung(st) >= 2 || st.whs.sys >= 1 },
  { id: 'won', ok: (st) => !!st.won },
  { id: 'won2', ok: (st) => !!st.won2 },
  { id: 'won3', ok: (st) => !!st.won3 },
];

export function unlocked(st: Ladder, id: UnlockId): boolean {
  const u = UNLOCKS.find((x) => x.id === id);
  return !!(u && u.ok(st));
}

/** Anything newly open is noted with the week; returns the ids, so screens can say what's opened up. */
export function unlockWeek(st: Ladder): UnlockId[] {
  const seen = (st.unl = st.unl || {}), out: UnlockId[] = [];
  for (const u of UNLOCKS) {
    if (!seen[u.id] && u.ok(st)) {
      seen[u.id] = st.week;
      out.push(u.id);
    }
  }
  return out;
}

// ---------- tickets ----------

export function tc(st: Ladder): Record<string, any> {
  return (st.tc = st.tc || {});
}
export function tcAdd(st: Ladder, k: string, n = 1): void {
  const t = tc(st);
  t[k] = ((t[k] as number) || 0) + n;
}

/** What tickets need beyond the career itself: net worth, and the week of the last lost-time or serious incident. */
export interface TicketCtx {
  netWorth: () => number;
  lastSerious: number | null;
}

export type TicketCat = 'start' | 'contracts' | 'fleet' | 'safety' | 'weather' | 'money' | 'hardcore';

export const TICKETS: readonly { id: string; c: TicketCat; ok: (st: Ladder, x: TicketCtx) => boolean }[] = [
  { id: 'firsthire', c: 'start', ok: (st) => (tc(st).hires || 0) >= 1 },
  { id: 'fleet2', c: 'start', ok: (st) => rung(st) >= 2 },
  { id: 'staff1', c: 'start', ok: (st) => (tc(st).hired || 0) >= 1 || st.staff.length > 0 },
  { id: 'swms', c: 'start', ok: (st) => st.whs.sys >= 1 },
  { id: 'ready', c: 'start', ok: (st) => !!st.won },
  { id: 'firstsub', c: 'contracts', ok: (st) => (st.subsWon || 0) >= 1 },
  { id: 'ontime', c: 'contracts', ok: (st) => (st.subsDone || 0) - (st.lds || 0) >= 1 },
  { id: 'twocrews', c: 'contracts', ok: (st) => (tc(st).crews2 || 0) >= 1 },
  { id: 'council', c: 'contracts', ok: (st) => (st.ownWon || 0) >= 1 },
  { id: 'tenwins', c: 'contracts', ok: (st) => (st.subsWon || 0) + (st.ownWon || 0) >= 10 },
  { id: 'regional', c: 'contracts', ok: (st) => rung(st) >= 6 },
  { id: 'program', c: 'contracts', ok: (st) => (st.majorDone || 0) >= 1 },
  { id: 'early', c: 'contracts', ok: (st) => (tc(st).early || 0) >= 1 },
  { id: 'depot', c: 'fleet', ok: (st) => ['depot', 'regional', 'hub'].includes(st.yard) },
  { id: 'hub', c: 'fleet', ok: (st) => st.yard === 'hub' },
  { id: 'fleet10', c: 'fleet', ok: (st) => st.fleet.filter((m) => m.status !== 'auction').length >= 10 },
  { id: 'gps', c: 'fleet', ok: (st) => st.fleet.some((m) => m.gps) || (tc(st).gps || 0) >= 1 },
  { id: 'multi', c: 'fleet', ok: (st) => st.fleet.some((m) => m.multi) },
  { id: 'auction', c: 'fleet', ok: (st) => (tc(st).auction || 0) >= 1 },
  { id: 'fitter', c: 'fleet', ok: (st) => st.staff.some((p) => p.role === 'fitter') },
  { id: 'ops', c: 'fleet', ok: (st) => st.staff.some((p) => p.role === 'ops') },
  { id: 'cleanyear', c: 'safety', ok: (st, x) => !!st.won && st.week - (x.lastSerious == null ? (tc(st).safeFrom ?? st.week) : x.lastSerious) >= 52 },
  { id: 'speakup', c: 'safety', ok: (st) => st.whs.nm >= 3 },
  { id: 'yarn', c: 'safety', ok: (st) => (tc(st).yarn || 0) >= 1 },
  { id: 'iso', c: 'safety', ok: (st) => st.whs.sys >= 3 },
  { id: 'raincall', c: 'weather', ok: (st) => (tc(st).rainRight || 0) >= 5 },
  { id: 'bust', c: 'weather', ok: (st) => (tc(st).bustOk || 0) >= 1 },
  { id: 'loanfree', c: 'money', ok: (st) => !!st.loan.paidOff && st.week > 4 },
  { id: 'buyout', c: 'money', ok: (st) => (st.buyouts || 0) >= 1 },
  { id: 'hc1', c: 'hardcore', ok: (st) => !!st.hardcore && !!st.won },
  { id: 'hc2', c: 'hardcore', ok: (st) => !!st.hardcore && (st.ownWon || 0) >= 1 },
  { id: 'hc3', c: 'hardcore', ok: (st) => !!st.hardcore && (st.majorDone || 0) >= 1 },
  { id: 'hc4', c: 'hardcore', ok: (st) => (tc(st).brink || 0) >= 1 },
  { id: 'million', c: 'money', ok: (_st, x) => x.netWorth() >= 1e6 },
];

/** Award anything newly earned. Returns the ids, in the order they were earned. */
export function checkTix(st: Ladder, x: TicketCtx): string[] {
  if (st.phase !== 'play') return [];
  st.tix = st.tix || {};
  const got: string[] = [];
  for (const t of TICKETS) {
    if (st.tix[t.id]) continue;
    let ok = false;
    try {
      ok = t.ok(st, x);
    } catch {
      ok = false;
    }
    if (ok) {
      st.tixN = (st.tixN || 0) + 1;
      st.tix[t.id] = { w: st.week, no: st.tixN };
      got.push(t.id);
    }
  }
  if (got.length) st.tixNew = (st.tixNew || []).concat(got);
  return got;
}
