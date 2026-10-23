// Diesel: a bulk tank at the yard that you keep topped up, and a pump price that moves every week.
// Every machine's fuel figure (machines.ts) is a day's fuel at DIESEL_BASE a litre. The jobs keep charging that;
// at the end of the week the litres come out of your tank (bought by the load) or off the fuel truck at this
// week's pump price, and the difference is squared up. A dry tank stands your fuel-paying work down for a day
// while the fuel truck comes. A war overseas sends the price up and rations the loads.
// The real game only: under the prototype nothing here runs.

import { compat } from './compat';
import { spend, type Accounts } from './ledger';
import { YARD_ORDER, YARDS, type YardId } from './yards';
import { int, type Rand } from './rng';

/** The pump price a litre that the machines' fuel figures assume. */
export const DIESEL_BASE = 2.1;
/** A load of bulk diesel costs this much a litre less than the pump. */
export const BULK_OFF = 0.15;
/** The fuel truck's call-out, each week your tank runs dry. */
export const CALLOUT = 180;
/** Council contracts pay this share of the price rise back (rise and fall). */
export const RISE_FALL = 0.8;
/** A fuel levy gets this share of the rise back from the other clients. */
export const LEVY_BACK = 0.5;
/** The ops manager orders a load when the tank drops below this. */
export const AUTO_AT = 0.3;

export type TankId = 'small' | 'mid' | 'big' | 'xl' | 'farm';
export const TANKS: Record<TankId, { L: number; cost: number; yard: YardId }> = {
  small: { L: 10000, cost: 18000, yard: 'fenced' },
  mid: { L: 30000, cost: 45000, yard: 'depot' },
  big: { L: 68000, cost: 90000, yard: 'regional' },
  // Scott, 23 Oct: two more steps for the big outfits
  xl: { L: 110000, cost: 150000, yard: 'regional' },
  farm: { L: 200000, cost: 260000, yard: 'hub' },
};
export const TANK_ORDER: readonly TankId[] = ['small', 'mid', 'big', 'xl', 'farm'];

export interface FuelWar {
  from: number;
  to: number;
  peak: number;
}

export interface FuelBook {
  tank: TankId | null;
  /** Litres in the tank, and what they cost a litre. */
  L: number;
  avg: number;
  /** The weekly drift in the price (about 1), before any war. */
  walk: number;
  /** A load on its way: litres, the price a litre, and the week it arrives. */
  order: { L: number; at: number; due: number } | null;
  /** This week's fuel at the base price, and the part on council contracts. */
  wk: number;
  wkRF: number;
  /** Litres a working day last week, for how long the tank will last. */
  last: number;
  /** The day this week the tank runs dry (0 to 4), or -1. */
  dry: number;
  war: FuelWar | null;
  warDone?: number;
  /** The ops manager keeps it topped up. */
  auto?: boolean;
  /** A fuel levy on your clients, until this week. */
  levy?: number;
  /** The pump price, the last 26 weeks. */
  hist: number[];
}

export type FuelEvent =
  | { k: 'fuelIn'; L: number; at: number }
  | { k: 'fuelDry'; d: number; cost: number }
  | { k: 'fuelStolen'; L: number; caught: boolean }
  | { k: 'fuelAuto'; L: number; at: number }
  | { k: 'warOver' };

type FB = {
  week: number; bank: number; acc: Accounts; yard: YardId; erp?: boolean; fuel?: FuelBook;
  staff: { role: string }[]; queue: { k: string; [x: string]: unknown }[];
};

export function newFuel(): FuelBook {
  return { tank: null, L: 0, avg: 0, walk: 1, order: null, wk: 0, wkRF: 0, last: 0, dry: -1, war: null, hist: [] };
}

/** The career's fuel book, made the first time it's needed. Null under the prototype. */
export function fuelOf(b: FB): FuelBook | null {
  if (compat.prototype) return null;
  if (!b.fuel) b.fuel = newFuel();
  return b.fuel;
}

/** How much the war has the price up this week: it climbs over a fortnight, holds, then eases over a month. */
export function warMul(war: FuelWar | null, week: number): number {
  if (!war || week < war.from) return 1;
  const up = war.peak - 1;
  if (week === war.from) return 1 + up * 0.45;
  if (week === war.from + 1) return 1 + up * 0.8;
  if (week <= war.to) return war.peak;
  return Math.max(1, 1 + up * (1 - (week - war.to) / 5));
}

/** This week's pump price a litre. costIdx is inflation (Hard and Hardcore). */
export function pumpPrice(F: FuelBook, week: number, costIdx = 1): number {
  return Math.round(DIESEL_BASE * F.walk * warMul(F.war, week) * costIdx * 100) / 100;
}
export function bulkPrice(F: FuelBook, week: number, costIdx = 1): number {
  return Math.round((pumpPrice(F, week, costIdx) - BULK_OFF) * 100) / 100;
}

/** Rationed while the war's on and a fortnight after: half loads, two weeks to come. */
export function rationed(F: FuelBook, week: number): boolean {
  return !!F.war && week >= F.war.from && week <= F.war.to + 2;
}

export function hasOps(b: Pick<FB, 'staff'>): boolean {
  return b.staff.some((p) => p.role === 'ops');
}

/** The tanks your yard has room for. */
export function tankOk(yard: YardId, t: TankId): boolean {
  return YARD_ORDER.indexOf(yard) >= YARD_ORDER.indexOf(TANKS[t].yard);
}

/** What a load would be: litres and its cost. full: fill it up; else half the tank (less if it won't fit). */
export function loadOf(F: FuelBook, week: number, full: boolean, costIdx = 1): { L: number; at: number; cost: number } {
  const cap = F.tank ? TANKS[F.tank].L : 0, space = Math.max(0, cap - F.L);
  const L = Math.floor(Math.min(space, full && !rationed(F, week) ? space : cap / 2) / 100) * 100, at = bulkPrice(F, week, costIdx);
  return { L, at, cost: Math.round(L * at) };
}

/** Order a load. It's paid for when it arrives: next week, or the week after while rationed. */
export function orderFuel(b: FB, full: boolean, costIdx = 1): boolean {
  const F = fuelOf(b);
  if (!F || !F.tank || F.order) return false;
  const ld = loadOf(F, b.week, full, costIdx);
  if (ld.L <= 0) return false;
  F.order = { L: ld.L, at: ld.at, due: b.week + (rationed(F, b.week) ? 2 : 1) };
  return true;
}
export function cancelFuel(b: FB): void {
  const F = fuelOf(b);
  if (F) F.order = null;
}

/** Put a tank in (or a bigger one; the diesel moves across). A new tank comes with a load in it. */
export function buyTank(b: FB, t: TankId, costIdx = 1): boolean {
  const F = fuelOf(b);
  if (!F || !tankOk(b.yard, t) || (F.tank && TANK_ORDER.indexOf(t) <= TANK_ORDER.indexOf(F.tank))) return false;
  const first = !F.tank, fill = first ? Math.floor((TANKS[t].L * (rationed(F, b.week) ? 0.5 : 1)) / 100) * 100 : 0, at = bulkPrice(F, b.week, costIdx);
  const cost = TANKS[t].cost + Math.round(fill * at);
  if (b.bank < cost) return false;
  spend(b, 'capital', TANKS[t].cost);
  if (fill) spend(b, 'jobCosts', Math.round(fill * at));
  F.tank = t;
  if (fill) {
    F.avg = at;
    F.L = fill;
  }
  return true;
}
export function tankCost(F: FuelBook, t: TankId, week: number, costIdx = 1): number {
  const fill = F.tank ? 0 : Math.floor((TANKS[t].L * (rationed(F, week) ? 0.5 : 1)) / 100) * 100;
  return TANKS[t].cost + Math.round(fill * bulkPrice(F, week, costIdx));
}

export function setAuto(b: FB, on: boolean): void {
  const F = fuelOf(b);
  if (F) F.auto = on;
}

/** The machines burnt this much fuel (at the base price) on work you pay the fuel for. rf: a council contract. */
export function fuelUse(b: { fuel?: FuelBook }, dollars: number, rf = false): void {
  if (compat.prototype || !b.fuel || !dollars) return;
  b.fuel.wk += dollars;
  if (rf) b.fuel.wkRF += dollars;
}

/** Does work stand idle today, waiting on the fuel truck? */
export function fuelIdle(b: { fuel?: FuelBook }, d: number): boolean {
  return !compat.prototype && !!b.fuel && b.fuel.dry === d;
}

/** Days of diesel left in the tank at last week's rate (null: no work to go by). */
export function daysLeft(F: FuelBook): number | null {
  return F.last > 0 ? Math.floor(F.L / F.last) : null;
}

/** Start of the week: a load that's due arrives, and when the tank will run dry this week. */
export function fuelStart(b: FB, events: FuelEvent[]): void {
  const F = fuelOf(b);
  if (!F) return;
  F.wk = 0;
  F.wkRF = 0;
  if (F.order && F.order.due <= b.week && F.tank) {
    const L = Math.min(F.order.L, TANKS[F.tank].L - F.L), cost = Math.round(L * F.order.at);
    if (L > 0) {
      spend(b, 'jobCosts', cost);
      F.avg = (F.avg * F.L + F.order.at * L) / (F.L + L);
      F.L += L;
      events.push({ k: 'fuelIn', L, at: F.order.at });
    }
    F.order = null;
  }
  const left = F.tank ? daysLeft(F) : null;
  F.dry = left != null && left < 5 ? left : -1;
}

/**
 * End of the week: the litres come out of the tank, or off the fuel truck at the pump price, and the jobs'
 * fuel at the base price is squared up. Council contracts pay most of a rise back; a levy gets some back from
 * the rest. A tank in an open yard can lose diesel. Returns what it cost over the base (less is a saving).
 */
export function fuelSettle(rand: Rand, b: FB, costIdx: number, events: FuelEvent[]): number {
  const F = fuelOf(b);
  if (!F) return 0;
  const pump = pumpPrice(F, b.week, costIdx), L = F.wk / DIESEL_BASE, rfL = F.wkRF / DIESEL_BASE;
  let fromTank = 0;
  if (F.tank) {
    fromTank = Math.min(F.L, L);
    F.L -= fromTank;
  }
  const pumpL = L - fromTank, callout = F.tank && F.dry >= 0 && L > 0 ? CALLOUT : 0;
  // the tank's diesel was paid for when it came; the jobs charged it at the base price, so that comes back
  let cost = pumpL * pump + callout - L * DIESEL_BASE;
  const rise = Math.max(0, pump - DIESEL_BASE);
  cost -= RISE_FALL * rise * rfL;
  if ((F.levy ?? 0) >= b.week) cost -= LEVY_BACK * rise * (L - rfL);
  cost = Math.round(cost);
  if (cost) spend(b, 'jobCosts', cost);
  if (F.dry >= 0 && L > 0) events.push({ k: 'fuelDry', d: F.dry, cost: Math.round(pumpL * pump + callout) });
  if (L > 0) F.last = Math.round(L / 5);
  if (F.L <= 0) F.avg = 0;
  // someone helps themselves out of a tank that anyone can get to
  if (F.tank && F.L > 500 && rand() < YARDS[b.yard].theft * 0.03) {
    const caught = !!b.erp, lost = Math.round((F.L * (0.15 + rand() * 0.2) * (caught ? 0.3 : 1)) / 10) * 10;
    F.L -= lost;
    events.push({ k: 'fuelStolen', L: lost, caught });
  }
  F.dry = -1;
  return cost;
}

/**
 * The new week's price: a drift that wanders a few cents and drifts back, and now and then a war. The same for
 * every career on the same seed in the same week (rand is the world's), so a season's players all get it together.
 * Then the ops manager tops the tank up if it's low.
 */
export function fuelWeek(rand: Rand, b: FB, costIdx: number, events: FuelEvent[]): void {
  const F = fuelOf(b);
  if (!F) return;
  F.walk = Math.min(1.12, Math.max(0.9, 1 + (F.walk - 1) * 0.85 + (rand() - 0.5) * 0.05));
  const roll = rand(), peak = 1.3 + rand() * 0.3, len = int(rand, 6, 12);
  if (F.war && b.week > F.war.to + 5) {
    F.warDone = F.war.to;
    F.war = null;
  }
  if (F.war && b.week === F.war.to + 1) events.push({ k: 'warOver' });
  if (!F.war && b.week > 26 && (F.warDone == null || b.week - F.warDone > 52) && roll < 1 / 80) {
    F.war = { from: b.week, to: b.week + len, peak: Math.round(peak * 100) / 100 };
    b.queue.push({ k: 'dieselWar' });
  }
  F.hist.push(pumpPrice(F, b.week, costIdx));
  if (F.hist.length > 26) F.hist.shift();
  if (F.auto && hasOps(b) && F.tank && !F.order && F.L < AUTO_AT * TANKS[F.tank].L && orderFuel(b, true, costIdx)) {
    events.push({ k: 'fuelAuto', L: F.order!.L, at: F.order!.at });
  }
}

/** The war card: ask your clients for a fuel levy (some think less of you), or wear it. */
export function dieselLevy(b: FB & { rep: number }): void {
  const F = fuelOf(b);
  if (!F || !F.war) return;
  F.levy = F.war.to + 4;
  b.rep = Math.max(0, b.rep - 1);
}
