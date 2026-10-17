// Easing a new player in: the "getting started" coach (five steps, each done by doing it), tabs that appear
// as they're needed, the mentor's notes (each shown until you've read it), and running quiet weeks on.
// Words are in text/coach.ts.

import type { Career, Report } from './game';
import { endWeek } from './game';
import { tc } from './career';
import { whyNot } from './hire';
import { machineAlerts } from './books';

export type CoachStep = 'earn' | 'end' | 'late' | 'health' | 'goal';
export type TabId = 'yard' | 'work' | 'map' | 'market' | 'bank' | 'career';
export type MentorNote = 'office' | 'overheads' | 'score' | 'plan' | 'bas' | 'year' | 'rel' | 'runon';

export interface CoachState {
  /** The step you're on. */
  i: number;
  /** The week that step began. */
  at: number;
  /** Turned off. */
  off?: boolean;
  /** The last step's "Got it". */
  ok?: boolean;
}

/** The steps in order: which tab shows you, whether the step waits for "Got it", and when it's done. */
export const COACH: { id: CoachStep; tab: TabId | null; ok?: boolean; done: (c: Career) => boolean }[] = [
  { id: 'earn', tab: 'work', done: (c) => c.jobs.length > 0 || (tc(c).hires || 0) > 0 },
  { id: 'end', tab: null, done: (c) => c.week > (c.coach!.at || 1) },
  { id: 'late', tab: 'bank', done: (c) => (c.stats.earned || 0) > 0 || c.week >= (c.coach!.at || 1) + 5 },
  { id: 'health', tab: 'yard', done: (c) => (tc(c).svc || 0) > 0 || c.week >= (c.coach!.at || 1) + 6 },
  { id: 'goal', tab: 'career', ok: true, done: (c) => !!c.won || !!c.coach!.ok },
];

export function coachOn(c: Career): boolean {
  return !!c.coach && !c.coach.off && c.coach.i < COACH.length;
}

/** The step the coach is on, or null once it's finished or turned off. */
export function coachStep(c: Career): (typeof COACH)[number] | null {
  return coachOn(c) ? COACH[c.coach!.i]! : null;
}

/** Move past every step that's done. The Office tab appears when the coach points at it. */
export function coachTick(c: Career): void {
  if (!coachOn(c)) return;
  for (let guard = 0; coachOn(c) && COACH[c.coach!.i]!.done(c) && guard < 6; guard++) {
    c.coach!.i++;
    c.coach!.at = c.week;
    c.coach!.ok = false;
  }
  if (coachOn(c) && COACH[c.coach!.i]!.tab === 'bank') unlockTab(c, 'bank');
}

/** "Got it" on the last step. */
export function coachOk(c: Career): void {
  if (!c.coach) return;
  c.coach.ok = true;
  coachTick(c);
}

/** "Skip the tips". */
export function coachOff(c: Career): void {
  if (c.coach) c.coach.off = true;
}

// ---------- tabs ----------

export const TAB_ORDER: TabId[] = ['yard', 'work', 'map', 'market', 'bank', 'career'];

const ALL_TABS: Record<string, number> = { map: 1, bank: 1, board: 1 };

/** A career from before tabs unlocked has them all. */
function tabsOn(c: Career): Record<string, number> {
  if (!c.tabs) c.tabs = { map: 1, bank: 1, board: 1 };
  return c.tabs;
}

export function unlockTab(c: Career, k: string): void {
  const T = tabsOn(c);
  if (!T[k]) {
    T[k] = 1;
    (c.tabsNew = c.tabsNew || {})[k] = 1;
  }
}

/** The Office from week 4 (sooner if the bank's ringing); the Map once there's contract work about. */
export function tabsWeek(c: Career): void {
  if (c.week >= 4 || c.loan.missed || c.odOver) unlockTab(c, 'bank');
  if (c.week >= 3) unlockTab(c, 'board');
  if (c.won || c.jobs.some((j) => j.kind === 'sub' || j.kind === 'own') || (c.tenders || []).length) unlockTab(c, 'map');
}

export function tabShown(c: Career, k: TabId): boolean {
  return ['yard', 'work', 'market', 'career'].includes(k) || !!(c.tabs ?? ALL_TABS)[k];
}

/** It's been looked at: no longer new. */
export function tabSeen(c: Career, k: TabId): void {
  if (c.tabsNew && c.tabsNew[k]) delete c.tabsNew[k];
}

export function tabIsNew(c: Career, k: TabId): boolean {
  return !!(c.tabsNew && c.tabsNew[k]);
}

// ---------- the mentor's notes ----------

/** A note shows until you've said "Got it", unless you've turned them off. */
export function mentorShown(c: Career, k: MentorNote): boolean {
  return !c.tipsOff && !(c.tipsSeen || {})[k];
}

export function mentorOk(c: Career, k: MentorNote): void {
  (c.tipsSeen = c.tipsSeen || {})[k] = c.week;
}

export function mentorOff(c: Career): void {
  c.tipsOff = true;
}

// ---------- running quiet weeks on ----------

export function canRunOn(c: Career): boolean {
  return c.phase === 'play' && !c.queue.length && !coachOn(c);
}

export interface RunSummary {
  n: number;
  from: number;
  to: number;
  invoiced: number;
  paid: number;
  costs: number;
  rain: number;
  worked: number;
}

interface Before {
  t: number;
  c: number;
  idleOffer: boolean;
  bad: boolean;
}

const BAD = new Set(['overdue', 'wornOut', 'badlyWorn']);

function snapshot(c: Career): Before {
  return {
    t: (c.tenders || []).filter((t) => !t.bid).length,
    c: (c.ctenders || []).filter((t) => !t.bid).length,
    idleOffer: c.fleet.some((m) => m.status === 'idle' && m.down === 0) && c.offers.some((o) => !whyNot(c as never, o)),
    bad: machineAlerts(c.fleet).some((a) => BAD.has(a.k)),
  };
}

/** Did the week turn up something that needs you? */
function quietStop(c: Career, before: Before, r: Report | null): boolean {
  if (c.phase !== 'play' || c.queue.length) return true;
  const ev = (r?.events || []) as { k: string; kind?: string }[];
  if (r && (r.tix.length || ev.some((e) => (e.k === 'finished' && e.kind === 'sub') || e.k === 'ownFinished' || e.k === 'unlocked'))) return true;
  const now = snapshot(c);
  if (now.t > before.t || now.c > before.c) return true;
  if (now.idleOffer && !before.idleOffer) return true;
  if (c.odOver || c.loan.missed || (c.hardcore && c.under)) return true;
  if (now.bad && !before.bad) return true;
  return false;
}

/**
 * Play up to four weeks, stopping the moment something needs you: a card, a new tender, work for an idle
 * machine, a stamp or a ticket, the bank, or a machine in a bad way. Returns the last week's report, with a
 * summary of the run when it was more than one week.
 */
export function runOn(c: Career): (Report & { run?: RunSummary }) | null {
  if (!canRunOn(c)) return null;
  const w0 = c.week, sum = { invoiced: 0, paid: 0, costs: 0, rain: 0, worked: 0 };
  let n = 0, last: (Report & { run?: RunSummary }) | null = null;
  while (n < 4) {
    const before = snapshot(c);
    last = endWeek(c);
    n++;
    if (last) for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += last[k] || 0;
    if (!last || quietStop(c, before, last)) break;
  }
  if (last && n > 1) last.run = { n, from: w0, to: w0 + n - 1, ...sum };
  return last;
}
