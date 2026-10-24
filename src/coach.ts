// Easing a new player in: the "getting started" coach (five steps, each done by doing it), tabs that appear
// as they're needed, the mentor's notes (each shown until you've read it), and running quiet weeks on.
// Words are in text/coach.ts.

import type { Career, Report } from './game';
import { endWeek } from './game';
import { tc } from './career';
import { whyNot } from './hire';
import { machineAlerts } from './books';
import { choose, drawCard } from './choose';
import { compat } from './compat';
import { bestFitter } from './managers';
import { hashN } from './rng';

export type CoachStep = 'earn' | 'end' | 'late' | 'health' | 'goal';
export type TabId = 'yard' | 'work' | 'map' | 'market' | 'bank' | 'career';
export type MentorNote = 'office' | 'overheads' | 'score' | 'plan' | 'bas' | 'year' | 'rel' | 'runon' | 'ddes' | 'claims';

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
/** Why a run of quiet weeks stopped, or null to keep going. */
export type RunStop = 'needsYou' | 'stamp' | 'finished' | 'tender' | 'idleWork' | 'bank' | 'machine';

function quietStop(c: Career, before: Before, r: Report | null): RunStop | null {
  if (c.phase !== 'play' || c.queue.length) return 'needsYou';
  const ev = (r?.events || []) as { k: string; kind?: string }[];
  if (r && r.tix.length) return 'stamp';
  if (r && ev.some((e) => (e.k === 'finished' && e.kind === 'sub') || e.k === 'ownFinished' || e.k === 'unlocked')) return 'finished';
  const now = snapshot(c);
  if (now.t > before.t || now.c > before.c) return 'tender';
  if (now.idleOffer && !before.idleOffer) return 'idleWork';
  if (c.odOver || c.loan.missed || (c.hardcore && c.under)) return 'bank';
  if (now.bad && !before.bad) return 'machine';
  return null;
}

/**
 * Cards Run on answers for you, with the safe answer, instead of stopping: the small day-to-day calls (and breakdowns,
 * when you've a fitter to make the call: see fitterCall). Bigger ones
 * (results you won, the bank, breakdowns with no fitter, injuries, money decisions) still stop it. Lost tender results only say
 * "Carry on", so they don't stop it either.
 */
export const RUN_ANSWERS: Record<string, string> = { rainday: 'standDown', late: 'wait', quiet: 'yarn', nearmiss: 'report', early: 'wait' };
const NEWS_ONLY = new Set(['tresult', 'cresult']);

/** A card Run on answered for you, for the summary. */
export interface Handled {
  w: number;
  k: string;
  id: string;
  who?: string;
  /** The machine, on a breakdown or a fault found at a service. */
  type?: string;
}

/**
 * Breakdowns and faults found at a service, when you've a fitter (the real game): their call, by how good they are.
 * Green patches it, solid is 50-50, a gun always fixes it properly. Warranty work goes to the dealer. No fitter: it stops.
 */
export function fitterCall(c: Career, q: { k: string; id?: string }, data: Record<string, any>): string | null {
  if (compat.prototype || (q.k !== 'break' && q.k !== 'svcfind')) return null;
  const f = bestFitter(c.staff);
  if (!f) return null;
  if (q.k === 'break' && data.card?.warranty) return 'warranty';
  const proper = f.skill === 'gun' || (f.skill === 'solid' && hashN('fitter|' + c.week + '|' + q.id) % 2 === 0);
  return q.k === 'break' ? (proper ? 'fitterFix' : 'patch') : proper ? 'fix' : 'patch';
}

/** Answer the small cards at the front of the queue. Returns the tickets earned doing it. */
export function answerSmall(c: Career, w: number, handled: Handled[]): string[] {
  const tix: string[] = [];
  while (c.queue.length) {
    const q = c.queue[0]!, d = drawCard(c, q);
    if (!d) {
      choose(c, 0); // no longer applies: it just goes
      continue;
    }
    const fit = fitterCall(c, q, d.data), want = fit ?? RUN_ANSWERS[q.k], i = want ? d.opts.findIndex((o) => o.id === want) : NEWS_ONLY.has(q.k) && d.opts.length === 1 ? 0 : -1;
    if (i < 0) break;
    const a = choose(c, i);
    if (!a) continue;
    const fitName = fit ? bestFitter(c.staff)?.name : undefined;
    handled.push({ w, k: q.k, id: a.id, ...(d.data.person?.name ? { who: d.data.person.name as string } : fitName ? { who: fitName } : {}), ...(fit && d.data.m ? { type: d.data.m.type as string } : {}) });
    tix.push(...a.tix);
  }
  return tix;
}

/**
 * Play up to four weeks, stopping the moment something needs you: a card, a new tender, work for an idle
 * machine, a stamp or a ticket, the bank, or a machine in a bad way. Small cards get the safe answer and the run
 * goes on (not in the prototype, which stops at every card). Returns the last week's report, with a summary of
 * the run when it was more than one week, why it stopped, and the cards it answered.
 */
export function runOn(c: Career): (Report & { run?: RunSummary; stop?: RunStop | null; handled?: Handled[] }) | null {
  if (!canRunOn(c)) return null;
  const w0 = c.week, sum = { invoiced: 0, paid: 0, costs: 0, rain: 0, worked: 0 }, handled: Handled[] = [];
  let n = 0, last: (Report & { run?: RunSummary; stop?: RunStop | null; handled?: Handled[] }) | null = null, stop: RunStop | null = null;
  while (n < 4) {
    const before = snapshot(c);
    last = endWeek(c);
    n++;
    if (last) for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += last[k] || 0;
    if (!last) break;
    const tix = compat.prototype ? [] : answerSmall(c, last.week, handled);
    stop = tix.length ? 'stamp' : quietStop(c, before, last);
    if (stop) break;
  }
  if (last) {
    last.stop = stop;
    if (handled.length) last.handled = handled;
  }
  if (last && n > 1) last.run = { n, from: w0, to: w0 + n - 1, ...sum };
  return last;
}
