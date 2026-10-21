// Hire work: the first money in. Four kinds of job come up each week.
//   wet      your machine and an operator for a head contractor, paid by the day, they supply fuel
//   dry      your machine only, their operator, paid by the week; you stay free, the machine wears twice as fast
//   council  maintenance grading on day labour, paid by the day, you supply fuel; counts double for track record
//   private  a fixed-price job for a landholder: rain days are on you
// A machine nearly done on a day job can have the next one booked in behind it, if the client will wait.
// Nothing here writes sentences; it returns codes and events, and the screens say them.

import { jobRef, note } from './diary';
import { book, type Accounts } from './ledger';
import { breakdown, breaks, TYPES, wear, type Machine, type MachineType, type WorkshopCtx } from './machines';
import { HEAD_CONTRACTORS } from './market';
import { mapDone, type DistrictMap } from './map';
import { relAdd } from './relations';
import { int, pick, type Rand } from './rng';
import { compat, shuffled } from './compat';
import { isBulk } from './machines';
import { fuelIdle, fuelUse } from './fuel';
import { SKILLS, ROLES, type Person } from './staff';
import { TOWNS, type TownId } from './towns';
import { forecast, type WeatherCtx } from './weather';

/** Head contractors: weeks to pay, and how often they pay late. */
export const CLIENTS: Record<string, { terms: number; late: number }> = {
  'Border Civil': { terms: 7, late: 0.35 },
  'Hartley Bros': { terms: 4, late: 0.2 },
  'Macintyre Plant': { terms: 5, late: 0.15 },
  'Dry Creek Civil': { terms: 4, late: 0.06 },
};

/** The kinds of private job. Names, not sentences: a private client is "Shed pad, Talwood". */
export const PRIVATE_JOBS = ['Station track', 'Farm roads', 'Shed pad', 'Laneway re-sheet', 'Dam bank tidy-up'] as const;

export type HireKind = 'wet' | 'dry' | 'council' | 'private';
const DAYJOB: Record<string, boolean> = { wet: true, council: true, private: true };

export interface Offer {
  id: string;
  kind: HireKind;
  type: MachineType;
  place: string;
  client: string;
  /** Working days (weeks for dry hire). */
  days: number;
  /** Per day (wet, council) or per week (dry). */
  rate?: number;
  /** Private jobs: the price. */
  fixed?: number;
  /** Weeks to pay. */
  terms: number;
  /** You pay the fuel. */
  fuelPaid?: boolean;
  /** Private jobs that need a roller too. */
  needsRoller?: boolean;
  /** A head contractor rang about one of your idle machines. */
  enq?: boolean;
  /** Council pit work: cubic metres of gravel to rip and stockpile, and how hard the pit rips (0 soft, 1 firm, 2 hard). type is the smallest dozer for it. */
  gravel?: number;
  rock?: 0 | 1 | 2;
}

/** A job on the books. Hire jobs use the fields below; contracts add their own later. */
export interface Job {
  id: string;
  kind: string;
  type: MachineType;
  client: string;
  place: string;
  /** What a screen needs to name a contract: the road's length, or the package's roads, km, area and lot. */
  nm?: { L?: number; roads?: number; km?: number; area?: string; lot?: number; lots?: number };
  days: number;
  done: number;
  rate: number;
  /** Private jobs: the price. */
  fixed?: number;
  terms: number;
  fuelPaid: boolean;
  /** The machine on it (none yet on a contract waiting to start). */
  mId: string | null;
  /** Who's driving: a person's id, 'you', or null (dry hire). */
  who: string | null;
  rollerId: string | null;
  /** Weekly dry hire for a roller you don't own. */
  hireIn: number;
  extra: number;
  earned: number;
  idleWeeks: number;
  /** Booked in behind this job; starts when it finishes. */
  after?: string | null;
  needsRoller?: boolean;
  /** Mobilised mid-week: no work until after this day. */
  mob?: { w: number; d: number } | null;
  /** Spent on it so far. */
  spent?: number;
  finished?: boolean;
  freed?: boolean;
  /** Weeks stood down (a serious incident). */
  stood?: number;
  /** This week's takings and days. */
  wk?: number;
  wkDays?: number;
  jlog?: number;
  // contract fields, used once contracts are ported
  cartId?: string | null;
  cart2Id?: string | null;
  ownedIds?: string[];
  state?: string;
  [x: string]: unknown;
}

/** An invoice waiting to be paid. */
export interface Receivable {
  id: string;
  client: string;
  amt: number;
  due: number;
  lateRolled: boolean;
  /** A claim on a collapsed head contractor's administrators. */
  adm?: boolean;
}

/** The parts of a career hire work touches. */
export interface Biz {
  week: number;
  town: TownId;
  bank: number;
  seq: number;
  fleet: Machine[];
  staff: Person[];
  jobs: Job[];
  offers: Offer[];
  recv: Receivable[];
  rep: number;
  blocked: Record<string, number>;
  youJob: string | null;
  youBlocked: number;
  /** Weeks of operator cover left, and who it's covering. */
  opCover: number;
  coverFor: string | null;
  acc: Accounts;
  queue: { k: string; id?: string; [x: string]: unknown }[];
  stats: { earned: number; [x: string]: number };
  rel?: Record<string, number>;
  lateCd?: Record<string, number>;
  /** Flood funding paused until this week. */
  freeze?: number;
  jlog?: JobLog[];
  /** The district map, once made (map.ts). */
  dmap?: DistrictMap;
  /** The bulk fuel tank and the diesel price (fuel.ts). */
  fuel?: import('./fuel').FuelBook;
}

export interface JobLog {
  w: number; kind: string; client: string; rev: number; cost: number; cut: boolean; sub: boolean; part: boolean; plan: number | null; oh: number;
  /** What a screen needs to name the job. */
  tn?: Pick<Job, 'kind' | 'type' | 'client' | 'place' | 'nm' | 'major' | 'prestige'>;
}

export function uid(b: { seq: number }): string {
  b.seq = (b.seq || 0) + 1;
  return 'i' + b.seq;
}

const round = (n: number, to: number) => Math.round(n / to) * to;

/** Track record in stars, from points. */
export function stars(rep: number): number {
  return rep >= 22 ? 3 : rep >= 12 ? 2 : rep >= 5 ? 1 : 0;
}

/** An unknown firm gets about 72% of schedule rates, 8% more with each star; busy times pay a little more. */
export function rateFactor(rep: number, fmul: number): number {
  return (0.72 + 0.08 * stars(rep)) * (0.92 + 0.08 * fmul);
}

export function owns(b: Pick<Biz, 'fleet'>, t: MachineType): boolean {
  return b.fleet.some((m) => m.type === t && m.status !== 'auction');
}

export function freeMachine(b: Pick<Biz, 'fleet'>, type: MachineType): Machine | undefined {
  return b.fleet.find((m) => m.type === type && m.status === 'idle' && m.down === 0);
}

/** Your staff go out first, then you. */
export function freeDriver(b: Pick<Biz, 'staff' | 'youJob'>, type: MachineType): string | null {
  const p = b.staff.find((x) => !x.jobId && x.off === 0 && ROLES[x.role].drives.includes(type));
  if (p) return p.id;
  return b.youJob ? null : 'you';
}

export function seat(b: Pick<Biz, 'staff' | 'youJob'>, j: Job, who: string): void {
  if (who === 'you') b.youJob = j.id;
  else {
    const p = b.staff.find((x) => x.id === who);
    if (p) p.jobId = j.id;
  }
}

/** A client that won't use you right now (a council suspension, a head contractor you chased). */
export function barred(b: Pick<Biz, 'blocked' | 'week'>, client: string): boolean {
  return (b.blocked[client] ?? 0) > b.week;
}

export function frozen(b: Pick<Biz, 'freeze' | 'week'>): boolean {
  return (b.freeze ?? 0) > b.week;
}

/** Dozers the council hires by the day to push up gravel at its pits, smallest first. */
export const PIT_DOZERS: readonly MachineType[] = ['d6', 'd8', 'd9', 'd10'];
const COUNCIL_DOZERS: readonly string[] = PIT_DOZERS;
/** Gravel a dozer rips and stockpiles in a 10-hour day, in a soft pit; firm and hard pits go slower. */
export const PIT_RATE: Record<string, number> = { d6: 500, d8: 900, d9: 1300, d10: 1800 };
export const PIT_HARD = [1, 0.7, 0.5] as const;

/** The smallest dozer for a pit job: more gravel, or a harder pit, wants a bigger machine. */
export function pitDozer(gravel: number, rock: number): MachineType {
  return PIT_DOZERS[Math.min(3, Math.floor(gravel / 6000 + rock * 0.9))]!;
}

/** The machine that would go on an offer: its own type, or for pit work the smallest free dozer that's big enough. */
export function offerMachine(b: Pick<Biz, 'fleet'>, o: Offer): Machine | undefined {
  if (!o.gravel) return freeMachine(b, o.type);
  const min = PIT_DOZERS.indexOf(o.type);
  for (const t of PIT_DOZERS.slice(min)) {
    const m = freeMachine(b, t);
    if (m) return m;
  }
  return undefined;
}

/** This week's hire offers. fmul is how busy the work is (market.ts). */
export function genOffers(rand: Rand, b: Biz, fmul: number, won: boolean, won2: boolean): Offer[] {
  const T = TOWNS[b.town], out: Offer[] = [];
  const n = Math.max(2, Math.round((3 + int(rand, 0, 2)) * Math.min(1.25, fmul)));
  const contractors = HEAD_CONTRACTORS.filter((c) => !(b.blocked[c]! > b.week));
  const rf = rateFactor(b.rep, fmul);

  for (let i = 0; i < n; i++) {
    const x = rand();
    let kind: HireKind = x < 0.35 ? 'wet' : x < 0.6 ? 'dry' : x < 0.75 ? 'council' : 'private';
    if ((kind === 'wet' || kind === 'dry') && !contractors.length) kind = 'council';
    // suspended by the council: it rings someone else (the prototype keeps offering council work)
    if (kind === 'council' && !compat.prototype && barred(b, T.council)) kind = 'private';
    const y = rand();
    let type: MachineType = kind === 'council' || kind === 'private' ? 'grader' : y < 0.6 ? 'grader' : y < 0.8 ? 'roller' : y < 0.95 || !owns(b, 'truck') ? 'cart' : 'truck';
    // a bulk outfit: head contractors ring to hire its dozers, excavators and the like. With no grader that's every
    // call; in the real game a bulk outfit that's bought road gear still gets them, in step with how much bulk gear it runs
    const bulkGear = (b as { path?: string }).path === 'bulk' ? b.fleet.filter((m) => isBulk(m.type) && m.status !== 'auction').map((m) => m.type) : [];
    const roadGear = owns(b, 'grader');
    // the real game: the council rings for a dozer too, to push up gravel at its pit
    const dozers = compat.prototype || kind !== 'council' ? [] : b.fleet.filter((m) => COUNCIL_DOZERS.includes(m.type) && m.status !== 'auction').map((m) => m.type);
    const pit = dozers.length > 0 && rand() < (roadGear ? 0.5 : 0.8);
    if (pit) type = pick(rand, dozers);
    const bulkCall = !pit && bulkGear.length > 0 && (!roadGear || (!compat.prototype && rand() < Math.max(0.5, bulkGear.length / b.fleet.filter((m) => m.status !== 'auction').length)));
    if (bulkCall && contractors.length) {
      if (kind === 'council' || kind === 'private') kind = 'wet';
      type = pick(rand, bulkGear);
    }
    const place = pick(rand, T.places), id = uid(b), Ty = TYPES[type];
    if (kind === 'wet') {
      const client = pick(rand, contractors), days = int(rand, 8, 20), rate = round(Ty.wet * rf * (0.92 + rand() * 0.16), 50);
      out.push({ id, kind, type, place, client, days, rate, terms: CLIENTS[client]!.terms, fuelPaid: false });
    } else if (kind === 'dry') {
      const client = pick(rand, contractors), days = int(rand, 2, 6), rate = round(Ty.dry * rf * (0.92 + rand() * 0.16), 100);
      out.push({ id, kind, type, place, client, days, rate, terms: CLIENTS[client]!.terms });
    } else if (kind === 'council' && type !== 'grader') {
      // the job sets the dozer: up to the biggest you own, smaller jobs more often. The council pays that size's rate.
      const top = PIT_DOZERS.indexOf(type) >= 0 ? Math.max(...dozers.map((t) => PIT_DOZERS.indexOf(t as MachineType))) : 0;
      const want = Math.min(top, Math.floor(rand() ** 1.6 * (top + 1)));
      const rock = int(rand, 0, Math.min(2, want)) as 0 | 1 | 2;
      // enough gravel to want that size, never so much it needs a bigger one than they've rung you about
      const lo = Math.max(0.25, want - rock * 0.9), hi = want + 1 - rock * 0.9;
      const gravel = Math.max(1500, Math.min(Math.floor((hi * 6000 - 1) / 500) * 500, round((lo + rand() * (hi - lo)) * 6000, 500)));
      const need = pitDozer(gravel, rock), N = TYPES[need];
      const days = Math.max(3, Math.min(20, Math.ceil(gravel / (PIT_RATE[need]! * PIT_HARD[rock]))));
      const rate = round((N.wet + N.fuel) * 0.9 * (0.95 + rand() * 0.1), 10);
      out.push({ id, kind, type: need, place, client: T.council, days, rate, terms: 2, fuelPaid: true, gravel, rock });
    } else if (kind === 'council') {
      const days = int(rand, 12, 25), rate = round(225 * 9 * (0.95 + rand() * 0.1), 10);
      out.push({ id, kind, type, place, client: T.council, days, rate, terms: 2, fuelPaid: true });
    } else {
      const what = pick(rand, PRIVATE_JOBS), days = int(rand, 3, 8), fixed = round(days * (2100 + rand() * 500), 100);
      const needsRoller = what === 'Shed pad' || rand() < 0.3;
      out.push({ id, kind, type, place, client: what + ', ' + place, days, fixed, terms: 1, fuelPaid: true, needsRoller });
    }
  }

  // Word gets round that you've got gear: idle machines bring in their own dry-hire calls.
  if (won && contractors.length) {
    const idle = b.fleet.filter((m) => m.status === 'idle' && m.down === 0);
    const extra = Math.min(6, Math.round(idle.length * (won2 ? 0.6 : 0.3) * (0.6 + rand() * 0.8)));
    shuffled(rand, idle).slice(0, extra).forEach((m) => {
      const Ty = TYPES[m.type], client = pick(rand, contractors), place = pick(rand, T.places), id = uid(b);
      const days = int(rand, 2, 6), rate = round(Ty.dry * rf * (0.92 + rand() * 0.16), 100);
      out.push({ id, kind: 'dry', type: m.type, place, client, days, rate, terms: CLIENTS[client]!.terms, enq: true });
    });
  }
  return out;
}

export type WhyNot = 'busy' | 'noMachine' | 'noDriver' | null;

/** Why you can't take an offer, or null if you can. */
export function whyNot(b: Biz, o: Offer): WhyNot {
  const m = offerMachine(b, o);
  const fits = (t: string) => (o.gravel ? PIT_DOZERS.indexOf(t as MachineType) >= PIT_DOZERS.indexOf(o.type) : t === o.type);
  if (!m) return b.fleet.some((x) => fits(x.type) && x.status !== 'auction') ? 'busy' : 'noMachine';
  if (o.kind !== 'dry' && !freeDriver(b, m.type)) return 'noDriver';
  return null;
}

/** Float to get going: $600 for a private job, $1,100 otherwise. */
export function floatFor(kind: HireKind): number {
  return kind === 'private' ? 600 : 1100;
}

export function jobCost(b: Pick<Biz, 'acc'>, j: Job, amt: number): void {
  if (!amt) return;
  j.spent = (j.spent || 0) + amt;
  book(b.acc, 'jobCosts', amt);
}

function newJob(b: Biz, o: Offer, mId: string | null): Job {
  return { id: uid(b), kind: o.kind, type: o.type, client: o.client, place: o.place, days: o.days, done: 0, rate: o.rate || 0, fixed: o.fixed || 0,
    terms: o.terms, fuelPaid: !!o.fuelPaid, mId, who: null, rollerId: null, hireIn: 0, extra: 0, earned: 0, idleWeeks: 0 };
}

/** Take an offer: machine and driver go on it, plus a roller (yours, or hired in) if it needs one. */
export function accept(b: Biz, id: string): Job | null {
  const o = b.offers.find((x) => x.id === id);
  if (!o || whyNot(b, o)) return null;
  const m = offerMachine(b, o)!;
  // pit work: the dozer you send goes on the job (a bigger one burns more fuel for the same rate)
  const j = newJob(b, { ...o, type: m.type }, m.id);
  if (o.gravel) j.gravel = o.gravel;
  m.status = 'job';
  m.jobId = j.id;
  if (o.kind !== 'dry') {
    j.who = freeDriver(b, m.type);
    seat(b, j, j.who!);
  }
  if (o.needsRoller) {
    const rl = freeMachine(b, 'roller');
    if (rl) {
      rl.status = 'job';
      rl.jobId = j.id;
      j.rollerId = rl.id;
    } else j.hireIn = TYPES.roller.dry;
  }
  const fl = floatFor(o.kind);
  b.bank -= fl;
  jobCost(b, j, fl);
  b.jobs.push(j);
  b.offers = b.offers.filter((x) => x.id !== id);
  note(b, { k: 'tookOn', job: jobRef(j), float: fl });
  return j;
}

/** A day job this offer could be booked in behind: same machine type, 5 or fewer days to go, nothing booked yet. */
export function bookable(b: Biz, o: Offer): Job | null {
  if (!DAYJOB[o.kind]) return null;
  const c = b.jobs.filter((j) => {
    const m = b.fleet.find((x) => x.id === j.mId);
    return DAYJOB[j.kind] && !j.after && !j.finished && m && m.type === o.type && m.jobId === j.id && j.days - j.done <= 5 && !b.jobs.some((q) => q.after === j.id);
  });
  return c.sort((a, z) => a.days - a.done - (z.days - z.done))[0] ?? null;
}

/**
 * Will they wait? 80% for a day's wait, 10% less for each extra day, 25% less with rain on this week's forecast
 * (they want it done before it), a little more for private clients, less for the council's roster, more with a track record.
 */
export function waitOdds(b: Biz, wx: WeatherCtx, o: Offer, cur: Job): { p: number; wait: number; wet: number } {
  const wait = cur.days - cur.done;
  let wet = 0;
  for (let d = 0; d < 5; d++) wet = Math.max(wet, forecast(wx, b.week, d).pc);
  const p = 0.8 - 0.1 * Math.max(0, wait - 1) - (wet >= 50 ? 0.25 : 0) + (o.kind === 'private' ? 0.05 : o.kind === 'council' ? -0.1 : 0) + Math.min(0.1, (b.rep || 0) * 0.01);
  return { p: Math.max(0.1, Math.min(0.92, p)), wait, wet };
}

export type WaitAnswer = { yes: true; job: Job; wait: number } | { yes: false; why: 'rain' | 'roster' | 'tooLong' | 'someoneElse'; wait: number };

/** Ring the client. Yes books it in; no loses the job. */
export function askWait(rand: Rand, b: Biz, wx: WeatherCtx, id: string): WaitAnswer | null {
  const o = b.offers.find((x) => x.id === id);
  if (!o) return null;
  const cur = bookable(b, o);
  if (!cur) return null;
  const W = waitOdds(b, wx, o, cur);
  if (rand() < W.p) return { yes: true, job: bookIn(b, o, cur), wait: W.wait };
  const why = W.wet >= 50 ? 'rain' : o.kind === 'council' ? 'roster' : W.wait >= 4 ? 'tooLong' : 'someoneElse';
  b.offers = b.offers.filter((x) => x !== o);
  note(b, { k: 'saidNo', job: jobRef(o as never), why, wait: W.wait });
  return { yes: false, why, wait: W.wait };
}

export function bookIn(b: Biz, o: Offer, cur: Job): Job {
  const j = newJob(b, o, cur.mId);
  j.after = cur.id;
  j.needsRoller = !!o.needsRoller;
  const fl = floatFor(o.kind);
  b.bank -= fl;
  jobCost(b, j, fl);
  b.jobs.push(j);
  b.offers = b.offers.filter((x) => x.id !== o.id);
  note(b, { k: 'bookedIn', job: jobRef(j), after: jobRef(cur), float: fl });
  return j;
}

function person(b: Biz, id: string | null): Person | undefined {
  return id ? b.staff.find((p) => p.id === id) : undefined;
}

export type HireEvent =
  | { k: 'bookedNoMachine'; jobId: string; type: MachineType }
  | { k: 'downtime'; client: string; off: number }
  | { k: 'gaveUp'; client: string }
  | { k: 'finished'; jobId: string; kind: string; client: string; gain: number; earned: number }
  | { k: 'breakdown'; id: string; type: MachineType }
  | { k: 'late'; id: string; client: string; amt: number };

/** The machine and driver roll straight onto whatever was booked in behind this job. d = the day it started, if mid-week. */
export function handOver(b: Biz, j: Job, d: number | null, events: HireEvent[]): void {
  for (const q of b.jobs.filter((x) => x.after === j.id)) {
    let m = b.fleet.find((x) => x.id === q.mId);
    if (!m || m.status !== 'idle') m = freeMachine(b, q.type) || (m && m.status === 'idle' ? m : undefined);
    q.after = null;
    if (!m) {
      events.push({ k: 'bookedNoMachine', jobId: q.id, type: q.type });
      note(b, { k: 'bookedNoMachine', job: jobRef(q), type: q.type });
      b.jobs = b.jobs.filter((x) => x !== q);
      continue;
    }
    q.mId = m.id;
    m.status = 'job';
    m.jobId = q.id;
    const jp = person(b, j.who);
    const who = j.who && ((j.who === 'you' && !b.youJob) || (jp && !jp.jobId)) ? j.who : freeDriver(b, q.type);
    if (who) {
      q.who = who;
      seat(b, q, who);
    }
    if (q.needsRoller) {
      const rl = freeMachine(b, 'roller');
      if (rl) {
        rl.status = 'job';
        rl.jobId = q.id;
        q.rollerId = rl.id;
      } else q.hireIn = TYPES.roller.dry;
    }
    if (d != null) q.mob = { w: b.week, d };
  }
}

/** Free a finished job's machines and people straight away, so whatever's waiting can start mid-week. */
export function freeUp(b: Biz, j: Job, d: number | null, events: HireEvent[]): void {
  j.freed = true;
  for (const id of [j.mId, j.rollerId, j.cartId, j.cart2Id, j.ldrId as string | undefined, ...(j.ownedIds || [])]) {
    const m = id ? b.fleet.find((x) => x.id === id) : undefined;
    if (m && m.jobId === j.id) {
      m.status = 'idle';
      m.jobId = null;
    }
  }
  for (const p of b.staff) if (p.jobId === j.id) p.jobId = null;
  if (b.youJob === j.id) b.youJob = null;
  handOver(b, j, d, events);
}

/** Off the books: machines and people back, and whatever's booked behind it starts. */
export function release(b: Biz, j: Job, events: HireEvent[]): void {
  // a contract's roads: fixed if it finished, back to damaged if it was cut short or never done
  if (j.mapIds && b.dmap) mapDone(b.dmap, j.mapIds as string[], !!j.finished && !j.cut, b.week);
  for (const id of [j.mId, j.rollerId, j.cartId, j.cart2Id, j.ldrId as string | undefined]) {
    const m = id ? b.fleet.find((x) => x.id === id) : undefined;
    if (m && (m.jobId === j.id || (!j.freed && m.jobId == null))) {
      m.status = 'idle';
      m.jobId = null;
    }
  }
  for (const id of j.ownedIds || []) {
    const m = b.fleet.find((x) => x.id === id);
    if (m && m.jobId === j.id) {
      m.status = 'idle';
      m.jobId = null;
    }
  }
  for (const p of b.staff) if (p.jobId === j.id) p.jobId = null;
  if (b.youJob === j.id) b.youJob = null;
  b.jobs = b.jobs.filter((x) => x.id !== j.id);
  if (j.after) return;
  handOver(b, j, null, events);
}

/** Send an invoice. The council takes 4 weeks longer while flood funding is frozen. */
export function invoice(b: Biz, client: string, amt: number, terms: number, rep: { invoiced: number }): void {
  if (amt <= 0) return;
  if (frozen(b) && client === TOWNS[b.town].council) terms += 4;
  b.recv.push({ id: uid(b), client, amt: Math.round(amt), due: b.week + terms, lateRolled: false });
  rep.invoiced += amt;
}

/** The driver's off and nobody's covering. */
export function driverOff(b: Biz, j: Job): boolean {
  if (j.kind === 'dry') return false;
  if (j.who === 'you') return b.youBlocked > 0;
  const p = person(b, j.who);
  if (!p) return true;
  return p.off > 0 && !(b.opCover > 0 && b.coverFor === p.id);
}

/**
 * A driver off hurt or sick, with nobody covering: anyone free who drives that machine takes the seat, so the
 * job keeps going. You only cover if you choose to on the card. Returns who swapped in.
 */
export function coverOff(b: Biz): { jobId: string; from: string; to: string }[] {
  const out: { jobId: string; from: string; to: string }[] = [];
  for (const j of b.jobs) {
    if (j.finished || j.after || !DAYJOB[j.kind] || !j.who || j.who === 'you' || !driverOff(b, j)) continue;
    const p = b.staff.find((x) => !x.jobId && x.off === 0 && ROLES[x.role].drives.includes(j.type));
    if (!p) continue;
    const old = person(b, j.who);
    if (old) old.jobId = null;
    p.jobId = j.id;
    out.push({ jobId: j.id, from: j.who, to: p.id });
    j.who = p.id;
  }
  return out;
}

export interface WeekReport {
  worked: number;
  lost: number;
  invoiced: number;
  paid: number;
  costs: number;
}

/**
 * One day on a hire job. Returns false for jobs that aren't hire work (contracts run their own day).
 * downDays counts dry-hire days lost to breakdowns, which the client knocks off the week.
 */
export function hireDay(rand: Rand, b: Biz, j: Job, d: number, wet: boolean, w: WorkshopCtx, rep: WeekReport, downDays: Record<string, number>, events: HireEvent[], contract?: () => void): boolean {
  const c0 = rep.costs;
  const run = (): boolean => {
    if (j.finished || j.after) return true;
    if ((j.stood ?? 0) > 0) {
      if (!wet) rep.lost++;
      return true;
    }
    if (j.mob && j.mob.w === b.week && d <= j.mob.d) return true;
    // your tank's dry: work you fuel yourself waits on the fuel truck today
    if (fuelIdle(b, d) && (j.fuelPaid || ((j.kind === 'sub' || j.kind === 'own') && j.state !== 'subbed'))) {
      if (!wet) rep.lost++;
      return true;
    }
    // contracts run their own day (contracts.ts), inside the same cost wrapper
    if (j.state === 'subbed' || j.kind === 'own') {
      if (!contract) return false;
      contract();
      return true;
    }
    const m = b.fleet.find((x) => x.id === j.mId);
    if (!m) return true;
    if (j.kind === 'sub') {
      if (!contract) return false;
      contract();
      return true;
    }
    const working = m.down === 0 || m.cover > 0;
    const brk = (x: Machine, mult: number) => {
      if (breaks(rand, x, mult, w)) {
        breakdown(rand, x, w, b.acc);
        b.queue.push({ k: 'break', id: x.id });
        events.push({ k: 'breakdown', id: x.id, type: x.type });
      }
    };
    if (j.kind === 'dry') {
      if (wet) return true;
      if (!working) {
        downDays[j.id] = (downDays[j.id] || 0) + 1;
        return true;
      }
      // their operator, your wear: harder than yours
      if (m.down === 0) {
        wear(m, 1.8, b.acc);
        brk(m, 1.5);
      }
      return true;
    }
    if (wet) return true;
    if (driverOff(b, j) || !working) {
      rep.lost++;
      return true;
    }
    j.done++;
    j.wkDays = (j.wkDays || 0) + 1;
    rep.worked++;
    if (j.kind !== 'private') j.wk = (j.wk || 0) + j.rate;
    if (j.fuelPaid) {
      b.bank -= TYPES[j.type].fuel;
      rep.costs += TYPES[j.type].fuel;
      fuelUse(b, TYPES[j.type].fuel);
    }
    const p = person(b, j.who), wm = p ? SKILLS[p.skill].wear : 1;
    if (m.down === 0) {
      wear(m, wm, b.acc);
      brk(m, wm);
    }
    if (j.rollerId) {
      const rl = b.fleet.find((x) => x.id === j.rollerId);
      if (rl) wear(rl, 1, b.acc);
    }
    if (j.done >= j.days) j.finished = true;
    return true;
  };
  const ok = run();
  jobCost(b, j, rep.costs - c0);
  return ok;
}

/** A finished job goes in the job log (last 40), for the year in review. */
export function jobDone(b: Biz, j: Job): void {
  if (!j.finished || j.jlog) return;
  j.jlog = 1;
  b.jlog = b.jlog || [];
  b.jlog.unshift({ w: b.week, kind: (j.major ? 'major' : j.kind) as string, client: j.client, rev: Math.round(j.earned || 0), cost: Math.round(j.spent || 0),
    plan: j.planCost ? Math.round(j.planCost as number) : null, oh: (j.planOH as number) || 0, cut: !!j.cut, sub: j.state === 'subbed', part: !!j.part0,
    tn: { kind: j.kind, type: j.type, client: j.client, place: j.place, nm: j.nm, major: j.major, prestige: j.prestige } });
  if (b.jlog.length > 40) b.jlog.length = 40;
}

/**
 * Money coming in. Each invoice that's due gets one roll at being paid late (head contractors only,
 * at most one late card per client every 8 weeks). lateMult is the difficulty's; the numbers person halves it.
 */
export function recvWeek(rand: Rand, b: Biz, rep: WeekReport, lateMult: number, numbers: boolean, events: HireEvent[]): void {
  for (const x of b.recv.slice()) {
    if (x.due > b.week) continue;
    const c = CLIENTS[x.client];
    if (c && !x.lateRolled && !((b.lateCd || {})[x.client]! > b.week) && rand() < c.late * lateMult * (numbers ? 0.5 : 1)) {
      (b.lateCd = b.lateCd || {})[x.client] = b.week + 8;
      x.lateRolled = true;
      x.due = 9999;
      b.queue.push({ k: 'late', id: x.id });
      events.push({ k: 'late', id: x.id, client: x.client, amt: x.amt });
      continue;
    }
    b.bank += x.amt;
    rep.paid += x.amt;
    b.stats.earned += x.amt;
    b.recv = b.recv.filter((y) => y.id !== x.id);
    if (x.adm) book(b.acc, 'badDebts', -x.amt);
  }
}

// ---------- the late-payer card ----------

/** Chase it under security of payment: paid in 3 weeks, but they won't use you for 26, and standing −3. */
export function lateChase(b: Biz, x: Receivable): void {
  x.due = b.week + 3;
  b.blocked[x.client] = b.week + 26;
  relAdd(b, x.client, -3);
}

/** Ring the boss: half now, the rest in 4 weeks. Returns what came in. */
export function lateFriendly(b: Biz, x: Receivable): number {
  const h = Math.round(x.amt / 2);
  b.bank += h;
  book(b.acc, 'collections', h);
  x.amt -= h;
  x.due = b.week + 4;
  return h;
}

/** Your machine's on hire to them: park it until they pay. Paid in full, the hire ends, no calls for 10 weeks. */
export function latePark(b: Biz, x: Receivable, onHire: Job, events: HireEvent[]): void {
  b.bank += x.amt;
  book(b.acc, 'collections', x.amt);
  b.recv = b.recv.filter((y) => y.id !== x.id);
  release(b, onHire, events);
  b.blocked[x.client] = b.week + 10;
}

/** Wait it out: 70% it's in the next pay run (2 weeks), otherwise another 6. */
export function lateWait(rand: Rand, b: Biz, x: Receivable): 'soon' | 'later' {
  if (rand() < 0.7) {
    x.due = b.week + 2;
    return 'soon';
  }
  x.due = b.week + 6;
  return 'later';
}

/** Start of the week: every job's weekly takings and days go back to zero. */
export function startWeek(b: Pick<Biz, 'jobs'>): void {
  for (const j of b.jobs) {
    j.wk = 0;
    j.wkDays = 0;
  }
}
