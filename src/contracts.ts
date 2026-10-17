// Running contracts. A subbie job runs one crew (grader, roller, a water cart or two) on the head contractor's
// road, paid by the crew-day with 5% retention held until the end and damages if it's late. Your own council
// contract takes you (or a supervisor) full time: your machines go on, the rest is hired in, and it's claimed
// monthly on progress. A program runs crew by crew, road by road, against a 30 June deadline.
// Any contract waiting to start can be subbed out to a local outfit.
// Also here: the working day for every kind of job, the end of the day, and settling each job at the end of the week.

import { book } from './ledger';
import {
  driverOff, freeDriver, freeMachine, freeUp, hireDay, invoice, jobCost, jobDone, release, seat,
  type Biz, type HireEvent, type Job, type WeekReport,
} from './hire';
import { GPS_MUL, TYPES, breakdown, breaks, wear, type Machine, type MachineType, type WorkshopCtx } from './machines';
import { mapDone, type DistrictMap } from './map';
import { FLOAT_DAYS, FLOAT_KM, FLOAT_MOVE, SITE_WEEK, TRUCK_DAY, crewMul, crewPeople, flow, hm, roadDist, subRate, weeksFor, type PlanCtx } from './planning';
import { relAdd } from './relations';
import { int, type Rand } from './rng';
import { ROLES, fillRoles, type Person } from './staff';
import { LD_WEEK, MOB, RETAIN, TREAT } from './tenders';
import { LD_OWN } from './council';
import type { TownId } from './towns';
import type { YardId } from './yards';

/** The parts of a career contracts touch. */
export interface ContractBiz extends Biz {
  town: TownId;
  yard: YardId;
  dmap?: DistrictMap;
  subsDone?: number;
  lds?: number;
  ownDone?: number;
  ownLate?: number;
  majorDone?: number;
  prestigeDone?: number;
  /** What you owe subbies, and when. */
  payables?: { to: string; amt: number; due: number; ato?: boolean }[];
  /** The week the young gun is slow with swaps. */
  ygSlow?: number;
}

export type ContractEvent =
  | HireEvent
  | { k: 'terminated'; jobId: string; client: string }
  | { k: 'subPulled'; jobId: string; name: string }
  | { k: 'crewHome'; jobId: string; crew: number; sub: boolean; machines: number }
  | { k: 'halfway'; jobId: string; done: number; cut: number }
  | { k: 'deadline'; jobId: string; cut: number }
  | { k: 'subFinished'; jobId: string; late: number; ld: number; retained: number; extra: number; terms: number }
  | { k: 'finishPoints'; jobId: string; pts: number; council: boolean }
  | { k: 'ownFinished'; jobId: string; major: boolean; late: number; ld: number; gain: number; subbedTo: string | null; early: boolean };

const round = (n: number, to: number) => Math.round(n / to) * to;
const mach = (b: Biz, id: string | null | undefined): Machine | undefined => (id ? b.fleet.find((m) => m.id === id) : undefined);

function opsMgr(b: Biz): Person | undefined {
  return b.staff.find((p) => p.role === 'ops' && p.off === 0);
}
function freeStaff(b: Biz, type: MachineType): Person | undefined {
  return b.staff.find((p) => !p.jobId && p.off === 0 && ROLES[p.role].drives.includes(type));
}

/** A machine hired in, or a casual paid, owed to someone on terms. */
export function owe(b: ContractBiz, to: string, amt: number, wks: number, j?: Job): void {
  if (amt <= 0) return;
  if (j) {
    j.spent = (j.spent || 0) + amt;
    book(b.acc, 'jobCostsOwed', amt);
  }
  b.payables = b.payables || [];
  b.payables.push({ to, amt: Math.round(amt), due: b.week + wks });
}

// ---------- staffing ----------

/** A subbie crew's day: fuel, casuals in the seats your staff don't fill, and water for the gravel. */
export function subDayCost(j: Job): number {
  return TYPES.grader.fuel + TYPES.roller.fuel + (j.cart2Id ? 2 : 1) * TYPES.cart.fuel + ((j.cas as MachineType[]) || []).reduce((a, k) => a + ROLES[k as 'roller'].casual, 0)
    + Math.round(((j.gravel as number) * (j.cart as number)) / (j.base as number));
}

/** A new subcontract can take the second water cart off one that's running: that one hires a cart in instead. */
export function stealCart(b: ContractBiz): Machine | null {
  const x = b.jobs.find((o) => o.kind === 'sub' && o.state === 'running' && !o.finished && o.cart2Id && mach(b, o.cart2Id) && mach(b, o.cart2Id)!.down === 0);
  if (!x) return null;
  const m = mach(b, x.cart2Id)!;
  x.cart2Id = null;
  x.hireIn = TYPES.cart.dry;
  x.dayCost = subDayCost(x);
  m.status = 'idle';
  m.jobId = null;
  return m;
}

/** Signed subbie jobs start once a grader, roller, water cart and driver are free. dayNow: the day it happens, mid-week. */
export function staffSubs(b: ContractBiz, dayNow: number | null): void {
  for (const j of b.jobs) {
    if (j.kind !== 'sub' || j.state !== 'waiting') continue;
    const g = freeMachine(b, 'grader'), rl = freeMachine(b, 'roller'), d = freeDriver(b, 'grader');
    if (!g || !rl || !d) continue;
    const c = freeMachine(b, 'cart') || stealCart(b);
    if (!c) continue;
    for (const m of [g, rl, c]) {
      m.status = 'job';
      m.jobId = j.id;
    }
    j.mId = g.id;
    j.rollerId = rl.id;
    j.cartId = c.id;
    j.who = d;
    j.state = 'running';
    seat(b, j, d);
    if (dayNow != null) j.mob = { w: b.week, d: dayNow + 1 };
    // Leave a spare cart in the yard if another subcontract is waiting on one.
    const others = b.jobs.some((o) => o !== j && o.kind === 'sub' && o.state === 'waiting'), c2 = others ? null : freeMachine(b, 'cart');
    if (c2) {
      c2.status = 'job';
      c2.jobId = j.id;
      j.cart2Id = c2.id;
      j.hireIn = 0;
    } else j.hireIn = TYPES.cart.dry;
    // Your own staff take the roller and carts before you call labour hire.
    j.cas = [];
    for (const k of ['roller', 'cart', 'cart'] as const) {
      const p = freeStaff(b, k);
      if (p) p.jobId = j.id;
      else (j.cas as string[]).push(k);
    }
    j.dayCost = subDayCost(j);
    b.bank -= MOB;
    jobCost(b, j, MOB);
  }
  // A spare cart in the yard replaces a hired second cart, as long as nobody's waiting for it.
  if (!b.jobs.some((o) => o.kind === 'sub' && o.state === 'waiting')) {
    for (const j of b.jobs) {
      if (j.kind !== 'sub' || j.state !== 'running' || j.finished || j.cart2Id || !j.hireIn) continue;
      const c3 = freeMachine(b, 'cart');
      if (!c3) continue;
      c3.status = 'job';
      c3.jobId = j.id;
      j.cart2Id = c3.id;
      j.hireIn = 0;
      j.dayCost = subDayCost(j);
    }
  }
  seatStaff(b);
}

/** Staff who are free take over from labour-hire casuals on running jobs. */
export function seatStaff(b: ContractBiz): void {
  for (const j of b.jobs) {
    if (j.finished || j.state !== 'running') continue;
    if (j.kind === 'sub') {
      if (j.cas == null) {
        const on = b.staff.filter((p) => p.jobId === j.id && p.id !== j.who), cas: string[] = ['roller', 'cart', 'cart'];
        for (const p of on) {
          const at = cas.findIndex((k) => ROLES[p.role].drives.includes(k as MachineType));
          if (at >= 0) cas.splice(at, 1);
        }
        j.cas = cas;
      }
      const before = (j.cas as string[]).length;
      j.cas = (j.cas as MachineType[]).filter((k) => {
        const p = freeStaff(b, k);
        if (!p) return true;
        p.jobId = j.id;
        return false;
      });
      if ((j.cas as string[]).length !== before) j.dayCost = subDayCost(j);
    }
    if (j.kind === 'own' && (j.casuals as number) > 0) {
      if (j.casLeft == null) {
        const nd = (j.need as Record<string, number>) || { grader: (j.crews as number) * (j.graders as number), roller: (j.crews as number) * (j.rollers as number), cart: (j.crews as number) * (j.carts as number), truck: (j.ownTrucks as number) || 0 };
        const ppl = b.staff.filter((p) => p.jobId === j.id).map((p) => ({ id: p.id, role: p.role }));
        if (j.who === 'you') ppl.push({ id: 'you', role: 'grader' });
        j.casLeft = fillRoles(nd, ppl).left;
      }
      const casLeft = j.casLeft as Record<string, number>;
      for (const k of ['roller', 'cart', 'grader', 'truck'] as const) {
        while (casLeft[k]! > 0 && (j.casuals as number) > 0) {
          const p = freeStaff(b, k);
          if (!p) break;
          p.jobId = j.id;
          casLeft[k]!--;
          j.casuals = (j.casuals as number) - 1;
          const c = ROLES[k].casual;
          const prog = j.prog as Prog | null;
          if (prog) {
            const cr = prog.crews.find((x) => !x.sub && !x.done && (k === 'truck' ? x.sheetDay > c : x.day > c));
            if (cr) {
              if (k === 'truck') cr.sheetDay -= c;
              else cr.day -= c;
            }
          } else if (k === 'truck') j.truckCasualDay = Math.max(0, (j.truckCasualDay as number) - c);
          else j.casualDay = Math.max(0, (j.casualDay as number) - c);
        }
      }
    }
  }
}

/** Your machine goes onto a contract in place of a hire-in (or a subbie, on wet hire). */
export function swapIn(b: ContractBiz, j: Job, m: Machine, k: MachineType): void {
  const gap = j.gap as Record<string, number>;
  if (!(gap[k]! > 0) || m.status !== 'idle') return;
  m.status = 'job';
  m.jobId = j.id;
  (j.ownedIds as string[]).push(m.id);
  gap[k]!--;
  if (hm(j as { hm?: Record<string, string> }, k) === 'wet' && !j.prog) {
    j.subDay = Math.max(0, ((j.subDay as number) || 0) - subRate(k));
    const p = freeStaff(b, k);
    if (p) p.jobId = j.id;
    else {
      j.casualDay = (j.casualDay as number) + ROLES[k as 'roller'].casual;
      j.casuals = (j.casuals as number) + 1;
    }
    if (j.fuelCrew != null) j.fuelCrew = (j.fuelCrew as number) + TYPES[k].fuel / (j.crews as number);
  } else j.hireWeek = Math.max(0, (j.hireWeek as number) - TYPES[k].dry);
}

/**
 * Free machines of your own go onto a running contract in place of hire-ins. An operations manager does it
 * without asking (except the young gun's slow weeks); otherwise you get a card.
 */
export function topUpOwn(b: ContractBiz, j: Job): void {
  const gap = j.gap as Record<string, number> | undefined;
  if (!gap) return;
  const cap = j.ownCap as Record<string, number> | null;
  for (const k of ['grader', 'roller', 'cart'] as const) {
    while (gap[k]! > 0 && !(cap && cap[k] != null && (j.ownedIds as string[]).filter((id) => mach(b, id)?.type === k).length >= cap[k]!)) {
      const m = b.fleet.find((x) => x.type === k && x.status === 'idle' && x.down === 0);
      if (!m) break;
      const ops = opsMgr(b);
      if (!ops || b.ygSlow === b.week) {
        if (ops) break;
        const noSwap = j.noSwap as Record<string, number> | undefined;
        if (!(noSwap && noSwap[k]! > b.week) && !b.queue.some((q) => q.k === 'swapin' && q.id === j.id && q.type === k)) b.queue.push({ k: 'swapin', id: j.id, type: k });
        break;
      }
      swapIn(b, j, m, k);
    }
  }
}

/** Your own contracts start once you (or a supervisor or operations manager) are free to run them. */
export function staffOwn(b: ContractBiz, dayNow: number | null): void {
  for (const j of b.jobs) if (j.kind === 'own' && j.state === 'running' && !j.finished) topUpOwn(b, j);
  seatStaff(b);
  for (const j of b.jobs) {
    if (j.kind !== 'own' || j.state !== 'waiting') continue;
    const boss = !b.youJob ? 'you' : b.staff.find((p) => (p.role === 'super' || p.role === 'ops') && !p.jobId && p.off === 0)?.id;
    if (!boss) continue;
    const crews = j.crews as number;
    const need: Record<string, number> = j.need ? JSON.parse(JSON.stringify(j.need)) : { grader: crews * (j.graders as number), roller: crews * (j.rollers as number), cart: crews * (j.carts as number), truck: crews * (j.trucks as number) };
    j.hireWeek = 0;
    j.subDay = 0;
    j.ownedIds = [];
    j.ownTrucks = 0;
    const wet: Record<string, number> = { grader: 0, roller: 0, cart: 0 };
    let fuelDay = 0;
    const cap = j.ownCap as Record<string, number> | null;
    for (const k of ['grader', 'roller', 'cart', 'truck'] as const) {
      const c = cap && cap[k] != null ? Math.min(need[k]!, cap[k]!) : need[k]!;
      const free = b.fleet.filter((m) => m.type === k && m.status === 'idle' && m.down === 0).slice(0, c);
      for (const m of free) {
        m.status = 'job';
        m.jobId = j.id;
        (j.ownedIds as string[]).push(m.id);
      }
      const short = need[k]! - free.length;
      if (k === 'truck') {
        j.ownTrucks = free.length;
        continue;
      }
      j.gap = (j.gap as Record<string, number>) || {};
      (j.gap as Record<string, number>)[k] = short;
      if (j.prog) {
        const planned = Math.min(need[k]!, cap && cap[k] != null ? cap[k]! : need[k]!);
        const po = j.planOwned as Record<string, number> | null;
        const gapP = Math.max(0, Math.min(planned, po ? po[k]! : planned) - free.length);
        (j.gap as Record<string, number>)[k] = gapP;
        j.hireWeek = (j.hireWeek as number) + gapP * TYPES[k].dry;
        continue;
      }
      if (hm(j as { hm?: Record<string, string> }, k) === 'wet') {
        wet[k] = short;
        j.subDay = (j.subDay as number) + short * subRate(k);
      } else j.hireWeek = (j.hireWeek as number) + short * TYPES[k].dry;
      fuelDay += (need[k]! - wet[k]!) * TYPES[k].fuel;
    }
    j.fuelCrew = fuelDay / crews;
    if (j.prog) {
      j.subDay = 0;
      j.casualDay = 0;
      j.truckCasualDay = 0;
    }
    const crew = fillRoles({ grader: need.grader! - wet.grader!, roller: need.roller! - wet.roller!, cart: need.cart! - wet.cart!, truck: j.ownTrucks as number }, crewPeople(b as unknown as PlanCtx, true));
    j.casLeft = crew.left;
    for (const id of crew.used) seat(b, j, id);
    j.who = boss;
    seat(b, j, boss);
    if (!j.prog) {
      j.casualDay = crew.casualDay;
      j.truckCasualDay = crew.truckCasualDay;
    }
    j.casuals = crew.casuals;
    j.state = 'running';
    b.bank -= crews * MOB;
    jobCost(b, j, crews * MOB);
    if (dayNow != null) j.mob = { w: b.week, d: dayNow + 1 };
  }
}

// ---------- the working day ----------

/** A crew on a running program: its roads, where it's up to, and its machines. */
export interface ProgCrewRun {
  sub: boolean;
  gr: number;
  ro: number;
  ca: number;
  tr: number;
  day: number;
  sheetDay: number;
  week: number;
  /** The road it's on. */
  k: number;
  /** Float days left before it starts the next road. */
  flt: number;
  done: boolean;
  q: { mapId: string | null; n: string; g: number; s: number; haul?: number; water?: number; x?: number; y?: number; roy: number }[];
  mids?: string[];
}
export interface Prog {
  floats: number;
  crews: ProgCrewRun[];
  split?: boolean;
}

/** A subbie working your contract. On a subbie job they're owed their rate for each crew-day, at 4 weeks. */
export function subbieDay(b: ContractBiz, j: Job, rep: WeekReport): void {
  if ((j.subHold as number) > 0) return;
  const q = j.sub as SubQuote;
  for (let c = 0; c < q.crews; c++) {
    if (j.kind === 'own') {
      if ((j.gLeft as number) > 0) j.gLeft = (j.gLeft as number) - q.pace;
      else if ((j.sLeft as number) > 0) j.sLeft = (j.sLeft as number) - Math.min(j.sLeft as number, TREAT.resheet.per * q.pace);
      j.done++;
    } else {
      j.part = ((j.part as number) || 0) + q.pace;
      while ((j.part as number) >= 1 && j.done < j.days) {
        j.part = (j.part as number) - 1;
        j.done++;
        j.wkDays = (j.wkDays || 0) + 1;
        if ((j.paid as number) < (j.base as number)) {
          j.wk = (j.wk || 0) + j.rate;
          j.paid = (j.paid as number) + 1;
        }
        owe(b, q.name, q.rate!, 4, j);
      }
    }
  }
  if (j.kind === 'own' && (j.gLeft as number) <= 0 && (j.sLeft as number) <= 0) j.finished = true;
  if (j.kind === 'sub' && j.done >= j.days) j.finished = true;
}

/** GPS on your graders: a share of the GPS speed-up, by how many of the contract's graders have it. */
export function gpsMul(b: Biz, j: Job): number {
  const tot = Math.max(1, (j.crews as number) * ((j.graders as number) || 1));
  const n = (j.ownedIds as string[]).filter((id) => { const m = mach(b, id); return m && m.type === 'grader' && m.gps; }).length;
  return 1 + (GPS_MUL - 1) * Math.min(1, n / tot);
}
export function crewGps(b: Biz, c: ProgCrewRun): number {
  const n = (c.mids || []).filter((id) => { const m = mach(b, id); return m && m.type === 'grader' && m.gps; }).length;
  return 1 + (GPS_MUL - 1) * Math.min(1, n / Math.max(1, c.gr || 1));
}

/** Track record for the finish: +1 if half the graders have GPS, +1 if half the rollers are multi-tyred. */
export function finishPts(b: Biz, j: Job): number {
  const ids = j.kind === 'sub' ? [j.mId, j.rollerId] : (j.ownedIds as string[]);
  let g = 0, gG = 0, ro = 0, rM = 0;
  for (const id of ids) {
    const m = mach(b, id);
    if (!m) continue;
    if (m.type === 'grader') {
      g++;
      if (m.gps) gG++;
    }
    if (m.type === 'roller') {
      ro++;
      if (m.multi) rM++;
    }
  }
  return (g && gG * 2 >= g ? 1 : 0) + (ro && rM * 2 >= ro ? 1 : 0);
}

export function ownFlow(j: Job) {
  return flow(crewMul(j as { graders?: number; rollers?: number }), j.carts as number, j.trucks as number, j.waterKm as number, j.haul as number);
}

function wearAndBreak(rand: Rand, b: Biz, m: Machine, w: WorkshopCtx, events: ContractEvent[]): void {
  wear(m, 1, b.acc);
  if (breaks(rand, m, 1, w)) {
    breakdown(rand, m, w, b.acc);
    b.queue.push({ k: 'break', id: m.id });
    events.push({ k: 'breakdown', id: m.id, type: m.type });
  }
}

/** A crew that's finished its roads floats home: its machines are free for other work. */
function crewHome(b: Biz, j: Job, c: ProgCrewRun, i: number, events: ContractEvent[]): void {
  for (const id of c.mids || []) {
    const m = mach(b, id);
    if (m && m.jobId === j.id) {
      m.status = 'idle';
      m.jobId = null;
    }
    j.ownedIds = (j.ownedIds as string[]).filter((x) => x !== id);
  }
  const n = (c.mids || []).length;
  c.mids = [];
  events.push({ k: 'crewHome', jobId: j.id, crew: i, sub: c.sub, machines: n });
}

/** One working day of a program: each crew on its own road, floating between far ones. */
export function progDay(rand: Rand, b: ContractBiz, j: Job, rep: WeekReport, w: WorkshopCtx, events: ContractEvent[]): void {
  const P = j.prog as Prog, pace = (j.subPace as number) || 0.85;
  let cost = 0;
  // Each crew has its own machines: a breakdown stops that crew only.
  if (!P.split) {
    P.split = true;
    const pool = (j.ownedIds as string[]).slice();
    for (const c of P.crews) {
      c.mids = [];
      if (c.sub) continue;
      for (const [type, n] of [['grader', c.gr], ['roller', c.ro], ['cart', c.ca], ['truck', c.tr]] as [MachineType, number][]) {
        for (let k = 0; k < n; k++) {
          const at = pool.findIndex((id) => mach(b, id)?.type === type);
          if (at >= 0) c.mids.push(pool.splice(at, 1)[0]!);
        }
      }
    }
    if (pool.length) {
      const oc = P.crews.filter((c) => !c.sub);
      pool.forEach((id, n) => { if (oc.length) oc[n % oc.length]!.mids!.push(id); });
    }
  }
  for (const id of j.ownedIds as string[]) {
    if (!P.crews.some((c) => c.mids && c.mids.includes(id))) {
      const oc2 = P.crews.filter((c) => !c.sub && !c.done);
      if (oc2.length) oc2[0]!.mids!.push(id);
    }
  }
  const idle: Record<number, number> = {}, firstLive = P.crews.findIndex((c) => !c.sub && !c.done);
  P.crews.forEach((c, i) => {
    if (!c.sub && !c.done && (c.mids || []).some((id) => { const m = mach(b, id); return m && m.type !== 'truck' && m.down > 0 && m.cover === 0; })) idle[i] = 1;
  });
  if (b.youBlocked > 0 && j.who === 'you' && firstLive >= 0) idle[firstLive] = 1;
  P.crews.forEach((c, i) => {
    if (c.done) return;
    if (idle[i]) {
      rep.lost++;
      return;
    }
    // The day carries on: finish a road or switch to gravel and the crew keeps going with what's left of the day.
    let frac = 1, guard = 0;
    while (frac > 1e-6 && !c.done && guard++ < 12) {
      if (c.flt > 0) {
        const fu = Math.min(frac, c.flt);
        c.flt -= fu;
        frac -= fu;
        continue;
      }
      const rd = c.q[c.k]!, fl = c.sub ? null : flow(Math.min(c.gr, c.ro), c.ca, c.tr, rd.water!, rd.haul!), dayc = c.sub ? (j.subRate as number) || 0 : c.day;
      if (rd.g > 1e-6) {
        const gr = c.sub ? pace : fl!.out * crewGps(b, c), ug = Math.min(frac, rd.g / gr);
        rd.g -= gr * ug;
        j.gLeft = (j.gLeft as number) - gr * ug;
        frac -= ug;
        cost += dayc * ug;
        if (!c.sub) j.done += ug;
      } else if (rd.s > 1e-6) {
        const sr = c.sub ? TREAT.resheet.per * pace : fl!.sheetRate, us = Math.min(frac, rd.s / sr), pl3 = sr * us;
        rd.s -= pl3;
        j.sLeft = (j.sLeft as number) - pl3;
        frac -= us;
        cost += (dayc + (c.sub ? 0 : c.sheetDay)) * us + pl3 * rd.roy;
        if (!c.sub) j.done += us;
      }
      if (rd.g <= 1e-6 && rd.s <= 1e-6) {
        rd.g = 0;
        rd.s = 0;
        c.k++;
        if (rd.mapId && b.dmap) mapDone(b.dmap, [rd.mapId], true, b.week);
        if (c.k >= c.q.length) {
          c.done = true;
          crewHome(b, j, c, i, events);
        } else if (roadDist(rd, c.q[c.k]) > FLOAT_KM) {
          c.flt = FLOAT_DAYS;
          if (!c.sub) {
            cost += FLOAT_MOVE;
            P.floats++;
          }
        }
      }
    }
    rep.worked++;
    for (const id of c.mids || []) {
      const m = mach(b, id);
      if (m && m.down === 0 && (m.type !== 'truck' || c.q[Math.min(c.k, c.q.length - 1)]!.g <= 0)) wearAndBreak(rand, b, m, w, events);
    }
  });
  b.bank -= cost;
  rep.costs += cost;
  if (P.crews.every((c) => c.done) || ((j.gLeft as number) <= 0.01 && (j.sLeft as number) <= 0.5)) {
    j.gLeft = 0;
    j.sLeft = 0;
    j.finished = true;
  }
}

/** A working day on your own council contract (not a program). */
export function ownDay(rand: Rand, b: ContractBiz, j: Job, rep: WeekReport, w: WorkshopCtx, events: ContractEvent[]): void {
  if (j.prog) return progDay(rand, b, j, rep, w, events);
  const crews = j.crews as number;
  if (j.subCrews) {
    let sc = 0;
    for (let k = 0; k < (j.subCrews as number); k++) {
      if ((j.gLeft as number) > 0) j.gLeft = (j.gLeft as number) - (j.subPace as number);
      else if ((j.sLeft as number) > 0) {
        const pl2 = Math.min(j.sLeft as number, TREAT.resheet.per * (j.subPace as number));
        j.sLeft = (j.sLeft as number) - pl2;
        sc += pl2 * (j.royalty as number);
      } else break;
      sc += j.subRate as number;
    }
    b.bank -= sc;
    rep.costs += sc;
    if ((j.gLeft as number) <= 0 && (j.sLeft as number) <= 0) {
      j.finished = true;
      return;
    }
  }
  const down = (j.ownedIds as string[]).filter((id) => { const m = mach(b, id); return !m || (m.type !== 'truck' && m.down > 0 && m.cover === 0); }).length;
  let active = Math.max(0, crews - down);
  if (b.youBlocked > 0 && j.who === 'you') active = Math.max(0, active - 1);
  if (!active) {
    rep.lost += crews;
    return;
  }
  rep.lost += crews - active;
  const fl = ownFlow(j), share = active / crews, sheeting = (j.gLeft as number) <= 0;
  let cost = active * (j.fuelCrew != null ? (j.fuelCrew as number) : (j.graders as number) * TYPES.grader.fuel + (j.rollers as number) * TYPES.roller.fuel + (j.carts as number) * TYPES.cart.fuel)
    + Math.round(((j.casualDay as number) + ((j.subDay as number) || 0)) * share);
  const truckDay = ((crews * (j.trucks as number) - (j.ownTrucks as number)) * TRUCK_DAY + (j.ownTrucks as number) * TYPES.truck.fuel + (j.truckCasualDay as number)) / crews;
  for (let c = 0; c < active; c++) {
    if ((j.gLeft as number) > 0) j.gLeft = (j.gLeft as number) - fl.out * gpsMul(b, j);
    else if ((j.sLeft as number) > 0) {
      const placed = Math.min(j.sLeft as number, fl.sheetRate);
      j.sLeft = (j.sLeft as number) - placed;
      cost += truckDay + placed * (j.royalty as number);
    }
  }
  j.done += active;
  rep.worked += active;
  b.bank -= cost;
  rep.costs += cost;
  for (const id of j.ownedIds as string[]) {
    const m = mach(b, id);
    if (m && m.down === 0 && (m.type !== 'truck' || sheeting)) wearAndBreak(rand, b, m, w, events);
  }
  if ((j.gLeft as number) <= 0 && (j.sLeft as number) <= 0) j.finished = true;
}

/** A crew-day on a subbie job: grader, roller and cart(s) all have to be going. */
function subDay(rand: Rand, b: ContractBiz, j: Job, m: Machine, wet: boolean, rep: WeekReport, w: WorkshopCtx, events: ContractEvent[]): void {
  if (wet) return;
  if (driverOff(b, j)) {
    rep.lost++;
    return;
  }
  const crew = [m, mach(b, j.rollerId), mach(b, j.cartId)].concat(j.cart2Id ? [mach(b, j.cart2Id)] : []);
  if (crew.some((x) => !x || (x.down > 0 && x.cover === 0))) {
    rep.lost++;
    return;
  }
  j.part = ((j.part as number) || 0) + (m.gps ? GPS_MUL : 1);
  rep.worked++;
  while ((j.part as number) >= 1 - 1e-9 && j.done < j.days) {
    j.part = (j.part as number) - 1;
    j.done++;
    j.wkDays = (j.wkDays || 0) + 1;
    if ((j.paid as number) < (j.base as number)) {
      j.wk = (j.wk || 0) + j.rate;
      j.paid = (j.paid as number) + 1;
    }
  }
  b.bank -= j.dayCost as number;
  rep.costs += j.dayCost as number;
  for (const x of crew) if (x!.down === 0) wearAndBreak(rand, b, x!, w, events);
  if (j.done >= j.days) j.finished = true;
}

/** One day on any job: hire work, a subbie job, your own contract, or one subbed out. */
export function jobDay(rand: Rand, b: ContractBiz, j: Job, d: number, wet: boolean, w: WorkshopCtx, rep: WeekReport, downDays: Record<string, number>, events: ContractEvent[]): void {
  hireDay(rand, b, j, d, wet, w, rep, downDays, events as HireEvent[], () => {
    if (j.state === 'subbed') {
      if (!wet) subbieDay(b, j, rep);
      return;
    }
    if (j.kind === 'own') {
      if (j.state === 'running' && !wet) ownDay(rand, b, j, rep, w, events);
      return;
    }
    subDay(rand, b, j, mach(b, j.mId)!, wet, rep, w, events);
  });
}

/** End of a working day: whatever finished hands its crew and gear to what's waiting, and broken-down gear gets a day closer. */
export function endOfDay(b: ContractBiz, d: number, events: ContractEvent[]): void {
  if (d < 4 && b.jobs.some((j) => j.finished && !j.freed)) {
    for (const j of b.jobs.slice()) if (j.finished && !j.freed) freeUp(b, j, d, events as HireEvent[]);
    staffSubs(b, d);
    staffOwn(b, d);
  }
  for (const m of b.fleet) {
    if (m.down > 0 && m.down < 99) {
      if (m.cover > 0) m.cover--;
      m.down--;
    }
  }
}

// ---------- the end of the week ----------

/** Contracts nobody ever started: after 3 weeks past due, the client ends them. Track record −3, barred for 26 weeks. */
export function terminateWeek(b: ContractBiz, events: ContractEvent[]): void {
  for (const j of b.jobs.slice()) {
    if ((j.kind === 'sub' || j.kind === 'own') && j.state === 'waiting' && b.week > (j.due as number) + 3) {
      b.rep = Math.max(0, b.rep - 3);
      b.blocked[j.client] = b.week + 26;
      release(b, j, events as HireEvent[]);
      events.push({ k: 'terminated', jobId: j.id, client: j.client });
      relAdd(b, j.client, -5);
    }
  }
}

/** Take a share of the unworked part of a program off you. Returns the contract value lost. */
export function cutWork(j: Job, frac: number): number {
  const per = TREAT.resheet.per, U0 = (j.g0 as number) + (j.s0 as number) / per;
  const gl = Math.max(0, j.gLeft as number) * frac, sl = Math.max(0, j.sLeft as number) * frac, gone = gl + sl / per;
  j.gLeft = (j.gLeft as number) - gl;
  j.sLeft = (j.sLeft as number) - sl;
  j.g0 = (j.g0 as number) - gl;
  j.s0 = (j.s0 as number) - sl;
  const lost = ((j.price as number) * gone) / U0;
  j.price = (j.price as number) - lost;
  const prog = j.prog as Prog | null;
  if (prog) {
    for (const c of prog.crews) {
      c.q.forEach((rd, n) => {
        if (n >= c.k) {
          rd.g *= 1 - frac;
          rd.s *= 1 - frac;
        }
      });
      if (frac >= 1) c.done = true;
    }
  }
  return lost;
}

/**
 * The council checks a program: halfway to 30 June, if under 40% is done, 30% of what's left goes to someone else
 * (track record −1). Past the deadline, all of it does.
 */
export function programCheck(b: ContractBiz, j: Job, events: ContractEvent[]): void {
  const per = TREAT.resheet.per, done = 1 - (Math.max(0, j.gLeft as number) + Math.max(0, j.sLeft as number) / per) / ((j.g0 as number) + (j.s0 as number) / per);
  if (!j.cutHalf && b.week >= (j.half as number)) {
    j.cutHalf = true;
    if (done < 0.4) {
      const lost = cutWork(j, 0.3);
      b.rep = Math.max(0, b.rep - 1);
      events.push({ k: 'halfway', jobId: j.id, done, cut: lost });
    } else events.push({ k: 'halfway', jobId: j.id, done, cut: 0 });
  }
  if (b.week > (j.due as number)) {
    const lost2 = cutWork(j, 1);
    j.cut = true;
    j.finished = true;
    events.push({ k: 'deadline', jobId: j.id, cut: lost2 });
  }
}

/**
 * The week on your own contract: hire-ins and site costs, the progress claim (retention held back), a subbie
 * pulling their crew now and then, and on finishing, retention and variations less any damages, and track record.
 */
export function ownWeek(rand: Rand, b: ContractBiz, j: Job, rep: WeekReport, oldhand: boolean, events: ContractEvent[]): void {
  const subbed = j.state === 'subbed';
  if (j.state !== 'running' && !subbed) return;
  const prog = j.prog as Prog | null;
  const wk = subbed ? SITE_WEEK / 2 : (j.hireWeek as number) * (oldhand ? 0.9 : 1) + SITE_WEEK + (prog ? prog.crews.reduce((a, c) => a + (c.done || c.sub ? 0 : c.week), 0) : 0);
  b.bank -= wk;
  rep.costs += wk;
  if (j.major && !j.finished) programCheck(b, j, events);
  const per = TREAT.resheet.per;
  const prg = j.finished ? 1 : 1 - (Math.max(0, j.gLeft as number) + Math.max(0, j.sLeft as number) / per) / ((j.g0 as number) + (j.s0 as number) / per);
  const claim = Math.round((j.price as number) * prg - (j.claimed as number));
  const sub = j.sub as SubQuote | null;
  if (claim > 0) {
    const ret = claim * (j.retain != null ? (j.retain as number) : RETAIN);
    j.claimed = (j.claimed as number) + claim;
    j.retained = (j.retained as number) + ret;
    j.earned += claim;
    invoice(b, j.client, claim - ret, j.terms, rep);
    if (subbed) owe(b, sub!.name, (claim - ret) * (j.subShare as number), j.terms, j);
  }
  if (subbed && !j.finished && rand() < 0.04) {
    j.subHold = 1;
    events.push({ k: 'subPulled', jobId: j.id, name: sub!.name });
  } else j.subHold = 0;
  if (j.finished) {
    const late = j.cut ? 0 : Math.max(0, b.week - (j.due as number)), ld = late * (j.ld != null ? (j.ld as number) : LD_OWN);
    const fin = Math.max(0, (j.retained as number) + j.extra - ld);
    invoice(b, j.client, fin, j.terms + 4, rep);
    j.earned += j.extra - ld;
    if (subbed) owe(b, sub!.name, fin * (j.subShare as number), j.terms + 4, j);
    b.ownDone = (b.ownDone || 0) + 1;
    if (ld) b.ownLate = (b.ownLate || 0) + 1;
    let gain = j.cut ? -3 : j.major ? (j.cutHalf ? 4 : 8) : j.subEver ? (ld ? 0 : 2) : ld ? 2 : 5;
    const fpo = !subbed && !j.cut ? finishPts(b, j) : 0;
    gain += fpo;
    if (fpo) events.push({ k: 'finishPoints', jobId: j.id, pts: fpo, council: true });
    if (j.major && !j.cut && j.prestige) b.prestigeDone = (b.prestigeDone || 0) + 1;
    if (j.major && !j.cut) b.majorDone = (b.majorDone || 0) + 1;
    b.rep += gain;
    if (!subbed) {
      b.bank -= (j.crews as number) * MOB;
      rep.costs += (j.crews as number) * MOB;
    }
    // a program cut at the deadline has already said so (programCheck)
    if (!j.cut) events.push({ k: 'ownFinished', jobId: j.id, major: !!j.major, late, ld, gain, subbedTo: subbed ? sub!.name : null, early: !!j.major && b.week <= (j.due as number) - 1 });
    release(b, j, events as HireEvent[]);
  }
}

/** Track record for finishing: council day labour counts double, a head contractor's subbie job triple. */
const GAIN: Record<string, number> = { sub: 3, council: 2 };

/**
 * End of the week on any job: hire work invoices its week; a subbie job invoices its crew-days less retention
 * and, on finishing, the retention less any damages; your own contract runs ownWeek. oldhand: the operations
 * manager who gets hire-ins 10% cheaper.
 */
export function settleJob(rand: Rand, b: ContractBiz, j: Job, rep: WeekReport, downDays: Record<string, number>, oldhand: boolean, events: ContractEvent[]): void {
  const c0 = rep.costs;
  (() => {
    if (j.after) return;
    if (j.kind === 'own') {
      ownWeek(rand, b, j, rep, oldhand, events);
      return;
    }
    if (j.kind === 'sub' && j.state === 'subbed' && !j.finished && rand() < 0.04) {
      j.subHold = 1;
      events.push({ k: 'subPulled', jobId: j.id, name: (j.sub as SubQuote).name });
    } else if (j.kind === 'sub') j.subHold = 0;
    if (j.kind === 'dry') {
      const amt = j.rate * (1 - (downDays[j.id] || 0) / 5);
      j.done++;
      j.earned += amt;
      invoice(b, j.client, amt, j.terms, rep);
      if (downDays[j.id]) events.push({ k: 'downtime', client: j.client, off: j.rate - amt });
      if (j.done >= j.days) j.finished = true;
    } else if (j.kind === 'sub' && (j.wk ?? 0) > 0) {
      const ret = j.wk! * RETAIN;
      j.retained = (j.retained as number) + ret;
      j.earned += j.wk!;
      invoice(b, j.client, j.wk! - ret, j.terms, rep);
    } else if ((j.wk ?? 0) > 0) {
      j.earned += j.wk!;
      invoice(b, j.client, j.wk!, j.terms, rep);
    }
    if (j.hireIn) {
      const hi = Math.round(j.hireIn * (oldhand ? 0.9 : 1));
      b.bank -= hi;
      rep.costs += hi;
    }
    if (!j.finished && j.kind !== 'dry' && j.kind !== 'sub' && j.wkDays === 0 && driverOff(b, j)) {
      j.idleWeeks++;
      if (j.idleWeeks >= 2 && j.kind !== 'private') {
        events.push({ k: 'gaveUp', client: j.client });
        b.rep = Math.max(0, b.rep - 1);
        release(b, j, events as HireEvent[]);
        return;
      }
    }
    if (j.finished) {
      let gain = GAIN[j.kind] ?? 1;
      if (j.kind === 'private') {
        invoice(b, j.client, (j.fixed || 0) + j.extra, j.terms, rep);
        j.earned = (j.fixed || 0) + j.extra;
      }
      if (j.kind === 'sub') {
        const late = Math.max(0, b.week - (j.due as number)), ld = late * LD_WEEK;
        invoice(b, j.client, Math.max(0, (j.retained as number) + j.extra - ld), j.terms + 4, rep);
        j.earned += j.extra - ld;
        b.subsDone = (b.subsDone || 0) + 1;
        relAdd(b, j.client, ld ? -2 : j.state === 'subbed' ? 1 : 2);
        if (ld) {
          b.lds = (b.lds || 0) + 1;
          gain = 1;
        }
        events.push({ k: 'subFinished', jobId: j.id, late, ld, retained: j.retained as number, extra: j.extra, terms: j.terms + 4 });
      }
      if (j.subEver) gain = Math.max(0, gain - 2);
      const fp = j.kind === 'sub' && j.state !== 'subbed' ? finishPts(b, j) : 0;
      if (fp) {
        gain += fp;
        events.push({ k: 'finishPoints', jobId: j.id, pts: fp, council: false });
      }
      b.rep += gain;
      const fl = j.state === 'subbed' ? 0 : j.kind === 'sub' ? MOB : j.kind === 'private' ? 0 : 1100;
      b.bank -= fl;
      rep.costs += fl;
      events.push({ k: 'finished', jobId: j.id, kind: j.kind, client: j.client, gain, earned: j.earned });
      release(b, j, events as HireEvent[]);
    }
  })();
  jobCost(b, j, rep.costs - c0);
  jobDone(b, j);
}

// ---------- subbing a contract out ----------

export const SUBBIES = ['Doherty Grading', 'Two Gates Plant', 'Red Gully Earthmoving', 'Pratt & Son Plant Hire', 'Dingo Fence Contracting', 'Kurrajong Grading', 'Saltbush Plant', 'Three Mile Earthworks'];

export interface SubQuote {
  name: string;
  crews: number;
  pace: number;
  /** Own contract: what they get for the rest of it. Subbie job: their rate per crew-day. */
  cost?: number;
  rate?: number;
  wks: number;
}

/** What's left on a job, in standard crew-days. */
export function leftDays(j: Job): number {
  return j.kind === 'own' ? Math.max(0, j.gLeft as number) + Math.max(0, j.sLeft as number) / TREAT.resheet.per : Math.max(0, j.days - j.done);
}

/** This week's quotes from local outfits to take a contract off your hands. New ones each week; some weeks nobody's free. */
export function subQuotes(rand: Rand, b: ContractBiz, j: Job): SubQuote[] {
  if (j.quotes && j.quotesWk === b.week) return j.quotes as SubQuote[];
  // TODO after the port: a biased shuffle, kept so careers match the prototype.
  const names = SUBBIES.slice().sort(() => rand() - 0.5), n = rand() < 0.15 ? 0 : int(rand, 1, 3), out: SubQuote[] = [], left = leftDays(j);
  for (let i = 0; i < n; i++) {
    const crews = j.kind === 'own' && left > 40 && rand() < 0.5 ? 2 : 1, pace = Math.round((0.76 + rand() * 0.16) * 100) / 100;
    const q = { name: names[i]!, crews, pace } as SubQuote;
    if (j.kind === 'own') {
      const base = (((j.planCost as number) || (j.price as number) / 1.12) * left) / ((j.g0 as number) + (j.s0 as number) / TREAT.resheet.per);
      q.cost = round(base * (0.9 + rand() * 0.09), 500);
    } else q.rate = round(j.rate * (0.78 + rand() * 0.12), 10);
    q.wks = weeksFor(b.town, left / (crews * pace), b.week + 1, 1);
    out.push(q);
  }
  j.quotes = out;
  j.quotesWk = b.week;
  return out;
}

/** Hand a waiting contract to a subbie. On your own contract they get a share of what's left to claim. */
export function subOut(rand: Rand, b: ContractBiz, id: string, i: number): boolean {
  const j = b.jobs.find((x) => x.id === id);
  if (!j || j.state !== 'waiting') return false;
  const q = subQuotes(rand, b, j)[i];
  if (!q) return false;
  j.state = 'subbed';
  j.sub = q;
  j.subEver = true;
  j.quotes = null;
  if (j.kind === 'own') {
    const claimLeft = (j.price as number) - (j.claimed as number);
    j.subShare = Math.min(0.97, q.cost! / Math.max(1, claimLeft));
  }
  return true;
}

/** Your own crew is free again: can you take the work back off the subbie? */
export function canTakeBack(b: ContractBiz, j: Job): boolean {
  if (j.kind === 'own') return !b.youJob || b.staff.some((p) => (p.role === 'super' || p.role === 'ops') && !p.jobId && p.off === 0);
  return !!(freeMachine(b, 'grader') && freeMachine(b, 'roller') && freeMachine(b, 'cart') && freeDriver(b, 'grader'));
}

export function takeBack(b: ContractBiz, id: string): boolean {
  const j = b.jobs.find((x) => x.id === id);
  if (!j || j.state !== 'subbed' || !canTakeBack(b, j)) return false;
  j.state = 'waiting';
  j.sub = null;
  j.subShare = 0;
  const prog = j.prog as Prog | null;
  if (prog) {
    let gT = 0, sT = 0;
    for (const c of prog.crews) c.q.forEach((rd, n) => { if (n >= c.k) { gT += rd.g; sT += rd.s; } });
    const kg = gT ? Math.max(0, j.gLeft as number) / gT : 0, ks = sT ? Math.max(0, j.sLeft as number) / sT : 0;
    for (const c of prog.crews) c.q.forEach((rd, n) => { if (n >= c.k) { rd.g *= kg; rd.s *= ks; } });
  }
  if (j.kind === 'own') staffOwn(b, null);
  else staffSubs(b, null);
  return true;
}

// ---------- the contract cards ----------

/** Extra work: days on a subbie job, or grading left on your own contract. */
export function addDays(j: Job, n: number): void {
  if (j.kind === 'own') j.gLeft = Math.max(0, j.gLeft as number) + n;
  else j.days += n;
}

/** Extra culverts "while you're there": what the variation's worth (two days' rate). */
export function variationValue(j: Job): number {
  return round(j.rate * 2, 100);
}
/** Do it, then lodge a variation: 65% it's approved from your diary. */
export function variationLodge(rand: Rand, j: Job): boolean {
  addDays(j, 2);
  if (rand() < 0.65) {
    j.extra += variationValue(j);
    return true;
  }
  return false;
}
/** Get it in writing first: a day lost to paperwork, and you're covered. */
export function variationWriting(j: Job): void {
  addDays(j, 3);
  j.extra += variationValue(j);
}
/** Do it free: they'll remember it. */
export function variationFree(b: ContractBiz, j: Job): void {
  addDays(j, 2);
  b.rep += 1;
  relAdd(b, j.client, 1);
}

/** The gravel failed its test: cartage from the better pit for the rest of the job, $6 a m³. */
export function gravelCartCost(j: Job): number {
  const left = Math.round(j.kind === 'own' ? Math.max(0, j.sLeft as number) : (j.gravel as number) * Math.max(0, 1 - j.done / j.days));
  return round(left * 6, 100);
}
export function gravelCart(b: ContractBiz, j: Job): void {
  const gc = gravelCartCost(j);
  b.bank -= gc;
  jobCost(b, j, gc);
}
/** Work it harder: 2 more days, and a 25% chance of 2 more after that. */
export function gravelWork(rand: Rand, j: Job): boolean {
  addDays(j, 2);
  if (rand() < 0.75) return true;
  addDays(j, 2);
  return false;
}
/** Argue it's within spec: 35% you're right; otherwise 3 days of rework and track record −1. */
export function gravelArgue(rand: Rand, b: ContractBiz, j: Job): boolean {
  if (rand() < 0.35) return true;
  addDays(j, 3);
  b.rep = Math.max(0, b.rep - 1);
  return false;
}

/** The dam's dry: buy bore water ($4,000), cart from 12 km further, or that plus another cart per crew. */
export function dryDamBore(b: ContractBiz, j: Job): void {
  b.bank -= 4000;
  jobCost(b, j, 4000);
}
export function dryDamFar(j: Job): void {
  j.waterKm = (j.waterKm as number) + 12;
}
export function dryDamFarMore(j: Job): void {
  j.waterKm = (j.waterKm as number) + 12;
  j.carts = (j.carts as number) + 1;
  const crews = j.crews as number;
  if (hm(j as { hm?: Record<string, string> }, 'cart') === 'wet') {
    j.subDay = ((j.subDay as number) || 0) + crews * subRate('cart');
    return;
  }
  j.hireWeek = (j.hireWeek as number) + crews * TYPES.cart.dry;
  j.casuals = (j.casuals as number) + crews;
  j.casualDay = (j.casualDay as number) + crews * ROLES.cart.casual;
  if (j.fuelCrew != null) j.fuelCrew = (j.fuelCrew as number) + TYPES.cart.fuel;
}

/** The near pit's run out: switch to the far pit, switch and add two trucks a crew, or buy from the farmer next door at $8 a m³. */
export function pitFar(j: Job, moreTrucks: boolean): void {
  const far = j.far as { haul: number; royalty: number };
  j.haul = far.haul;
  j.royalty = far.royalty;
  j.marginal = false;
  if (moreTrucks) j.trucks = (j.trucks as number) + 2;
}
export function pitFarmer(b: ContractBiz, j: Job): void {
  const left = Math.round(Math.max(0, j.sLeft as number));
  b.bank -= left * 8;
  jobCost(b, j, left * 8);
}

/** Your machine's back in the yard: put it on (in place of the hire-in), or keep it free and don't ask for 4 weeks. */
export function swapCardKeep(b: ContractBiz, j: Job, type: MachineType): void {
  j.noSwap = (j.noSwap as Record<string, number>) || {};
  (j.noSwap as Record<string, number>)[type] = b.week + 4;
}

