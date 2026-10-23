// Seasons: a short game of about a year of real weather, the same for everyone (one seed per season), scored on
// net worth gained. Every move is recorded as a command, so a score can be checked by playing the moves again
// from the start: the server does that before a score goes on the public board. Words are in text/seasons.ts.

import { hashN, int, pick } from './rng';
import { wxStartFor } from './weather';
import * as game from './game';
import { newCareer, owns, stream, worldRand, planCtx, fmul, mood, overheads, worth, type Career } from './game';
import { uid } from './hire';
import { genOffers } from './hire';
import { genMarket } from './market';
import { canTender, genTenders } from './tenders';
import { genCouncil, genMajor, signOwn } from './council';
import { staffOwn } from './contracts';
import { autoPlan, planEval } from './planning';
import { newMachine, type MachineType } from './machines';
import { NAMES, ROLES, SKILLS, genCandidates, type Role, type Skill } from './staff';
import { newAccounts } from './ledger';
import { weeklyRepay } from './bank';
import { YARDS } from './yards';
import { choose } from './choose';
import { coachOff, coachOk, runOn } from './coach';
import { note } from './diary';

/** Bump whenever the simulation changes, so older scores aren't checked against new rules. */
export const SIM_VER = 22; // 22: program roads choose their pit and water. 21: packages 3–8 km roads; program lots split by km (70–110), small areas join the next. 20: developers want late-model gear; new machines from the dealer; late-model used listings. 19: laser and GPS machine control on bulk gear, one Laser Gear a job. 18: hard calls (the right thing costs something; choices come back later). 17: council pit work sized to the gravel and the pit (D6 to D10). 16: the council hires dozers to push up gravel at its pit. 15: rival outfits find work you never see, so they aren't idle for years; a bulk outfit with road gear still gets calls for its bulk gear. 14: bulk work pays 10% more again, and an outfit doing road and bulk work climbs by whichever is further along. 13: rewarded ads (a free mechanic, a late invoice paid, a weekly top-up). 12: finished bulk jobs come off the books. 11: your fitter patches or fixes breakdowns, and Run on goes by them. 10: roads rated for roadtrains, or singles only. 9: hire roadtrains on council jobs. 8: roadtrains. 7: a loader at the gravel pit. 6: Scott's hire schedule on a 10-hour day, and the 627. 5: bulk fuel and the diesel price. 2: Run on answers small cards itself. 3: playtest fixes (council bans, cover, Christmas). 4: DDES Advisory on WHS and tenders, the DDES ERP

export type SeasonId = 'wet2010' | 'dry2019' | 'prog2022';

export interface SeasonDef {
  id: SeasonId;
  town: 'gdi' | 'ct';
  /** The year the weather starts, from 1 April. */
  year: number;
  weeks: number;
  loan: number;
  /** Starts mid-career as a regional contractor with a program won. */
  preset?: 'regional';
}

export const SEASONS: readonly SeasonDef[] = [
  { id: 'wet2010', town: 'ct', year: 2010, weeks: 52, loan: 180000 },
  { id: 'dry2019', town: 'gdi', year: 2019, weeks: 52, loan: 80000 },
  { id: 'prog2022', town: 'gdi', year: 2022, weeks: 66, loan: 650000, preset: 'regional' },
];

export const seasonDef = (id: string): SeasonDef | undefined => SEASONS.find((x) => x.id === id);

export interface SeasonState {
  id: SeasonId;
  weeks: number;
  v: number;
  /** Net worth at the start: the score is what you add to it. */
  nw0: number;
  /** The program season ends when the program's delivered. */
  prog?: boolean;
  score?: number;
  /** Weeks played when it ended. */
  done?: number;
}

const round = (n: number, to: number) => Math.round(n / to) * to;

/** A season's career: the same seed and weather for everyone. co is only the company's name. */
export function startSeason(id: SeasonId, co: string): Career {
  const D = seasonDef(id)!, seed = hashN('season|' + D.id) + 1;
  const c = newCareer({ co, loan: D.loan, town: D.town, hc: false }, seed, wxStartFor(D.year));
  c.season = { id: D.id, weeks: D.weeks, v: SIM_VER, nw0: 0 } as SeasonState;
  c.alog = [];
  c.coach = { off: true } as Career['coach'];
  c.tabs = { map: 1, bank: 1, board: 1 };
  if (D.preset === 'regional') presetRegional(c);
  (c.season as SeasonState).nw0 = worth(c);
  c.acc = newAccounts(c.bank);
  return c;
}

/** The program season starts mid-career: two crews, staff, a depot, and a flood recovery program already won. */
function presetRegional(c: Career): void {
  const r = stream(c);
  const add = (t: MachineType, n: number) => {
    for (let i = 0; i < n; i++) {
      const m = newMachine(r, uid(c), t, int(r, 2012, 2019), int(r, 70, 86), int(r, 6000, 12000));
      m.svcAt = m.hours - int(r, 0, 150);
      c.fleet.push(m);
    }
  };
  add('grader', 2); add('roller', 2); add('cart', 4); add('truck', 2);
  const P = (role: Role, skill: Skill = 'solid') => {
    const nm = pick(r, NAMES.filter((n) => !c.staff.some((x) => x.name === n)));
    c.staff.push({ id: uid(c), name: nm, role, skill, wage: round(ROLES[role].wage * SKILLS[skill].pay, 50), off: 0, jobId: null });
  };
  P('grader', 'gun'); P('grader'); P('roller'); P('cart'); P('truck'); P('super');
  c.yard = 'regional';
  c.won = c.won2 = c.won3 = true;
  c.seenWin = c.seenWin2 = c.seenWin3 = true;
  c.rep = 24; c.subsWon = 4; c.subsDone = 4; c.ownWon = 2; c.ownDone = 2;
  c.whs.sys = 2;
  c.phase = 'play';
  c.bank = 220000;
  c.loan = { bal: 650000, weekly: weeklyRepay(650000), missed: 0, arrears: 0 } as Career['loan'];
  const w = worldRand(c, 'preset'), p = planCtx(c);
  c.offers = genOffers(w, c as never, fmul(c), c.won, c.won2);
  c.market = genMarket(w, { week: c.week, won: c.won, mood: mood(c), rivSell: c.rivSell, clear: c.clear }, () => uid(c));
  genTenders(w, c as never, canTender((t) => owns(c, t), c.rep, c.whs.sys), mood(c), fmul(c));
  genCouncil(w, c as never, p, fmul(c));
  for (let g = 0; g < 300 && !c.ctenders.some((t) => t.major); g++) genMajor(w, c as never, p, fmul(c), false);
  c.cands = genCandidates(w, { taken: c.staff.map((x) => x.name), ownContract: c.won2, workshop: YARDS[c.yard].svc < 1 }, () => uid(c));
  // You've already won the program: the season is about delivering it by 30 June, on budget, in the real 2022 weather.
  const pg = c.ctenders.find((t) => t.major);
  if (pg) {
    pg.pl.prog = autoPlan(pg, 2) as never;
    pg.mk = 0.25;
    const e = planEval(p, pg, pg.pl);
    pg.bid = round(e.cost * (1 + pg.mk) + overheads(c) * Math.max(8, e.wks || 20), 500);
    pg.mine = { method: e.method, pl: JSON.parse(JSON.stringify(pg.pl)) } as never;
    c.ctenders = c.ctenders.filter((t) => t !== pg);
    signOwn(c as never, planCtx(c), pg);
    staffOwn(c as never, null);
    c.ownWon = 2;
    (c.season as SeasonState).weeks = (pg.dlWeek as number) + 2;
    (c.season as SeasonState).prog = true;
  }
  note(c, { k: 'presetRegional', bid: pg ? pg.bid : null });
}

/** Net worth gained so far. */
export function seasonScore(c: Career): number {
  return Math.round(worth(c) - (c.season as SeasonState).nw0);
}

/** End of a week: is the season over? Past its weeks, or the program delivered. Ends it and returns true if so. */
export function seasonWeek(c: Career): boolean {
  const S = c.season as SeasonState | undefined;
  if (!S || !(c.week > S.weeks || (S.prog && (c.majorDone || 0) >= 1))) return false;
  S.score = seasonScore(c);
  S.done = c.week - 1;
  c.phase = 'seasonEnd';
  c.report = null;
  c.queue = [];
  note(c, { k: 'seasonOver', score: S.score, done: S.done });
  return true;
}

// ---------- the moves, recorded ----------

/** The moves the game itself offers (game.ts), by name. */
const GAME_MOVES = [
  'accept', 'approachRival', 'askWait', 'bid', 'borrowAgainstFleet', 'bringHome', 'buy', 'buyErp', 'buyFuelTank', 'cancelDiesel', 'closeBranchDepot', 'endWeek', 'fitGps', 'fitLaser', 'fuelAuto',
  'fixProperly', 'hammer', 'handOnNow', 'hireBranchManager', 'hireCand', 'hireManager', 'inspectListing', 'letGo', 'moveYard', 'open', 'orderNew',
  'openBranchDepot', 'openProgram', 'orderDiesel', 'payLoanDown', 'priceCheck', 'programAct', 'retireNow', 'ringAround', 'sellMachine', 'sendToBranch', 'service',
  'setHireMode', 'setMargin', 'setOverheadShare', 'setPlan', 'subOut', 'submitBid', 'submitCouncil', 'takeBack', 'toggleTalks',
  'unlistMachine', 'upgradeRoadtrain', 'upgradeSafety', 'withdrawBid',
] as const;
/** And the rest: answering a card, running quiet weeks on, and the coach. */
const OTHER_MOVES = ['choose', 'runOn', 'coachOk', 'coachOff'] as const;

/**
 * Everything a player can do that changes the game, by name. Screens call these through `play` (below), which
 * records each one in a season, so the season can be played again from its moves.
 */
export const COMMAND_NAMES: readonly string[] = [...GAME_MOVES, ...OTHER_MOVES];
const IS_COMMAND = new Set(COMMAND_NAMES);

type GameMove = (typeof GAME_MOVES)[number];
type Commands = { [K in GameMove]: (typeof game)[K] } & { choose: typeof choose; runOn: typeof runOn; coachOk: typeof coachOk; coachOff: typeof coachOff };
export type CommandName = keyof Commands;
/** One recorded move: the command and what it was called with (after the career). */
export type Move = [CommandName, ...unknown[]];

// looked up when called: this module and game.ts load each other, so nothing here can hold game's functions at load
function command(name: CommandName): (c: Career, ...a: unknown[]) => unknown {
  const other: Record<string, unknown> = { choose, runOn, coachOk, coachOff };
  return (name in other ? other[name] : (game as Record<string, unknown>)[name]) as (c: Career, ...a: unknown[]) => unknown;
}

/** Do a move, recording it if this is a season in play. */
export function perform(c: Career, name: CommandName, ...args: unknown[]): unknown {
  if (c.season && c.phase !== 'seasonEnd') (c.alog = (c.alog as Move[]) || []).push([name, ...args] as Move);
  return command(name)(c, ...args);
}

/**
 * The commands, for screens: `play.buy(c, id)` buys and records it. Same names and arguments as the game's own
 * functions, plus choose (answer a card), runOn and the coach.
 */
export const play = Object.fromEntries(COMMAND_NAMES.map((k) => [k, (c: Career, ...a: unknown[]) => perform(c, k as CommandName, ...a)])) as unknown as Commands;

export interface ReplayResult {
  ok: boolean;
  score?: number;
  week?: number;
  why?: string;
}

/**
 * Play a season again from its recorded moves. ok when the moves are all real commands and the season reached
 * its end; then score and week are what the moves actually earned, whatever anyone claims.
 */
export function replaySeason(id: string, moves: unknown, co = 'Replay'): ReplayResult {
  if (!seasonDef(id)) return { ok: false, why: 'no such season' };
  if (!Array.isArray(moves) || moves.length > 40000) return { ok: false, why: 'not a list of moves' };
  try {
    const c = startSeason(id as SeasonId, co);
    for (const m of moves) {
      if (c.phase === 'seasonEnd') break;
      if (!Array.isArray(m) || typeof m[0] !== 'string' || !IS_COMMAND.has(m[0])) return { ok: false, why: 'unknown move' };
      const [name, ...args] = m as [CommandName, ...unknown[]];
      if (args.some((a) => a !== null && typeof a === 'object' && !Array.isArray(a) && Object.getPrototypeOf(a) !== Object.prototype)) return { ok: false, why: 'bad move' };
      command(name)(c, ...args);
    }
    const S = c.season as SeasonState;
    return c.phase === 'seasonEnd' ? { ok: true, score: S.score!, week: S.done! } : { ok: false, why: 'the season never ended' };
  } catch (e) {
    return { ok: false, why: String((e as Error)?.message || e) };
  }
}

