// The workshop week. Fitters service what's coming due at a quarter of the dealer price and fix
// patched-up gear sitting idle. The workshop manager books whatever's left out to the dealer on time,
// handles faults found at a service themselves, asks for more fitters, and calls for worn-out gear to be turned over.
// Nothing here writes words: it returns events, and the screens say them.

import type { Accounts } from './ledger';
import { book } from './ledger';
import { serviced, serviceFind, svcCost, svcLeft, patchCost, type Machine, type MachineType, type WorkshopCtx } from './machines';
import { fitPer, fitters, fitCov, mgrIs, mgrOf } from './managers';
import type { Rand } from './rng';
import type { Person } from './staff';
import { YARDS, type YardId } from './yards';

/** A decision card waiting for the player. */
export type Card =
  | { k: 'svcfind'; id: string; part: string; fix: number; by: string | null }
  | { k: 'turnover'; id: string; by: string }
  | { k: string; id?: string; [x: string]: unknown };

/** The parts of a career the workshop touches. */
export interface Garage {
  week: number;
  bank: number;
  fleet: Machine[];
  staff: Person[];
  yard: YardId;
  acc: Accounts;
  queue: Card[];
}

export type WorkshopEvent =
  | { k: 'noWorkshop'; who: 'fitters' | 'wsm'; names: string[] }
  | { k: 'fitterWork'; names: string[]; serviced: number; fixed: MachineType[]; parts: number }
  | { k: 'dealerBookings'; name: string; serviced: number; fixedBands: boolean; cost: number }
  | { k: 'shortFitters'; name: string; more: number; without: number }
  | { k: 'foundAndFixed'; name: string; id: string; part: string; cost: number }
  | { k: 'foundAndPatched'; name: string; id: string; part: string; cost: number };

/** Not on hand: being sold, or out at the branch. */
function away(m: Machine): boolean {
  return m.status === 'auction' || m.status === 'listed' || m.status === 'branch';
}

function homeFleet(g: Garage): number {
  return g.fleet.filter((m) => m.status !== 'branch').length;
}

/** The planner services 40 hours earlier than everyone else. */
function serviceWindow(staff: readonly Person[]): number {
  return mgrIs(staff, 'planner') ? 65 : 25;
}

const round = (n: number, to: number) => Math.round(n / to) * to;

/**
 * After a service: did it turn up a fault? A workshop manager in a workshop deals with it on the spot
 * (fixed properly if there's the money or they're the old diesel fitter, otherwise patched).
 * Without one, it becomes a card for the player.
 */
export function afterService(rand: Rand, g: Garage, m: Machine, by: string | null, w: WorkshopCtx, events: WorkshopEvent[]): void {
  if (m.band || g.queue.some((q) => q.k === 'svcfind' && q.id === m.id)) return;
  const find = serviceFind(rand, m, w, !!by);
  if (!find) return;
  const W = mgrOf(g.staff, 'wsm');
  if (W && YARDS[g.yard].svc < 1) {
    if (mgrIs(g.staff, 'diesel') || g.bank > find.fix * 4) {
      g.bank -= find.fix;
      book(g.acc, 'workshop', find.fix);
      events.push({ k: 'foundAndFixed', name: W.name, id: m.id, part: find.part, cost: find.fix });
    } else {
      const pt = patchCost(find.fix);
      g.bank -= pt;
      book(g.acc, 'workshop', pt);
      m.band = { part: find.part, fix: find.fix, w: g.week };
      events.push({ k: 'foundAndPatched', name: W.name, id: m.id, part: find.part, cost: pt });
    }
    return;
  }
  g.queue.push({ k: 'svcfind', id: m.id, part: find.part, fix: find.fix, by });
}

/** The fitters' week. Returns what it cost (also booked to the workshop account). */
export function fitterWeek(rand: Rand, g: Garage, w: WorkshopCtx, events: WorkshopEvent[]): number {
  const F = fitters(g.staff);
  if (!F.length) return 0;
  if (YARDS[g.yard].svc >= 1) {
    events.push({ k: 'noWorkshop', who: 'fitters', names: F.map((p) => p.name) });
    return 0;
  }
  // Each fitter gets through at most 4 services a week, and only on the machines they cover.
  const cap = Math.min(F.length * 4, Math.round(fitCov(g.staff, homeFleet(g), YARDS[g.yard].svc) * homeFleet(g)));
  const early = serviceWindow(g.staff), dealer = mgrIs(g.staff, 'dealer');
  let done = 0, parts = 0;
  const fixed: MachineType[] = [];

  g.fleet
    .filter((m) => !away(m) && m.down === 0 && svcLeft(m) <= early)
    .sort((a, b) => svcLeft(a) - svcLeft(b))
    .slice(0, cap)
    .forEach((m, i) => {
      const c = round(svcCost(m, w) * 0.25 * (dealer ? 0.85 : 1), 50);
      g.bank -= c;
      parts += c;
      serviced(m, 'fitter');
      done++;
      afterService(rand, g, m, F[i % F.length]!.name, w, events);
    });

  // Spare time goes on fixing patched-up gear properly, at 70% of the quote.
  g.fleet
    .filter((m) => m.band && m.status === 'idle' && m.down === 0)
    .slice(0, Math.max(0, cap - done))
    .forEach((m) => {
      const c = round(m.band!.fix * 0.7, 50);
      g.bank -= c;
      parts += c;
      fixed.push(m.type);
      m.band = null;
    });

  book(g.acc, 'workshop', parts);
  if (done || fixed.length) events.push({ k: 'fitterWork', names: F.map((p) => p.name), serviced: done, fixed, parts });
  return parts;
}

/** Below this condition the workshop manager calls for a machine to be turned over. */
export function turnoverAt(staff: readonly Person[]): number {
  return mgrIs(staff, 'dealer') ? 50 : mgrIs(staff, 'diesel') ? 35 : 42;
}

/** The workshop manager's week. Returns what it cost (also booked to the workshop account). */
export function wsmWeek(rand: Rand, g: Garage, w: WorkshopCtx, odLimit: number, events: WorkshopEvent[]): number {
  const p = mgrOf(g.staff, 'wsm');
  if (!p) return 0;
  if (YARDS[g.yard].svc >= 1) {
    events.push({ k: 'noWorkshop', who: 'wsm', names: [p.name] });
    return 0;
  }
  const early = serviceWindow(g.staff), dc = mgrIs(g.staff, 'dealer') ? 0.85 : 1;
  let out = 0, n = 0;

  // Whatever the fitters couldn't get to goes out to the dealer, on time, as long as the bank allows.
  for (const m of g.fleet.filter((x) => !away(x) && x.down === 0 && svcLeft(x) <= early)) {
    const c = round(svcCost(m, w) * dc, 50);
    if (g.bank + odLimit < c) continue;
    g.bank -= c;
    out += c;
    n++;
    serviced(m, 'dealer');
    afterService(rand, g, m, p.name, w, events);
  }

  // Patched-up gear gets fixed properly, if it leaves three times the bill in the bank.
  let bf = 0;
  for (const m of g.fleet.filter((x) => x.band && x.status === 'idle' && x.down === 0)) {
    const c = round(m.band!.fix * 0.7 * dc, 50);
    if (g.bank < c * 3) continue;
    g.bank -= c;
    bf += c;
    m.band = null;
  }

  if (out + bf) {
    book(g.acc, 'workshop', out + bf);
    events.push({ k: 'dealerBookings', name: p.name, serviced: n, fixedBands: bf > 0, cost: out + bf });
  }

  // Short of fitters? They say so every 8 weeks.
  const per = fitPer(g.staff), need = Math.ceil(homeFleet(g) / per), have = fitters(g.staff).length;
  if (have < need && g.week % 8 === 0) events.push({ k: 'shortFitters', name: p.name, more: need - have, without: homeFleet(g) - have * per });

  // Every 4 weeks, the most worn-out idle machine gets flagged for turnover.
  if (g.week % 4 === 0 && !g.queue.some((q) => q.k === 'turnover')) {
    const thr = turnoverAt(g.staff);
    const old = g.fleet
      .filter((m) => m.status === 'idle' && m.cond < thr && !((m.toSnooze ?? 0) > g.week))
      .sort((a, b) => a.cond - b.cond)[0];
    if (old) g.queue.push({ k: 'turnover', id: old.id, by: p.name });
  }
  return out + bf;
}
