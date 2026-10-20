// Machines: what they're worth, how they wear, servicing, and breakdowns.
// Condition runs 10 to 100. Every day worked adds 10 hours (9 in the prototype). A service is due every 250 hours.

import { yearOf } from './calendar';
import { compat, onCompat } from './compat';
import { book, type Accounts } from './ledger';
import { int, pick, type Rand } from './rng';

/** The road gear the base game is built on. */
export type RoadType = 'grader' | 'roller' | 'cart' | 'truck';
/** The Bulk and Ag pack's gear: each model its own type, so prices, fuel and hire rates are its own. */
export type BulkType =
  | 'd6' | 'd8' | 'd9' | 'd10'
  | 'pull' | 's623' | 's627' | 's631' | 's637' | 's651' | 's657'
  | 'padfoot' | 'c815' | 'c825' | 'excavator' | 'moxy' | 'moxycart';
/** A wheel loader at the gravel pit, loading the trucks (the real game only). */
export type PitType = 'loader';
export type MachineType = RoadType | BulkType | PitType;

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
  // Bulk and Ag (my guesses, Scott OK'd them for testing): wet hire is a day with operator, dry hire a week
  d6:        { name: 'Dozer D6', short: 'D6', newV: 750000, svc: 1600, fuel: 600, wet: 1900, dry: 6300, sub: 2300 },
  d8:        { name: 'Dozer D8', short: 'D8', newV: 1150000, svc: 2200, fuel: 900, wet: 2350, dry: 7800, sub: 2800 },
  d9:        { name: 'Dozer D9', short: 'D9', newV: 1600000, svc: 2800, fuel: 1150, wet: 2800, dry: 9200, sub: 3350 },
  d10:       { name: 'Dozer D10', short: 'D10', newV: 2300000, svc: 3500, fuel: 1500, wet: 3400, dry: 11200, sub: 4100 },
  pull:      { name: 'Tractor and pull scrapers', short: 'pull scraper', newV: 800000, svc: 2400, fuel: 1000, wet: 2000, dry: 6600, sub: 2400 },
  s623:      { name: 'Scraper 623, elevating', short: '623', newV: 1300000, svc: 2600, fuel: 1100, wet: 2350, dry: 7800, sub: 2800 },
  s627:      { name: 'Scraper 627, push-pull', short: '627', newV: 1600000, svc: 2800, fuel: 1300, wet: 2650, dry: 8800, sub: 3150 },
  s631:      { name: 'Scraper 631, open bowl', short: '631', newV: 1700000, svc: 2800, fuel: 1350, wet: 2700, dry: 8900, sub: 3250 },
  s637:      { name: 'Scraper 637, push-pull', short: '637', newV: 1900000, svc: 3000, fuel: 1500, wet: 2950, dry: 9700, sub: 3550 },
  s651:      { name: 'Scraper 651, open bowl', short: '651', newV: 2400000, svc: 3400, fuel: 1800, wet: 3400, dry: 11200, sub: 4100 },
  s657:      { name: 'Scraper 657, push-pull', short: '657', newV: 2700000, svc: 3600, fuel: 2000, wet: 3800, dry: 12500, sub: 4550 },
  padfoot:   { name: 'Padfoot roller', short: 'padfoot', newV: 260000, svc: 1200, fuel: 480, wet: 1300, dry: 4300, sub: 1550 },
  c815:      { name: 'Compactor 815', short: '815', newV: 900000, svc: 2000, fuel: 900, wet: 1980, dry: 6500, sub: 2400 },
  c825:      { name: 'Compactor 825', short: '825', newV: 1250000, svc: 2400, fuel: 1100, wet: 2340, dry: 7700, sub: 2800 },
  excavator: { name: 'Excavator 25t', short: 'excavator', newV: 380000, svc: 1400, fuel: 650, wet: 1530, dry: 5000, sub: 1850 },
  moxy:      { name: 'Moxy 30t', short: 'moxy', newV: 650000, svc: 1600, fuel: 800, wet: 1620, dry: 5300, sub: 1950 },
  moxycart:  { name: 'Moxy water cart 28kL', short: 'moxy cart', newV: 700000, svc: 1700, fuel: 850, wet: 1700, dry: 5600, sub: 2050 },
  loader:    { name: 'Loader 966', short: 'loader', newV: 520000, svc: 1500, fuel: 540, wet: 1530, dry: 4000, sub: 2070 },
};

/**
 * The real game's rates: Scott's 2022-23 hire schedule, on a 10-hour day. wet is the hourly rate with the client's
 * fuel, fuel the gap to the rate with your fuel, sub that whole rate (what another outfit charges you), dry a week.
 * The 627's are a guess between the 623 and the 637. The prototype keeps the table above.
 */
const RATES: Partial<Record<MachineType, { wet: number; withFuel: number; dry: number; name?: string }>> = {
  grader: { wet: 185, withFuel: 240, dry: 5000, name: 'Grader 14ft' },
  roller: { wet: 150, withFuel: 200, dry: 2500 },
  cart: { wet: 140, withFuel: 200, dry: 2500 },
  truck: { wet: 170, withFuel: 220, dry: 2750 },
  d6: { wet: 190, withFuel: 260, dry: 6500 },
  d8: { wet: 250, withFuel: 370, dry: 8000 },
  d9: { wet: 300, withFuel: 450, dry: 10000 },
  d10: { wet: 380, withFuel: 520, dry: 12500 },
  pull: { wet: 240, withFuel: 360, dry: 10000 },
  s623: { wet: 300, withFuel: 430, dry: 12000 },
  s627: { wet: 330, withFuel: 490, dry: 14000 },
  s631: { wet: 275, withFuel: 390, dry: 10000 },
  s637: { wet: 355, withFuel: 540, dry: 16000 },
  s651: { wet: 400, withFuel: 610, dry: 15000 },
  s657: { wet: 480, withFuel: 750, dry: 20000 },
  padfoot: { wet: 150, withFuel: 200, dry: 2500 },
  c815: { wet: 170, withFuel: 250, dry: 3000 },
  c825: { wet: 195, withFuel: 300, dry: 3000 },
  excavator: { wet: 200, withFuel: 250, dry: 2500, name: 'Excavator 30t' },
  moxy: { wet: 180, withFuel: 260, dry: 3000 },
  moxycart: { wet: 200, withFuel: 300, dry: 4000, name: 'Moxy water cart 40kL' },
  loader: { wet: 170, withFuel: 230, dry: 4000 },
};
/** Hours in a working day: what a wet hire day is charged on and what a day puts on the clock. */
export const dayHours = () => (compat.prototype ? 9 : 10);
const PROTO_TYPES = JSON.parse(JSON.stringify(TYPES)) as typeof TYPES;
onCompat(() => {
  for (const k of Object.keys(TYPES) as MachineType[]) {
    const r = RATES[k], h = dayHours();
    Object.assign(TYPES[k], PROTO_TYPES[k]);
    if (compat.prototype || !r) continue;
    Object.assign(TYPES[k], { wet: r.wet * h, fuel: (r.withFuel - r.wet) * h, sub: r.withFuel * h, dry: r.dry }, r.name ? { name: r.name } : {});
  }
});

/** Which family each machine belongs to, for grouping in the yard. */
export type Family = RoadType | 'dozer' | 'scraper' | 'compactor' | 'excavator' | 'moxy' | 'loader';
export const FAMILY: Record<MachineType, Family> = {
  grader: 'grader', roller: 'roller', cart: 'cart', truck: 'truck',
  d6: 'dozer', d8: 'dozer', d9: 'dozer', d10: 'dozer',
  pull: 'scraper', s623: 'scraper', s627: 'scraper', s631: 'scraper', s637: 'scraper', s651: 'scraper', s657: 'scraper',
  padfoot: 'compactor', c815: 'compactor', c825: 'compactor', excavator: 'excavator', moxy: 'moxy', moxycart: 'moxy',
  loader: 'loader',
};

/** The Bulk and Ag pack's machines, in the order the Market shows them. */
export const BULK_TYPES: readonly BulkType[] = ['d6', 'd8', 'd9', 'd10', 'pull', 's623', 's627', 's631', 's637', 's651', 's657', 'padfoot', 'c815', 'c825', 'excavator', 'moxy', 'moxycart'];

/** Road gear: what crews, councils and contracts are counted in. */
export function isRoad(t: MachineType): t is RoadType {
  return t === 'grader' || t === 'roller' || t === 'cart' || t === 'truck';
}

export function isBulk(t: MachineType): t is BulkType {
  return t !== 'loader' && (FAMILY[t] !== t || t === 'excavator' || t === 'moxy');
}

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
  /** A side tipper pulling a second trailer: a roadtrain (the real game). */
  rt?: boolean;
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
/** GPS machine control: a grader gets 7% more done a day. */
export const GPS_MUL = 1.07;
/** A second trailer and dolly turn a side tipper into a roadtrain. */
export const RT_COST = 95000;
/** A roadtrain's day: Scott's schedule, $210 an hour wet, $290 with your fuel, $3,500 a week dry, on a 10-hour day. */
export const RT = { wet: 2100, fuel: 800, sub: 2900, dry: 3500 };

const round = (n: number, to: number) => Math.round(n / to) * to;

export function newMachine(rand: Rand, id: string, type: MachineType, year: number, cond: number, hours: number): Machine {
  return { id, type, year, cond, hours, svcAt: hours - int(rand, 0, 120), status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null };
}

export function machineName(m: Pick<Machine, 'type' | 'multi'> & { rt?: boolean }): string {
  return m.multi ? 'Multi-tyre roller' : m.rt ? 'Roadtrain side tipper' : TYPES[m.type].name;
}

/** What it's worth on its own: 8% a year off the new price (never below 20%), then condition takes up to 40% off that. */
export function baseValue(m: Pick<Machine, 'type' | 'year' | 'cond'>, week: number): number {
  const age = yearOf(week) - m.year;
  return round(TYPES[m.type].newV * Math.max(0.2, Math.pow(0.92, age)) * (0.6 + (0.4 * m.cond) / 100), 500);
}

/** What it's worth with its extras: GPS keeps half its cost, multi-tyres add 10%. */
export function value(m: Pick<Machine, 'type' | 'year' | 'cond' | 'gps' | 'multi'> & { rt?: boolean }, week: number): number {
  const b = baseValue(m, week);
  return b + (m.gps ? round(GPS_COST * 0.5, 500) : 0) + (m.multi ? round(b * 0.1, 500) : 0) + (m.rt ? round(RT_COST * 0.6, 500) : 0);
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
  m.hours += dayHours();
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

const DOZER_PARTS = ['worn track links', 'cracked blade push arm', 'weeping tilt cylinder', 'tired final drive seals', 'cracked ripper shank'] as const;
const SCRAPER_PARTS = ['cracked bowl cutting edge', 'weeping apron cylinder', 'worn hitch pins', 'slipping transmission clutch'] as const;
const COMPACTOR_PARTS = ['worn tamping feet', 'cracked blade mount', 'weeping steering cylinder', 'worn articulation bushes'] as const;

export const PARTS: Record<MachineType, readonly string[]> = {
  grader: ['cracked circle drive mount', 'weeping blade lift cylinder', 'worn steering pins', 'cracked radiator core', 'slack in the tandem chains'],
  roller: ['vibe bearing running hot', 'weeping drum motor seal', 'cracked ROPS mount', 'worn articulation bushes'],
  cart:   ['water pump seal letting go', 'cracked spray bar bracket', 'slipping clutch', 'worn spring hangers'],
  truck:  ['cracked tipper hoist mount', 'leaking air tank', 'worn kingpins', 'weeping hoist cylinder'],
  d6: DOZER_PARTS, d8: DOZER_PARTS, d9: DOZER_PARTS, d10: DOZER_PARTS,
  pull: SCRAPER_PARTS, s623: SCRAPER_PARTS, s627: SCRAPER_PARTS, s631: SCRAPER_PARTS, s637: SCRAPER_PARTS, s651: SCRAPER_PARTS, s657: SCRAPER_PARTS,
  padfoot: ['vibe bearing running hot', 'worn padfoot shell', 'cracked ROPS mount', 'worn articulation bushes'],
  c815: COMPACTOR_PARTS, c825: COMPACTOR_PARTS,
  excavator: ['weeping boom cylinder', 'worn bucket pins', 'cracked track frame', 'slow swing motor'],
  moxy: ['cracked tray hinge', 'worn articulation bushes', 'leaking hoist cylinder', 'tired diff bearings'],
  moxycart: ['water pump seal letting go', 'cracked spray bar bracket', 'worn articulation bushes', 'tired diff bearings'],
  loader: ['weeping lift cylinder', 'worn bucket pins', 'tired transmission clutch packs', 'worn articulation bushes'],
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
