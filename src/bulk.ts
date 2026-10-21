// The Bulk and Ag pack: farmers and developers ring about work, you price it per unit (m³, hectare, metre, km), and
// the spread does it at the pace of its slowest machine (sums.ts). Farm work is a fixed price: the work in the
// ground, not the days, is what you're paid for, so a bad quantity or a thin spread is your loss. Developers pay
// monthly claims less retention, with damages if you're late. Numbers and codes only; the words live in src/text/.

import { book } from './ledger';
import { monthIdx } from './calendar';
import { compat, onCompat } from './compat';
import { TYPES, breakdown, breaks, dayHours, wear, type BulkType, type Machine, type MachineType, type WorkshopCtx } from './machines';
import { int, pick, type Rand } from './rng';
import { ROLES } from './staff';
import { TOWNS } from './towns';
import { invoice, uid, type Biz, type Job, type WeekReport } from './hire';
import { compactorRate, damVolume, pushedSpread, scraperCycle, scraperRate, waterCartRate, waterNeeded, type DamPit } from './sums';
import { note } from './diary';
import { fuelUse } from './fuel';

const round = (n: number, to: number) => Math.round(n / to) * to;

// ---------- the machines' numbers ----------

/** A scraper: bank m³ a load, minutes to load, loaded and empty speeds (km/h), and whether a dozer has to push it. */
export const SCRAPER_SPEC: Partial<Record<BulkType, { bank: number; load: number; lk: number; ek: number; pushed: boolean }>> = {
  pull: { bank: 11, load: 1.2, lk: 15, ek: 22, pushed: false },
  s623: { bank: 13, load: 1.0, lk: 20, ek: 30, pushed: false },
  s627: { bank: 15, load: 1.0, lk: 21, ek: 31, pushed: false },
  s631: { bank: 18, load: 0.7, lk: 22, ek: 32, pushed: true },
  s637: { bank: 18, load: 1.0, lk: 22, ek: 32, pushed: false },
  s651: { bank: 26, load: 0.8, lk: 24, ek: 34, pushed: true },
  s657: { bank: 26, load: 1.1, lk: 24, ek: 34, pushed: false },
};
/** A dozer pushing dirt up on its own: bank m³ an hour over a 60 m push. */
export const DOZE: Partial<Record<BulkType, number>> = { d6: 90, d8: 150, d9: 200, d10: 260 };
/** Stick raking and cutter barring, hectares an hour. Cutter barring needs a D8 or bigger. */
export const RAKE_HA: Partial<Record<BulkType, number>> = { d6: 0.6, d8: 0.9, d9: 1.2, d10: 1.5 };
export const CUT_HA: Partial<Record<BulkType, number>> = { d8: 1.5, d9: 2.0, d10: 2.5 };
/** Compactor rolling width (m). The smooth drum finishes pads. */
export const COMPACT_W: Partial<Record<MachineType, number>> = { padfoot: 2.1, c815: 3.2, c825: 3.7, roller: 2.1 };
/** Water cart tanks (litres). */
export const TANK: Partial<Record<MachineType, number>> = { cart: 18000, moxycart: 28000 };
onCompat(() => { TANK.moxycart = compat.prototype ? 28000 : 40000; });
/** An excavator digging a channel or loading trucks, bank m³ an hour; a moxy or side tipper carting from it. */
export const DIG = 110;
export const CART_M3: Partial<Record<MachineType, number>> = { moxy: 75, truck: 45 };
/** Contour banks: km an hour with a grader or a dozer. */
export const CONTOUR_KM: Partial<Record<MachineType, number>> = { grader: 0.15, d6: 0.1, d8: 0.12, d9: 0.12, d10: 0.12 };

/** Turns, waiting at the cut, a compactor in the way: a working spread gets about 80% of the sums' pace. */
export const DELAYS = 0.8;
export const SHRINK = 0.1;
export const MOIST_ADD = 3;
export const CART_TRIP = 25;
export const SURVEY_COST = 2000;
/** The real game's going rates for bulk work: 10% over the prototype's (in step with the hire schedule and the 10-hour day), then 10% more (Scott, 22 Oct). */
export const PRICE_LIFT = 1.21;
/** A labour-hire operator for a seat none of your crew can fill. */
export const BULK_CASUAL = 650;
/** Weeks an enquiry waits for your price, and weeks a won job waits for a spread before the client goes elsewhere. */
export const ENQ_WEEKS = 3;
export const WAIT_WEEKS = 6;
/** Share of dam enquiries with an engineer's spec and compaction tests on the wall, and what they pay extra. */
export const TESTED_SHARE = 0.35;
export const TESTED_PREMIUM = 0.15;
/** A failed test: rework at this share of the price. A comeback fixed: this share. */
export const REWORK = 0.12;
export const LEAK_FIX = 0.15;
/** The red-zone call: three days' hourly cash, and the fine if it comes out. */
export const REDZONE_CASH = 7200;
/** How often a farmer asks to do a won job for cash; the discount; the odds the tax office finds it within the year, and what it costs then. */
export const CASH_ASK = 0.12, CASH_OFF = 0.1, CASH_AUDIT = 0.15, CASH_BACK = 0.35;
/** The engineer's price for signing off a tested wall untested. */
export const SIGNOFF_BRIBE = 1500;
export const REDZONE_FINE = 60000;
/** A week with this much rain leaves the clay too wet to compact. */
export const WET_CLAY_MM = 25;
/** Developers: claims every 4 weeks, 5% retention, damages a week late (share of the price), and the odds a week they go under. */
export const DEV_CLAIM_WEEKS = 4;
export const DEV_RETAIN = 0.05;
export const DEV_LD = 0.005;
export const DEV_BUST = 0.004;
/** Fire season (August and September): windrows can't be burnt. */
export const FIRE_MONTHS: readonly number[] = [7, 8];

/** Attachments: one each, bought once. */
export type Attachment = 'laser' | 'rake' | 'cutter';
export const ATTACH: Record<Attachment, number> = { laser: 38000, rake: 45000, cutter: 65000 };

// ---------- the kinds of work ----------

export type DamKind = 'ringTank' | 'turkeyNest';
export type BulkKind = DamKind | 'laser' | 'channel' | 'contour' | 'pad' | 'rake' | 'cutter' | 'dev';
export type Unit = 'm3' | 'ha' | 'm' | 'km';

export interface KindSpec {
  unit: Unit;
  /** How often it rings, out of the lot. */
  odds: number;
  /** Needs this attachment to start. */
  att?: Attachment;
  /** What the surveyor (or geotech) can tell you. */
  survey: boolean;
  /** Always tested at the end. */
  tested?: boolean;
  /** Only once you've run your own contract. */
  big?: boolean;
}
export const KINDS: Record<BulkKind, KindSpec> = {
  ringTank: { unit: 'm3', odds: 20, survey: true },
  turkeyNest: { unit: 'm3', odds: 20, survey: true },
  laser: { unit: 'ha', odds: 12, att: 'laser', survey: true },
  channel: { unit: 'm', odds: 10, survey: true },
  contour: { unit: 'km', odds: 10, survey: false },
  pad: { unit: 'm3', odds: 10, survey: false, tested: true },
  rake: { unit: 'ha', odds: 8, att: 'rake', survey: false },
  cutter: { unit: 'ha', odds: 6, att: 'cutter', survey: false },
  dev: { unit: 'm3', odds: 4, survey: true, tested: true, big: true },
};

export const isDam = (k: unknown): k is DamKind => k === 'ringTank' || k === 'turkeyNest';

export interface FarmEnquiry {
  id: string;
  kind: BulkKind;
  /** The farmer, or the developer. */
  farm: string;
  place: string;
  /** Dams: the pit's shape. */
  dam?: DamPit;
  /** Pit to wall, or cut to fill, one way (m). */
  haul: number;
  /** The quantity on the plans, in the kind's unit. */
  vol: number;
  /** What's really there: the paddock isn't flat, the scrub's thicker, there's rock. Hidden. */
  truth: number;
  /** What a surveyor would tell you (within 3%). Hidden until paid for. */
  survey: number;
  surveyed?: boolean;
  /** Compaction tests at the end. */
  tested?: boolean;
  /** Laser levelling: m³ a hectare on the plans. Channels: m³ a metre, and rock in the cut. Pads: area and depth. */
  per?: number;
  rock?: boolean;
  area?: number;
  /** Developers: weeks allowed once you start. */
  weeks?: number;
  /** The client's ceiling. Hidden. */
  budget: number;
  /** Your rate per unit, and the price once sent. */
  rate: number;
  quoted?: number;
  week: number;
}

export interface Leak { w: number; farm: string; place: string; dk: BulkKind; price: number; /** How good the work was, and whether it was pushed on wet clay (the real game). */ q?: number; wet?: boolean }
export interface BulkBook {
  enq: FarmEnquiry[];
  /** Comebacks waiting: leaking walls, banks that broke, paddocks that pond. */
  leaks?: Leak[];
  /** The red-zone call: last asked, taken (week), found out. */
  rzLast?: number;
  rz?: number;
  rzFound?: boolean;
  /** Attachments you own. */
  att?: Partial<Record<Attachment, boolean>>;
  /** The real game: the red-zone grazier's dam, waiting on what you say. */
  rzDam?: FarmEnquiry;
  /** A grazier with a grudge: he rings, and gives it to someone else unless you're dirt cheap. */
  grudge?: { farm: string; until: number };
  /** A grazier who owes you one: his work is yours at anything reasonable. */
  promise?: { farm: string; until: number };
  /** A client you let down a little: less keen next time. */
  cool?: { farm: string; until: number };
}
export type BulkState = Biz & { bulk?: BulkBook; won2?: boolean; bulkDone?: number; devDone?: number; testsPassed?: number };
type B = BulkState;

export const FARMS = ['Kelly', 'Hartigan', 'Morrow', 'Fitzgerald', 'Lucas', 'Pearce', 'Doyle', 'McCann', 'Walsh', 'Brennan'] as const;
const DEVS = ['Macintyre Land', 'Border Solar', 'Weir Valley Estates', 'Downs Logistics Park'] as const;

/** Someone rings about work. Developers only once you've run your own contract. */
export function genEnquiry(rand: Rand, b: B, fmul: number, only?: BulkKind): FarmEnquiry {
  const pool = (Object.keys(KINDS) as BulkKind[]).filter((k) => !KINDS[k].big || b.won2);
  let kind = only ?? pool[0]!;
  if (!only) {
    let x = rand() * pool.reduce((a, k) => a + KINDS[k].odds, 0);
    for (const k of pool) if ((x -= KINDS[k].odds) < 0) { kind = k; break; }
  }
  const lift = compat.prototype ? 1 : PRICE_LIFT, mkt = (0.92 + 0.08 * fmul) * lift, place = pick(rand, TOWNS[b.town].places);
  const yourRate = (r: number) => { const s = rateStep({ kind }); return Math.round((r * lift) / s) * s; };
  const base = { id: uid(b), kind, place, week: b.week } as const;
  const noise = (lo: number, hi: number) => lo + rand() * (hi - lo);
  if (isDam(kind)) {
    let dam: DamPit;
    do {
      dam = kind === 'ringTank'
        ? { topLength: int(rand, 15, 30) * 10, topWidth: int(rand, 10, 20) * 10, depth: int(rand, 5, 8) / 2, sideBatter: 3, endBatter: int(rand, 3, 4) }
        : { topLength: int(rand, 6, 13) * 10, topWidth: int(rand, 4, 8) * 10, depth: int(rand, 8, 14) / 2, sideBatter: 3, endBatter: int(rand, 3, 4) };
    } while (damVolume(dam).floorWidth < 8 || damVolume(dam).floorLength < 8);
    const vol = Math.round(damVolume(dam).total), truth = Math.round(vol * noise(0.9, 1.2)), survey = Math.round(truth * noise(0.97, 1.03));
    // big ring tanks go cheaper a m³ than small, fiddly turkey nests
    const budget = round(vol * (kind === 'ringTank' ? noise(2.6, 3.6) : noise(3.8, 5.2)) * mkt, 500);
    const tested = rand() < TESTED_SHARE;
    const haul = kind === 'ringTank' ? int(rand, 15, 40) * 10 : int(rand, 6, 20) * 10;
    return { ...base, farm: pick(rand, FARMS), dam, haul, vol, truth, survey, budget: tested ? round(budget * (1 + TESTED_PREMIUM), 500) : budget, tested, rate: Math.round(yourRate((kind === 'ringTank' ? 2.9 : 4.2) + (tested ? 0.5 : 0)) * 100) / 100 };
  }
  const farm = kind === 'dev' ? pick(rand, DEVS) : pick(rand, FARMS);
  const make = (vol: number, truthMul: number, perUnit: number, rate: number, haul: number, extra: Partial<FarmEnquiry> = {}): FarmEnquiry => {
    const truth = Math.round(vol * truthMul * 100) / 100, survey = Math.round(truth * noise(0.97, 1.03) * 100) / 100;
    return { ...base, farm, haul, vol, truth, survey, budget: round(vol * perUnit * mkt, 100), rate: Math.round(yourRate(rate) * 100) / 100, ...extra };
  };
  switch (kind) {
    case 'laser': {
      // the levels on the plans say so many m³ a hectare; the real cut and fill don't always balance
      const ha = int(rand, 20, 80), per = int(rand, 25, 50) * 10;
      return make(ha, noise(0.85, 1.25), per * noise(2.6, 3.8) / 1, Math.round(per * 3.1 / 10) * 10, 80, { per });
    }
    case 'channel': {
      const m = int(rand, 8, 50) * 50, per = int(rand, 4, 10) / 2, rock = rand() < 0.3;
      return make(m, rock ? noise(1.3, 1.6) : noise(0.95, 1.08), per * noise(3.8, 5.2), Math.round(per * 4.5), 0, { per, rock });
    }
    case 'contour': {
      const km = int(rand, 4, 20) / 2;
      return make(km, noise(0.95, 1.1), noise(1700, 2700), 2100, 0);
    }
    case 'pad': {
      const area = int(rand, 15, 60) * 100, depth = int(rand, 4, 10) / 10, vol = Math.round(area * depth);
      return make(vol, noise(0.9, 1.15), noise(13, 18), 15, int(rand, 15, 40) * 10, { area, per: depth, tested: true });
    }
    case 'rake': {
      const ha = int(rand, 8, 60) * 5;
      return make(ha, noise(0.9, 1.3), noise(300, 500), 380, 0);
    }
    case 'cutter': {
      const ha = int(rand, 10, 60) * 10;
      return make(ha, noise(0.9, 1.2), noise(160, 260), 200, 0);
    }
    default: {
      // a developer's bulk earthworks: big, tested, monthly claims, and a deadline
      const vol = int(rand, 12, 50) * 10000;
      return make(vol, noise(0.95, 1.12), noise(3.2, 4.4), 3.6, int(rand, 25, 60) * 10, { tested: true, weeks: Math.ceil(vol / 30000) + 4 });
    }
  }
}

/** Pay a surveyor: their figure replaces the plans'. */
export function survey(b: B, id: string): boolean {
  const e = enq(b, id);
  if (!e || e.surveyed || e.quoted || !KINDS[e.kind].survey || b.bank < SURVEY_COST) return false;
  b.bank -= SURVEY_COST;
  e.surveyed = true;
  return true;
}

/** The quantity you're pricing: the surveyor's if you paid for one, the plans' if not. */
export function pricingVol(e: FarmEnquiry): number {
  return e.surveyed ? e.survey : e.vol;
}

export function quotePrice(e: FarmEnquiry): number {
  return round(e.rate * pricingVol(e), 100);
}

/** Rate steps by unit: 10c a m³, $10 a hectare or km... */
export function rateStep(e: Pick<FarmEnquiry, 'kind'>): number {
  const u = KINDS[e.kind].unit;
  return u === 'm3' ? 0.1 : u === 'm' ? 0.5 : u === 'ha' ? 10 : 50;
}

export function setRate(b: B, id: string, steps: number): void {
  const e = enq(b, id);
  if (e && !e.quoted) e.rate = Math.max(rateStep(e), Math.round((e.rate + steps * rateStep(e)) * 100) / 100);
}

export function sendQuote(b: B, id: string): boolean {
  const e = enq(b, id);
  if (!e || e.quoted) return false;
  e.quoted = quotePrice(e);
  return true;
}

/** The client's yes: sure under 88% of their budget, never over 108%. */
/** The real game: a grazier's grudge or favour bends his answer. */
export function clientOdds(S: BulkBook, e: FarmEnquiry, week: number): number {
  const on = (x?: { farm: string; until: number }) => !!x && x.farm === e.farm && week < x.until;
  if (on(S.grudge)) return (e.quoted ?? 0) <= e.budget * GRUDGE_PRICE ? yesOdds(e) : 0;
  if (on(S.promise)) return (e.quoted ?? 0) <= e.budget * 1.25 ? 1 : yesOdds(e);
  if (on(S.cool)) return yesOdds(e) * 0.6;
  return yesOdds(e);
}
/** Under a grudge, he only says yes at this share of his budget or less. */
export const GRUDGE_PRICE = 0.7;

export function yesOdds(e: FarmEnquiry): number {
  return Math.max(0, Math.min(1, (e.budget * 1.08 - (e.quoted ?? 0)) / (e.budget * 0.2)));
}

/** Buy an attachment: one each. */
export function buyAttachment(b: B, a: Attachment): boolean {
  const S = (b.bulk ??= { enq: [] });
  if (S.att?.[a] || b.bank < ATTACH[a]) return false;
  b.bank -= ATTACH[a];
  book(b.acc, 'capital', ATTACH[a]);
  (S.att ??= {})[a] = true;
  return true;
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
  | { k: 'redzoneFound'; fine: number }
  | { k: 'burnWait'; jobId: string }
  | { k: 'burnt'; jobId: string; price: number }
  | { k: 'devClaim'; jobId: string; amt: number }
  | { k: 'devBust'; jobId: string; lost: number };

/** Once a week: clients answer last week's prices, comebacks ring, windrows get burnt, developers pay or fold, and the phone might ring. */
export function bulkWeek(rand: Rand, b: B, fmul: number, events: BulkEvent[], mm = 0): void {
  const S = (b.bulk ??= { enq: [] });
  for (const L of (S.leaks ?? []).slice()) {
    if (L.w <= b.week) {
      S.leaks = S.leaks!.filter((x) => x !== L);
      b.queue.push({ k: 'leak', ...L, fix: round(L.price * LEAK_FIX, 100) });
    }
  }
  if (mm >= WET_CLAY_MM) {
    const j = b.jobs.find((x) => x.kind === 'bulk' && x.state === 'running' && !x.finished && (isDam(x.dk) || x.dk === 'pad' || x.dk === 'dev'));
    if (j && !b.queue.some((q) => q.k === 'wetclay')) b.queue.push({ k: 'wetclay', id: j.id, mm: Math.round(mm) });
  }
  // the real game: the engineer testing a wall offers to sign it off untested
  if (!compat.prototype) {
    const tj = b.jobs.find((x) => x.kind === 'bulk' && x.state === 'running' && !x.finished && x.tested && !x.signAsked && (x.m3 as number) >= (x.est as number) * 0.6);
    if (tj && !b.queue.some((q) => q.k === 'signoff') && rand() < 0.3) {
      tj.signAsked = true;
      b.queue.push({ k: 'signoff', id: tj.id });
    }
  }
  // windrows waiting on the end of fire season
  for (const j of b.jobs) {
    if (j.kind === 'bulk' && j.state === 'burn' && !FIRE_MONTHS.includes(monthIdx(b.week))) {
      j.state = 'done';
      invoice(b, j.client, j.fixed as number, j.terms, { invoiced: 0 });
      events.push({ k: 'burnt', jobId: j.id, price: j.fixed as number });
    }
  }
  // developers: a claim every four weeks, and sometimes they fold owing you
  for (const j of b.jobs.slice()) {
    if (j.kind !== 'bulk' || j.dk !== 'dev' || j.finished || j.state !== 'running') continue;
    if (rand() < DEV_BUST) {
      const owed = b.recv.filter((x) => x.client === j.client), lost = owed.reduce((a, x) => a + x.amt, 0) + ((j.retained as number) || 0);
      b.recv = b.recv.filter((x) => x.client !== j.client);
      book(b.acc, 'badDebts', lost);
      endJob(b, j);
      j.cut = true;
      events.push({ k: 'devBust', jobId: j.id, lost: Math.round(lost) });
      note(b, { k: 'devBust', farm: j.client, lost: Math.round(lost) });
      continue;
    }
    if ((b.week - (j.started as number)) % DEV_CLAIM_WEEKS === 0) devClaim(b, j, events);
  }
  if (S.rz != null && !S.rzFound && b.week - S.rz <= 52 && rand() < 0.008) {
    S.rzFound = true;
    b.bank -= REDZONE_FINE;
    b.rep = Math.max(0, b.rep - 3);
    // the real game: and the council won't hire you for six months
    if (!compat.prototype) (b.blocked as Record<string, number>)[TOWNS[b.town as keyof typeof TOWNS].council] = b.week + 26;
    events.push({ k: 'redzoneFound', fine: REDZONE_FINE });
    note(b, { k: 'redzoneFound', fine: REDZONE_FINE });
  }
  if (b.fleet.some((m) => m.type === 'd8' || m.type === 'd9' || m.type === 'd10') && b.week - (S.rzLast ?? -99) >= 40 && !b.queue.length && rand() < 0.04) {
    S.rzLast = b.week;
    if (compat.prototype) b.queue.push({ k: 'redzone' });
    else {
      // a grazier you've worked for if there is one, and the dam he's got lined up for you
      const known = ((b as { log?: { e: { k: string; farm?: string } }[] }).log ?? []).filter((x) => (x.e.k === 'damWon' || x.e.k === 'damDone') && (FARMS as readonly string[]).includes(x.e.farm ?? '')).map((x) => x.e.farm!);
      const farm = known.length ? pick(rand, known) : pick(rand, FARMS);
      S.rzDam = { ...genEnquiry(rand, b, fmul, 'turkeyNest'), farm };
      b.queue.push({ k: 'redzone', farm });
    }
  }
  for (const e of S.enq.slice()) {
    if (e.quoted && e.week < b.week) {
      S.enq = S.enq.filter((x) => x !== e);
      if (rand() < (compat.prototype ? yesOdds(e) : clientOdds(S, e, b.week))) {
        const j = bulkJob(b, e);
        // the gear's booked the moment they say yes, before a hire job can take it
        startOne(b, j, events);
        events.push({ k: 'damWon', jobId: j.id, price: e.quoted });
        // the real game: now and then a farmer wants it done for cash
        if (!compat.prototype && e.kind !== 'dev' && !e.tested && rand() < CASH_ASK) b.queue.push({ k: 'cashjob', id: j.id });
        note(b, { k: 'damWon', farm: e.farm, place: e.place, dk: e.kind, price: e.quoted });
      } else {
        events.push({ k: 'damLost', farm: e.farm, place: e.place });
        note(b, { k: !compat.prototype && S.grudge?.farm === e.farm && b.week < S.grudge.until ? 'grudgeLost' : 'damLost', farm: e.farm, place: e.place, dk: e.kind });
      }
    } else if (!e.quoted && b.week - e.week >= ENQ_WEEKS) {
      S.enq = S.enq.filter((x) => x !== e);
      events.push({ k: 'damLapsed', farm: e.farm, place: e.place });
    }
  }
  for (const j of b.jobs.slice()) {
    if (j.kind === 'bulk' && j.state === 'waiting' && b.week - (j.won as number) >= WAIT_WEEKS) {
      b.jobs = b.jobs.filter((x) => x !== j);
      b.rep = Math.max(0, b.rep - 1);
      events.push({ k: 'damGone', jobId: j.id });
      note(b, { k: 'damGone', farm: j.client, place: j.place, dk: j.dk });
    }
  }
  if (S.enq.filter((e) => !e.quoted).length < 3 && rand() < 0.5) {
    // half the time it's work your gear can already do, so a small outfit isn't left looking at jobs it can't touch
    const can = doable(b);
    const e = genEnquiry(rand, b, fmul, can.length && rand() < 0.5 ? pick(rand, can) : undefined);
    // the real game: a grazier with a grudge keeps ringing for prices, just to give the work to someone else
    if (!compat.prototype && S.grudge && b.week < S.grudge.until && e.kind !== 'dev' && rand() < 0.35) e.farm = S.grudge.farm;
    S.enq.push(e);
  }
}

/** The kinds of work the yard could start today, gear and attachments both. */
export function doable(b: Pick<B, 'fleet' | 'bulk' | 'won2'>): BulkKind[] {
  const ms = b.fleet.filter((m) => m.status !== 'auction');
  return (Object.keys(KINDS) as BulkKind[]).filter((k) => (!KINDS[k].big || b.won2) && workRate(ms, { dk: k, haul: 200, per: 3 }, b.bulk?.att).perHour > 0);
}

function enq(b: B, id: string): FarmEnquiry | undefined {
  return b.bulk?.enq.find((e) => e.id === id);
}

function bulkJob(b: B, e: FarmEnquiry): Job {
  const dev = e.kind === 'dev';
  const j: Job = {
    id: uid(b), kind: 'bulk', type: 'd8', client: e.farm, place: e.place, days: 0, done: 0, rate: e.rate, fixed: e.quoted, terms: dev ? 4 : 2, fuelPaid: true,
    mId: null, who: null, rollerId: null, hireIn: 0, extra: 0, earned: 0, idleWeeks: 0, state: 'waiting',
    dk: e.kind, tested: !!e.tested, qsum: 0, dam: e.dam, haul: e.haul, per: e.per, rock: e.rock, truth: e.truth, est: pricingVol(e), m3: 0, won: b.week,
    weeks: e.weeks, claimed: 0, retained: 0, spread: [] as string[], crew: {} as Record<string, string>,
  };
  b.jobs.push(j);
  return j;
}

// ---------- the spread ----------

const bulkScraper = (t: MachineType) => SCRAPER_SPEC[t as BulkType];
const has = (b: B, a: Attachment) => !!b.bulk?.att?.[a];

export interface SpreadRate {
  rates: Record<string, number>;
  /** Units of the job's work an hour. */
  perHour: number;
  slowest: string;
  compacted: boolean;
  watered: boolean;
  precon: boolean;
  /** Finished with a grader (laser levelling, pads). */
  trimmed: boolean;
}

/** Bank m³ an hour of dirt moved: scrapers (pushed or not), else an excavator loading moxies or tippers, else dozers. */
function dirtRate(ms: readonly Pick<Machine, 'type'>[], haul: number): { k: string; r: number } {
  const scr = ms.filter((m) => bulkScraper(m.type)), doz = ms.filter((m) => DOZE[m.type as BulkType]);
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
    return { k: 'scrapers', r: self + pushed };
  }
  const ex = ms.filter((m) => m.type === 'excavator').length, carts = ms.reduce((a, m) => a + (CART_M3[m.type] ?? 0), 0);
  if (ex && carts) return { k: carts < ex * DIG ? 'trucks' : 'excavator', r: Math.min(ex * DIG, carts * Math.min(1, 300 / Math.max(300, haul))) };
  if (doz.length) return { k: 'dozers', r: doz.reduce((a, m) => a + DOZE[m.type as BulkType]!, 0) * Math.min(1, 60 / Math.max(60, haul)) };
  return { k: 'dirt', r: 0 };
}

/** What a set of machines gets through an hour, in the job's unit, part by part, and the slowest part. */
export function workRate(all: readonly Pick<Machine, 'type'>[], j: { dk?: unknown; haul?: unknown; per?: unknown; rock?: unknown; precon?: unknown; tested?: unknown }, att: Partial<Record<Attachment, boolean>> = {}): SpreadRate {
  // rock in a channel is already in how many metres' worth of digging it really is (the truth)
  const kind = (j.dk ?? 'turkeyNest') as BulkKind, haul = (j.haul as number) || 0, per = (j.per as number) || 1;
  let ms = all.slice(), pre = false;
  // preconditioning the pit takes a dozer (the smallest) and a moxy water cart off the spread
  if (j.precon && j.tested) {
    const dz = ms.filter((m) => DOZE[m.type as BulkType]).sort((a, z) => DOZE[a.type as BulkType]! - DOZE[z.type as BulkType]!)[0], mc = ms.find((m) => m.type === 'moxycart');
    if (dz && mc) {
      ms = ms.filter((m) => m !== dz && m !== mc);
      pre = true;
    }
  }
  const comp = ms.filter((m) => COMPACT_W[m.type] && m.type !== 'roller'), carts = ms.filter((m) => TANK[m.type]), grader = ms.some((m) => m.type === 'grader');
  const rates: Record<string, number> = {};
  const done = (scale = 1): SpreadRate => {
    let slowest = '', perHour = Infinity;
    for (const [k, r] of Object.entries(rates)) if (r < perHour) { perHour = r; slowest = k; }
    return { rates, perHour: perHour === Infinity ? 0 : perHour * DELAYS * scale, slowest, compacted: comp.length > 0, watered: carts.length > 0, precon: pre, trimmed: grader };
  };
  switch (kind) {
    case 'laser': {
      if (!att.laser) { rates.laser = 0; return done(); }
      const d = dirtRate(ms.filter((m) => bulkScraper(m.type) || DOZE[m.type as BulkType]), haul || 80);
      rates[d.k] = d.r;
      return done(1 / per);
    }
    case 'channel': {
      const ex = ms.filter((m) => m.type === 'excavator').length;
      rates.excavator = ex * DIG;
      return done(1 / per);
    }
    case 'contour': {
      rates.banks = ms.reduce((a, m) => a + (CONTOUR_KM[m.type] ?? 0), 0);
      // a dozer packs a bank down as it builds it; a grader on its own leaves it loose
      return { ...done(), compacted: ms.some((m) => DOZE[m.type as BulkType]) };
    }
    case 'rake': {
      const dz = ms.filter((m) => RAKE_HA[m.type as BulkType]).sort((a, z) => RAKE_HA[z.type as BulkType]! - RAKE_HA[a.type as BulkType]!)[0];
      rates.rake = att.rake && dz ? RAKE_HA[dz.type as BulkType]! : 0;
      return done();
    }
    case 'cutter': {
      const dz = ms.filter((m) => CUT_HA[m.type as BulkType]).sort((a, z) => CUT_HA[z.type as BulkType]! - CUT_HA[a.type as BulkType]!)[0];
      rates.cutter = att.cutter && dz ? CUT_HA[dz.type as BulkType]! : 0;
      return done();
    }
    default: {
      // dams, pads and developers' bulk: dirt, then rolling it, then water
      const d = dirtRate(ms, haul);
      rates[d.k] = d.r;
      if (comp.length || (kind === 'pad' && ms.some((m) => m.type === 'roller'))) rates.compactor = ms.reduce((a, m) => a + (COMPACT_W[m.type] ? compactorRate(COMPACT_W[m.type]!, 8, 0.2, 6) : 0), 0) / (1 - SHRINK);
      if (carts.length) rates.water = carts.reduce((a, m) => a + waterCartRate(TANK[m.type]!, CART_TRIP), 0) / waterNeeded(1 - SHRINK, MOIST_ADD);
      return done();
    }
  }
}

/** The dam sum's spread, kept for the step 2 screens and tests: bank m³ an hour. */
export function spreadRate(all: readonly Pick<Machine, 'type'>[], haul: number, precon = false): SpreadRate {
  return workRate(all, { dk: 'turkeyNest', haul, precon, tested: precon });
}

/** Which machines each kind of job takes, from what's idle. */
export function freeFor(b: Pick<B, 'fleet'>, kind: BulkKind): Machine[] {
  const idle = b.fleet.filter((m) => m.status === 'idle' && m.down === 0);
  const pickN = (f: (m: Machine) => boolean, n: number) => idle.filter(f).slice(0, n);
  switch (kind) {
    case 'laser': return [...idle.filter((m) => bulkScraper(m.type)), ...pickN((m) => m.type === 'grader', 1)];
    case 'channel': return [...idle.filter((m) => m.type === 'excavator'), ...pickN((m) => !!DOZE[m.type as BulkType], 1)];
    case 'contour': return pickN((m) => !!CONTOUR_KM[m.type], 2);
    case 'rake': return pickN((m) => !!RAKE_HA[m.type as BulkType], 1);
    case 'cutter': return idle.filter((m) => CUT_HA[m.type as BulkType]).sort((a, z) => CUT_HA[z.type as BulkType]! - CUT_HA[a.type as BulkType]!).slice(0, 1);
    case 'pad': return [...idle.filter((m) => bulkScraper(m.type) || DOZE[m.type as BulkType] || COMPACT_W[m.type] || TANK[m.type] || m.type === 'excavator' || CART_M3[m.type]).filter((m) => m.type !== 'grader'), ...pickN((m) => m.type === 'grader', 1)];
    default: return idle.filter((m) => bulkScraper(m.type) || DOZE[m.type as BulkType] || (COMPACT_W[m.type] && m.type !== 'roller') || m.type === 'moxycart' || (kind === 'dev' && (m.type === 'excavator' || m.type === 'moxy')));
  }
}

/** The dam spread (step 2's name for it). */
export function freeSpread(b: Pick<B, 'fleet'>): Machine[] {
  return freeFor(b, 'turkeyNest');
}

/** A day's running cost for a machine: its fuel and a share of its next service. */
export function machineDay(t: MachineType): number {
  return TYPES[t].fuel + Math.round(TYPES[t].svc / 28);
}

/** What a job would take with a set of machines: days, and the cost of the spread (fuel, servicing, casual operators). */
export function jobEstimate(b: Pick<B, 'fleet' | 'staff' | 'youJob' | 'bulk'>, ms: readonly Machine[], e: Pick<FarmEnquiry, 'kind' | 'haul' | 'per' | 'rock'>, qty: number) {
  const sr = workRate(ms, { dk: e.kind, haul: e.haul, per: e.per, rock: e.rock }, b.bulk?.att), perDay = sr.perHour * dayHours();
  const days = perDay > 0 ? Math.ceil(qty / perDay) : Infinity;
  const seats = seatPlan(b, ms);
  const dayCost = ms.reduce((a, m) => a + machineDay(m.type), 0) + seats.casuals * BULK_CASUAL;
  return { ...sr, perDay, days, dayCost, cost: days * dayCost, casuals: seats.casuals };
}

/** Step 2's estimate for a dam. */
export function damEstimate(b: Pick<B, 'fleet' | 'staff' | 'youJob'>, ms: readonly Machine[], vol: number, haul: number) {
  return jobEstimate(b as never, ms, { kind: 'turkeyNest', haul }, vol);
}

/** Who drives what: your crew who can drive each machine, then you, then labour hire. */
export function seatPlan(b: Pick<B, 'staff' | 'youJob'>, ms: readonly Pick<Machine, 'id' | 'type'>[], jobId?: string): { crew: Record<string, string>; casuals: number } {
  const crew: Record<string, string> = {}, used = new Set<string>();
  let you = !b.youJob || b.youJob === jobId, casuals = 0;
  for (const m of ms) {
    const p = b.staff.find((x) => !used.has(x.id) && x.off === 0 && (!x.jobId || x.jobId === jobId) && ROLES[x.role].drives.includes(m.type));
    if (p) {
      crew[m.id] = p.id;
      used.add(p.id);
    } else if (you) {
      crew[m.id] = 'you';
      you = false;
    } else {
      crew[m.id] = 'casual';
      casuals++;
    }
  }
  return { crew, casuals };
}

/** Monday: a waiting job takes its spread if there's enough to make a start; a running one picks up anything freed. */
export function bulkStart(b: B, events: BulkEvent[]): void {
  for (const j of b.jobs) startOne(b, j, events);
}

/** Take a job's spread (and start it, if there's enough to make a start). Called on Monday, and the moment a job's won. */
function startOne(b: B, j: Job, events: BulkEvent[]): void {
  if (j.kind !== 'bulk' || j.finished || (j.state !== 'waiting' && j.state !== 'running')) return;
  const mine = b.fleet.filter((m) => m.jobId === j.id);
  const add = freeFor(b, j.dk as BulkKind);
  if (j.state === 'waiting' && workRate(mine.concat(add), j as never, b.bulk?.att).perHour <= 0) return;
  for (const m of add) {
    m.status = 'job';
    m.jobId = j.id;
  }
  const all = mine.concat(add);
  // seat the crew afresh each week: whoever's free and can drive it
  for (const p of b.staff) if (p.jobId === j.id) p.jobId = null;
  if (b.youJob === j.id) b.youJob = null;
  const sp = seatPlan(b, all, j.id);
  for (const [, who] of Object.entries(sp.crew)) {
    if (who === 'you') b.youJob = j.id;
    else if (who !== 'casual') {
      const p = b.staff.find((x) => x.id === who);
      if (p) p.jobId = j.id;
    }
  }
  j.crew = sp.crew;
  j.spread = all.map((m) => m.id);
  if (j.state === 'waiting') {
    j.state = 'running';
    j.started = b.week;
    if (j.dk === 'dev') j.due = b.week + (j.weeks as number);
    events.push({ k: 'damStarted', jobId: j.id });
    note(b, { k: 'damStarted', farm: j.client, place: j.place, dk: j.dk });
  }
}

// ---------- quality ----------

/** How good a day's work is, 0 to 1. Dams and pads: rolled, watered, preconditioned, or pushed on wet. Banks: a dozer packs them better than a grader. Laser levelling: trimmed with a grader. */
export function dayQuality(sr: { compacted: boolean; watered: boolean; precon: boolean; trimmed?: boolean; rates?: Record<string, number> }, wetPush: boolean, kind: BulkKind = 'turkeyNest'): number {
  if (kind === 'contour') return sr.compacted ? 0.88 : 0.72;
  if (kind === 'laser') return sr.trimmed ? 0.92 : 0.65;
  if (kind === 'channel' || kind === 'rake' || kind === 'cutter') return 1;
  return Math.max(0, Math.min(1, 0.55 + (sr.compacted ? 0.25 : 0) + (sr.watered ? 0.1 : 0) + (sr.precon ? 0.15 : 0) - (wetPush ? 0.25 : 0)));
}

/** The work as done so far, 0 to 1. */
export function wallQuality(j: Job): number {
  return (j.m3 as number) > 0 ? ((j.qsum as number) || 0) / (j.m3 as number) : 0;
}

/** A tested job passes on quality: sure at 0.9, never at 0.5 or below. Untested, poor work comes back: never at 0.85 or better. */
export function passOdds(q: number): number {
  return Math.max(0, Math.min(1, (q - 0.5) / 0.4));
}
/** The real game: a sound wall still comes back now and then (cracking, yabbies). */
export const DROUGHT_CRACK = 0.04;

/** Whether a client believes it wasn't your wall: good, dry-rolled work usually stands up; pushed on wet clay, rarely. */
export function believeOdds(q: number, wet: boolean): number {
  return Math.max(0.05, Math.min(0.8, (q - 0.5) * 2.5)) * (wet ? 0.3 : 1);
}

export function leakOdds(q: number): number {
  return Math.max(0, Math.min(1, (0.85 - q) * 1.5));
}

// ---------- the day ----------

export function damDay(rand: Rand, b: B, j: Job, wet: boolean, w: WorkshopCtx, rep: WeekReport, events: BulkEvent[]): void {
  if (j.state !== 'running' || j.finished || wet) return;
  if (((j.dry as number) || 0) > 0) {
    j.dry = (j.dry as number) - 1;
    rep.lost++;
    return;
  }
  const kind = j.dk as BulkKind;
  const ms = b.fleet.filter((m) => m.jobId === j.id && m.down === 0);
  const crew = j.crew as Record<string, string>;
  // a seat whose driver is off today stops that machine
  const going = ms.filter((m) => {
    const who = crew[m.id];
    if (!who || who === 'casual') return true;
    if (who === 'you') return !(b.youBlocked > 0);
    return (b.staff.find((p) => p.id === who)?.off ?? 1) === 0;
  });
  const sr = workRate(going, j as never, b.bulk?.att);
  if (sr.perHour <= 0) {
    rep.lost++;
    return;
  }
  const moved = sr.perHour * dayHours();
  j.m3 = (j.m3 as number) + moved;
  j.qsum = ((j.qsum as number) || 0) + moved * dayQuality(sr, j.wetPush === b.week, kind);
  j.slowest = sr.slowest;
  rep.worked++;
  // cutter barring is brutal on a dozer
  const hard = kind === 'cutter' ? 1.8 : 1;
  let cost = 0;
  for (const m of going) {
    cost += TYPES[m.type].fuel;
    if (crew[m.id] === 'casual') cost += BULK_CASUAL;
    wear(m, hard, b.acc);
    if (breaks(rand, m, hard, w)) {
      breakdown(rand, m, w, b.acc);
      b.queue.push({ k: 'break', id: m.id });
    }
  }
  b.bank -= cost;
  rep.costs += cost;
  j.spent = (j.spent || 0) + cost;
  book(b.acc, 'jobCosts', cost);
  fuelUse(b, going.reduce((a, m) => a + TYPES[m.type].fuel, 0));
  if ((j.m3 as number) >= (j.truth as number)) finishJob(rand, b, j, rep, events);
}

function endJob(b: B, j: Job): void {
  j.finished = true;
  j.freed = true;
  for (const m of b.fleet) if (m.jobId === j.id) {
    m.jobId = null;
    if (m.status === 'job') m.status = 'idle';
  }
  for (const p of b.staff) if (p.jobId === j.id) p.jobId = null;
  if (b.youJob === j.id) b.youJob = null;
}

function devClaim(b: B, j: Job, events: BulkEvent[], final = false): void {
  const worth = Math.min(j.m3 as number, j.truth as number) / (j.truth as number) * (j.fixed as number), due = worth - ((j.claimed as number) || 0);
  if (due <= 0 && !final) return;
  const ret = due * DEV_RETAIN;
  j.claimed = ((j.claimed as number) || 0) + due;
  j.retained = ((j.retained as number) || 0) + ret;
  invoice(b, j.client, due - ret, j.terms, { invoiced: 0 });
  events.push({ k: 'devClaim', jobId: j.id, amt: Math.round(due - ret) });
}

function finishJob(rand: Rand, b: B, j: Job, rep: WeekReport, events: BulkEvent[]): void {
  const kind = j.dk as BulkKind;
  endJob(b, j);
  j.earned = j.fixed as number;
  b.bulkDone = (b.bulkDone || 0) + 1;
  if (kind === 'dev') b.devDone = (b.devDone || 0) + 1;
  if (kind === 'dev') {
    // the last claim, the retention back, less damages if you're late
    devClaim(b, j, events, true);
    const late = Math.max(0, b.week - (j.due as number)), ld = round(late * DEV_LD * (j.fixed as number), 100);
    invoice(b, j.client, ((j.retained as number) || 0) - ld, j.terms + 4, rep);
    j.ld = ld;
  } else if (kind === 'rake' && FIRE_MONTHS.includes(monthIdx(b.week))) {
    // windrows can't be burnt in fire season: paid once they are
    j.state = 'burn';
    events.push({ k: 'burnWait', jobId: j.id });
  } else if (j.cash) {
    // cash in hand, nothing in the books
    b.bank += j.fixed as number;
    if (rand() < CASH_AUDIT) laterBulk(b, 'audit', int(rand, 10, 40), { farm: j.client, amt: round((j.fixed as number) * CASH_BACK, 100) });
  } else invoice(b, j.client, j.fixed as number, j.terms, rep);
  events.push({ k: 'damDone', jobId: j.id, price: j.fixed as number, m3: Math.round(j.truth as number), est: Math.round(j.est as number) });
  const q = wallQuality(j);
  j.q = Math.round(q * 100) / 100;
  if (j.tested && j.signed) {
    // signed off untested: it passes on paper. If it wouldn't have, the wall finds out later.
    b.rep += 1;
    b.testsPassed = (b.testsPassed || 0) + 1;
    events.push({ k: 'damPassed', jobId: j.id });
    if (rand() >= passOdds(q)) laterBulk(b, 'signFail', int(rand, 12, 40), { farm: j.client, place: j.place, cost: round((j.fixed as number) * REWORK * 2, 100) });
  } else if (j.tested) {
    if (rand() < passOdds(q)) {
      b.rep += 1;
      b.testsPassed = (b.testsPassed || 0) + 1;
      events.push({ k: 'damPassed', jobId: j.id });
    } else {
      const cost = round((j.fixed as number) * REWORK, 100);
      b.bank -= cost;
      rep.costs += cost;
      j.spent = (j.spent || 0) + cost;
      b.rep = Math.max(0, b.rep - 1);
      events.push({ k: 'damFailed', jobId: j.id, cost });
    }
  } else if (rand() < leakOdds(q) || (!compat.prototype && rand() < DROUGHT_CRACK)) {
    // the real game: a good wall can still crack in a dry spell, or get the yabbies in
    const S = (b.bulk ??= { enq: [] });
    (S.leaks ??= []).push({ w: b.week + int(rand, 8, 30), farm: j.client, place: j.place, dk: kind, price: j.fixed as number, ...(compat.prototype ? {} : { q: Math.round(q * 100) / 100, wet: j.wetPush != null }) });
  }
  note(b, { k: 'damDone', farm: j.client, place: j.place, dk: j.dk, price: j.fixed, m3: Math.round(j.truth as number), est: Math.round(j.est as number), spent: Math.round(j.spent || 0) });
}

/** Precondition the pit (tested walls only): a dozer and a moxy water cart wet the dirt up before it's picked up. */
export function setPrecon(b: B, id: string, on: boolean): boolean {
  const j = b.jobs.find((x) => x.id === id);
  if (!j || j.kind !== 'bulk' || !j.tested || j.finished) return false;
  j.precon = on;
  return true;
}

// ---------- the cards ----------

/** Wet clay: wait two working days for it to dry, or push on and the work suffers this week. */
export function wetClayWait(j: Job): void {
  j.dry = 2;
}
export function wetClayPush(b: { week: number }, j: Job): void {
  j.wetPush = b.week;
}
/** A comeback: go back and fix it, or tell them it's not your fault. */
export function leakFix(b: B, fix: number): void {
  b.bank -= fix;
}
export function leakArgue(b: B): void {
  b.rep = Math.max(0, b.rep - 2);
}
/** The real game: show them it wasn't your wall. Believed, nothing comes of it; not, they get an engineer and you pay the fix and the name. Returns believed. */
export function leakShow(rand: Rand, b: B, fix: number, q: number, wet: boolean): boolean {
  if (rand() < believeOdds(q, wet)) return true;
  b.bank -= fix;
  b.rep = Math.max(0, b.rep - 2);
  return false;
}
/** Wet clay: wait for it to dry, and the client's put out (the real game: a little less keen next time). */
export function wetClayWaitCool(b: B, j: Job): void {
  wetClayWait(j);
  (b.bulk ??= { enq: [] }).cool = { farm: j.client, until: b.week + 26 };
}
/** The red-zone grazier, the real game. No: he holds it against you for a year. Permit: half the time the same, half the time the dam comes back later, done properly. Take: the cash, and the dam's yours. */
export function redzoneNo(b: B, farm: string): void {
  const S = (b.bulk ??= { enq: [] });
  S.grudge = { farm, until: b.week + 52 };
  delete S.rzDam;
}
export function redzonePermit(rand: Rand, b: B, farm: string): boolean {
  if (rand() < 0.5) {
    redzoneNo(b, farm);
    return false;
  }
  laterBulk(b, 'rzDam', int(rand, 10, 16), { permit: true });
  return true;
}
export function redzoneTakeDam(rand: Rand, b: B): void {
  redzoneTake(b);
  laterBulk(b, 'rzDam', int(rand, 4, 8), {});
}
/** A farmer wants a won job done for cash: take it (10% off, paid in cash, no invoice) or put it through the books (half the time they're put out). */
export function cashTake(j: Job): void {
  j.cash = true;
  j.fixed = round((j.fixed as number) * (1 - CASH_OFF), 100);
}
export function cashInvoice(rand: Rand, b: B, j: Job): boolean {
  if (rand() < 0.5) {
    (b.bulk ??= { enq: [] }).cool = { farm: j.client, until: b.week + 26 };
    return true;
  }
  return false;
}
/** Pay the engineer to sign off the tests. */
export function signoffPay(b: B, j: Job): void {
  b.bank -= SIGNOFF_BRIBE;
  j.signed = true;
}
function laterBulk(b: B, k: string, wks: number, d: Record<string, unknown>): void {
  ((b as { later?: unknown[] }).later ??= []).push({ w: b.week + wks, k, ...d });
}
/** The red-zone job: the cash now, and a chance it comes out over the next year. */
export function redzoneTake(b: B): void {
  b.bank += REDZONE_CASH;
  (b.bulk ??= { enq: [] }).rz = b.week;
}
