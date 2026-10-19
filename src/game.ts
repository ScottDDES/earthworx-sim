// The whole game: a career, starting one, the player's actions, and the week, in the prototype's exact order.
// Every roll comes from the career's own stream (rngA), from a seed for the week's new world (worldRand), or
// from a card's seed (cards.ts / choose.ts), exactly as the prototype draws them, so a career replays exactly.

import { bankWeek, newLoan, weeklyRepay, type Loan } from './bank';
import { yearOf } from './calendar';
import { DIFFICULTY, costIdx as costIdxOf, difficultyOf, type Difficulty } from './difficulty';
import { book, newAccounts, type Accounts } from './ledger';
import { GPS_COST, TYPES, isBulk, newMachine, serviced, svcCost, value, type Machine } from './machines';
import { MOODS, fmul as fmulOf, genBulkListings, genMarket, marketWeek, newMarketMood, salesWeek, buyListing, lendCap, sell, unlist, inspect as inspectL, bid as bidL, hammer as hammerL, type HammerResult, type SellMode, type Market, type MarketMood, type Mood, type Listing, type SaleEvent } from './market';
import { fromState, hashN, int, pick, seedRand, type Rand } from './rng';
import { mkRivals, rivalsWeek, type Rival, type RivalEvent } from './rivals';
import { newWhs, safetyWeek, upgradeWhs, type SafetyEvent, type Whs } from './safety';
import { YARDS, type YardId } from './yards';
import { TOWNS, type TownId } from './towns';
import { pickStart, rainMm, wetDay } from './weather';
import { dayOffset, shutWeek } from './calendar';
import { SKILLS, genBulkCandidate, genCandidates, hire, wages, type Candidate, type Person } from './staff';
import { genMgrApplicants, hireMgr as hireMgrPerson, mgrIs, mgrOf, mgrTraitsWeek, mgrUnlocked, workshopCtx, type MgrRole, type MgrApplicant } from './managers';
import { afterService, fitterWeek, wsmWeek, type WorkshopEvent } from './workshop';
import { easeLoading, fleetValue, overheads as overheadsOf, premParts, premium as premiumOf } from './overheads';
import { compat } from './compat';
import { buyAttachment, bulkStart, bulkWeek, damDay, sendQuote, setPrecon, type Attachment, setRate, survey, type BulkBook, type BulkEvent } from './bulk';
import { ERP_SETUP, PRICE_CHECK_FEE, erpOk, priceBand } from './advisory';
import { BID_ODDS, rvOHFor } from './rivals';
import { accept as acceptOffer, askWait as askWaitHire, barred, coverOff, genOffers, recvWeek, startWeek, stars, uid, whyNot, type Offer, type Job, type JobLog, type HireEvent } from './hire';
import { relWeek } from './relations';
import { seasonWeek } from './seasons';
import { coachTick, tabsWeek, type CoachState } from './coach';
import { mRef, note, noteNews, type DiaryEntry } from './diary';
import { dmap, mapWeek, type DistrictMap, type MapEvent } from './map';
import { STD_CREW_DAY, tCost as tCostOf, subWks as subWksOf, canTender, closeTender, crewDayCost, genTenders, otherContracts, setMk, subPrice, submitBid as submitBidT, withdrawBid as withdrawBidT, tbs, type CloseEvent, type Standing, type SubTender } from './tenders';
import { closeCouncil, councilPrice, genMajor, genCouncil, canPrestige, progAct as progActC, setCmk, setHm as setHmC, setOh, setPlan as setPlanC, submitCouncil as submitCouncilT, type CouncilEvent, type ProgOp } from './council';
import { autoPlan, planEval, stdPlan, type CouncilTender, type PlanCtx } from './planning';
import { endOfDay, jobDay, settleJob, staffOwn, staffSubs, seatStaff, subOut as subOutC, subQuotes, takeBack as takeBackC, terminateWeek, type ContractEvent, type SubQuote } from './contracts';
import { bankCalls, closeBooks, gstInBank, hardcoreWeek, netWorth, newGst, odLimit, payablesWeek, taxMode, taxWeek, yearEnd, type BankCallEvent, type GstState, type HardcoreEvent, type TaxEvent, type TaxMode, type WeekRow, type YearReview, type Payable } from './office';
import { borrow, borrowRoom, cashForecast, fixedWeek, payDown, runway, type ForecastWeek } from './books';
import { askSellUp, handOn, inherit, retire, retireOffer, sellUpWeek, shockWeek, type RetireOffer, type ShockEvent } from './shocks';
import { branchWeek, closeBranch, hireBrMgr, openBranch, toBranch, toHome, type Branch, type BranchEvent, type BranchMgrKind } from './branch';
import { curveWeek, rainCallCheck, rainCallDay, rainCrews, swmsWeek, type RainCallEvent } from './cards';
import { checkTix, checkWin, rung, tc, tcAdd, unlockWeek, unlocked } from './career';

export interface Setup {
  co: string;
  loan: number;
  town: TownId;
  hc?: boolean;
  /** Start with the Bulk and Ag pack on. */
  bulk?: boolean;
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
  /** Running the DDES ERP. */
  erp?: boolean;
  /** Expansion packs switched on. Bulk and Ag is behind a test switch until it's sold as a pack. */
  packs?: { bulk?: boolean };
  /** The Bulk and Ag pack's farm enquiries. */
  bulk?: BulkBook;
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
  /** The getting-started coach, the tabs unlocked so far (and which are new), and the mentor notes read. */
  coach?: CoachState;
  tabs?: Record<string, number>;
  tabsNew?: Record<string, number>;
  tipsSeen?: Record<string, number>;
  tipsOff?: boolean;
  /** A season (a short scored game) and its recorded moves. */
  season?: import('./seasons').SeasonState;
  alog?: unknown[];
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
  return overheadsOf({ premium: prem, rent: YARDS[c.yard].rent, wages: wages(c.staff), whsSys: c.whs.sys, talks: c.whs.talks, crews: rainCrews(c.jobs), costIdx: costIdx(c), erp: !!c.erp });
}

/** What the DDES ERP saves (or would save) a week, after its own fee. */
export function erpSaving(c: Career): number {
  const was = c.erp;
  c.erp = false;
  const off = overheads(c);
  c.erp = true;
  const on = overheads(c);
  c.erp = was;
  return off - on;
}

/** Put in the DDES ERP: a regional depot or bigger, once. */
export function buyErp(c: Career): boolean {
  if (c.erp || !erpOk(c.yard) || c.bank < ERP_SETUP) return false;
  c.bank -= ERP_SETUP;
  c.erp = true;
  return true;
}

/**
 * Ask DDES Advisory to check a tender price: for a fee, a band for the sharpest price a rival will put in, from
 * who's in town, their costs and their margins. The luck on the day isn't in it, and nor is the non-price score.
 */
export function priceCheck(c: Career, id: string): boolean {
  const t = c.tenders.find((x) => x.id === id);
  if (t) {
    if (t.adv || t.direct || c.bank < PRICE_CHECK_FEE.sub) return false;
    const std = tCostOf(t, STD_CREW_DAY);
    const band = priceBand(c.rivals.filter((x) => BID_ODDS.sub[x.tier] > 0).map((x) => (std * x.eff + rvOHFor(x, subWksOf(t))) * (1 + x.margin)), 100);
    if (!band) return false;
    c.bank -= PRICE_CHECK_FEE.sub;
    t.adv = band;
    return true;
  }
  const ct = c.ctenders.find((x) => x.id === id);
  if (!ct || ct.adv) return false;
  const fee = ct.major ? PRICE_CHECK_FEE.major : PRICE_CHECK_FEE.council, kind = ct.major ? 'major' : 'council';
  if (c.bank < fee) return false;
  const sp = stdPlan(planCtx(c), ct), ef = DIFFICULTY[diff(c)].ef;
  let who = c.rivals.filter((x) => BID_ODDS[kind][x.tier] > 0);
  if (ct.prestige && c.rivals.some((x) => x.tier === 'big')) who = c.rivals.filter((x) => x.tier === 'big');
  const band = priceBand(who.map((x) => (sp.e.cost * Math.max(ef || 0.95, x.eff) + rvOHFor(x, sp.e.wks)) * (1 + x.margin + (ct.prestige ? 0.06 : 0))), 500);
  if (!band) return false;
  c.bank -= fee;
  ct.adv = band;
  return true;
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
  c.coach = { i: 0, at: 1 };
  c.tabs = {};
  if (setup.bulk) setPack(c, 'bulk', true);
  note(c, { k: 'started', co: c.co, town: c.town, loan: setup.loan });
  return c;
}

/** The Bulk and Ag machines join the week's listings when the pack is on. */
function bulkMarket(c: Career): void {
  if (c.packs?.bulk && c.market) c.market.listings.push(...genBulkListings(worldRand(c, 'bulk'), c.week, mood(c), () => uid(c)));
}

/** Switch an expansion pack on or off (a test switch for now; never in a leaderboard season). */
export function setPack(c: Career, pack: 'bulk', on: boolean): boolean {
  if (c.season) return false;
  const was = !!c.packs?.[pack];
  c.packs = { ...(c.packs || {}), [pack]: on };
  if (on && !was) bulkMarket(c);
  if (!on && c.market) c.market.listings = c.market.listings.filter((m) => !isBulk(m.type));
  return true;
}

/** Bulk and Ag: pay a surveyor, move your rate per m³, send the price. (Not recorded: the pack is never in a season.) */
export function damSurvey(c: Career, id: string): boolean {
  return survey(c as never, id);
}
export function damRate(c: Career, id: string, d: number): void {
  setRate(c as never, id, d);
}
export function damQuote(c: Career, id: string): boolean {
  return sendQuote(c as never, id);
}
export function damPrecon(c: Career, id: string, on: boolean): boolean {
  return setPrecon(c as never, id, on);
}
export function buyAttach(c: Career, a: Attachment): boolean {
  return buyAttachment(c as never, a);
}

/** Open for business: the first week's work, market and tenders. */
export function open(c: Career): void {
  c.phase = 'play';
  const rand = worldRand(c, 'open');
  c.offers = genOffers(rand, c as never, fmul(c), c.won, c.won2);
  c.market = genMarket(rand, { week: c.week, won: c.won, mood: mood(c), rivSell: c.rivSell, clear: c.clear }, () => uid(c));
  bulkMarket(c);
  genTenders(rand, c as never, canTender((t) => owns(c, t), c.rep, c.whs.sys), mood(c), fmul(c));
  note(c, { k: 'open' });
  coachTick(c);
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

/** Hand the business on to your kids: only once you're a regional contractor. */
export function handOnNow(c: Career): void {
  if (!c.won3 || c.phase !== 'play') return;
  const g = rung(c as never);
  handOn(c as never, mood(c), stars(c.rep), c.gst && gstInBank(tax(c)) ? c.gst.held : 0, { stage: g, peak: g });
}

/** One generation's run, for the family history. */
export interface Generation {
  gen: number;
  weeks: number;
  walk: number;
  stage: number;
}

/**
 * The next generation takes over: a new career under the same name, loan, town and mode, starting from one
 * machine, with the family money, a star of track record, the tickets, and the history. No coach, every tab open.
 */
export function nextGeneration(prev: Career, seed: number, wxStart?: number): Career | null {
  const u = prev.soldUp as { legacy?: boolean; week: number; walk: number; stage: number; peak?: number } | undefined;
  if (!u || !u.legacy) return null;
  const gen = (prev.gen || 1) + 1, gift = inherit(u.walk);
  const c = newCareer({ co: prev.co, loan: prev.loanStart || 180000, town: prev.town, hc: !!prev.hardcore }, seed, wxStart);
  c.gen = gen;
  c.dyn = [...((prev.dyn as Generation[]) || []), { gen: prev.gen || 1, weeks: u.week, walk: u.walk, stage: u.peak || u.stage }];
  c.bank += gift;
  c.rep = Math.max(c.rep, 5);
  c.tix = prev.tix || c.tix;
  c.tc = prev.tc || c.tc;
  c.tipsSeen = prev.tipsSeen;
  c.tipsOff = prev.tipsOff;
  c.coach = { off: true } as CoachState;
  c.tabs = { map: 1, bank: 1, board: 1 };
  note(c, { k: 'nextGen', gen, co: c.co, gift });
  return c;
}

/** Approach a struggling rival about buying them out: their offer comes up as a card. */
export function approachRival(c: Career, name: string): void {
  if (!c.queue.some((q) => q.k === 'buyout' && q.name === name)) c.queue.push({ k: 'buyout', name });
}

export function accept(c: Career, id: string): boolean {
  const ok = !!acceptOffer(c as never, id);
  if (ok) coachTick(c);
  return ok;
}

export type HireAnswer = { k: 'hired'; wage: number } | { k: 'walked'; ask: number; offer: number; rival: string };

/**
 * Hire someone off the labour board at what they ask, or haggle: offer 12% less and they might take it
 * (keen ones more likely), or walk and take a job with a rival.
 */
export function hireCand(c: Career, id: string, haggle = false): HireAnswer | null {
  const cd = c.cands.find((x) => x.id === id);
  if (!cd) return null;
  let wage = cd.ask;
  c.cands = c.cands.filter((x) => x !== cd);
  if (haggle) {
    const offer = Math.round((cd.ask * 0.88) / 50) * 50, rand = stream(c);
    if (rand() < Math.min(0.95, SKILLS[cd.skill].yes * (cd.keen ? 1.2 : 1))) wage = offer;
    else {
      const rival = pick<{ name: string }>(rand, c.rivals.length ? c.rivals : [{ name: 'a rival' }]).name;
      note(c, { k: 'knockedBack', name: cd.name, offer });
      return { k: 'walked', ask: cd.ask, offer, rival };
    }
  }
  c.staff.push(hire(cd, wage, uid(c)));
  seatStaff(c as never);
  tcAdd(c as never, 'hired');
  tickets(c);
  note(c, { k: 'hired', name: cd.name, role: cd.role, wage });
  return { k: 'hired', wage };
}

/** Let someone go with a week's pay. Not while they're on a job. */
export function letGo(c: Career, id: string): boolean {
  const p = c.staff.find((x) => x.id === id);
  if (!p || p.jobId) return false;
  c.bank -= p.wage;
  c.staff = c.staff.filter((x) => x !== p);
  note(c, { k: 'letGo', name: p.name });
  return true;
}

/** Fix a patched-up part properly. The machine's in the workshop for 2 days. */
export function fixProperly(c: Career, id: string): boolean {
  const m = c.fleet.find((x) => x.id === id);
  if (!m || !m.band || c.bank < m.band.fix) return false;
  c.bank -= m.band.fix;
  book(c.acc, 'workshop', m.band.fix);
  note(c, { k: 'fixedProperly', part: m.band.part, type: m.type, cost: m.band.fix });
  m.band = null;
  if (m.down === 0) m.down = 2;
  return true;
}

/** Fit GPS machine control to a grader: a better finish, and 7% faster. */
export function fitGps(c: Career, id: string): boolean {
  const m = c.fleet.find((x) => x.id === id);
  if (!m || m.type !== 'grader' || m.gps || c.bank < GPS_COST) return false;
  c.bank -= GPS_COST;
  book(c.acc, 'capital', GPS_COST);
  m.gps = true;
  tcAdd(c as never, 'gps');
  tickets(c);
  note(c, { k: 'gps', m: mRef(m), cost: GPS_COST });
  return true;
}

/** Step the safety system up a level. */
export function upgradeSafety(c: Career): boolean {
  if (!unlocked(c as never, 'swms')) return false;
  return upgradeWhs(c as never, { swms: true, won: c.won, won2: c.won2 });
}

/** Toolbox talks every Monday, on or off. They unlock once you're ready to subcontract. */
export function toggleTalks(c: Career): void {
  if (c.won || c.whs.talks) c.whs.talks = !c.whs.talks;
}

// ---------- the branch depot ----------

export function openBranchDepot(c: Career, k: BranchMgrKind): boolean {
  return openBranch(stream(c), c as never, k);
}
export function hireBranchManager(c: Career, k: BranchMgrKind): void {
  hireBrMgr(stream(c), c as never, k);
}
export function sendToBranch(c: Career, id: string): boolean {
  return toBranch(c as never, id);
}
export function bringHome(c: Career, id: string): boolean {
  return toHome(c as never, id, room(c));
}
export function closeBranchDepot(c: Career): void {
  closeBranch(c as never);
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
  /** The Christmas shutdown: nobody worked. */
  shut?: boolean;
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
  const ev = rep.events as (ContractEvent | WorkshopEvent | SafetyEvent | RainCallEvent | BankCallEvent | ShockEvent | HardcoreEvent | SaleEvent | RivalEvent | MapEvent | CloseEvent | CouncilEvent | BranchEvent | TaxEvent | HireEvent | WeekEvent | BulkEvent)[];
  const BK = { pays: 0, odi: 0, lc: 0, li: 0 };
  Object.defineProperty(rep, 'jobs', { value: Object.fromEntries(c.jobs.map((j) => [j.id, j])), enumerable: false });

  staffSubs(c as never, null);
  staffOwn(c as never, null);
  terminateWeek(c as never, ev as ContractEvent[]);

  const downDays: Record<string, number> = {};
  startWeek(c);
  if (!compat.prototype) coverOff(c as never);
  if (c.packs?.bulk) bulkStart(c as never, ev as BulkEvent[]);
  // Christmas: the whole district knocks off for two weeks, and contract deadlines move with it
  const shut = !compat.prototype && shutWeek(c.week);
  if (shut) {
    rep.shut = true;
    for (const j of c.jobs) if ((j.kind === 'sub' || j.kind === 'own') && !j.finished && j.due != null) j.due = (j.due as number) + 1;
  }
  for (let day = 0; day < 5; day++) {
    if (shut) {
      rep.days.push({ wet: false, mm: rainMm(wx, dayOffset(c.week, day)) });
      continue;
    }
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
    for (const j of c.jobs) {
      if (j.kind === 'bulk') damDay(rand, c as never, j, wet, w, rep, ev as BulkEvent[]);
      else jobDay(rand, c as never, j, day, wet, w, rep, downDays, ev as ContractEvent[]);
    }
    endOfDay(c as never, day, ev as ContractEvent[]);
  }
  const oldhand = mgrIs(c.staff, 'oldhand');
  for (const j of c.jobs.slice()) {
    if (j.kind === 'bulk') continue;
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
  if (c.packs?.bulk) {
    const bc = genBulkCandidate(worldRand(c, 'bulk-cands'), c.staff.map((p) => p.name).concat(c.cands.map((x) => x.name)), () => uid(c));
    if (bc) c.cands.push(bc);
  }
  if (c.opCover > 0) c.opCover--;
  if (c.youBlocked > 0) c.youBlocked--;
  swmsWeek(c as never, hasCrew(c), stars(c.rep));
  // a card the week before the Christmas shutdown, and no curve balls while everyone's away
  if (!compat.prototype && c.staff.length && shutWeek(c.week + 2) && !shutWeek(c.week + 1)) c.queue.push({ k: 'xmas' });
  if (compat.prototype || !shutWeek(c.week + 1)) curveWeek(rand, c as never, room(c), YARDS[c.yard].theft);

  for (const t of c.tenders.slice()) {
    if (t.close === c.week) {
      closeTender(rand, c as never, t, standing(c), c.co, mood(c), ev as CloseEvent[]);
      c.tenders = c.tenders.filter((x) => x !== t);
    }
  }
  for (const t of c.ctenders.slice()) {
    if (t.close === c.week) {
      // suspended: the council doesn't look at your price
      if (!compat.prototype && barred(c as never, TOWNS[c.town].council)) t.bid = null;
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
  bulkMarket(c);
  if (c.packs?.bulk) bulkWeek(worldRand(c, 'bulk-enq'), c as never, fmul(c), ev as BulkEvent[], rep.mm);
  genTenders(wr, c as never, canTender((t) => owns(c, t), c.rep, c.whs.sys), mood(c), fmul(c));
  if (compat.prototype || !barred(c as never, TOWNS[c.town].council)) {
    genCouncil(wr, c as never, planCtx(c), fmul(c));
    genMajor(wr, c as never, planCtx(c), fmul(c), canPrestige(c as never, c.whs.sys, c.yard));
  }
  checkWin(c as never);
  for (const id of unlockWeek(c as never)) { ev.push({ k: 'unlocked', id }); note(c, { k: 'unlocked', id }); }
  mgrWeek(c, rand);
  if (compat.prototype || !shutWeek(c.week)) rainCallCheck(c as never, wx);
  rep.tix = tickets(c);
  coachTick(c);
  tabsWeek(c);
  closeBooks(c as never, { w: rep.week, invoiced: rep.invoiced, paid: rep.paid, rain: rep.rain, over, premium: premiumOf(premParts(fleetValue(c.fleet, c.week), wages(c.staff)), c, c.whs.sys, c.week), rent: YARDS[c.yard].rent, wages: wages(c.staff), staffN: c.staff.length, mode: tax(c) }, BK);
  taxWeek(c as never, rep.week, tax(c), ev as TaxEvent[], () => {
    yearEnd(Object.assign(c, { staffN: c.staff.length, fleetN: c.fleet.length }) as never, rep.week, worth(c));
  });
  if (seasonWeek(c)) return rep;
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
