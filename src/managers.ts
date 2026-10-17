// Managers: a big wage, unlocked once you've run your own contract. Three kinds apply for each job,
// each good at something and costing you somewhere else. Also the workshop's cover:
// one fitter looks after 6 machines (8 under the planner), and the workshop manager counts as one.

import type { WorkshopCtx } from './machines';
import { pick, type Rand } from './rng';
import { NAMES, type Person } from './staff';

export type MgrRole = 'ops' | 'wsm';
export type Trait = 'oldhand' | 'numbers' | 'younggun' | 'dealer' | 'diesel' | 'planner';

export interface MgrSpec {
  role: MgrRole;
  n: string;
  wage: number;
  good: string;
  bad: string;
}

export const MGR: Record<Trait, MgrSpec> = {
  oldhand:  { role: 'ops', n: 'The old hand', wage: 3800, good: 'Knows every plant hire yard in the district: hire-ins on your contracts cost 10% less. Swaps your own gear on without asking.', bad: 'The dearest of the three, and does things their way.' },
  numbers:  { role: 'ops', n: 'The numbers person', wage: 3400, good: 'Chases every invoice: clients pay late half as often. Swaps your own gear on without asking.', bad: 'Crews don\'t rate them. Crew culture slips a little every month.' },
  younggun: { role: 'ops', n: 'The young gun', wage: 2800, good: 'The cheapest of the three, and keen. Swaps your own gear on without asking.', bad: 'Still learning: about one week in three, the swap waits a week.' },
  dealer:   { role: 'wsm', n: 'The ex-dealer service manager', wage: 3600, good: 'Knows the parts game: services and repairs 15% cheaper, and your gear sells for 5% more.', bad: 'Dear, and quick to tell you to buy new: flags gear for turnover at 50%.' },
  diesel:   { role: 'wsm', n: 'The old diesel fitter', wage: 3200, good: 'Breakdowns down a further 15%, and every fault gets fixed properly, never bandaided.', bad: 'Lets old gear run too long: only flags turnover once a machine is down to 35%.' },
  planner:  { role: 'wsm', n: 'The planner', wage: 3000, good: 'Plans the workshop tight: each fitter looks after 8 machines, not 6.', bad: 'By the book: services 40 hours early, so more services and more parts.' },
};

/** Applicants stay on the books this many weeks before a fresh lot apply. */
export const MGR_REFRESH_WEEKS = 12;

/** The manager in this job, if they're at work. */
export function mgrOf(staff: readonly Person[], role: MgrRole): Person | null {
  return staff.find((p) => p.role === role && p.off === 0) ?? null;
}

/** Is the manager at work this kind? */
export function mgrIs(staff: readonly Person[], trait: Trait): boolean {
  const p = mgrOf(staff, MGR[trait].role);
  return !!p && p.trait === trait;
}

/** Managers open up with your own contract; a workshop manager also needs a workshop. */
export function mgrUnlocked(role: MgrRole, ownContract: boolean, hasWorkshop: boolean): boolean {
  return ownContract && (role !== 'wsm' || hasWorkshop);
}

export interface MgrApplicant {
  id: string;
  name: string;
  trait: Trait;
  ask: number;
}

const round = (n: number, to: number) => Math.round(n / to) * to;

/** One of each kind applies, asking within 5% of the going rate (plus inflation). */
export function genMgrApplicants(rand: Rand, role: MgrRole, taken: readonly string[], costIdx: number, nextId: () => string): MgrApplicant[] {
  const out: MgrApplicant[] = [];
  for (const trait of Object.keys(MGR) as Trait[]) {
    if (MGR[trait].role !== role) continue;
    const name = pick(rand, NAMES.filter((n) => !taken.includes(n) && !out.some((c) => c.name === n)));
    const id = nextId();
    out.push({ id, name, trait, ask: round(MGR[trait].wage * (0.95 + rand() * 0.1) * costIdx, 50) });
  }
  return out;
}

export function hireMgr(c: MgrApplicant, id: string): Person {
  return { id, name: c.name, role: MGR[c.trait].role, skill: 'solid', wage: c.ask, off: 0, jobId: null, trait: c.trait };
}

// ---------- the workshop's cover ----------

/** Fitters at work. The workshop manager counts as one. */
export function fitters(staff: readonly Person[]): Person[] {
  return staff.filter((p) => (p.role === 'fitter' || p.role === 'wsm') && p.off === 0);
}

/** Machines one fitter can look after. */
export function fitPer(staff: readonly Person[]): number {
  return mgrIs(staff, 'planner') ? 8 : 6;
}

/** Share of the home fleet the fitters can look after, 0 to 1. No workshop, no cover. */
export function fitCov(staff: readonly Person[], homeFleet: number, yardSvc: number): number {
  const n = fitters(staff).length;
  if (!n || yardSvc >= 1) return 0;
  return Math.min(1, (n * fitPer(staff)) / Math.max(1, homeFleet));
}

/** Past 12 machines, somebody has to run the workshop. */
export function bigNoWsm(staff: readonly Person[], homeFleet: number): boolean {
  return homeFleet > 12 && !mgrOf(staff, 'wsm');
}

/** Everything the machine code needs to know about the workshop. */
export function workshopCtx(staff: readonly Person[], homeFleet: number, yardSvc: number, brk: number, costIdx: number): WorkshopCtx {
  const w = mgrOf(staff, 'wsm');
  const wsm = w && (w.trait === 'dealer' || w.trait === 'diesel' || w.trait === 'planner') ? w.trait : null;
  return { yardSvc, fitCov: fitCov(staff, homeFleet, yardSvc), wsm, bigNoWsm: bigNoWsm(staff, homeFleet), brk, costIdx };
}
