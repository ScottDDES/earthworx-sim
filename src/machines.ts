// Machines: what they're worth, how they wear, servicing, and breakdowns.
// Condition runs 10 to 100. Every day worked adds 9 hours. A service is due every 250 hours.

import { yearOf } from './calendar';
import { book, type Accounts } from './ledger';
import { int, pick, type Rand } from './rng';

export type MachineType = 'grader' | 'roller' | 'cart' | 'truck';

export interface MachineSpec {
  name: string;
  short: string;
  /** Price new. */
  newV: number;
  /** Dealer service price. */
  svc: number;
  /** Fuel per day worked. */
  fuel: number;
  /** Daily rate a client pays you for it with an operator (wet hire), before the market moves it. */
  wet: number;
  /** Weekly rate you pay to hire one in without an operator (dry hire). */
  dry: number;
  /** Daily rate you pay to hire one in with an operator, to fill a gap on your contract. */
  sub: number;
}

export const TYPES: Record<MachineType, MachineSpec> = {
  grader: { name: 'Grader 12M', short: 'grader', newV: 600000, svc: 1800, fuel: 570, wet: 1665, dry: 5100, sub: 2230 },
  roller: { name: 'Smooth drum roller', short: 'roller', newV: 220000, svc: 1200, fuel: 470, wet: 1260, dry: 3885, sub: 1750 },
  cart:   { name: 'Water cart 18kL', short: 'water cart', newV: 300000, svc: 1500, fuel: 530, wet: 1260, dry: 3885, sub: 1750 },
  truck:  { name: 'Side tipper', short: 'side tipper', newV: 260000, svc: 1100, fuel: 850, wet: 1010, dry: 4200, sub: 1860 },
};

export type MachineStatus = 'idle' | 'working' | 'hired' | 'listed' | 'auction' | 'branch' | string;

/** A fault found at a service and patched up rather than fixed. Breakdown odds stay up until it's fixed. */
export interface Bandaid {
  part: string;
  fix: number;
  w: number;
}

export interface Machine {
  id: string;
  type: MachineType;
  year: number;
  cond: number;
  hours: number;
  /** Hours on the clock at the last service. */
  svcAt: number;
  status: MachineStatus;
  /** Days until it's back working. 99 = broken down, waiting on a decision. */
  down: number;
  cover: number;
  warranty: number;
  jobId: string | null;
  sale: unknown;
  gps?: boolean;
  /** A roller fitted with rubber tyres. */
  multi?: boolean;
  band?: Bandaid | null;
  repair?: number;
  bandBroke?: string | null;
  /** The workshop manager won't call for it to be turned over again until this week. */
  toSnooze?: number;
}

export const SVC_EVERY = 250;
export const GPS_COST = 85000;
export const HOURS_PER_DAY = 9;

const round = (n: number, to: number) => Math.round(n / to) * to;

export function newMachine(rand: Rand, id: string, type: MachineType, year: number, cond: number, hours: number): Machine {
  return { id, type, year, cond, hours, svcAt: hours - int(rand, 0, 120), status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null };
}

export function machineName(m: Pick<Machine, 'type' | 'multi'>): string {
  return m.multi ? 'Multi-tyre roller' : TYPES[m.type].name;
}

/** What it's worth on its own: 8% a year off the new price (never below 20%), then condition takes up to 40% off that. */
export function baseValue(m: Pick<Machine, 'type' | 'year' | 'cond'>, week: number): number {
  const age = yearOf(week) - m.year;
  return round(TYPES[m.type].newV * Math.max(0.2, Math.pow(0.92, age)) * (0.6 + (0.4 * m.cond) / 100), 500);
}

/** What it's worth with its extras: GPS keeps half its cost, multi-tyres add 10%. */
export function value(m: Pick<Machine, 'type' | 'year' | 'cond' | 'gps' | 'multi'>, week: number): number {
  const b = baseValue(m, week);
  return b + (m.gps ? round(GPS_COST * 0.5, 500) : 0) + (m.multi ? round(b * 0.1, 500) : 0);
}

export function hoursSinceService(m: Machine): number {
  return m.hours - m.svcAt;
}
export function overdue(m: Machine): boolean {
  return hoursSinceService(m) > SVC_EVERY;
}
export function svcLeft(m: Machine): number {
  return SVC_EVERY - hoursSinceService(m);
}

/**
 * The state of the workshop, which changes what servicing and breakdowns cost.
 * The staff and yard modules work these out; machines just use them.
 */
export interface WorkshopCtx {
  /** The yard's service multiplier: 1 with no workshop, down to 0.6. */
  yardSvc: number;
  /** Share of the fleet the fitters can look after, 0 to 1. */
  fitCov: number;
  /** Which kind of workshop manager, if any. */
  wsm: 'dealer' | 'diesel' | 'planner' | null;
  /** More than 12 machines at home and no workshop manager. */
  bigNoWsm: boolean;
  /** The difficulty's breakdown multiplier. */
  brk: number;
  /** Inflation so far. */
  costIdx: number;
}

/** A dealer service at your yard's rate. */
export function svcCost(m: Machine, w: Pick<WorkshopCtx, 'yardSvc' | 'costIdx'>): number {
  return round(TYPES[m.type].svc * w.yardSvc * w.costIdx, 50);
}

/** After a service. A fitter's service in your own workshop does a bit more. */
export function serviced(m: Machine, by: 'dealer' | 'fitter'): void {
  m.svcAt = m.hours;
  m.cond = by === 'fitter' ? Math.min(95, m.cond + 16) : Math.min(92, m.cond + 12);
}

/**
 * A day's work. mult is how hard the day was (1 normal, 1.8 for a heavy haul).
 * An overdue service wears it faster.
 */
export function wear(m: Machine, mult: number, acc?: Accounts): void {
  m.hours += HOURS_PER_DAY;
  if (acc) book(acc, 'machineDays', 1);
  m.cond = Math.max(10, m.cond - (0.28 * mult + (overdue(m) ? 0.25 : 0)));
}

/** Chance it breaks down today. */
export function breakChance(m: Machine, mult: number, w: WorkshopCtx): number {
  const base = 0.003 + Math.max(0, 70 - m.cond) * 0.0006 + (overdue(m) ? 0.012 : 0) + (m.band ? 0.025 : 0);
  return base * mult * (1 - 0.55 * w.fitCov) * (w.wsm === 'diesel' ? 0.85 : 1) * (w.bigNoWsm ? 1.25 : 1) * w.brk;
}

export function breaks(rand: Rand, m: Machine, mult: number, w: WorkshopCtx): boolean {
  return rand() < breakChance(m, mult, w);
}

/**
 * It's broken down. Off the job until the player decides what to do, with the repair bill set now.
 * A patched-up fault that lets go costs 1.8 times the proper fix.
 */
export function breakdown(rand: Rand, m: Machine, w: WorkshopCtx, acc?: Accounts): void {
  if (acc) book(acc, 'breakdowns', 1);
  m.down = 99;
  m.repair = round(int(rand, 1500, 6500) * w.yardSvc * (1 - 0.35 * w.fitCov) * (w.wsm === 'dealer' ? 0.85 : 1) * w.costIdx, 100);
  m.bandBroke = null;
  if (m.band) {
    m.repair = round(m.band.fix * 1.8, 100);
    m.bandBroke = m.band.part;
    m.band = null;
  }
}

export const PARTS: Record<MachineType, readonly string[]> = {
  grader: ['cracked circle drive mount', 'weeping blade lift cylinder', 'worn steering pins', 'cracked radiator core', 'slack in the tandem chains'],
  roller: ['vibe bearing running hot', 'weeping drum motor seal', 'cracked ROPS mount', 'worn articulation bushes'],
  cart:   ['water pump seal letting go', 'cracked spray bar bracket', 'slipping clutch', 'worn spring hangers'],
  truck:  ['cracked tipper hoist mount', 'leaking air tank', 'worn kingpins', 'weeping hoist cylinder'],
};

export interface Find {
  part: string;
  fix: number;
}

/**
 * A service sometimes turns up a problem: 7%, more on worn gear. Your own fitter (byFitter)
 * fixes it for 30% less. Returns null when nothing's found.
 */
export function serviceFind(rand: Rand, m: Machine, w: Pick<WorkshopCtx, 'yardSvc' | 'wsm'>, byFitter: boolean): Find | null {
  if (!(rand() < 0.07 + Math.max(0, 60 - m.cond) * 0.003)) return null;
  const part = pick(rand, PARTS[m.type]);
  const fix = round(int(rand, 1200, 5500) * w.yardSvc * (byFitter ? 0.7 : 1) * (w.wsm === 'dealer' ? 0.85 : 1), 100);
  return { part, fix };
}

/** Patching a find costs 15% of the proper fix. */
export function patchCost(fix: number): number {
  return round(fix * 0.15, 50);
}
