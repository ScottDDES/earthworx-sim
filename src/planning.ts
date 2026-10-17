// Planning a council job. A crew is graders, rollers, water carts and trucks. Water carts keep the graders at pace;
// trucks bring gravel in for the rollers to place. The plan sets the crew-days, the weeks (losing the expected
// rain days for the season), and the cost. Flood recovery programs are planned crew by crew, road by road,
// with floats between roads that are far apart.
// Nothing here writes sentences: what's holding a plan up comes back as codes and numbers.

import { monthIdx } from './calendar';
import { TYPES, type Machine, type MachineType } from './machines';
import { fillRoles, type CrewFill, type Person, type Role } from './staff';
import { MOB, STD_CREW_DAY, TREAT, gradeDays, type Quantities } from './tenders';
import { TOWNS, type TownId } from './towns';
import { YARDS, type YardId } from './yards';
import type { Job } from './hire';
import { int, type Rand } from './rng';

/** Normal water run (km), a hired truck's day, a site's weekly running cost. */
export const WATER_STD_KM = 6;
export const TRUCK_DAY = 1860;
export const SITE_WEEK = 1200;
/** Floats: roads further apart than this need the gear floated, costing this much and half a day. */
export const FLOAT_KM = 12;
export const FLOAT_MOVE = 1600;
export const FLOAT_DAYS = 0.5;

const round = (n: number, to: number) => Math.round(n / to) * to;

/** Loads a cart gets in a day: a 30-minute fill and spread plus 3 minutes a km of water run. */
export function cartLoads(km: number): number {
  return 540 / (30 + km * 3);
}
/** m³ a truck brings in a day: 15 m³ a load, 20 minutes to load and tip plus 2 minutes a km of haul. */
export function truckM3(haul: number): number {
  return (15 * 540) / (20 + haul * 2);
}
/** A crew's pace in graders: each grader needs its own roller. */
export function crewMul(x: { graders?: number; rollers?: number }): number {
  return Math.min(x.graders || 1, x.rollers || 1);
}
export function waterNeed(mul: number): number {
  return mul > 1 ? 3 : 2;
}
/** Past a normal water run each cart gets fewer loads in, so it counts as less than a whole cart. */
export function cartEff(km: number): number {
  return Math.min(1, cartLoads(km) / cartLoads(WATER_STD_KM));
}

export interface Flow {
  mul: number;
  /** Water factor: the share of full pace the carts allow. */
  wf: number;
  /** Graders' output. */
  out: number;
  /** m³ a day the crew could place, and the trucks bring. */
  need: number;
  supply: number;
  sheetRate: number;
  /** Gravel factor. */
  gf: number;
}

export function flow(mul: number, carts: number, trucks: number, waterKm: number, haul: number): Flow {
  const wf = Math.max(0.2, Math.min(1, 1 - 0.33 * (waterNeed(mul) - carts * cartEff(waterKm))));
  const need = TREAT.resheet.per * mul * wf, supply = trucks * truckM3(haul);
  return { mul, wf, out: mul * wf, need, supply, sheetRate: Math.max(1, Math.min(need, supply)), gf: Math.min(1, supply / need) };
}

/** Hire mode per machine type on a plan: dry (hire the machine, your casual drives) or wet (a subbie with operator). */
export function hm(x: { hm?: Record<string, string> | null }, k: string): 'wet' | 'dry' {
  return (x.hm && (x.hm[k] as 'wet' | 'dry')) || 'dry';
}

export type Counts = Record<MachineType, number>;

/** The career a plan reads. */
export interface PlanCtx {
  town: TownId;
  week: number;
  yard: YardId;
  fleet: Machine[];
  jobs: Job[];
  staff: Person[];
  youJob: string | null;
}

/** Week a job will finish at its usual pace. */
export function jobEnds(p: PlanCtx, j: Job): number {
  const left = Math.max(0, j.days - j.done);
  return p.week + (j.kind === 'dry' ? left : Math.ceil(left / (j.kind === 'sub' ? 3.5 : 4)));
}

/** Your machines that will be free by a week: not being sold, and not on a contract or a job ending later. */
export function planCounts(p: PlanCtx, start: number): Counts {
  const o: Counts = { grader: 0, roller: 0, cart: 0, truck: 0 };
  for (const m of p.fleet) {
    const mj = m.jobId ? p.jobs.find((j) => j.id === m.jobId) : undefined;
    if (m.status === 'auction' || m.status === 'listed' || (mj && (mj.kind === 'own' || jobEnds(p, mj) >= (start || p.week)))) continue;
    o[m.type]++;
  }
  return o;
}

export function ownedCounts(fleet: readonly Machine[]): Counts {
  const o: Counts = { grader: 0, roller: 0, cart: 0, truck: 0 };
  for (const m of fleet) if (m.status !== 'auction' && m.status !== 'listed' && m.status !== 'branch') o[m.type]++;
  return o;
}

/** Machines away (on other jobs or at the branch) by a week. */
export function awayCounts(p: PlanCtx, start: number): number {
  const a = ownedCounts(p.fleet), b = planCounts(p, start);
  return (['grader', 'roller', 'cart', 'truck'] as const).reduce((n, k) => n + a[k] - b[k], 0);
}

/** People who could go on a crew: you (as a grader operator) and your staff. freeOnly: only those not on a job. */
export function crewPeople(p: PlanCtx, freeOnly: boolean): { id: string; role: Role }[] {
  const out: { id: string; role: Role }[] = !freeOnly || !p.youJob ? [{ id: 'you', role: 'grader' }] : [];
  for (const s of p.staff) if (!freeOnly || (!s.jobId && s.off === 0)) out.push({ id: s.id, role: s.role });
  return out;
}

/** Calendar weeks to get through `days` of crew work from week w, losing the expected rain days (wetMult for a wet year). */
export function weeksFor(town: TownId, days: number, w: number, wetMult: number): number {
  let left = days, n = 0;
  while (left > 0 && n < 104) {
    left -= 5 * (1 - Math.min(0.9, (TOWNS[town].rainDays[monthIdx(w + n)]! / 30) * wetMult));
    n++;
  }
  return n;
}

/** A road on a council package or program. */
export interface PlanRoad extends Quantities {
  name: string;
  L: number;
  mapId?: string | null;
  haul?: number;
  water?: number;
  x?: number;
  y?: number;
  lfg: number;
}

export interface Pit {
  name: string;
  haul: number;
  royalty: number;
  /** Gravel borderline on spec. */
  marginal: boolean;
  note: string;
}

/** A crew on a program. sub: a local outfit's whole crew. */
export interface ProgCrew {
  sub: boolean;
  gr: number;
  ro: number;
  ca: number;
  tr: number;
  /** Road indexes, in order. */
  seq: number[];
}

export interface Plan {
  crews: number;
  graders?: number;
  rollers?: number;
  carts: number;
  trucks: number;
  pit: number;
  subs?: number;
  hm?: Record<string, 'wet' | 'dry'>;
  /** Cap on how many of your own machines of each type go on it. */
  own?: Partial<Counts>;
  /** Programs: crew by crew. */
  prog?: { crews: ProgCrew[] };
}

export interface CouncilTender {
  id: string;
  roads: PlanRoad[];
  q: Quantities & { lfg: number };
  km: number;
  waterKm: number;
  close: number;
  mk: number;
  bid: number | null;
  pits: Pit[];
  pl: Plan;
  weeks: number;
  /** Subbie crews available, their pace and day rate. */
  subAvail?: number;
  subPace?: number;
  subRate?: number;
  /** A flood recovery program (an area, planned crew by crew). */
  major?: boolean;
  area?: string;
  lot?: number;
  lots?: number;
  stdCrews?: number;
  prestige?: boolean;
  dlWeek?: number;
  dlYear?: number;
  oh?: number | null;
  mine?: { method: number; oh: number; cost: number; pl: Plan };
  result?: import('./tenders').TenderResult[];
}

/** A local outfit's whole crew, per working day: dearer than your own gear, cheaper than hiring a crew in. */
export function subCrewRate(t: Pick<CouncilTender, 'q'>): number {
  const u = gradeDays(t.q) + t.q.resheet / TREAT.resheet.per, sh = u ? t.q.resheet / TREAT.resheet.per / u : 0;
  return round(STD_CREW_DAY * 1.3 + 2 * TRUCK_DAY * sh, 50);
}

/** How many subbie crews are free for it, their pace and rate. Set once. */
export function subCrewTerms(rand: Rand, t: CouncilTender): void {
  if (t.subRate) return;
  t.subAvail = t.major ? int(rand, 2, 4) : int(rand, 1, 2);
  t.subPace = Math.round((0.8 + rand() * 0.1) * 100) / 100;
  t.subRate = subCrewRate(t);
}

export function roadDist(a: { x?: number; y?: number } | null | undefined, b: { x?: number; y?: number } | null | undefined): number {
  return Math.sqrt(Math.pow((a ? a.x ?? 0 : 0) - (b ? b.x ?? 0 : 0), 2) + Math.pow((a ? a.y ?? 0 : 0) - (b ? b.y ?? 0 : 0), 2));
}

export function roadUnits(rd: Quantities): number {
  return gradeDays(rd) + rd.resheet / TREAT.resheet.per;
}

/** What's holding a crew up on a road. */
export type Block = 'ok' | 'water' | 'gravel' | 'idle';

/** Crew-days on one road for one crew (grading and gravel), and what's holding it up. */
export function crewRoad(t: Pick<CouncilTender, 'subPace'>, c: Pick<ProgCrew, 'sub' | 'gr' | 'ro' | 'ca' | 'tr'>, rd: PlanRoad): { g: number; s: number; b: Block; fl: Flow | null } {
  if (c.sub) {
    const pc = t.subPace || 0.85;
    return { g: gradeDays(rd) / pc, s: rd.resheet / (TREAT.resheet.per * pc), b: 'ok', fl: null };
  }
  const fl = flow(Math.min(c.gr, c.ro), c.ca, c.tr, rd.water!, rd.haul!), g = gradeDays(rd) / fl.out, s = rd.resheet ? rd.resheet / fl.sheetRate : 0;
  const b: Block = fl.wf < 0.999 ? 'water' : rd.resheet && fl.gf < 0.95 ? 'gravel' : rd.resheet >= 600 && fl.supply > fl.need * 1.6 ? 'idle' : 'ok';
  return { g, s, b, fl };
}

/** A new crew sized for the program's typical road: enough carts for the water, enough trucks for the gravel. */
export function newCrew(t: Pick<CouncilTender, 'roads'>, sub: boolean): ProgCrew {
  const hz = t.roads.map((x) => x.haul!).sort((a, b) => a - b), wz = t.roads.map((x) => x.water!).sort((a, b) => a - b);
  const mh = hz[hz.length >> 1] || 10, mw = wz[wz.length >> 1] || 6;
  const c: ProgCrew = { sub: !!sub, gr: 1, ro: 1, ca: 2, tr: 2, seq: [] };
  while (c.ca < 4 && flow(1, c.ca, c.tr, mw, mh).wf < 1) c.ca++;
  while (c.tr < 8 && flow(1, c.ca, c.tr, mw, mh).gf < 1) c.tr++;
  return c;
}

/** Each crew works its roads nearest-first, starting from the yard. */
export function tidyCrew(t: Pick<CouncilTender, 'roads'>, c: ProgCrew): void {
  const left = c.seq.slice(), out: number[] = [];
  let at: { x?: number; y?: number } = { x: 0, y: 0 };
  while (left.length) {
    left.sort((a, b) => roadDist(at, t.roads[a]) - roadDist(at, t.roads[b]));
    const nx = left.shift()!;
    out.push(nx);
    at = t.roads[nx]!;
  }
  c.seq = out;
}

/** Split the roads into n patches by direction from the yard and workload, then order each patch nearest-first. */
export function autoPlan(t: Pick<CouncilTender, 'roads' | 'subPace'>, n: number, keep?: ProgCrew[]): { crews: ProgCrew[] } {
  const crews = keep && keep.length ? keep.slice(0, n) : [];
  while (crews.length < n) crews.push(newCrew(t, false));
  for (const c of crews) c.seq = [];
  let cx = 0, cy = 0;
  for (const rd of t.roads) {
    cx += rd.x!;
    cy += rd.y!;
  }
  cx /= t.roads.length;
  cy /= t.roads.length;
  const idx = t.roads.map((_, i) => i).sort((a, b) => Math.atan2(t.roads[a]!.y! - cy, t.roads[a]!.x! - cx) - Math.atan2(t.roads[b]!.y! - cy, t.roads[b]!.x! - cx));
  let tot = 0;
  for (const i of idx) tot += roadUnits(t.roads[i]!);
  const speed = crews.map((c) => (c.sub ? t.subPace || 0.85 : Math.min(c.gr, c.ro))), sp = speed.reduce((a, x) => a + x, 0);
  let ci = 0, acc = 0;
  for (const i of idx) {
    const u = roadUnits(t.roads[i]!);
    if (ci < n - 1 && acc + u / 2 > (tot * speed.slice(0, ci + 1).reduce((a, x) => a + x, 0)) / sp) ci++;
    crews[ci]!.seq.push(i);
    acc += u;
  }
  for (const c of crews) tidyCrew(t, c);
  return { crews };
}

export interface CostBreakdown {
  fuel: number;
  labour: number;
  wear: number;
  hire: number;
  subbies: number;
  trucks: number;
  royalty: number;
  mob: number;
  site: number;
  subcrews: number;
  floats?: number;
}

/** What's holding a plan up. */
export type Bott =
  | { k: 'roller'; graders: number; rollers: number }
  | { k: 'water'; mul: number; carts: number; waterKm: number; wf: number; long: boolean }
  | { k: 'gravel'; trucks: number; supply: number; need: number }
  | { k: 'idle'; why: 'trucks' | 'rollers'; supply?: number; need?: number; graders?: number; rollers?: number }
  | { k: 'ok' }
  | { k: 'issue'; issue: Issue };

/** A program's problem, worst first. lost: crew-days it costs. crew: which crew (−1 for the whole program). */
export type Issue =
  | { k: 'unassigned'; lost: number; crew: -1; n: number }
  | { k: 'water'; lost: number; crew: number; road: number; carts: number; waterKm: number; wf: number }
  | { k: 'gravel'; lost: number; crew: number; road: number; trucks: number; haul: number; supply: number; need: number }
  | { k: 'trucksIdle'; lost: number; crew: number; road: number; haul: number; needTrucks: number; trucks: number }
  | { k: 'floats'; lost: number; crew: number; floats: number }
  | { k: 'spread'; lost: number; crew: -1; weeks: number };

export interface CrewResult {
  i: number;
  roads: { ri: number; start: number; days: number; g: number; s: number; b: Block; lost: number; fl: Flow | null; float: number }[];
  days: number;
  sheet: number;
  floats: number;
  /** Weeks in a normal year and a wet one. */
  wk: number;
  wet: number;
  /** Cost per working day, per sheeting day, and per week of hire-ins. */
  day: number;
  sheetDay: number;
  week: number;
  /** Breakdown allowance. */
  bf?: number;
}

export interface PlanEval {
  prog?: boolean;
  res?: CrewResult[];
  issues?: Issue[];
  unassigned?: number[];
  need?: Counts | null;
  floatsN?: number;
  SC: number;
  ownShare: number;
  fl: Flow | null;
  gDays: number;
  sDays: number;
  cd: number;
  perCrew: number;
  wks: number;
  wetWks: number;
  hire: Partial<Record<'grader' | 'roller' | 'cart', number>>;
  wet: Partial<Record<'grader' | 'roller' | 'cart', number>>;
  subDay: number;
  hireWeek: number;
  casuals: number;
  crew: CrewFill;
  ownTrucks: number;
  hiredTrucks: number;
  c: CostBreakdown;
  cost: number;
  /** Program points, 0, 3 or 6: finishing a week early scores 6, on time 3. */
  method: number;
  bott: Bott;
}

/** Subbie (wet hire) day rate for one machine. */
export function subRate(k: MachineType): number {
  return TYPES[k].sub;
}

/** A flood recovery program, crew by crew and road by road. */
export function progEval(p: PlanCtx, t: CouncilTender, pl: Plan, owned: Partial<Counts>, people: { id: string; role: Role }[]): PlanEval {
  const P = pl.prog!, crews = P.crews, start = t.close + 1, own = crews.filter((c) => !c.sub);
  const need: Counts = { grader: 0, roller: 0, cart: 0, truck: 0 };
  for (const c of own) {
    need.grader += c.gr;
    need.roller += c.ro;
    need.cart += c.ca;
    need.truck += c.tr;
  }
  const left: Counts = { grader: owned.grader || 0, roller: owned.roller || 0, cart: owned.cart || 0, truck: owned.truck || 0 };
  const hire = { grader: 0, roller: 0, cart: 0 }, wet = { grader: 0, roller: 0, cart: 0 };
  let pool = people.slice();
  const wearDay = round(120 * YARDS[p.yard].svc, 10);
  const c: CostBreakdown = { fuel: 0, labour: 0, wear: 0, hire: 0, subbies: 0, trucks: 0, royalty: 0, mob: own.length * 2 * MOB, site: 0, subcrews: 0, floats: 0 };
  const res: CrewResult[] = [];
  let allUsed: string[] = [], casualsN = 0, ownTrucks = 0, hiredTrucks = 0, cdAll = 0, gAll = 0, sAll = 0, floatsN = 0;
  const assigned: Record<number, number> = {};
  crews.forEach((cr, i) => {
    const R: CrewResult = { i, roads: [], days: 0, sheet: 0, floats: 0, wk: 0, wet: 0, day: 0, sheetDay: 0, week: 0 };
    let at: { x?: number; y?: number } = { x: 0, y: 0 };
    for (const ri0 of cr.seq) {
      const rd = t.roads[ri0];
      if (!rd) continue;
      assigned[ri0] = 1;
      const fd = cr.seq.indexOf(ri0) > 0 && roadDist(at, rd) > FLOAT_KM ? FLOAT_DAYS : 0;
      const x = crewRoad(t, cr, rd), ideal = crewRoad(t, { sub: false, gr: cr.gr, ro: cr.ro, ca: 4, tr: 12 }, rd);
      R.roads.push({ ri: ri0, start: R.days + fd, days: x.g + x.s, g: x.g, s: x.s, b: x.b, lost: cr.sub ? 0 : Math.max(0, x.g + x.s - ideal.g - ideal.s), fl: x.fl, float: fd });
      R.days += fd + x.g + x.s;
      R.sheet += x.s;
      if (fd) R.floats++;
      gAll += x.g;
      sAll += x.s;
      at = rd;
      c.royalty += rd.resheet * (rd.haul! < 12 ? 5 : 3);
    }
    // Breakdowns: your own gear stops a crew now and then; the older it is, the more often.
    const oc = p.fleet.filter((m) => m.type !== 'truck' && m.status !== 'auction' && m.status !== 'listed');
    const cond = oc.length ? oc.reduce((a, m) => a + m.cond, 0) / oc.length : 85;
    R.bf = cr.sub ? 1.02 : 1 + 0.04 + Math.max(0, 85 - cond) * 0.004;
    R.wk = R.days ? weeksFor(p.town, R.days * R.bf, start, 1) : 0;
    R.wet = R.days ? weeksFor(p.town, R.days * R.bf, start, 1.6) : 0;
    if (cr.sub) {
      R.day = t.subRate || 0;
      c.subcrews += Math.round(R.days * R.day);
    } else {
      const cfg = { grader: cr.gr, roller: cr.ro, cart: cr.ca }, seats = { grader: 0, roller: 0, cart: 0 };
      let fuelDay = 0, subDay = 0, hireWeek = 0, ownUsed = 0;
      for (const k of ['grader', 'roller', 'cart'] as const) {
        const o = Math.min(cfg[k], left[k]);
        left[k] -= o;
        ownUsed += o;
        const sh = cfg[k] - o;
        if (hm(pl, k) === 'wet') {
          wet[k] += sh;
          subDay += sh * subRate(k);
          seats[k] = o;
        } else {
          hire[k] += sh;
          hireWeek += sh * TYPES[k].dry;
          seats[k] = cfg[k];
        }
        fuelDay += seats[k] * TYPES[k].fuel;
      }
      const ot = Math.min(cr.tr, left.truck);
      left.truck -= ot;
      ownTrucks += ot;
      hiredTrucks += cr.tr - ot;
      ownUsed += ot;
      const fr = fillRoles({ grader: seats.grader, roller: seats.roller, cart: seats.cart, truck: ot }, pool);
      pool = pool.filter((x) => !fr.used.includes(x.id));
      allUsed = allUsed.concat(fr.used);
      casualsN += fr.casuals;
      R.day = fuelDay + fr.casualDay + subDay;
      R.sheetDay = (cr.tr - ot) * TRUCK_DAY + ot * TYPES.truck.fuel + fr.truckCasualDay;
      R.week = hireWeek;
      c.fuel += Math.round(R.days * fuelDay + R.sheet * ot * TYPES.truck.fuel);
      c.labour += Math.round(R.days * fr.casualDay + R.sheet * fr.truckCasualDay);
      c.subbies += Math.round(R.days * subDay);
      c.trucks += Math.round(R.sheet * (cr.tr - ot) * TRUCK_DAY);
      c.hire += hireWeek * R.wk;
      c.wear += Math.round(R.days * ownUsed * wearDay);
      c.floats! += R.floats * FLOAT_MOVE;
    }
    floatsN += R.floats;
    cdAll += R.days;
    res.push(R);
  });
  const wks = res.reduce((a, x) => Math.max(a, x.wk), 0), wetWks = res.reduce((a, x) => Math.max(a, x.wet), 0);
  c.site = SITE_WEEK * wks;
  let total = 0;
  for (const k of Object.keys(c) as (keyof CostBreakdown)[]) total += c[k]!;
  const un = t.roads.map((_, i) => i).filter((i) => !assigned[i]);
  const method = un.length ? 0 : wks <= t.weeks - 1 ? 6 : wks <= t.weeks ? 3 : 0;

  // what's holding it up
  const issues: Issue[] = [];
  for (const R of res) {
    const cr = crews[R.i]!;
    for (const x of R.roads) {
      if (x.b === 'ok' || x.lost <= 0.4) continue;
      const rd = t.roads[x.ri]!;
      if (x.b === 'water') issues.push({ k: 'water', lost: x.lost, crew: R.i, road: x.ri, carts: cr.ca, waterKm: rd.water!, wf: x.fl!.wf });
      else if (x.b === 'gravel') issues.push({ k: 'gravel', lost: x.lost, crew: R.i, road: x.ri, trucks: cr.tr, haul: rd.haul!, supply: x.fl!.supply, need: x.fl!.need });
      else issues.push({ k: 'trucksIdle', lost: x.lost, crew: R.i, road: x.ri, haul: rd.haul!, needTrucks: Math.max(1, Math.ceil(x.fl!.need / truckM3(rd.haul!))), trucks: cr.tr });
    }
    if (R.floats >= 3) issues.push({ k: 'floats', lost: R.floats * FLOAT_DAYS, crew: R.i, floats: R.floats });
  }
  const fin = res.filter((R) => R.days).map((R) => R.wk);
  if (fin.length > 1) {
    const mx = Math.max(...fin), mn = Math.min(...fin);
    if (mx - mn >= 4) issues.push({ k: 'spread', lost: (mx - mn) * 2, crew: -1, weeks: mx - mn });
  }
  if (un.length) issues.unshift({ k: 'unassigned', lost: 999, crew: -1, n: un.length });
  issues.sort((a, b) => b.lost - a.lost);
  const bott: Bott = issues.length ? { k: 'issue', issue: issues[0]! } : { k: 'ok' };
  const allCrew = fillRoles({ grader: 0, roller: 0, cart: 0, truck: 0 }, []);
  allCrew.used = allUsed;
  return {
    prog: true, res, issues, unassigned: un, need, floatsN, SC: crews.filter((x) => x.sub).length, ownShare: 1,
    fl: null, gDays: gAll, sDays: sAll, cd: cdAll, perCrew: cdAll / Math.max(1, crews.length), wks, wetWks, hire, wet, subDay: 0, hireWeek: 0,
    casuals: casualsN, crew: allCrew, ownTrucks, hiredTrucks, c, cost: total, method, bott,
  };
}

/**
 * Evaluates a plan: crew-days, weeks, cost and what's holding it up. owned: your machines free for it
 * (default: what's free by the start week, capped by the plan); people: who can drive (default: you and staff
 * not on another council job).
 */
export function planEval(p: PlanCtx, t: CouncilTender, pl: Plan, owned?: Partial<Counts>, people?: { id: string; role: Role }[]): PlanEval {
  owned = owned || planCounts(p, t.close + 1);
  if (pl.own) {
    owned = { ...owned };
    for (const k of ['grader', 'roller', 'cart', 'truck'] as const) if (pl.own[k] != null) owned[k] = Math.min(owned[k] || 0, pl.own[k]!);
  }
  people = people || crewPeople(p, false).filter((x) => {
    const s = p.staff.find((y) => y.id === x.id), sj = s && s.jobId ? p.jobs.find((j) => j.id === s.jobId) : undefined;
    return !(sj && sj.kind === 'own');
  });
  if (pl.prog && t.major) return progEval(p, t, pl, owned, people);
  const G = pl.graders || 1, R = pl.rollers || 1, N = pl.crews;
  const pit = t.pits[pl.pit]!, fl = flow(crewMul(pl), pl.carts, pl.trucks, t.waterKm, pit.haul), q = t.q;
  let gDays = gradeDays(q) / fl.out, sDays = q.resheet / fl.sheetRate;
  // Subbie crews work alongside yours; the work splits by pace.
  const SC = Math.min(pl.subs || 0, t.subAvail || 0), U = gradeDays(q) + q.resheet / TREAT.resheet.per, rho = U / Math.max(0.01, gDays + sDays);
  const own = SC ? (N * rho) / (N * rho + SC * (t.subPace || 0.85)) : 1;
  gDays *= own;
  sDays *= own;
  const cd = gDays + sDays, perCrew = cd / N, sheetDays = sDays / N, start = t.close + 1;
  const wks = weeksFor(p.town, perCrew, start, 1), wetWks = weeksFor(p.town, perCrew, start, 1.6);
  const need = { grader: N * G, roller: N * R, cart: N * pl.carts }, hire: PlanEval['hire'] = {}, wet: PlanEval['wet'] = {};
  let hireWeek = 0, subDay = 0, ownUsed = 0, fuelDay = 0;
  for (const k of ['grader', 'roller', 'cart'] as const) {
    const short = Math.max(0, need[k] - (owned[k] || 0));
    ownUsed += need[k] - short;
    if (hm(pl, k) === 'wet') {
      wet[k] = short;
      hire[k] = 0;
      subDay += short * subRate(k);
    } else {
      wet[k] = 0;
      hire[k] = short;
      hireWeek += short * TYPES[k].dry;
    }
    fuelDay += (need[k] - wet[k]!) * TYPES[k].fuel;
  }
  const ownTrucks = Math.min(owned.truck || 0, N * pl.trucks), hiredTrucks = N * pl.trucks - ownTrucks;
  const crew = fillRoles({ grader: need.grader - wet.grader!, roller: need.roller - wet.roller!, cart: need.cart - wet.cart!, truck: ownTrucks }, people);
  const wearDay = round(120 * YARDS[p.yard].svc, 10), casuals = crew.casuals;
  const c: CostBreakdown = {
    fuel: Math.round(perCrew * fuelDay + sheetDays * ownTrucks * TYPES.truck.fuel),
    labour: Math.round(perCrew * crew.casualDay + sheetDays * crew.truckCasualDay),
    wear: Math.round(perCrew * ownUsed * wearDay + sheetDays * ownTrucks * wearDay),
    hire: hireWeek * wks,
    subbies: Math.round(perCrew * subDay),
    trucks: Math.round(sheetDays * hiredTrucks * TRUCK_DAY),
    royalty: Math.round(q.resheet * pit.royalty),
    mob: pl.crews * 2 * MOB,
    site: SITE_WEEK * wks,
    subcrews: Math.round(SC * perCrew * (t.subRate || 0)),
  };
  let total = 0;
  for (const k of Object.keys(c) as (keyof CostBreakdown)[]) total += c[k]!;
  const method = wks <= t.weeks - 1 ? 6 : wks <= t.weeks ? 3 : 0;
  const mul = crewMul(pl);
  let bott: Bott;
  if (G > R) bott = { k: 'roller', graders: G, rollers: R };
  else if (fl.wf < 0.999) bott = { k: 'water', mul, carts: pl.carts, waterKm: t.waterKm, wf: fl.wf, long: cartEff(t.waterKm) < 1 };
  else if (q.resheet && fl.gf < 0.999) bott = { k: 'gravel', trucks: pl.trucks, supply: fl.supply, need: fl.need };
  else if (q.resheet && fl.supply > fl.need * 1.35) bott = { k: 'idle', why: 'trucks', supply: fl.supply, need: fl.need };
  else if (R > G) bott = { k: 'idle', why: 'rollers', graders: G, rollers: R };
  else bott = { k: 'ok' };
  return { SC, ownShare: own, fl, gDays, sDays, cd, perCrew, wks, wetWks, hire, wet, subDay, hireWeek, casuals, crew, ownTrucks, hiredTrucks, c, cost: total, method, bott };
}

/**
 * The plan a sensible rival would draw up: a standard crew count, a grader and roller each, enough carts and
 * trucks to keep up, from whichever pit and hire mode comes out cheapest, with their own gear for two graders,
 * a roller, two carts and a tipper, and three hands on wages.
 */
export function stdPlan(p: PlanCtx, t: CouncilTender): { pl: Plan; e: PlanEval } {
  let best: { pl: Plan; e: PlanEval } | null = null;
  for (const pit of [0, 1]) {
    for (const mode of ['dry', 'wet'] as const) {
      const pl: Plan = { crews: t.stdCrews || 2, graders: 1, rollers: 1, carts: 1, trucks: 1, pit, hm: { grader: mode, roller: mode, cart: mode } };
      while (pl.carts < 4 && flow(1, pl.carts, 1, t.waterKm, t.pits[pit]!.haul).wf < 1) pl.carts++;
      while (pl.trucks < 8 && flow(1, pl.carts, pl.trucks, t.waterKm, t.pits[pit]!.haul).gf < 1) pl.trucks++;
      const e = planEval(p, t, pl, { grader: 2, roller: 1, cart: 2, truck: 1 }, [{ id: 'a', role: 'grader' }, { id: 'b', role: 'grader' }, { id: 'c', role: 'roller' }]);
      if (!best || e.cost < best.e.cost) best = { pl, e };
    }
  }
  return best!;
}

/** The roads and quantities a program crew carries onto site, for the contract to work through. */
export function progRun(t: CouncilTender, pl: Plan, e: PlanEval) {
  return {
    floats: 0,
    crews: pl.prog!.crews.map((c, i) => {
      const R = e.res![i]!;
      return {
        sub: c.sub, gr: c.gr, ro: c.ro, ca: c.ca, tr: c.tr, day: R.day, sheetDay: R.sheetDay, week: R.week, k: 0, flt: 0, done: !c.seq.length,
        q: c.seq.map((ri0) => {
          const rd = t.roads[ri0]!;
          return { mapId: rd.mapId || null, n: rd.name, g: gradeDays(rd), s: rd.resheet, haul: rd.haul, water: rd.water, x: rd.x, y: rd.y, roy: rd.haul! < 12 ? 5 : 3 };
        }),
      };
    }),
  };
}
