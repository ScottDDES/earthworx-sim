// Safety. A system the player builds up in four levels (WHS_SYS in overheads.ts), a crew culture that moves
// with every call they make, and a hidden build-up of near-trouble (hazard). All three set the odds of an incident.
// Words for what happened live in text/safety.ts; the engine only records which story it was.

import { note } from './diary';
import { DIFFICULTY, type Difficulty } from './difficulty';
import { WHS_SYS } from './overheads';
import { int, pick, type Rand } from './rng';
import { ROLES, type Person } from './staff';
import { WELLBEING_ADVISORY, nearMissAdvisoryCost, seriousAdvisoryCost } from './advisory';

export type Severity = 'serious' | 'lti' | 'medical' | 'first aid' | 'near miss';

export interface Incident {
  w: number;
  sev: Severity;
  /** Who: a person's id, 'you', or '' for a casual or nobody. */
  who: string;
  /** Which story (see text/safety.ts). */
  story?: Story;
  /** A serious incident that was never reported. */
  hidden?: boolean;
}

export type Story =
  | { k: 'lti'; i: number; machine: number }
  | { k: 'serious'; i: number }
  | { k: 'nearmiss'; i: number }
  /** Kept working with a bad back (the hurt card). */
  | { k: 'badBack' };

export interface Whs {
  /** System level, 0 to 3. */
  sys: number;
  /** Toolbox talks on. */
  talks: boolean;
  /** Crew culture, 0 to 100. */
  cult: number;
  /** Hidden hazard build-up, 0 up. */
  hz: number;
  /** The incident register, newest first, last 20. */
  inc: Incident[];
  /** Near misses reported. */
  nm: number;
}

/** A new career starts with nothing written down, or SWMS if they've already got a track record. */
export function newWhs(won: boolean): Whs {
  return { sys: won ? 1 : 0, talks: false, cult: 50, hz: 0, inc: [], nm: 0 };
}

/** How likely an incident is, all things considered. */
export function riskMult(W: Whs, d: Difficulty): number {
  return DIFFICULTY[d].risk * WHS_SYS[W.sys]!.risk * (W.talks ? 0.85 : 1) * (1.2 - (0.4 * W.cult) / 100) * (1 + W.hz);
}

/** Incidents of these kinds in the last `wks` weeks. */
export function recentInc(W: Whs, sev: readonly Severity[], wks: number, week: number): number {
  return W.inc.filter((x) => sev.includes(x.sev) && week - x.w < wks).length;
}

/** Safety points on a council tender: the system's points, less 2 for a lost-time injury this year and 4 for a serious incident in two. */
export function whsNp(W: Whs, week: number): number {
  return WHS_SYS[W.sys]!.np - (recentInc(W, ['lti'], 52, week) ? 2 : 0) - (recentInc(W, ['serious'], 104, week) ? 4 : 0);
}

/** Safety points on a subbie tender: 0, 2, 4 or 6 by level, less the same penalties, never below 0. */
export function whsNpSub(W: Whs, week: number): number {
  const pen = (recentInc(W, ['lti'], 52, week) ? 2 : 0) + (recentInc(W, ['serious'], 104, week) ? 4 : 0);
  return Math.max(0, ([0, 2, 4, 6][W.sys] ?? 0) - pen);
}

export function record(W: Whs, x: Incident): void {
  W.inc.unshift(x);
  if (W.inc.length > 20) W.inc.length = 20;
}

/** The parts of a career safety touches. */
export interface SafetyState {
  week: number;
  bank: number;
  /** Insurance loading. */
  ins: number;
  /** Track record points. */
  rep: number;
  whs: Whs;
  staff: Person[];
  /** The job you're driving on, if any. */
  youJob: string | null;
  /** Weeks you're off the tools. */
  youBlocked: number;
  /** Who you're barred from tendering to, and until when. */
  blocked: Record<string, number>;
}

/** What it takes to step up to the next level, or why not. */
export function nextWhs(st: SafetyState, flags: { swms: boolean; won: boolean; won2: boolean }): 'max' | 'locked' | 'cash' | 'ok' {
  if (!flags.swms) return 'locked';
  const nx = WHS_SYS[st.whs.sys + 1];
  if (!nx) return 'max';
  if (nx.need && !flags[nx.need]) return 'locked';
  return st.bank < nx.cost ? 'cash' : 'ok';
}

/** Step up a level. The crew notices: culture +5. */
export function upgradeWhs(st: SafetyState, flags: { swms: boolean; won: boolean; won2: boolean }): boolean {
  if (nextWhs(st, flags) !== 'ok') return false;
  st.bank -= WHS_SYS[st.whs.sys + 1]!.cost;
  st.whs.sys++;
  st.whs.cult = Math.min(100, st.whs.cult + 5);
  note(st, { k: 'whsSetUp', sys: st.whs.sys, cost: WHS_SYS[st.whs.sys]!.cost });
  return true;
}

/** Who gets hurt: someone driving on a job this week, you included. null = a casual. */
export function hurtPick(rand: Rand, st: SafetyState): string | null {
  const ppl = st.staff.filter((p) => p.jobId && p.off === 0 && ROLES[p.role].drives.length).map((p) => p.id);
  if (st.youJob && !st.youBlocked) ppl.push('you');
  return ppl.length ? pick(rand, ppl) : null;
}

export function hurtOff(st: SafetyState, who: string, wks: number): void {
  if (who === 'you') st.youBlocked = Math.max(st.youBlocked || 0, wks);
  else {
    const p = st.staff.find((x) => x.id === who);
    if (p) p.off = Math.max(p.off, wks);
  }
}

export const LTI_EXCESS = 1500;
export const MEDICAL_COST = 600;

export type SafetyEvent =
  | { k: 'serious'; who: string | null }
  | { k: 'lti'; who: string | null; wks: number; story: Story }
  | { k: 'medical'; who: string | null }
  | { k: 'firstAid'; who: string | null };

/**
 * The safety week. Hazard eases (faster with toolbox talks); culture drifts up with talks, or slowly
 * back towards 50 without. Then each machine-day worked carries a 0.25% chance of an incident, scaled by the risk.
 * A serious incident becomes a card (see seriousCard). Returns the money it cost this week.
 */
export function safetyWeek(rand: Rand, st: SafetyState, worked: number, d: Difficulty, queue: { k: string; who?: string | null }[], events: SafetyEvent[]): number {
  const W = st.whs;
  W.hz = Math.max(0, W.hz * (W.talks ? 0.88 : 0.97));
  W.cult = Math.max(0, Math.min(100, W.cult + (W.talks ? 1 : W.cult > 50 ? -0.3 : 0)));
  if (!worked) return 0;
  const p = 1 - Math.pow(1 - 0.0025 * riskMult(W, d), worked);
  if (rand() >= p) return 0;

  // How bad: a better system makes the bad ones rarer.
  const sv = WHS_SYS[W.sys]!.sev, x = rand(), who = hurtPick(rand, st);
  if (x < 0.05 * sv) {
    queue.push({ k: 'serious', who });
    events.push({ k: 'serious', who });
    return 0;
  }
  if (x < 0.3 * sv) {
    const wks = who === 'you' ? int(rand, 1, 3) : int(rand, 2, 6);
    if (who) hurtOff(st, who, wks);
    st.ins += 0.1;
    st.rep = Math.max(0, st.rep - 1);
    st.bank -= LTI_EXCESS;
    // which machine they climbed off is rolled before which story, as the prototype does
    const machine = int(rand, 0, 2), story: Story = { k: 'lti', i: int(rand, 0, 3), machine };
    record(W, { w: st.week, sev: 'lti', who: who ?? '', story });
    events.push({ k: 'lti', who, wks, story });
    note(st, { k: 'lti', name: who === 'you' ? 'You' : st.staff.find((p) => p.id === who)?.name ?? 'A casual', wks });
    return LTI_EXCESS;
  }
  if (x < 0.6) {
    st.ins += 0.03;
    st.bank -= MEDICAL_COST;
    record(W, { w: st.week, sev: 'medical', who: who ?? '' });
    events.push({ k: 'medical', who });
    return MEDICAL_COST;
  }
  record(W, { w: st.week, sev: 'first aid', who: who ?? '' });
  events.push({ k: 'firstAid', who });
  return 0;
}

// ---------- the cards ----------
// A card's own numbers come from the card's seed, so it reads the same every time it's shown.
// What happens after the player chooses rolls on the career's stream.

const round = (n: number, to: number) => Math.round(n / to) * to;

export interface SeriousCard {
  who: string | null;
  /** The regulator's fine if it's reported: none with a full IMS or better. */
  fine: number;
  story: number;
  /** The job that stands down for the investigation, if there's one running. */
  jobId: string | null;
}

/** fleetSize scales the fine: a bigger outfit is expected to know better. */
export function seriousCard(cardRand: Rand, who: string | null, sys: number, fleetSize: number, jobId: string | null): SeriousCard {
  const fsz = Math.min(1, 0.25 + fleetSize / 10);
  const fine = sys <= 1 ? round(int(cardRand, 20000, 60000) * fsz, 1000) : sys === 2 ? round(int(cardRand, 0, 15000) * fsz, 1000) : 0;
  return { who, fine, story: int(cardRand, 0, 3), jobId };
}

/** Report it. Off for 16 weeks, the fine, insurance +25%, track record −2, but the crew sees it handled. */
export function seriousNotify(st: SafetyState, c: SeriousCard): void {
  if (c.who) hurtOff(st, c.who, 16);
  st.bank -= c.fine;
  st.ins += 0.25;
  st.rep = Math.max(0, st.rep - 2);
  st.whs.cult = Math.min(100, st.whs.cult + 5);
  st.whs.hz = 0;
  record(st.whs, { w: st.week, sev: 'serious', who: c.who ?? '', story: { k: 'serious', i: c.story } });
}

/**
 * Ring DDES Advisory: they deal with the regulator, run the investigation and do the paperwork. All up it costs
 * less than the fine alone (advisory.ts); insurance +10%, track record −1, and the crew sees it handled. Returns the cost.
 */
export function seriousAdvisory(st: SafetyState, c: SeriousCard): number {
  if (c.who) hurtOff(st, c.who, 16);
  const cost = seriousAdvisoryCost(c.fine);
  st.bank -= cost;
  st.ins += 0.1;
  st.rep = Math.max(0, st.rep - 1);
  st.whs.cult = Math.min(100, st.whs.cult + 8);
  st.whs.hz = 0;
  record(st.whs, { w: st.week, sev: 'serious', who: c.who ?? '', story: { k: 'serious', i: c.story } });
  return cost;
}

export type HideResult = { found: false } | { found: true; fine: number };

/**
 * Keep it quiet. The crew knows (culture −25, hazard up). 60% of the time the hospital reports it:
 * double the fine (at least $60k), insurance +40%, track record −5, and the council won't use you for 26 weeks.
 */
export function seriousHide(rand: Rand, st: SafetyState, c: SeriousCard, council: string): HideResult {
  if (c.who) hurtOff(st, c.who, 16);
  record(st.whs, { w: st.week, sev: 'serious', who: c.who ?? '', story: { k: 'serious', i: c.story }, hidden: true });
  st.whs.cult = Math.max(0, st.whs.cult - 25);
  st.whs.hz += 0.3;
  if (rand() < 0.6) {
    const big = round(Math.max(c.fine, 30000) * 2, 1000);
    st.bank -= big;
    st.ins += 0.4;
    st.rep = Math.max(0, st.rep - 5);
    st.blocked[council] = st.week + 26;
    return { found: true, fine: big };
  }
  return { found: false };
}

export interface NearMissCard {
  story: number;
  /** An hour's stand-down for the crews out. */
  cost: number;
}

export function nearMissCard(cardRand: Rand, crewsOut: number): NearMissCard {
  return { story: int(cardRand, 0, 3), cost: 450 * Math.max(1, crewsOut) };
}

/** Stop, talk it through, change the SWMS. */
export function nearMissReport(st: SafetyState, c: NearMissCard): void {
  st.bank -= c.cost;
  st.whs.nm++;
  st.whs.hz = Math.max(0, st.whs.hz - 0.15);
  st.whs.cult = Math.min(100, st.whs.cult + 6);
  record(st.whs, { w: st.week, sev: 'near miss', who: '', story: { k: 'nearmiss', i: c.story } });
}

/** DDES Advisory investigates it and updates the SWMS: cheaper than stopping the crew, and a better fix. Returns the cost. */
export function nearMissAdvisory(st: SafetyState, c: NearMissCard): number {
  const cost = nearMissAdvisoryCost(c.cost);
  st.bank -= cost;
  st.whs.nm++;
  st.whs.hz = Math.max(0, st.whs.hz - 0.2);
  st.whs.cult = Math.min(100, st.whs.cult + 6);
  record(st.whs, { w: st.week, sev: 'near miss', who: '', story: { k: 'nearmiss', i: c.story } });
  return cost;
}

/** Have a word and move on. */
export function nearMissShrug(st: SafetyState): void {
  st.whs.hz += 0.15;
  st.whs.cult = Math.max(0, st.whs.cult - 4);
}

/** Someone's been quiet. Take them for a feed and a yarn: $80. Returns which of three replies. */
export function quietYarn(rand: Rand, st: SafetyState, p: Person): number {
  st.bank -= 80;
  p.yarn = st.week;
  st.whs.cult = Math.min(100, st.whs.cult + 5);
  return int(rand, 0, 2);
}

/** DDES Advisory runs a wellbeing check-in for the whole crew: counts as a yarn with everyone. */
export function quietAdvisory(st: SafetyState): void {
  st.bank -= WELLBEING_ADVISORY;
  for (const p of st.staff) p.yarn = st.week;
  st.whs.cult = Math.min(100, st.whs.cult + 8);
}

/** A few days off, paid. */
export function quietDaysOff(st: SafetyState, p: Person): void {
  p.off = Math.max(p.off, 1);
  p.yarn = st.week;
  st.whs.cult = Math.min(100, st.whs.cult + 8);
}

/** Leave it: 30% a near thing on the machine, then 25% of the rest they're off two weeks. */
export function quietLeave(rand: Rand, st: SafetyState, p: Person): 'nearThing' | 'offWork' | 'nothing' {
  p.yarn = st.week;
  st.whs.cult = Math.max(0, st.whs.cult - 3);
  if (rand() < 0.3) {
    st.whs.hz += 0.2;
    return 'nearThing';
  }
  if (rand() < 0.25) {
    p.off = Math.max(p.off, 2);
    return 'offWork';
  }
  return 'nothing';
}

/** Head contractors want SWMS: pay someone to write them. */
export function swmsPay(st: SafetyState): void {
  st.bank -= WHS_SYS[1]!.cost;
  st.whs.sys = 1;
}

/** Or write them yourself at night, and lose a week. */
export function swmsSelf(st: SafetyState): void {
  st.whs.sys = 1;
  st.youBlocked = Math.max(st.youBlocked || 0, 1);
}
