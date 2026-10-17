// The plant market. Each week: three machines for sale (dealers tell the truth and give 8 weeks' warranty;
// private sellers and rivals talk the condition up), whatever cash-strapped rivals are dumping, and one auction lot.
// The market's mood follows the flood money, and flood money follows the rain: a wet year
// brings recovery work six months to a year and a half later.

import { mRef, note } from './diary';
import { dayOffset, yearOf } from './calendar';
import { topUp, type Loan } from './bank';
import { book, type Accounts } from './ledger';
import { newMachine, value, type Machine, type MachineType } from './machines';
import { int, pick, type Rand } from './rng';
import { meanYearMm, rainMm, type WeatherCtx } from './weather';

export type Mood = 'boom' | 'steady' | 'tight' | 'bust';

export interface MoodSpec {
  t: string;
  d: string;
  /** Rivals' margin in this market. */
  mg: number;
  /** Plant prices, relative to steady. */
  pm: number;
}

export const MOODS: Record<Mood, MoodSpec> = {
  boom:   { t: 'Boom',   d: 'Plenty of flood money about: more tenders, better rates, and new outfits starting up.', mg: 0.2, pm: 1.08 },
  steady: { t: 'Steady', d: 'A normal run of work. Rates are holding.', mg: 0.15, pm: 1 },
  tight:  { t: 'Tight',  d: 'The funding is drying up. Fewer tenders, and outfits are sharpening their pencils.', mg: 0.09, pm: 0.93 },
  bust:   { t: 'Bust',   d: 'Tough out there: three outfits chasing every job, and good gear going cheap at auction.', mg: 0.03, pm: 0.85 },
};

/** The head contractors. Rivals selling gear are named from here too. */
export const HEAD_CONTRACTORS = ['Border Civil', 'Hartley Bros', 'Macintyre Plant', 'Dry Creek Civil'] as const;

// ---------- the mood ----------

export interface MarketMood {
  /** Smoothed funding index: 1 is a normal year's rain behind the money. */
  f: number;
  mood: Mood | null;
  /** Week the mood last changed. */
  since?: number;
}

/**
 * How much flood money is about this week: rain over the year that ended six months ago,
 * against the town's average, plus a bump for each big day (40 mm or more).
 */
export function fundIdx(wx: WeatherCtx, week: number): number {
  let tot = 0, big = 0;
  for (let o = dayOffset(week - 78, 0); o < dayOffset(week - 26, 0); o++) {
    const mm = rainMm(wx, o);
    tot += mm;
    if (mm >= 40) big++;
  }
  return tot / meanYearMm(wx.town) + 0.1 * big;
}

const ORDER: readonly Mood[] = ['bust', 'tight', 'steady', 'boom'];
const CUT = [0.75, 0.95, 1.4];

/**
 * The week's move in the market. The index drifts a fifth of the way to this week's funding.
 * The mood only turns once the index is clearly past the line and the last turn was 8 or more weeks ago.
 * Returns the new mood when it turns (not on the first week).
 */
export function marketWeek(M: MarketMood, wx: WeatherCtx, week: number): Mood | null {
  const raw = fundIdx(wx, week);
  M.f += (raw - M.f) * 0.2;
  const at = M.mood ? ORDER.indexOf(M.mood) : -1;
  let md: Mood = M.f >= 1.4 ? 'boom' : M.f >= 0.95 ? 'steady' : M.f >= 0.75 ? 'tight' : 'bust';
  if (at >= 0 && md !== M.mood) {
    const to = ORDER.indexOf(md), edge = CUT[Math.min(at, to)]!, gap = 0.06;
    if ((to > at ? M.f < edge + gap : M.f > edge - gap) || week - (M.since || 0) < 8) md = M.mood!;
  }
  if (md !== M.mood) {
    const turned = M.mood !== null;
    M.since = week;
    M.mood = md;
    return turned ? md : null;
  }
  return null;
}

export function newMarketMood(wx: WeatherCtx, week: number): MarketMood {
  return { f: fundIdx(wx, week), mood: null };
}

/** How busy the work is, 0.5 to 1.5; a funding freeze cuts it to a third. */
export function fmul(M: MarketMood | null, frozen: boolean): number {
  return (M ? Math.max(0.5, Math.min(1.5, M.f / 1.1)) : 1) * (frozen ? 0.35 : 1);
}

// ---------- what's for sale ----------

export type Seller = 'dealer' | 'private' | 'rival';

export interface Listing {
  id: string;
  type: MachineType;
  year: number;
  /** The real condition. */
  cond: number;
  /** What the seller says. */
  claimed: number;
  hours: number;
  seller: Seller;
  /** True condition known: dealers are straight, or you paid for an inspection. */
  revealed: boolean;
  /** The rival selling it. */
  who?: string;
  multi?: boolean;
  /** A rival short of cash, selling cheap. */
  distress?: boolean;
  price: number;
}

export type LotSource = { k: 'clearance'; name: string } | { k: 'council' } | { k: 'dispersal' } | { k: 'repo' };

export interface AuctionLot {
  id: string;
  type: MachineType;
  year: number;
  cond: number;
  hours: number;
  from: LotSource;
  /** Current bid. */
  bid: number;
  /** The most the other bidders will go. */
  max: number;
  leader: 'you' | 'rival';
  done: boolean;
  /** The auctioneer's guide, as a range. */
  guideLo: number;
  guideHi: number;
  /** The part nobody can vouch for. */
  unknown: string;
  result?: HammerResult;
}

export interface Market {
  listings: Listing[];
  lot: AuctionLot;
}

/** A rival selling up, waiting for next week's market. */
export interface RivalSale {
  type: MachineType;
  who: string;
}

/** A rival's clearance: their gear goes through the auction for a few weeks. */
export interface Clearance {
  name: string;
  n: number;
}

export interface MarketInputs {
  week: number;
  /** Trucks only show up once you're ready to subcontract. */
  won: boolean;
  mood: Mood;
  /** Emptied as they're listed. */
  rivSell: RivalSale[];
  /** The first one's count goes down by one; it's dropped when it reaches 0. */
  clear: Clearance[];
}

const round = (n: number, to: number) => Math.round(n / to) * to;
const UNKNOWNS = ['Drum and vibe system', 'Transmission', 'Hydraulic pump', 'Undercarriage', 'Engine blow-by'] as const;

/** This week's market. */
export function genMarket(rand: Rand, x: MarketInputs, nextId: () => string): Market {
  const L: Listing[] = [], pm = MOODS[x.mood].pm, yr = yearOf(x.week);

  for (let i = 0; i < 3; i++) {
    const type = pick(rand, (['grader', 'grader', 'roller', 'roller', 'cart'] as MachineType[]).concat(x.won ? ['truck'] : []));
    const year = int(rand, 2004, 2018), cond = int(rand, 45, 86);
    const s = rand(), seller: Seller = s < 0.4 ? 'dealer' : s < 0.8 ? 'private' : 'rival';
    // Private sellers talk it up by up to 14; rivals by 15.
    const claimed = seller === 'dealer' ? cond : Math.min(92, cond + (seller === 'rival' ? 15 : int(rand, 0, 14)));
    const id = nextId();
    const m: Listing = { id, type, year, cond, claimed, hours: (yr - year) * int(rand, 650, 900), seller, revealed: seller === 'dealer', price: 0 };
    if (seller === 'rival') m.who = pick(rand, HEAD_CONTRACTORS);
    if (type === 'roller' && rand() < 0.3) m.multi = true;
    m.price = round(value({ type, year, cond: claimed, multi: m.multi }, x.week) * (seller === 'dealer' ? 1.12 : seller === 'rival' ? 0.88 : 0.95) * pm, 500);
    L.push(m);
  }

  // Outfits short of cash sell what they can, cheap, and they go to the top of the list.
  for (const s of x.rivSell) {
    const year = int(rand, 2008, 2020), cond = int(rand, 50, 82), id = nextId();
    const claimed = Math.min(92, cond + int(rand, 0, 8));
    const m: Listing = { id, type: s.type, year, cond, claimed, hours: (yr - year) * int(rand, 650, 900), seller: 'rival', who: s.who, distress: true, revealed: false, price: 0 };
    m.price = round(value({ type: m.type, year, cond: claimed }, x.week) * 0.8 * pm, 500);
    L.unshift(m);
  }
  x.rivSell.length = 0;

  const type = pick(rand, (['grader', 'roller', 'roller', 'cart'] as MachineType[]).concat(x.won ? ['truck'] : []));
  const year = int(rand, 2005, 2016), cond = int(rand, 40, 85);
  const clr = x.clear[0];
  const id = nextId(), hours = (yr - year) * int(rand, 700, 950);
  const from: LotSource = clr ? { k: 'clearance', name: clr.name } : pick(rand, [{ k: 'council' }, { k: 'dispersal' }, { k: 'repo' }] as LotSource[]);
  const v = value({ type, year, cond }, x.week);
  // Bidding opens at half its value. A clearance sale goes cheap; otherwise the room goes to 65–97%, moved by the market.
  const bid = round(v * 0.5, 500);
  const max = round(v * (clr ? 0.5 + rand() * 0.3 : (0.65 + rand() * 0.32) * pm), 500);
  if (clr && --clr.n <= 0) x.clear.shift();
  const lot: AuctionLot = { id, type, year, cond, hours, from, bid, max, leader: 'rival', done: false, guideLo: v * 0.75, guideHi: v * 1.05, unknown: pick(rand, UNKNOWNS) };
  return { listings: L, lot };
}

// ---------- buying ----------

export const INSPECT_COST = 600;
export const WARRANTY_WEEKS = 8;
/** The auction house's buyer's premium. */
export const BUYERS_PREMIUM = 0.08;
export const FAILED_SETTLE_FINE = 1000;

/** Finance needs 20% down. */
export function finDeposit(l: Pick<Listing, 'price'>): number {
  return round(l.price * 0.2, 500);
}

/** The bank's allowance for your track record, on top of what the fleet's worth. */
export function trackAllow(won: boolean, won2: boolean, won3: boolean): number {
  return won3 ? 300000 : won2 ? 150000 : won ? 50000 : 0;
}

/** The most the bank will lend in all: 65% of the fleet's value plus the track-record allowance. */
export function lendCap(fleetVal: number, won: boolean, won2: boolean, won3: boolean): number {
  return round(0.65 * fleetVal + trackAllow(won, won2, won3), 1000);
}

/**
 * Will the bank finance it? Only once you're ready to subcontract, with no missed repayments,
 * lending no more than 80% of its claimed value (plus $5k), within your limit plus 65% of this machine.
 */
export function canFinance(l: Listing, week: number, loan: Loan, cap: number, won: boolean): boolean {
  const v = value({ type: l.type, year: l.year, cond: l.claimed }, week), lent = l.price - finDeposit(l);
  return won && loan.missed === 0 && lent <= 0.8 * v + 5000 && loan.bal + lent <= cap + 0.65 * v;
}

/** The parts of a career buying and selling touches. */
export interface Buyer {
  week: number;
  bank: number;
  fleet: Machine[];
  loan: Loan;
  acc: Accounts;
  market: Market;
}

export type BuyResult = { ok: false; why: 'gone' | 'full' | 'cash' | 'noFinance' } | { ok: true; machine: Machine; lent: number };

/**
 * Buys a listing for cash, or with finance (20% down, the rest on the loan).
 * room is how many more machines the yard holds; cap is lendCap(); won is "ready to subcontract".
 */
export function buyListing(rand: Rand, b: Buyer, id: string, fin: boolean, room: number, cap: number, won: boolean, machineId: string): BuyResult {
  const l = b.market.listings.find((x) => x.id === id);
  if (!l) return { ok: false, why: 'gone' };
  if (room <= 0) return { ok: false, why: 'full' };
  let lent = 0;
  if (fin) {
    if (!canFinance(l, b.week, b.loan, cap, won)) return { ok: false, why: 'noFinance' };
    const dep = finDeposit(l);
    if (b.bank < dep) return { ok: false, why: 'cash' };
    lent = l.price - dep;
    b.bank -= dep;
    book(b.acc, 'capital', dep);
    topUp(b.loan, lent);
    note(b, { k: 'financed', lent, weekly: b.loan.weekly });
  } else {
    if (b.bank < l.price) return { ok: false, why: 'cash' };
    b.bank -= l.price;
    book(b.acc, 'capital', l.price);
  }
  const m = newMachine(rand, machineId, l.type, l.year, l.cond, l.hours) as Machine & { paid?: number; paidWk?: number };
  if (l.seller === 'dealer') m.warranty = b.week + WARRANTY_WEEKS;
  m.multi = !!l.multi;
  m.paid = l.price;
  m.paidWk = b.week;
  b.fleet.push(m);
  b.market.listings = b.market.listings.filter((x) => x.id !== id);
  note(b, { k: 'bought', m: mRef(m), price: l.price, dealer: l.seller === 'dealer' });
  if (l.seller === 'rival') note(b, { k: 'boughtOffRival', who: l.who });
  return { ok: true, machine: m, lent };
}

/** Pay a mechanic to check a listing's real condition. */
export function inspect(b: Pick<Buyer, 'week' | 'bank' | 'market'>, id: string): boolean {
  const l = b.market.listings.find((x) => x.id === id);
  if (!l || b.bank < INSPECT_COST) return false;
  b.bank -= INSPECT_COST;
  l.revealed = true;
  note(b, { k: 'inspected', type: l.type, cost: INSPECT_COST });
  return true;
}

/** Raise the bid by n. The room comes back $1,000 over you until you pass their limit. */
export function bid(lot: AuctionLot, n: number, room: number): void {
  if (lot.done || room <= 0) return;
  const nb = lot.bid + n;
  if (nb + 1000 <= lot.max) {
    lot.bid = nb + 1000;
    lot.leader = 'rival';
  } else {
    lot.bid = nb;
    lot.leader = 'you';
  }
}

export type HammerResult =
  | { k: 'lost'; price: number }
  | { k: 'cantSettle'; total: number; fine: number }
  | { k: 'won'; price: number; total: number; machine: Machine };

/** The hammer falls. Win it and you pay the bid plus the 8% buyer's premium, or a fine if you can't. */
export function hammer(rand: Rand, b: Pick<Buyer, 'week' | 'bank' | 'fleet' | 'acc'>, lot: AuctionLot, machineId: string): HammerResult | null {
  if (lot.done) return null;
  lot.done = true;
  if (lot.leader !== 'you') return (lot.result = { k: 'lost', price: lot.bid });
  const total = Math.round(lot.bid * (1 + BUYERS_PREMIUM));
  if (b.bank < total) {
    b.bank -= FAILED_SETTLE_FINE;
    note(b, { k: 'cantSettle', fine: FAILED_SETTLE_FINE });
    return (lot.result = { k: 'cantSettle', total, fine: FAILED_SETTLE_FINE });
  }
  b.bank -= total;
  book(b.acc, 'capital', total);
  const m = newMachine(rand, machineId, lot.type, lot.year, lot.cond, lot.hours) as Machine & { paid?: number; paidWk?: number };
  m.paid = total;
  m.paidWk = b.week;
  b.fleet.push(m);
  return (lot.result = { k: 'won', price: lot.bid, total, machine: m });
}

// ---------- selling ----------

export type SellMode = 'trade' | 'auction' | 'list';

export interface PrivateSale {
  weeks: number;
  price: number;
}

/** What a machine fetches: its value, 5% more if the ex-dealer runs your workshop. */
export function saleValue(m: Machine, week: number, dealerMgr: boolean): number {
  const v = value(m, week);
  return dealerMgr ? Math.round(v * 1.05) : v;
}

/**
 * Sell an idle machine. Trade-in is 72% of its value, cash now. The auction sells it next week
 * for 57–93% after fees. A private listing asks 95% and sells in 2 to 5 weeks.
 * Returns the cash from a trade-in, otherwise 0.
 */
export function sell(rand: Rand, b: Pick<Buyer, 'week' | 'bank' | 'fleet' | 'acc'>, id: string, mode: SellMode, dealerMgr: boolean): number | null {
  const m = b.fleet.find((x) => x.id === id);
  if (!m || m.status !== 'idle') return null;
  const v = saleValue(m, b.week, dealerMgr);
  if (mode === 'trade') {
    const got = Math.round(v * 0.72);
    b.bank += got;
    book(b.acc, 'capital', -got);
    b.fleet.splice(b.fleet.indexOf(m), 1);
    note(b, { k: 'tradedIn', m: mRef(m), got: v * 0.72 });
    return got;
  }
  if (mode === 'auction') {
    m.status = 'auction';
    note(b, { k: 'toAuction', m: mRef(m) });
    return 0;
  }
  m.status = 'listed';
  m.sale = { weeks: int(rand, 2, 5), price: round(v * 0.95, 500) } satisfies PrivateSale;
  note(b, { k: 'listed', m: mRef(m), price: (m.sale as PrivateSale).price });
  return 0;
}

export function unlist(b: Pick<Buyer, 'week'>, m: Machine): void {
  if (m.status !== 'listed') return;
  m.status = 'idle';
  m.sale = null;
  note(b, { k: 'unlisted', m: mRef(m) });
}

export type SaleEvent = { k: 'soldAtAuction'; id: string; type: MachineType; got: number } | { k: 'soldPrivately'; id: string; type: MachineType; got: number };

/** End of the week: auctions settle, private listings count down and sell. */
export function salesWeek(rand: Rand, b: Pick<Buyer, 'week' | 'bank' | 'fleet' | 'acc'>, mood: Mood, events: SaleEvent[]): void {
  for (const m of b.fleet.slice()) {
    if (m.status === 'auction') {
      const got = Math.round(value(m, b.week) * (0.6 + rand() * 0.38) * 0.95 * MOODS[mood].pm);
      b.bank += got;
      book(b.acc, 'capital', -got);
      b.fleet.splice(b.fleet.indexOf(m), 1);
      events.push({ k: 'soldAtAuction', id: m.id, type: m.type, got });
      note(b, { k: 'soldAtAuction', m: mRef(m), got });
    } else if (m.status === 'listed') {
      const s = m.sale as PrivateSale;
      s.weeks--;
      if (s.weeks <= 0) {
        b.bank += s.price;
        book(b.acc, 'capital', -s.price);
        b.fleet.splice(b.fleet.indexOf(m), 1);
        events.push({ k: 'soldPrivately', id: m.id, type: m.type, got: s.price });
        note(b, { k: 'soldPrivately', m: mRef(m), got: s.price });
      }
    }
  }
}
