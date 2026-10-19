// The Bulk and Ag pack, step 2: farmers ring about dams, you price them with the dam sum, and your spread builds them
// at the pace of its slowest machine (sums.ts). A dam is a fixed price: the dirt in the ground, not the days, is what
// you're paid for, so a bad volume or a thin spread is your loss. Numbers and codes only; the words live in src/text/.

import { book } from './ledger';
import { TYPES, breakdown, breaks, wear, type BulkType, type Machine, type MachineType, type WorkshopCtx } from './machines';
import { int, pick, type Rand } from './rng';
import { ROLES, type Person } from './staff';
import { TOWNS } from './towns';
import { invoice, uid, type Biz, type Job, type WeekReport } from './hire';
import { compactorRate, damVolume, pushedSpread, scraperCycle, scraperRate, waterCartRate, waterNeeded, type DamPit } from './sums';
import { note } from './diary';

const round = (n: number, to: number) => Math.round(n / to) * to;

/** A scraper: bank m³ a load, minutes to load, loaded and empty speeds (km/h), and whether a dozer has to push it. */
export const SCRAPER_SPEC: Partial<Record<BulkType, { bank: number; load: number; lk: number; ek: number; pushed: boolean }>> = {
  pull: { bank: 11, load: 1.2, lk: 15, ek: 22, pushed: false },
  s623: { bank: 13, load: 1.0, lk: 20, ek: 30, pushed: false },
  s631: { bank: 18, load: 0.7, lk: 22, ek: 32, pushed: true },
  s637: { bank: 18, load: 1.0, lk: 22, ek: 32, pushed: false },
  s651: { bank: 26, load: 0.8, lk: 24, ek: 34, pushed: true },
  s657: { bank: 26, load: 1.1, lk: 24, ek: 34, pushed: false },
};
/** A dozer pushing dirt up on its own: bank m³ an hour over a 60 m push. */
export const DOZE: Partial<Record<BulkType, number>> = { d6: 90, d8: 150, d9: 200, d10: 260 };
/** Compactor rolling width (m). */
export const COMPACT_W: Partial<Record<BulkType, number>> = { padfoot: 2.1, c815: 3.2, c825: 3.7 };
/** Water cart tanks (litres). */
export const TANK: Partial<Record<MachineType, number>> = { cart: 18000, moxycart: 28000 };

/** Turns, waiting at the cut, a compactor in the way: a working spread gets about 80% of the sums' pace. */
export const DELAYS = 0.8;
export const SHRINK = 0.1;
export const MOIST_ADD = 3;
export const CART_TRIP = 25;
export const SPREAD_SPEED = 0.2 / 6; // 200 mm lifts, six passes, at 8 km/h (see compactorRate)
export const SURVEY_COST = 2000;
/** A labour-hire operator for a seat none of your crew can fill. */
export const BULK_CASUAL = 650;
/** Weeks an enquiry waits for your price, and weeks a won dam waits for a spread before the farmer goes elsewhere. */
export const ENQ_WEEKS = 3;
export const WAIT_WEEKS = 6;
/** Share of enquiries that come with an engineer's spec and compaction tests on the wall, and what they pay extra. */
export const TESTED_SHARE = 0.35;
export const TESTED_PREMIUM = 0.15;
/** A failed wall test: rework at this share of the price. A leak fixed: this share. */
export const REWORK = 0.12;
export const LEAK_FIX = 0.15;
/** The red-zone call: three days' hourly cash, and the fine if it comes out. */
export const REDZONE_CASH = 7200;
export const REDZONE_FINE = 60000;
/** A week with this much rain leaves the clay too wet to compact. */
export const WET_CLAY_MM = 25;

export type DamKind = 'ringTank' | 'turkeyNest';

export interface FarmEnquiry {
  id: string;
  kind: DamKind;
  farm: string;
  place: string;
  dam: DamPit;
  /** Pit to wall, one way (m). */
  haul: number;
  /** The dam sum on the plans. */
  vol: number;
  /** What's really in the ground: the paddock isn't flat. Hidden. */
  truth: number;
  /** What a surveyor would tell you (within 3% of the truth). Hidden until paid for. */
  survey: number;
  surveyed?: boolean;
  /** An engineer's spec: compaction tests on the wall. */
  tested?: boolean;
  /** The farmer's ceiling. Hidden. */
  budget: number;
  /** Your rate per m³, and the price once sent. */
  rate: number;
  quoted?: number;
  week: number;
}

export interface Leak { w: number; farm: string; place: string; dk: DamKind; price: number }
export interface BulkBook {
  enq: FarmEnquiry[];
  /** Walls that will leak, and when the farmer rings. */
  leaks?: Leak[];
  /** The red-zone call: last asked, taken (week), found out. */
  rzLast?: number;
  rz?: number;
  rzFound?: boolean;
}
export type BulkState = Biz & { bulk?: BulkBook };
type B = BulkState;

const FARMS = ['Kelly', 'Hartigan', 'Morrow', 'Fitzgerald', 'Lucas', 'Pearce', 'Doyle', 'McCann', 'Walsh', 'Brennan'] as const;

/** A farmer rings about a dam. Ring tanks are big and shallow, turkey nests small and deep. */
export function genEnquiry(rand: Rand, b: B, fmul: number): FarmEnquiry {
  const kind: DamKind = rand() < 0.5 ? 'ringTank' : 'turkeyNest';
  let dam: DamPit;
  do {
    dam = kind === 'ringTank'
      ? { topLength: int(rand, 15, 30) * 10, topWidth: int(rand, 10, 20) * 10, depth: int(rand, 5, 8) / 2, sideBatter: 3, endBatter: int(rand, 3, 4) }
      : { topLength: int(rand, 6, 13) * 10, topWidth: int(rand, 4, 8) * 10, depth: int(rand, 8, 14) / 2, sideBatter: 3, endBatter: int(rand, 3, 4) };
  } while (damVolume(dam).floorWidth < 8 || damVolume(dam).floorLength < 8);
  const vol = Math.round(damVolume(dam).total);
  const truth = Math.round(vol * (0.9 + rand() * 0.3));
  const survey = Math.round(truth * (0.97 + rand() * 0.06));
  // big ring tanks go cheaper a m³ than small, fiddly turkey nests
  const budget = round(vol * (kind === 'ringTank' ? 2.6 + rand() * 1.0 : 3.8 + rand() * 1.4) * (0.92 + 0.08 * fmul), 500);
  const tested = rand() < TESTED_SHARE;
  const tbudget = tested ? round(budget * (1 + TESTED_PREMIUM), 500) : budget;
  const haul = kind === 'ringTank' ? int(rand, 15, 40) * 10 : int(rand, 6, 20) * 10;
  return { id: uid(b), kind, farm: pick(rand, FARMS), place: pick(rand, TOWNS[b.town].places), dam, haul, vol, truth, survey, budget: tbudget, tested, rate: (kind === 'ringTank' ? 3.1 : 4.5) + (tested ? 0.5 : 0), week: b.week };
}

/** Pay a surveyor: their figure replaces the sum on the plans. */
export function survey(b: B, id: string): boolean {
  const e = enq(b, id);
  if (!e || e.surveyed || e.quoted || b.bank < SURVEY_COST) return false;
  b.bank -= SURVEY_COST;
  e.surveyed = true;
  return true;
}

/** The volume you're pricing: the surveyor's if you paid for one, the plans' if not. */
export function pricingVol(e: FarmEnquiry): number {
  return e.surveyed ? e.survey : e.vol;
}

export function quotePrice(e: FarmEnquiry): number {
  return round(e.rate * pricingVol(e), 100);
}

/** Move your rate per m³, in 10c steps, between $2 and $9. */
export function setRate(b: B, id: string, d: number): void {
  const e = enq(b, id);
  if (e && !e.quoted) e.rate = Math.max(2, Math.min(9, Math.round((e.rate + d) * 100) / 100));
}

export function sendQuote(b: B, id: string): boolean {
  const e = enq(b, id);
  if (!e || e.quoted) return false;
  e.quoted = quotePrice(e);
  return true;
}

/** The farmer's yes: sure under 88% of their budget, never over 108%. */
export function yesOdds(e: FarmEnquiry): number {
  return Math.max(0, Math.min(1, (e.budget * 1.08 - (e.quoted ?? 0)) / (e.budget * 0.2)));
}

export type BulkEvent =
  | { k: 'damWon'; jobId: string; price: number }
  | { k: 'damLost'; farm: string; place: string }
  | { k: 'damLapsed'; farm: string; place: string }
  | { k: 'damStarted'; jobId: string }
  | { k: 'damDone'; jobId: string; price: number; m3: number; est: number }
  | { k: 'damGone'; jobId: string }
  | { k: 'damPassed'; jobId: string }
  | { k: 'damFailed'; jobId: string; cost: number }
  | { k: 'redzoneFound'; fine: number };

/** Once a week: farmers answer last week's quotes, unpriced enquiries lapse, and the phone might ring. */
export function bulkWeek(rand: Rand, b: B, fmul: number, events: BulkEvent[], mm = 0): void {
  const S = (b.bulk ??= { enq: [] });
  // a wall that's leaking: the farmer rings
  for (const L of (S.leaks ?? []).slice()) {
    if (L.w <= b.week) {
      S.leaks = S.leaks!.filter((x) => x !== L);
      b.queue.push({ k: 'leak', ...L, fix: round(L.price * LEAK_FIX, 100) });
    }
  }
  // a wet week: the clay on a dam that's going is too wet to roll
  if (mm >= WET_CLAY_MM) {
    const j = b.jobs.find((x) => x.kind === 'dam' && x.state === 'running' && !x.finished);
    if (j && !b.queue.some((q) => q.k === 'wetclay')) b.queue.push({ k: 'wetclay', id: j.id, mm: Math.round(mm) });
  }
  // if you took the red-zone job, it can come out over the next year
  if (S.rz != null && !S.rzFound && b.week - S.rz <= 52 && rand() < 0.008) {
    S.rzFound = true;
    b.bank -= REDZONE_FINE;
    b.rep = Math.max(0, b.rep - 3);
    events.push({ k: 'redzoneFound', fine: REDZONE_FINE });
    note(b, { k: 'redzoneFound', fine: REDZONE_FINE });
  }
  // the red-zone call itself: once in a while, to an outfit with a big dozer
  if (b.fleet.some((m) => m.type === 'd8' || m.type === 'd9' || m.type === 'd10') && b.week - (S.rzLast ?? -99) >= 40 && !b.queue.length && rand() < 0.04) {
    S.rzLast = b.week;
    b.queue.push({ k: 'redzone' });
  }
  for (const e of S.enq.slice()) {
    if (e.quoted && e.week < b.week) {
      S.enq = S.enq.filter((x) => x !== e);
      if (rand() < yesOdds(e)) {
        const j = damJob(b, e);
        events.push({ k: 'damWon', jobId: j.id, price: e.quoted });
        note(b, { k: 'damWon', farm: e.farm, place: e.place, dk: e.kind, price: e.quoted });
      } else {
        events.push({ k: 'damLost', farm: e.farm, place: e.place });
        note(b, { k: 'damLost', farm: e.farm, place: e.place, dk: e.kind });
      }
    } else if (!e.quoted && b.week - e.week >= ENQ_WEEKS) {
      S.enq = S.enq.filter((x) => x !== e);
      events.push({ k: 'damLapsed', farm: e.farm, place: e.place });
    }
  }
  // a won dam with no spread to start it: after six weeks the farmer gets someone else in
  for (const j of b.jobs.slice()) {
    if (j.kind === 'dam' && j.state === 'waiting' && b.week - (j.won as number) >= WAIT_WEEKS) {
      b.jobs = b.jobs.filter((x) => x !== j);
      b.rep = Math.max(0, b.rep - 1);
      events.push({ k: 'damGone', jobId: j.id });
      note(b, { k: 'damGone', farm: j.client, place: j.place });
    }
  }
  if (S.enq.filter((e) => !e.quoted).length < 3 && rand() < 0.45) S.enq.push(genEnquiry(rand, b, fmul));
}

function enq(b: B, id: string): FarmEnquiry | undefined {
  return b.bulk?.enq.find((e) => e.id === id);
}

function damJob(b: B, e: FarmEnquiry): Job {
  const j: Job = {
    id: uid(b), kind: 'dam', type: 'd8', client: e.farm, place: e.place, days: 0, done: 0, rate: 0, fixed: e.quoted, terms: 2, fuelPaid: true,
    mId: null, who: null, rollerId: null, hireIn: 0, extra: 0, earned: 0, idleWeeks: 0, state: 'waiting',
    dk: e.kind, tested: !!e.tested, qsum: 0, dam: e.dam, haul: e.haul, truth: e.truth, est: pricingVol(e), m3: 0, won: b.week, spread: [] as string[], crew: {} as Record<string, string>,
  };
  b.jobs.push(j);
  return j;
}

// ---------- the spread ----------

const bulkScraper = (t: MachineType) => SCRAPER_SPEC[t as BulkType];

/** What a set of machines moves an hour (bank m³), part by part, and the slowest part. */
export function spreadRate(all: readonly Pick<Machine, 'type'>[], haul: number, precon = false): { rates: Record<string, number>; perHour: number; slowest: string; compacted: boolean; watered: boolean; precon: boolean } {
  // preconditioning the pit takes a dozer (the smallest) and a moxy water cart off the spread
  let ms = all.slice(), pre = false;
  if (precon) {
    const dz = ms.filter((m) => DOZE[m.type as BulkType]).sort((a, z) => DOZE[a.type as BulkType]! - DOZE[z.type as BulkType]!)[0], mc = ms.find((m) => m.type === 'moxycart');
    if (dz && mc) {
      ms = ms.filter((m) => m !== dz && m !== mc);
      pre = true;
    }
  }
  const scr = ms.filter((m) => bulkScraper(m.type)), doz = ms.filter((m) => DOZE[m.type as BulkType]);
  const comp = ms.filter((m) => COMPACT_W[m.type as BulkType]), carts = ms.filter((m) => TANK[m.type]);
  const rates: Record<string, number> = {};
  if (scr.length) {
    let self = 0, pushedN = 0, pushedRate = 0, load = 0, bank = 0;
    for (const m of scr) {
      const S = bulkScraper(m.type)!, cyc = scraperCycle({ load: S.load, haul, loadedKmh: S.lk, emptyKmh: S.ek, spreadTurn: 0.8 });
      if (!S.pushed) self += scraperRate(cyc, S.bank);
      else {
        pushedN++;
        pushedRate += scraperRate(cyc, S.bank);
        load += S.load;
        bank += S.bank;
      }
    }
    let pushed = 0;
    if (pushedN) {
      // a pushed spread is capped by its push dozers, at the average load and bowl of the scrapers they load
      const ld = load / pushedN, bk = bank / pushedN, cyc = (60 / (pushedRate / pushedN)) * (50 / 60) * bk;
      pushed = pushedSpread(pushedN, doz.length, cyc, ld, bk);
    }
    rates.scrapers = self + pushed;
  } else if (doz.length) {
    rates.dozers = doz.reduce((a, m) => a + DOZE[m.type as BulkType]!, 0) * Math.min(1, 60 / Math.max(60, haul));
  } else rates.dirt = 0;
  if (comp.length) rates.compactor = comp.reduce((a, m) => a + compactorRate(COMPACT_W[m.type as BulkType]!, 8, 0.2, 6), 0) / (1 - SHRINK);
  if (carts.length) rates.water = carts.reduce((a, m) => a + waterCartRate(TANK[m.type]!, CART_TRIP), 0) / waterNeeded(1 - SHRINK, MOIST_ADD);
  let slowest = '', perHour = Infinity;
  for (const [k, r] of Object.entries(rates)) if (r < perHour) { perHour = r; slowest = k; }
  return { rates, perHour: perHour === Infinity ? 0 : perHour * DELAYS, slowest, compacted: comp.length > 0, watered: carts.length > 0, precon: pre };
}

/** The machines a dam would take if it started now: every idle, working bulk machine and water cart. */
export function freeSpread(b: Pick<B, 'fleet'>): Machine[] {
  return b.fleet.filter((m) => m.status === 'idle' && m.down === 0 && (bulkScraper(m.type) || DOZE[m.type as BulkType] || COMPACT_W[m.type as BulkType] || m.type === 'moxycart'));
}

/** A day's running cost for a machine: its fuel and a share of its next service. */
export function machineDay(t: MachineType): number {
  return TYPES[t].fuel + Math.round(TYPES[t].svc / 28);
}

/** What a dam would take with a set of machines: days, and the cost of the spread (fuel, servicing, casual operators). */
export function damEstimate(b: Pick<B, 'fleet' | 'staff' | 'youJob'>, ms: readonly Machine[], vol: number, haul: number) {
  const sr = spreadRate(ms, haul), perDay = sr.perHour * 9;
  const days = perDay > 0 ? Math.ceil(vol / perDay) : Infinity;
  const seats = seatPlan(b, ms);
  const dayCost = ms.reduce((a, m) => a + machineDay(m.type), 0) + seats.casuals * BULK_CASUAL;
  return { ...sr, perDay, days, dayCost, cost: days * dayCost, casuals: seats.casuals };
}

/** Who drives what: your crew who can drive each machine, then you, then labour hire. */
export function seatPlan(b: Pick<B, 'staff' | 'youJob'>, ms: readonly Pick<Machine, 'id' | 'type'>[], jobId?: string): { crew: Record<string, string>; casuals: number } {
  const crew: Record<string, string> = {}, used = new Set<string>();
  let you = !b.youJob || b.youJob === jobId, casuals = 0;
  for (const m of ms) {
    const p = b.staff.find((x) => !used.has(x.id) && x.off === 0 && (!x.jobId || x.jobId === jobId) && ROLES[x.role].drives.includes(m.type));
    if (p) { crew[m.id] = p.id; used.add(p.id); }
    else if (you) { crew[m.id] = 'you'; you = false; }
    else { crew[m.id] = 'casual'; casuals++; }
  }
  return { crew, casuals };
}

/** Monday: a waiting dam takes the spread if there's enough to move dirt; a running one picks up anything freed. */
export function bulkStart(b: B, events: BulkEvent[]): void {
  for (const j of b.jobs) {
    if (j.kind !== 'dam' || j.finished) continue;
    const mine = b.fleet.filter((m) => m.jobId === j.id);
    const add = freeSpread(b);
    if (j.state === 'waiting' && spreadRate(mine.concat(add), j.haul as number).perHour <= 0) continue;
    for (const m of add) { m.status = 'job'; m.jobId = j.id; }
    const all = mine.concat(add);
    // seat the crew afresh each week: whoever's free and can drive it
    for (const p of b.staff) if (p.jobId === j.id) p.jobId = null;
    if (b.youJob === j.id) b.youJob = null;
    const sp = seatPlan(b, all, j.id);
    for (const [, who] of Object.entries(sp.crew)) {
      if (who === 'you') b.youJob = j.id;
      else if (who !== 'casual') { const p = b.staff.find((x) => x.id === who); if (p) p.jobId = j.id; }
    }
    j.crew = sp.crew;
    j.wkM3 = 0;
    j.spread = all.map((m) => m.id);
    if (j.state === 'waiting') {
      j.state = 'running';
      events.push({ k: 'damStarted', jobId: j.id });
      note(b, { k: 'damStarted', farm: j.client, place: j.place, dk: j.dk });
    }
  }
}

/** A day on a dam: the working machines move what the slowest part allows; fuel, servicing and casuals are paid. */
/** How good a day's work on the wall is, 0 to 1: rolled, watered, the pit preconditioned, or pushed on in wet clay. */
export function dayQuality(sr: { compacted: boolean; watered: boolean; precon: boolean }, wetPush: boolean): number {
  return Math.max(0, Math.min(1, 0.55 + (sr.compacted ? 0.25 : 0) + (sr.watered ? 0.1 : 0) + (sr.precon ? 0.15 : 0) - (wetPush ? 0.25 : 0)));
}

/** The wall as built so far, 0 to 1. */
export function wallQuality(j: Job): number {
  return (j.m3 as number) > 0 ? ((j.qsum as number) || 0) / (j.m3 as number) : 0;
}

/** A tested wall passes on quality: sure at 0.9, never at 0.5 or below. Untested, a poor wall leaks: never at 0.85 or better. */
export function passOdds(q: number): number {
  return Math.max(0, Math.min(1, (q - 0.5) / 0.4));
}
export function leakOdds(q: number): number {
  return Math.max(0, Math.min(1, (0.85 - q) * 1.5));
}

export function damDay(rand: Rand, b: B, j: Job, wet: boolean, w: WorkshopCtx, rep: WeekReport, events: BulkEvent[]): void {
  if (j.state !== 'running' || j.finished || wet) return;
  // waiting for the clay to dry out
  if (((j.dry as number) || 0) > 0) {
    j.dry = (j.dry as number) - 1;
    rep.lost++;
    return;
  }
  const ms = b.fleet.filter((m) => m.jobId === j.id && m.down === 0);
  const crew = j.crew as Record<string, string>;
  // a seat whose driver is off today stops that machine
  const going = ms.filter((m) => { const who = crew[m.id]; if (!who || who === 'casual') return true; if (who === 'you') return !(b.youBlocked > 0); return (b.staff.find((p) => p.id === who)?.off ?? 1) === 0; });
  const sr = spreadRate(going, j.haul as number, !!j.precon && !!j.tested);
  if (sr.perHour <= 0) { rep.lost++; return; }
  const moved = sr.perHour * 9;
  j.m3 = (j.m3 as number) + moved;
  j.qsum = ((j.qsum as number) || 0) + moved * dayQuality(sr, j.wetPush === b.week);
  j.wkM3 = ((j.wkM3 as number) || 0) + moved;
  j.slowest = sr.slowest;
  rep.worked++;
  let cost = 0;
  for (const m of going) {
    cost += TYPES[m.type].fuel;
    if (crew[m.id] === 'casual') cost += BULK_CASUAL;
    wear(m, 1, b.acc);
    if (breaks(rand, m, 1, w)) {
      breakdown(rand, m, w, b.acc);
      b.queue.push({ k: 'break', id: m.id });
    }
  }
  b.bank -= cost;
  rep.costs += cost;
  j.spent = (j.spent || 0) + cost;
  book(b.acc, 'jobCosts', cost);
  if ((j.m3 as number) >= (j.truth as number)) {
    j.finished = true;
    j.freed = true;
    j.earned = j.fixed as number;
    invoice(b, j.client, j.fixed as number, j.terms, rep);
    for (const m of b.fleet) if (m.jobId === j.id) { m.jobId = null; if (m.status === 'job') m.status = 'idle'; }
    for (const p of b.staff) if (p.jobId === j.id) p.jobId = null;
    if (b.youJob === j.id) b.youJob = null;
    events.push({ k: 'damDone', jobId: j.id, price: j.fixed as number, m3: Math.round(j.truth as number), est: Math.round(j.est as number) });
    // the wall: a tested one is tested now; an untested poor one leaks later
    const q = wallQuality(j);
    j.q = Math.round(q * 100) / 100;
    if (j.tested) {
      if (rand() < passOdds(q)) {
        b.rep += 1;
        events.push({ k: 'damPassed', jobId: j.id });
      } else {
        const cost = round((j.fixed as number) * REWORK, 100);
        b.bank -= cost;
        rep.costs += cost;
        j.spent = (j.spent || 0) + cost;
        b.rep = Math.max(0, b.rep - 1);
        events.push({ k: 'damFailed', jobId: j.id, cost });
      }
    } else if (rand() < leakOdds(q)) {
      const S = (b.bulk ??= { enq: [] });
      (S.leaks ??= []).push({ w: b.week + int(rand, 8, 30), farm: j.client, place: j.place, dk: j.dk as DamKind, price: j.fixed as number });
    }
    note(b, { k: 'damDone', farm: j.client, place: j.place, dk: j.dk, price: j.fixed, m3: Math.round(j.truth as number), est: Math.round(j.est as number), spent: Math.round(j.spent || 0) });
  }
}

/** Precondition the pit (tested walls only): a dozer and a moxy water cart wet the dirt up before it's picked up. */
export function setPrecon(b: B, id: string, on: boolean): boolean {
  const j = b.jobs.find((x) => x.id === id);
  if (!j || j.kind !== 'dam' || !j.tested || j.finished) return false;
  j.precon = on;
  return true;
}

// ---------- the cards ----------

/** Wet clay: wait two working days for it to dry, or push on and the wall suffers this week. */
export function wetClayWait(j: Job): void {
  j.dry = 2;
}
export function wetClayPush(b: { week: number }, j: Job): void {
  j.wetPush = b.week;
}
/** A leaking wall: go back and fix it, or tell them it's their clay. */
export function leakFix(b: B, fix: number): void {
  b.bank -= fix;
}
export function leakArgue(b: B): void {
  b.rep = Math.max(0, b.rep - 2);
}
/** The red-zone job: the cash now, and a chance it comes out over the next year. */
export function redzoneTake(b: B): void {
  b.bank += REDZONE_CASH;
  (b.bulk ??= { enq: [] }).rz = b.week;
}
