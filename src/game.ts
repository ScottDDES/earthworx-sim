// The whole game: a career, starting one, the player's actions, and the week, in the prototype's exact order.
// Every roll comes from the career's own stream (rngA), from a seed for the week's new world (worldRand), or
// from a card's seed (cards.ts / choose.ts), exactly as the prototype draws them, so a career replays exactly.

import { bankWeek, newLoan, weeklyRepay, type Loan } from './bank';
import { yearOf } from './calendar';
import { DIFFICULTY, costIdx as costIdxOf, difficultyOf, type Difficulty } from './difficulty';
import { book, newAccounts, type Accounts } from './ledger';
import { TYPES, newMachine, serviced, svcCost, value, type Machine } from './machines';
import { MOODS, fmul as fmulOf, genMarket, marketWeek, newMarketMood, salesWeek, buyListing, lendCap, sell, unlist, inspect as inspectL, bid as bidL, hammer as hammerL, type HammerResult, type SellMode, type Market, type MarketMood, type Mood, type Listing, type SaleEvent } from './market';
import { fromState, hashN, int, seedRand, type Rand } from './rng';
import { mkRivals, rivalsWeek, type Rival, type RivalEvent } from './rivals';
import { newWhs, safetyWeek, type SafetyEvent, type Whs } from './safety';
import { YARDS, type YardId } from './yards';
import { TOWNS, type TownId } from './towns';
import { pickStart, rainMm, wetDay } from './weather';
import { dayOffset } from './calendar';
import { genCandidates, hire, wages, type Candidate, type Person } from './staff';
import { genMgrApplicants, hireMgr as hireMgrPerson, mgrIs, mgrOf, mgrTraitsWeek, mgrUnlocked, workshopCtx, type MgrRole, type MgrApplicant } from './managers';
import { afterService, fitterWeek, wsmWeek, type WorkshopEvent } from './workshop';
import { easeLoading, fleetValue, overheads as overheadsOf, premParts, premium as premiumOf } from './overheads';
import { accept as acceptOffer, askWait as askWaitHire, genOffers, recvWeek, startWeek, stars, uid, whyNot, type Offer, type Job, type JobLog, type HireEvent } from './hire';
import { relWeek } from './relations';
import { mRef, note, noteNews, type DiaryEntry } from './diary';
import { dmap, mapWeek, type DistrictMap, type MapEvent } from './map';
import { canTender, closeTender, crewDayCost, genTenders, otherContracts, setMk, subPrice, submitBid as submitBidT, withdrawBid as withdrawBidT, tbs, type CloseEvent, type Standing, type SubTender } from './tenders';
import { closeCouncil, councilPrice, genMajor, genCouncil, canPrestige, progAct as progActC, setCmk, setHm as setHmC, setOh, setPlan as setPlanC, submitCouncil as submitCouncilT, type CouncilEvent, type ProgOp } from './council';
import { autoPlan, planEval, type CouncilTender, type PlanCtx } from './planning';
import { endOfDay, jobDay, settleJob, staffOwn, staffSubs, seatStaff, subOut as subOutC, subQuotes, takeBack as takeBackC, terminateWeek, type ContractEvent, type SubQuote } from './contracts';
import { bankCalls, closeBooks, gstInBank, hardcoreWeek, netWorth, newGst, odLimit, payablesWeek, taxMode, taxWeek, yearEnd, type BankCallEvent, type GstState, type HardcoreEvent, type TaxEvent, type TaxMode, type WeekRow, type YearReview, type Payable } from './office';
import { borrow, borrowRoom, cashForecast, fixedWeek, payDown, runway, type ForecastWeek } from './books';
import { askSellUp, retire, retireOffer, sellUpWeek, shockWeek, type RetireOffer, type ShockEvent } from './shocks';
import { branchWeek, type Branch, type BranchEvent } from './branch';
import { curveWeek, rainCallCheck, rainCallDay, rainCrews, swmsWeek, type RainCallEvent } from './cards';
import { checkTix, checkWin, rung, tc, tcAdd, unlockWeek } from './career';

export interface Setup {
  co: string;
  loan: number;
  town: TownId;
  hc?: boolean;
}

/** A whole career. Fields are added by the parts of the game that use them. */
export interface Career {
  v: number;
  seq: number;
  wxStart: number;
  co: string;
  town: TownId;
  week: number;
  bank: number;
  loan: Loan;
  fleet: Machine[];
  jobs: Job[];
  offers: Offer[];
  recv: { id: string; client: string; amt: number; due: number; lateRolled: boolean; adm?: boolean }[];
  staff: Person[];
  cands: Candidate[];
  opCover: number;
  coverFor: string | null;
  youBlocked: number;
  youJob: string | null;
  rep: number;
  ins: number;
  blocked: Record<string, number>;
  market: Market | null;
  queue: { k: string; id?: string; sd?: number; [x: string]: any }[];
  phase: string;
  won: boolean;
  won2: boolean;
  won3: boolean;
  stats: { earned: number; [x: string]: number };
  yard: YardId;
  camera: boolean;
  cbLast: number;
  cbSeen: Record<string, number>;
  rivals: Rival[];
  tenders: SubTender[];
  ctenders: CouncilTender[];
  subsWon: number;
  subsDone: number;
  lds: number;
  ownWon: number;
  ownDone: number;
  ownLate: number;
  /** The site diary (last 40) and the district news (last 12), newest first. */
  log: DiaryEntry[];
  news: DiaryEntry[];
  rivSell: { type: Machine['type']; who: string }[];
  clear: { name: string; n: number }[];
  gone: string[];
  mkt: MarketMood;
  loanStart: number;
  repos: number;
  hardcore: boolean;
  whs: Whs;
  dmap?: DistrictMap;
  acc: Accounts;
  tb?: { s: [number, number]; c: [number, number]; since: number };
  gst?: GstState;
  hist?: WeekRow[];
  jlog?: JobLog[];
  years?: YearReview[];
  branch?: Branch | null;
  payables?: Payable[];
  unl?: Record<string, number>;
  rngSeed: string;
  rngA: number;
  [x: string]: any;
}

/** The week's new world rolls from its own seed, so it's the same whatever the player did that week. */
export function worldRand(c: Career, tag: string): Rand {
  return seedRand(hashN((c.rngSeed || 'x') + '|' + c.week + '|' + tag));
}

/** The career's own stream. */
export function stream(c: Career): Rand {
  const st = { get a() { return c.rngA; }, set a(v: number) { c.rngA = v; } };
  return fromState(st);
}

export function diff(c: Career): Difficulty {
  return difficultyOf(c.loanStart, c.hardcore);
}
export function mood(c: Career): Mood {
  return c.mkt ? (c.mkt.mood ?? 'steady') : 'steady';
}
export function fmul(c: Career): number {
  return fmulOf(c.mkt ?? null, (c.freeze ?? 0) > c.week);
}
export function costIdx(c: Career): number {
  return costIdxOf(c.week, diff(c));
}
export function room(c: Career): number {
  return YARDS[c.yard].slots - c.fleet.filter((m) => m.status !== 'branch').length;
}
export function homeFleet(c: Career): number {
  return c.fleet.filter((m) => m.status !== 'branch').length;
}
export function wctx(c: Career) {
  return workshopCtx(c.staff, homeFleet(c), YARDS[c.yard].svc, DIFFICULTY[diff(c)].brk, costIdx(c));
}
export function planCtx(c: Career): PlanCtx {
  return c as unknown as PlanCtx;
}
export function tax(c: Career): TaxMode {
  return taxMode(c.loanStart, c.hardcore);
}
export function owns(c: Career, t: string): boolean {
  return c.fleet.some((m) => m.type === t && m.status !== 'auction');
}
export function hasCrew(c: Career): boolean {
  return owns(c, 'grader') && owns(c, 'roller') && owns(c, 'cart');
}
export function overheads(c: Career): number {
  const prem = premiumOf(premParts(fleetValue(c.fleet, c.week), wages(c.staff)), c, c.whs.sys, c.week);
  return overheadsOf({ premium: prem, rent: YARDS[c.yard].rent, wages: wages(c.staff), whsSys: c.whs.sys, talks: c.whs.talks, crews: rainCrews(c.jobs), costIdx: costIdx(c) });
}
export function capFull(c: Career): boolean {
  return !c.staff.some((p) => p.role === 'ops' && p.off === 0) && c.jobs.filter((j) => (j.kind === 'sub' || j.kind === 'own') && !j.finished).length >= 2;
}
export function standing(c: Career): Standing {
  const od = odLimit(c);
  const stretched = c.loan.missed > 0 || (c.odOver || 0) > 0 || (od > 0 && c.bank < -0.8 * od) || !!(c.hardcore && c.under);
  return { rep: c.rep, whs: c.whs, week: c.week, stretched, contracts: otherContracts(c.jobs), soft: !!DIFFICULTY[diff(c)].soft, rel: c.rel };
}
export function worth(c: Career): number {
  return netWorth(c, tax(c));
}
function lastSerious(c: Career): number | null {
  const W = c.whs.inc.filter((x) => x.sev === 'lti' || x.sev === 'serious');
  return W.length ? W[0]!.w : null;
}
export function tickets(c: Career): string[] {
  return checkTix(c as never, { netWorth: () => worth(c), lastSerious: lastSerious(c) });
}

// ---------- starting a career ----------

/** The machines for sale on day one: a few graders, rollers and a cart, dealers and private. */
export function starterListings(rand: Rand): Listing[] {
  const mk = (t: Machine['type'], y: number, seller: 'dealer' | 'private', cond: number, hide: number): Listing => {
    const hours = (2027 - y) * int(rand, 700, 850), claimed = Math.min(92, cond + hide);
    return { id: 'L' + t + y, type: t, year: y, cond, hours, seller, revealed: seller === 'dealer', claimed,
      price: Math.round((value({ type: t, year: y, cond: claimed }, 1) * (seller === 'dealer' ? 1.12 : 0.95)) / 500) * 500 };
  };
  return [mk('grader', 2004, 'private', 58, 7), mk('grader', 2008, 'dealer', 72, 0), mk('grader', 2014, 'dealer', 86, 0),
    mk('roller', 2010, 'private', 64, 6), mk('roller', 2015, 'dealer', 82, 0), mk('cart', 2009, 'private', 60, 8)];
}

/**
 * A new career from the setup screen. seed: the career's seed (everything rolls from it). wxStart: which real
 * year's rain it replays; the prototype picks it outside the seed, so it can be passed in.
 */
export function newCareer(setup: Setup, seed: number, wxStart?: number): Career {
  const rand = seedRand(seed);
  const c = {
    v: 1, seq: 0, wxStart: wxStart ?? pickStart(seedRand(seed ^ 0x5bd1e995)), co: setup.co.trim() || 'Black Soil Earthmoving', town: setup.town, week: 1,
    bank: 40000 + setup.loan, loan: newLoan(setup.loan), fleet: [], jobs: [], offers: [], recv: [], staff: [], cands: [], opCover: 0, coverFor: null, youBlocked: 0,
    rep: 0, ins: 1, blocked: {}, market: null, queue: [], log: [], phase: 'shop', won: false, seenWin: false, stats: { earned: 0 }, yard: 'home', camera: false,
    cbLast: 0, cbSeen: {}, rivals: mkRivals(rand, setup.town), tenders: [], subsWon: 0, subsDone: 0, lds: 0, won2: false, seenWin2: false,
    ctenders: [], ownWon: 0, ownDone: 0, ownLate: 0, won3: false, seenWin3: false,
  } as unknown as Career;
  c.market = { listings: starterListings(rand), lot: null as never };
  c.news = [];
  c.rivSell = [];
  c.clear = [];
  c.gone = [];
  c.mkt = newMarketMood({ town: c.town, wxStart: c.wxStart }, 1);
  marketWeek(c.mkt, { town: c.town, wxStart: c.wxStart }, 1);
  c.cands = genCandidates(rand, { taken: [], ownContract: false, workshop: false }, () => uid(c));
  c.loanStart = setup.loan;
  c.repos = 0;
  c.hardcore = !!setup.hc;
  c.whs = newWhs(false);
  dmap(rand, c as never);
  c.acc = newAccounts(c.bank);
  tbs(c as never);
  c.gst = newGst();
  c.rngSeed = String(seed);
  c.rngA = seed;
  c.youJob = null;
  note(c, { k: 'started', co: c.co, town: c.town, loan: setup.loan });
  return c;
}

/** Open for business: the first week's work, market and tenders. */
export function open(c: Career): void {
  c.phase = 'play';
  const rand = worldRand(c, 'open');
  c.offers = genOffers(rand, c as never, fmul(c), c.won, c.won2);
  c.market = genMarket(rand, { week: c.week, won: c.won, mood: mood(c), rivSell: c.rivSell, clear: c.clear }, () => uid(c));
  genTenders(rand, c as never, canTender((t) => owns(c, t), c.rep, c.whs.sys), mood(c), fmul(c));
  note(c, { k: 'open' });
}

// ---------- the player's actions ----------

export function buy(c: Career, id: string, fin = false): boolean {
  // the prototype only numbers the machine once the purchase goes through, so the id is set after
  const res = buyListing(stream(c), c as never, id, fin, room(c), lendCap(fleetValue(c.fleet, c.week), c.won, c.won2, c.won3), c.won, '');
  if (res.ok) res.machine.id = uid(c);
  return res.ok;
}

/** Pay a mechanic $600 to check a listing's real condition. */
export function inspectListing(c: Career, id: string): boolean {
  return inspectL(c as never, id);
}

/** Raise your bid at this week's auction. */
export function bid(c: Career, n: number): void {
  if (c.market) bidL(c.market.lot, n, room(c));
}

/** Let the hammer fall on this week's lot. */
export function hammer(c: Career): HammerResult | null {
  if (!c.market) return null;
  const lot = c.market.lot;
  if (lot.done) return null;
  const res = hammerL(stream(c), c as never, lot, '');
  if (res && res.k === 'won') {
    res.machine.id = uid(c);
    tcAdd(c as never, 'auction');
    tickets(c);
    note(c, { k: 'wonAuction', m: mRef(res.machine), total: res.total });
  }
  return res;
}

/** How far into the overdraft the bank lets you go. */
export function odLimitOf(c: Career): number {
  return odLimit(c);
}

/** The next n weeks of cash. */
export function cashAhead(c: Career, n = 12): ForecastWeek[] {
  return cashForecast(c, n, overheads(c), !!c.gst && gstInBank(tax(c)));
}

/** Weeks of fixed costs the cash and overdraft cover. */
export function runwayWeeks(c: Career): number {
  return runway(c.bank, odLimit(c), fixedWeek(overheads(c), c.loan));
}

/** How much more the bank will lend against the fleet. */
export function canBorrow(c: Career): number {
  return borrowRoom(lendCap(fleetValue(c.fleet, c.week), c.won, c.won2, c.won3), c.loan);
}

/** Borrow against the fleet. Returns what was lent. */
export function borrowAgainstFleet(c: Career, amt: number): number {
  return borrow(c as never, amt, canBorrow(c));
}

/** Pay the loan down. Returns what came off it. */
export function payLoanDown(c: Career, amt: number): number {
  return payDown(c as never, amt);
}

/** Ring around about selling: false and why if nobody will talk. */
export function ringAround(c: Career): 'asked' | 'tooSoon' | 'nobody' {
  if (c.week - (c.sellAsk ?? -99) < 4) return 'tooSoon';
  if (!askSellUp(c as never, true)) {
    c.sellAsk = c.week;
    return 'nobody';
  }
  return 'asked';
}

/** What a buyer would pay if you sold up and retired now. */
export function retireQuote(c: Career): RetireOffer {
  return retireOffer(c as never, mood(c), stars(c.rep), c.gst && gstInBank(tax(c)) ? c.gst.held : 0);
}

/** Sell up and retire: the career ends. */
export function retireNow(c: Career): void {
  if (!c.won || c.phase !== 'play') return;
  const g = rung(c as never);
  retire(c as never, mood(c), stars(c.rep), c.gst && gstInBank(tax(c)) ? c.gst.held : 0, { stage: g, peak: g });
}

/** Approach a struggling rival about buying them out: their offer comes up as a card. */
export function approachRival(c: Career, name: string): void {
  if (!c.queue.some((q) => q.k === 'buyout' && q.name === name)) c.queue.push({ k: 'buyout', name });
}

export function accept(c: Career, id: string): boolean {
  return !!acceptOffer(c as never, id);
}

export function hireCand(c: Career, id: string): boolean {
  const cd = c.cands.find((x) => x.id === id);
  if (!cd) return false;
  c.cands = c.cands.filter((x) => x !== cd);
  c.staff.push(hire(cd, cd.ask, uid(c)));
  seatStaff(c as never);
  tcAdd(c as never, 'hired');
  tickets(c);
  note(c, { k: 'hired', name: cd.name, role: cd.role, wage: cd.ask });
  return true;
}

export function hireManager(c: Career, role: MgrRole, id: string): boolean {
  if (!mgrUnlocked(role, c.won2, YARDS[c.yard].svc < 1) || mgrOf(c.staff, role)) return false;
  const M = c.mgrs && c.mgrs[role], cd = M && (M.c as MgrApplicant[]).find((x) => x.id === id);
  if (!cd) return false;
  M.c = M.c.filter((x: MgrApplicant) => x !== cd);
  c.staff.push(hireMgrPerson(cd, uid(c)));
  tcAdd(c as never, 'hired');
  tickets(c);
  note(c, { k: 'hiredMgr', name: cd.name, trait: cd.trait, role, wage: cd.ask });
  return true;
}

export function moveYard(c: Career, k: YardId): boolean {
  const Y = YARDS[k];
  if (!Y || k === c.yard || c.fleet.length > Y.slots || c.bank < Y.setup || (k === 'depot' && !c.won) || (k === 'regional' && !c.won2) || (k === 'hub' && !c.won3)) return false;
  c.bank -= Y.setup;
  book(c.acc, 'capital', Y.setup);
  c.yard = k;
  note(c, { k: 'movedYard', yard: k, setup: Y.setup });
  return true;
}

export function submitBid(c: Career, id: string): boolean {
  const t = c.tenders.find((x) => x.id === id);
  if (!t) return false;
  return submitBidT(c as never, id, subPrice(t, overheads(c), otherContracts(c.jobs), crewDayCost(c.fleet, c.yard)).price, capFull(c));
}

export function submitCouncil(c: Career, id: string): boolean {
  return submitCouncilT(planCtx(c), c as never, id, overheads(c), otherContracts(c.jobs), capFull(c));
}

// ---------- the week ----------

export interface Report {
  week: number;
  rain: number;
  mm: number;
  worked: number;
  lost: number;
  invoiced: number;
  paid: number;
  costs: number;
  events: unknown[];
  tix: string[];
  /** Each day's rain, and whether it stopped work. */
  days: { wet: boolean; mm: number }[];
  /** The jobs on the books when the week started, so the docket can name ones that finished. Not saved. */
  jobs?: Record<string, Job>;
}

/** The week's own events, beside the ones each part of the engine reports. */
export type WeekEvent =
  | { k: 'caughtUp'; amt: number }
  | { k: 'missedRepay'; n: number }
  | { k: 'paidOff' }
  | { k: 'mood'; mood: Mood }
  | { k: 'unlocked'; id: string };

/** The end of the week. Does nothing while a card is waiting. */
export function endWeek(c: Career): Report | null {
  if (c.phase !== 'play' || c.queue.length) return null;
  const rand = stream(c), d = diff(c), wx = { town: c.town, wxStart: c.wxStart };
  const rep: Report = { week: c.week, rain: 0, mm: 0, worked: 0, lost: 0, invoiced: 0, paid: 0, costs: 0, events: [], tix: [], days: [] };
  const ev = rep.events as (ContractEvent | WorkshopEvent | SafetyEvent | RainCallEvent | BankCallEvent | ShockEvent | HardcoreEvent | SaleEvent | RivalEvent | MapEvent | CloseEvent | CouncilEvent | BranchEvent | TaxEvent | HireEvent | WeekEvent)[];
  const BK = { pays: 0, odi: 0, lc: 0, li: 0 };
  Object.defineProperty(rep, 'jobs', { value: Object.fromEntries(c.jobs.map((j) => [j.id, j])), enumerable: false });

  staffSubs(c as never, null);
  staffOwn(c as never, null);
  terminateWeek(c as never, ev as ContractEvent[]);

  const downDays: Record<string, number> = {};
  startWeek(c);
  for (let day = 0; day < 5; day++) {
    let wet = wetDay(wx, c.week, day);
    const rcEv: RainCallEvent[] = [];
    wet = rainCallDay(c as never, wx, day, wet, rep, rcEv);
    for (const e of rcEv) {
      if ((e.k === 'stoodDown' && e.right) || e.k === 'missedUs') tcAdd(c as never, 'rainRight');
      ev.push(e);
    }
    if (wet) rep.rain++;
    rep.mm += rainMm(wx, dayOffset(c.week, day));
    rep.days.push({ wet, mm: rainMm(wx, dayOffset(c.week, day)) });
    const w = wctx(c);
    for (const j of c.jobs) jobDay(rand, c as never, j, day, wet, w, rep, downDays, ev as ContractEvent[]);
    endOfDay(c as never, day, ev as ContractEvent[]);
  }
  const oldhand = mgrIs(c.staff, 'oldhand');
  for (const j of c.jobs.slice()) {
    const before = ev.length;
    settleJob(rand, c as never, j, rep, downDays, oldhand, ev as ContractEvent[]);
    for (const e of ev.slice(before) as ContractEvent[]) {
      if (e.k === 'finished' && ['wet', 'dry', 'council', 'private'].includes(e.kind)) tcAdd(c as never, 'hires');
      if (e.k === 'ownFinished' && e.early) tcAdd(c as never, 'early');
    }
  }
  const w = wctx(c);
  rep.costs += fitterWeek(rand, c as never, w, ev as WorkshopEvent[]);
  rep.costs += wsmWeek(rand, c as never, w, odLimit(c), ev as WorkshopEvent[]);
  if (c.branch) branchWeek(rand, c as never, w, fmul(c), DIFFICULTY[d].mg, costIdx(c), c.whs.sys, rep, c.acc, ev as BranchEvent[]);
  rep.costs += safetyWeek(rand, c as never, rep.worked, d, c.queue, ev as SafetyEvent[]);
  for (const j of c.jobs) if ((j.stood ?? 0) > 0) j.stood!--;

  const over = overheads(c);
  c.bank -= over;
  rep.costs += over;
  easeLoading(c);
  BK.pays = payablesWeek(c, rep);
  recvWeek(rand, c as never, rep, DIFFICULTY[d].late, mgrIs(c.staff, 'numbers'), ev as HireEvent[]);
  const od = odLimit(c);
  const bw = bankWeek(c, od);
  BK.odi = bw.odInterest;
  BK.li = bw.loanInterest;
  BK.lc = bw.paid - bw.odInterest;
  rep.costs += bw.paid;
  if (bw.caughtUp) ev.push({ k: 'caughtUp', amt: bw.caughtUp });
  if (bw.missedNow) {
    ev.push({ k: 'missedRepay', n: c.loan.missed });
    note(c, { k: 'missedRepay', n: c.loan.missed });
  }
  bankCalls(c, od, ev as BankCallEvent[]);
  shockWeek(rand, c as never, d, ev as ShockEvent[], ev as HireEvent[]);
  relWeek(c);
  sellUpWeek(rand, c as never, odLimit(c));
  const nw = worth(c);
  const hcEv: HardcoreEvent[] = [];
  hardcoreWeek(c, nw, () => ({ stage: rung(c as never), peak: rung(c as never), earned: Math.round(c.stats.earned), fleet: c.fleet.length, tix: Object.keys(c.tix || {}).length }), hcEv);
  if (hcEv.some((e) => e.k === 'backAbove')) tcAdd(c as never, 'brink');
  ev.push(...hcEv);
  if (c.loan.bal <= 0 && !c.loan.paidOff) {
    c.loan.bal = 0;
    c.loan.paidOff = true;
    ev.push({ k: 'paidOff' });
  }
  salesWeek(rand, c as never, mood(c), ev as SaleEvent[]);
  for (const p of c.staff) if (p.off > 0) p.off--;
  c.cands = genCandidates(worldRand(c, 'cands'), { taken: c.staff.map((p) => p.name), ownContract: c.won2, workshop: YARDS[c.yard].svc < 1 }, () => uid(c));
  if (c.opCover > 0) c.opCover--;
  if (c.youBlocked > 0) c.youBlocked--;
  swmsWeek(c as never, hasCrew(c), stars(c.rep));
  curveWeek(rand, c as never, room(c), YARDS[c.yard].theft);

  for (const t of c.tenders.slice()) {
    if (t.close === c.week) {
      closeTender(rand, c as never, t, standing(c), c.co, mood(c), ev as CloseEvent[]);
      c.tenders = c.tenders.filter((x) => x !== t);
    }
  }
  for (const t of c.ctenders.slice()) {
    if (t.close === c.week) {
      closeCouncil(rand, c as never, planCtx(c), t, standing(c), c.co, mood(c), DIFFICULTY[d].ef, ev as CouncilEvent[]);
      c.ctenders = c.ctenders.filter((x) => x !== t);
    }
  }
  const turned = marketWeek(c.mkt, wx, c.week);
  if (turned) {
    ev.push({ k: 'mood', mood: turned });
    noteNews(c, { k: 'mood', mood: turned });
  }
  // what the rivals and the floods did goes in the diary and the news too
  const said = ev.length;
  rivalsWeek(rand, c as never, { fmul: fmul(c), mood: mood(c), mg: DIFFICULTY[d].mg, spawn: DIFFICULTY[d].spawn, canBuyOut: !!c.won2 && !c.loan.missed, won2: c.won2, won3: c.won3 }, ev as RivalEvent[]);
  mapWeek(rand, c.dmap!, c.week, fmul(c), mood(c), rep.mm, c.rivals.map((x) => x.name), ev as MapEvent[]);
  for (const e of ev.slice(said)) noteNews(c, e as never);
  const T = tc(c as never);
  if (c.jobs.filter((j) => (j.kind === 'sub' || j.kind === 'own') && (j.state === 'running' || j.state === 'subbed') && !j.finished).length >= 2) T.crews2 = 1;
  if (mood(c) === 'bust') {
    if (!T.bust) T.bust = { w: c.week, repos: c.repos || 0 };
  } else if (T.bust) {
    if (c.week - T.bust.w >= 8 && (c.repos || 0) === T.bust.repos) tcAdd(c as never, 'bustOk');
    T.bust = null;
  }
  if (c.won && T.safeFrom == null) T.safeFrom = c.week;

  c.week++;
  const wr = worldRand(c, 'world');
  c.offers = genOffers(wr, c as never, fmul(c), c.won, c.won2);
  c.market = genMarket(wr, { week: c.week, won: c.won, mood: mood(c), rivSell: c.rivSell, clear: c.clear }, () => uid(c));
  genTenders(wr, c as never, canTender((t) => owns(c, t), c.rep, c.whs.sys), mood(c), fmul(c));
  genCouncil(wr, c as never, planCtx(c), fmul(c));
  genMajor(wr, c as never, planCtx(c), fmul(c), canPrestige(c as never, c.whs.sys, c.yard));
  checkWin(c as never);
  for (const id of unlockWeek(c as never)) { ev.push({ k: 'unlocked', id }); note(c, { k: 'unlocked', id }); }
  mgrWeek(c, rand);
  rainCallCheck(c as never, wx);
  rep.tix = tickets(c);
  closeBooks(c as never, { w: rep.week, invoiced: rep.invoiced, paid: rep.paid, rain: rep.rain, over, premium: premiumOf(premParts(fleetValue(c.fleet, c.week), wages(c.staff)), c, c.whs.sys, c.week), rent: YARDS[c.yard].rent, wages: wages(c.staff), staffN: c.staff.length, mode: tax(c) }, BK);
  taxWeek(c as never, rep.week, tax(c), ev as TaxEvent[], () => {
    yearEnd(Object.assign(c, { staffN: c.staff.length, fleetN: c.fleet.length }) as never, rep.week, worth(c));
  });
  c.report = rep;
  return rep;
}

/** New manager applicants every 12 weeks once you've run your own contract, and the managers' weekly quirks. */
function mgrWeek(c: Career, rand: Rand): void {
  if (!c.won2) return;
  c.mgrs = c.mgrs || {};
  for (const role of ['ops', 'wsm'] as const) {
    const M = c.mgrs[role];
    if (M && M.w + 12 > c.week) continue;
    c.mgrs[role] = { w: c.week, c: genMgrApplicants(rand, role, c.staff.map((p) => p.name), costIdx(c), () => uid(c)) };
  }
  c.ygSlow = mgrTraitsWeek(rand, c.staff, c.week, c.whs);
}


/** Book a dealer service: condition back up, and sometimes it turns up a fault (a card, or the workshop manager deals with it). */
export function service(c: Career, id: string): boolean {
  const m = c.fleet.find((x) => x.id === id);
  if (!m) return false;
  const w = wctx(c), cost = svcCost(m, w);
  if (c.bank + odLimit(c) < cost) return false;
  c.bank -= cost;
  book(c.acc, 'workshop', cost);
  tcAdd(c as never, 'svc');
  serviced(m, 'dealer');
  note(c, { k: 'serviced', type: m.type, cost });
  afterService(stream(c), c as never, m, null, w, []);
  return true;
}

/** Take a privately listed machine off sale. */
export function unlistMachine(c: Career, id: string): void {
  const m = c.fleet.find((x) => x.id === id);
  if (m) unlist(c, m);
}

/** Sell an idle machine: trade it in, put it in the auction, or list it privately. */
export function sellMachine(c: Career, id: string, mode: SellMode): boolean {
  return sell(stream(c), c as never, id, mode, mgrIs(c.staff, 'dealer')) != null;
}

/** Ring a client to ask them to wait for your machine, booking the job in behind the current one. */
export function askWait(c: Career, id: string) {
  return askWaitHire(stream(c), c as never, { town: c.town, wxStart: c.wxStart }, id);
}

/** Change your margin on a subbie or council tender (your price has to go in again). */
export function setMargin(c: Career, id: string, d: number): void {
  const t = c.tenders.find((x) => x.id === id);
  if (t) setMk(c as never, id, d);
  else {
    const ct = c.ctenders.find((x) => x.id === id);
    if (ct) setCmk(ct, d);
  }
}

/** Carry more or less of your overheads on a tender, in quarters. */
export function setOverheadShare(c: Career, id: string, d: number): void {
  const t = c.tenders.find((x) => x.id === id) ?? c.ctenders.find((x) => x.id === id);
  if (t) setOh(t, d, otherContracts(c.jobs));
}

export function withdrawBid(c: Career, id: string): void {
  withdrawBidT(c as never, id);
}

/**
 * This week's quotes from local outfits to take a waiting contract off your hands. The prototype rolls these
 * with Math.random while it draws the screen; here each job's quotes have their own seed for the week.
 */
export function quotes(c: Career, jobId: string): SubQuote[] {
  const j = c.jobs.find((x) => x.id === jobId);
  return j ? subQuotes(worldRand(c, 'quotes|' + jobId), c as never, j) : [];
}

export function subOut(c: Career, jobId: string, i: number): boolean {
  quotes(c, jobId);
  return subOutC(worldRand(c, 'quotes|' + jobId), c as never, jobId, i);
}

export function takeBack(c: Career, jobId: string): boolean {
  return takeBackC(c as never, jobId);
}

/** Change a council plan: crews, graders, rollers, carts, trucks a crew, the pit, subbie crews, or how many of your own ('own:grader'). */
export function setPlan(c: Career, id: string, k: string, d: number): void {
  const t = c.ctenders.find((x) => x.id === id);
  if (t) setPlanC(planCtx(c), t, k as never, d);
}

/** Hire a machine type dry (your casual drives) or wet (a subbie with operator). */
export function setHireMode(c: Career, id: string, k: string, v: 'dry' | 'wet'): void {
  const t = c.ctenders.find((x) => x.id === id);
  if (t) setHmC(t, k, v);
}

/**
 * Open a flood recovery program for planning. The first time, its roads are split between three crews.
 * (The prototype does this when the sheet is first drawn, so it's a step of its own here.)
 */
export function openProgram(c: Career, id: string): void {
  const t = c.ctenders.find((x) => x.id === id);
  if (t && t.major && !t.pl.prog) t.pl.prog = autoPlan(t, 3);
}

/** Change a program's crews and roads (see council.progAct). */
export function programAct(c: Career, id: string, op: ProgOp): void {
  const t = c.ctenders.find((x) => x.id === id);
  if (t) progActC(t, op);
}

/** A council tender's plan as it stands: weeks, cost, method points, what's holding it up, and your price. */
export function evaluate(c: Career, id: string) {
  const t = c.ctenders.find((x) => x.id === id);
  if (!t) return null;
  const e = planEval(planCtx(c), t, t.pl);
  return { e, price: councilPrice(t, e, overheads(c), otherContracts(c.jobs)) };
}

/** This week's insurance premium. */
export function premiumNow(c: Career): number {
  return premiumOf(premParts(fleetValue(c.fleet, c.week), wages(c.staff)), c, c.whs.sys, c.week);
}
