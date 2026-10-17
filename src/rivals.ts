// The other outfits chasing the same work. Each runs its own books: win and make money and they grow,
// lose money or sit idle and they sell gear, fold, or get bought out. They remember: winners price up, losers sharpen.

import { MOODS, type Clearance, type Mood, type RivalSale } from './market';
import type { MachineType } from './machines';
import { int, pick, type Rand } from './rng';
import type { TownId } from './towns';

export type RivalTier = 'small' | 'mid' | 'big';

/** The outfits already in each town: name, stars, cost efficiency (below 1 is cheaper than you), margin. */
export const RIVALS: Record<TownId, readonly [string, number, number, number][]> = {
  gdi: [['Weir River Plant', 2, 0.97, 0.10], ['Bluegum Earthworks', 1, 1.02, 0.06], ['Coolmunda Civil', 1, 1, 0.14], ['Redgum Grading', 2, 0.95, 0.17], ['Condamine Civil Group', 3, 0.95, 0.1]],
  ct: [['Burdekin Plant', 2, 0.97, 0.10], ['Basalt Earthmoving', 1, 1.02, 0.06], ['Ironbark Civil', 1, 1, 0.14], ['Spinifex Grading', 2, 0.95, 0.17], ['Flinders Civil Group', 3, 0.95, 0.1]],
};

/** Names for new outfits: a local place, then a trade. */
export const NEW_NAMES: Record<TownId, readonly string[]> = {
  gdi: ['Callandoon', 'Brigalow', 'Dumaresq', 'Mungindi', 'Kildonan', 'Bendidee', 'Wyaga', 'Lundavra', 'Billa Billa', 'Weengallon', 'Gradule', 'Kurumbul'],
  ct: ['Pentland', 'Fanning', 'Lolworth', 'Seventy Mile', 'Campaspe', 'Mingela', 'Cape River', 'Dalrymple', 'Sellheim', 'Balfes Creek', 'Torrens Creek', 'Hervey'],
};
export const NEW_TAILS = ['Earthmoving', 'Plant Hire', 'Grading', 'Contracting', 'Civil', 'Earthworks'] as const;

/** Jobs at once, starting fleet, and the cash a healthy outfit of that size carries. */
export const TIER: Record<RivalTier, { cap: number; fleet: number; cash: number; t: string }> = {
  small: { cap: 1, fleet: 4, cash: 55000, t: 'Small' },
  mid: { cap: 1, fleet: 8, cash: 150000, t: 'Mid-size' },
  big: { cap: 2, fleet: 18, cash: 450000, t: 'Big' },
};

/** A rival's weekly cost of owning a machine, and what one's worth. */
export const RV_OWN = 400;
export const RV_MACH = 45000;

/** A rival's office: small outfits run lean, big firms carry an office, estimators and supervisors. */
export const RV_OH: Record<RivalTier, number> = { small: 1500, mid: 4500, big: 11000 };

export type TenderKind = 'sub' | 'council' | 'major';

/** Who prices what: small outfits chase subbie roads, the bigger ones council packages and programs. */
export const BID_ODDS: Record<TenderKind, Record<RivalTier, number>> = {
  sub: { small: 0.85, mid: 0.75, big: 0.1 },
  council: { small: 0.4, mid: 0.8, big: 0.2 },
  major: { small: 0, mid: 0.45, big: 0.9 },
};

export interface RivalJob {
  /** Weeks left. */
  wk: number;
  /** Profit per week. */
  pw: number;
  /** Profit over the job. */
  p: number;
}

export interface Rival {
  name: string;
  stars: number;
  /** Cost efficiency: 0.95 means their crews cost 5% less than yours. */
  eff: number;
  margin: number;
  wins: number;
  jobs: RivalJob[];
  tier: RivalTier;
  fleet: number;
  cash: number;
  debt: number;
  /** Weeks without a job. */
  idle: number;
  /** Weeks in a row short of cash. */
  low: number;
  /** Weeks in town. */
  age: number;
  /** Profit on their last three jobs, newest first. */
  last: number[];
  /** Selling gear (said once until they recover). */
  sold?: number;
  /** You've been offered the chance to buy them out. */
  offered?: boolean;
  /** Safety system level, 0 to 4, set the first time a tender looks. */
  whs?: number;
}

export function mkRival(rand: Rand, x: readonly [string, number, number, number], tier: RivalTier): Rival {
  const T = TIER[tier];
  return { name: x[0], stars: x[1], eff: x[2], margin: x[3], wins: 0, jobs: [], tier, fleet: T.fleet + int(rand, -1, 1), cash: Math.round(T.cash * (0.8 + rand() * 0.4)), debt: 0, idle: 0, low: 0, age: 0, last: [] };
}

export function rvTier(x: readonly [string, number, number, number]): RivalTier {
  return x[1] >= 3 ? 'big' : x[1] >= 2 ? 'mid' : 'small';
}

/** The outfits already in town at the start of a career: established, some debt on the gear. */
export function mkRivals(rand: Rand, town: TownId): Rival[] {
  return RIVALS[town].map((x) => {
    const rv = mkRival(rand, x, rvTier(x));
    rv.debt = Math.round(rv.fleet * RV_MACH * 0.35);
    rv.age = 200;
    return rv;
  });
}

export function rvFree(x: Rival): boolean {
  return x.jobs.length < TIER[x.tier].cap;
}

export type RivalPhase = 'stretched' | 'hungry' | 'growing' | 'steady';

export function rvPhase(x: Rival): RivalPhase {
  if (x.cash < 0 || x.debt > x.fleet * RV_MACH * 0.7) return 'stretched';
  if (x.idle >= 6) return 'hungry';
  if (x.last.length && x.last[0]! > 0 && x.cash > TIER[x.tier].cash * 0.6) return 'growing';
  return 'steady';
}

export type RivalForm = 'flatOut' | 'new' | 'stretched' | 'hungry' | 'sharp' | 'high' | 'growing' | 'steady';

/**
 * What the word is on a rival. On a tender (district false): are they free to price, and how sharp.
 * On the district map (district true): what they're up to. Screens add the job count and idle weeks.
 */
export function rvForm(x: Rival, district: boolean): RivalForm {
  const ph = rvPhase(x);
  if (district) return x.age < 26 ? 'new' : ph;
  if (!rvFree(x)) return 'flatOut';
  return x.age < 26 ? 'new' : ph === 'stretched' ? 'stretched' : ph === 'hungry' ? 'hungry'
    : x.margin < 0.04 ? 'sharp' : x.margin > 0.15 ? 'high' : ph === 'growing' ? 'growing' : 'steady';
}

/** A rival's weekly office cost. */
export function rvOH(x: Rival): number {
  return RV_OH[x.tier] + 150 * x.fleet;
}

/** The overheads a rival puts on a job of this many weeks, spread over the work they've already got. */
export function rvOHFor(x: Rival, wks: number): number {
  return Math.round((rvOH(x) * Math.max(1, wks)) / (1 + x.jobs.length));
}

/** A rival's safety system, set the first time anyone looks: big firms have more on paper. */
export function rvWhs(rand: Rand, x: Rival): number {
  if (x.whs == null) x.whs = x.tier === 'big' ? int(rand, 2, 4) : x.tier === 'mid' ? int(rand, 1, 3) : int(rand, 0, 2);
  return x.whs;
}

/** Who prices a tender. If nobody would, the least busy outfit that does this kind of work prices anyway. */
export function whoPrices(rand: Rand, rivals: Rival[], kind: TenderKind): Rival[] {
  const B = rivals.filter((x) => rvFree(x) && !(kind === 'council' && x.tier === 'small' && x.stars < 1) && !(kind === 'major' && x.tier === 'mid' && x.fleet < 8) && rand() < BID_ODDS[kind][x.tier]);
  if (B.length) return B;
  const any = rivals.filter((x) => BID_ODDS[kind][x.tier] > 0);
  return [(any.length ? any : rivals).slice().sort((a, b) => a.jobs.length - b.jobs.length)[0]!];
}

/**
 * A rival wins. What it really costs them shows over the weeks: they miss by 0–22%, more in a boom,
 * more if they're new in town, more if they were hungry. Every fifth win earns a star. Winners price up.
 */
export function rvWin(rand: Rand, x: Rival, price: number, cost: number, weeks: number, mood: Mood): void {
  const miss = 0.96 + rand() * 0.22 + (mood === 'boom' ? rand() * 0.05 : 0) + (x.age < 52 ? rand() * 0.08 : 0) + (x.idle >= 6 ? rand() * 0.06 : 0);
  const profit = price - cost * x.eff * miss, wk = Math.max(1, weeks);
  x.jobs.push({ wk, pw: profit / wk, p: Math.round(profit) });
  x.wins++;
  if (x.wins % 5 === 0) x.stars = Math.min(3, x.stars + 1);
  x.margin = Math.min(0.22, x.margin + 0.03);
  x.idle = 0;
}

/** A new outfit starting up. Small ones are hungry: a touch dearer to run, and they price sharp to get a start. */
export function newRival(rand: Rand, rivals: Rival[], gone: string[], town: TownId, tier: RivalTier = 'small'): Rival {
  const used = rivals.map((x) => x.name).concat(gone);
  let nm: string, g = 0;
  do nm = pick(rand, NEW_NAMES[town]) + ' ' + pick(rand, NEW_TAILS);
  while (used.some((u) => u.split(' ')[0] === nm.split(' ')[0]) && g++ < 40);
  const stars = tier === 'small' ? (rand() < 0.5 ? 1 : 0) : tier === 'mid' ? 2 : 3;
  const eff = tier === 'small' ? 1 + rand() * 0.06 : 0.96;
  const margin = tier === 'small' ? rand() * 0.05 : 0.08;
  const x = mkRival(rand, [nm, stars, eff, margin], tier);
  if (tier === 'small') {
    x.fleet = int(rand, 2, 3);
    x.cash = int(rand, 15, 40) * 1000;
    x.debt = Math.round(x.fleet * RV_MACH * 0.5);
  } else {
    x.debt = Math.round(x.fleet * RV_MACH * 0.4);
    x.age = 104;
  }
  return x;
}

/** The parts of a career the rivals touch. */
export interface RivalWorld {
  week: number;
  town: TownId;
  rivals: Rival[];
  /** Outfits that have folded or been bought (their names aren't reused). */
  gone: string[];
  rivSell: RivalSale[];
  clear: Clearance[];
  queue: { k: string; [x: string]: unknown }[];
}

export interface RivalsWeekInputs {
  /** How busy the work is (market.ts fmul). */
  fmul: number;
  mood: Mood;
  /** The difficulty's margin shift and how often new outfits start. */
  mg: number;
  spawn: number;
  /** You could buy out a rival in trouble (your own contract, no missed repayments). */
  canBuyOut: boolean;
  won2: boolean;
  won3: boolean;
}

export type RivalEvent =
  | { k: 'grewMid'; name: string }
  | { k: 'grewBig'; name: string }
  | { k: 'sellingGear'; name: string }
  | { k: 'boughtOut'; buyer: string; name: string; fleet: number }
  | { k: 'wentUnder'; name: string; losses: boolean }
  | { k: 'newSmall'; name: string; fleet: number }
  | { k: 'newMid'; name: string; fleet: number }
  | { k: 'newBig'; name: string };

/**
 * A rival folds. 45% of the time a bigger outfit with cash buys them; otherwise their gear goes through
 * clearance sales at auction (see market.ts).
 */
export function rvFold(rand: Rand, w: RivalWorld, x: Rival, events: RivalEvent[]): void {
  w.rivals = w.rivals.filter((y) => y !== x);
  w.gone.push(x.name);
  const buyer = w.rivals.filter((y) => y.tier !== 'small' && y.cash > x.fleet * RV_MACH * 0.5 && rvPhase(y) !== 'stretched').sort((a, b) => b.cash - a.cash)[0];
  if (buyer && rand() < 0.45) {
    buyer.cash -= x.fleet * RV_MACH * 0.5;
    buyer.fleet += x.fleet;
    buyer.stars = Math.max(buyer.stars, x.stars);
    events.push({ k: 'boughtOut', buyer: buyer.name, name: x.name, fleet: x.fleet });
  } else {
    w.clear.push({ name: x.name, n: Math.min(5, Math.max(2, x.fleet - 1)) });
    events.push({ k: 'wentUnder', name: x.name, losses: x.last.filter((p) => p < 0).length > 1 });
  }
}

const SELL_TYPES: readonly MachineType[] = ['grader', 'roller', 'cart', 'cart', 'grader'];

/** The rivals' week: jobs pay out, gear costs, margins drift, outfits grow, struggle, sell up, fold or start. */
export function rivalsWeek(rand: Rand, w: RivalWorld, x0: RivalsWeekInputs, events: RivalEvent[]): void {
  const k = x0.fmul;
  for (const x of w.rivals.slice()) {
    x.age++;
    for (const j of x.jobs) {
      x.cash += j.pw;
      j.wk--;
    }
    x.jobs = x.jobs.filter((j) => {
      if (j.wk > 0) return true;
      x.last.unshift(j.p);
      if (x.last.length > 3) x.last.length = 3;
      return false;
    });
    if (x.jobs.length) x.idle = 0;
    else x.idle++;
    // Owning the gear costs every week; private work and dry hire fill the gaps, more of it when there's money about.
    const spare = 1 - x.jobs.length / TIER[x.tier].cap;
    x.cash += x.fleet * (spare * 200 * Math.min(k, 1.2) - RV_OWN) - x.debt * 0.0025;
    // Owners take their money out in the good years (and the tax man takes his), so few have a big buffer when it turns.
    const keep = TIER[x.tier].cash * 1.3;
    if (x.cash > keep) x.cash -= (x.cash - keep) * 0.06;
    x.debt = Math.max(0, x.debt * 0.9985);
    const ph = rvPhase(x);
    const tg = MOODS[x0.mood].mg + x0.mg - (ph === 'hungry' ? 0.04 : 0) - (ph === 'stretched' ? 0.03 : 0);
    x.margin = Math.max(-0.03, Math.min(0.22, x.margin + (tg - x.margin) * 0.08));
    if (ph === 'growing' && k >= 0.9 && x.cash > TIER[x.tier].cash * 1.1 && rand() < 0.03) {
      x.fleet++;
      x.cash -= RV_MACH * 0.2;
      x.debt += RV_MACH * 0.8;
    }
    if (x.tier === 'small' && x.fleet >= 8 && x.stars >= 2) {
      x.tier = 'mid';
      events.push({ k: 'grewMid', name: x.name });
    } else if (x.tier === 'mid' && x.fleet >= 16 && x.stars >= 3 && w.rivals.filter((y) => y.tier === 'big').length < 2) {
      x.tier = 'big';
      events.push({ k: 'grewBig', name: x.name });
    }
    if (ph === 'stretched' && x.fleet > 2 && rand() < 0.18) {
      x.fleet--;
      const got = RV_MACH * 0.8 * MOODS[x0.mood].pm;
      x.cash += got;
      x.debt = Math.max(0, x.debt - got * 0.6);
      w.rivSell.push({ who: x.name, type: pick(rand, SELL_TYPES) });
      if (!x.sold) {
        x.sold = 1;
        events.push({ k: 'sellingGear', name: x.name });
      }
    }
    if (x.sold && x.cash > TIER[x.tier].cash * 0.5) x.sold = 0;
    if (x.cash < -x.fleet * 6000 || (x.fleet <= 2 && x.cash < 0)) x.low++;
    else x.low = 0;
    if (x.low >= 2 && !x.offered && x0.canBuyOut) {
      x.offered = true;
      if (!w.queue.some((q) => q.k === 'buyout' && q.name === x.name)) w.queue.push({ k: 'buyout', name: x.name });
    }
    if (x.low >= 5) rvFold(rand, w, x, events);
  }

  // New outfits start up when rates are good, and hardly at all in a bust.
  const small = w.rivals.filter((x) => x.tier === 'small').length;
  const avgM = w.rivals.reduce((a, x) => a + x.margin, 0) / Math.max(1, w.rivals.length);
  if (w.rivals.length < 3 || (w.week > 12 && small < 5 && w.rivals.length < 8 && rand() < (avgM > 0.13 ? 0.016 : 0.006) * k * x0.spawn)) {
    const nr = newRival(rand, w.rivals, w.gone, w.town);
    w.rivals.push(nr);
    events.push({ k: 'newSmall', name: nr.name, fleet: nr.fleet });
  }
  if (x0.won2 && !w.rivals.some((x) => x.tier !== 'small') && rand() < 0.05) {
    const nm = newRival(rand, w.rivals, w.gone, w.town, 'mid');
    w.rivals.push(nm);
    events.push({ k: 'newMid', name: nm.name, fleet: nm.fleet });
  }
  if (x0.won3 && !w.rivals.some((x) => x.tier === 'big') && rand() < 0.03) {
    const nb = newRival(rand, w.rivals, w.gone, w.town, 'big');
    w.rivals.push(nb);
    events.push({ k: 'newBig', name: nb.name });
  }
}
