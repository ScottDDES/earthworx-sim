// What hits an established business from outside, and the deals that come with trouble.
//   Shocks: a head contractor collapses owing you money, flood funding is paused, or insurance goes up across
//   the industry. None on Easy; more often the harder the difficulty.
//   Selling up: when you're the one stretched, a bigger outfit rings with an offer for your gear or the lot.
//   Buying out: when a rival's going under, they'd rather sell to you than the auctioneer.

import { mRef, news, note } from './diary';
import { topUp, type Loan } from './bank';
import { book } from './ledger';
import { MOODS, type Mood } from './market';
import { newMachine, TYPES, value, type Machine, type MachineType } from './machines';
import { CLIENTS, release, uid, type Biz, type HireEvent } from './hire';
import { int, pick, type Rand } from './rng';
import { rvPhase, type Rival } from './rivals';
import { NAMES, ROLES, type Person, type Role } from './staff';
import type { Difficulty } from './difficulty';
import { yearOf } from './calendar';

const round = (n: number, to: number) => Math.round(n / to) * to;

// ---------- shocks ----------

/** Shocks a year: none on Easy, one every four years on Normal, two on Hard, and 1.6 a year on Hardcore. */
export const SHOCK_RATE: Record<Difficulty, number> = { easy: 0, normal: 0.25, hard: 0.5, hc: 1.6 };

export interface ShockState extends Biz {
  won?: boolean;
  won2?: boolean;
  shockLast?: number;
  tenders: { hc: string; [x: string]: unknown }[];
  /** Insurance: a hard market until this week, adding insX. */
  insHard?: number;
  insX?: number;
}

export type ShockEvent = { k: 'collapse'; name: string; debt: number } | { k: 'freeze'; until: number } | { k: 'insure' };

/** A head contractor goes under: everything they owe you (invoices and retention) stops, their jobs end, they're gone for good. */
export function collapseHC(b: ShockState, name: string, events: HireEvent[]): number {
  let debt = 0;
  b.recv = b.recv.filter((x) => {
    if (x.client === name) {
      debt += x.amt;
      return false;
    }
    return true;
  });
  for (const j of b.jobs.slice()) {
    if (j.client === name && !j.finished) {
      debt += (j.retained as number) || 0;
      j.finished = true;
      j.cut = true;
      release(b, j, events);
    }
  }
  b.tenders = b.tenders.filter((t) => t.hc !== name);
  b.blocked[name] = 999999;
  book(b.acc, 'badDebts', debt);
  return Math.round(debt);
}

/**
 * Maybe a shock this week: only once you're subcontracting, at most one every 26 weeks. A collapse needs a head
 * contractor owing you $15k or more (twice as likely as the others); a freeze needs your own council work.
 */
export function shockWeek(rand: Rand, b: ShockState, d: Difficulty, events: ShockEvent[], hireEvents: HireEvent[]): void {
  const rate = SHOCK_RATE[d];
  if (!b.won || !rate || b.week - (b.shockLast || 0) < 26 || rand() >= rate / 52) return;
  const owed: Record<string, number> = {}, pool: ('collapse' | 'freeze' | 'insure')[] = [];
  for (const x of b.recv) if (CLIENTS[x.client]) owed[x.client] = (owed[x.client] || 0) + x.amt;
  for (const j of b.jobs) if (!j.finished && CLIENTS[j.client]) owed[j.client] = (owed[j.client] || 0) + ((j.retained as number) || 0) + 1;
  const hc = Object.keys(owed).filter((c) => !(b.blocked[c]! > b.week + 5000)).sort((a, z) => owed[z]! - owed[a]!)[0];
  if (hc && owed[hc]! >= 15000) pool.push('collapse', 'collapse');
  if (b.won2 && !((b.freeze ?? 0) > b.week)) pool.push('freeze');
  if (!((b.insHard ?? 0) > b.week)) pool.push('insure');
  if (!pool.length) return;
  const k = pick(rand, pool);
  b.shockLast = b.week;
  if (k === 'collapse') {
    const debt = collapseHC(b, hc!, hireEvents);
    b.queue.push({ k: 'collapse', name: hc!, debt });
    events.push({ k: 'collapse', name: hc!, debt });
    note(b, { k: 'collapse', name: hc!, debt });
    news(b, { k: 'collapseNews', name: hc! });
  }
  if (k === 'freeze') {
    b.freeze = b.week + int(rand, 10, 18);
    b.queue.push({ k: 'freeze', until: b.freeze });
    events.push({ k: 'freeze', until: b.freeze });
    note(b, { k: 'freeze', until: b.freeze });
  }
  if (k === 'insure') {
    b.insHard = b.week + 52;
    b.insX = 1.35;
    b.queue.push({ k: 'insure' });
    events.push({ k: 'insure' });
    note(b, { k: 'insure' });
  }
}

/** The collapse card's numbers, from the card's own seed: the likely dividend (10–30c in the dollar) and what a collector pays (8c). */
export function collapseCard(cardRand: Rand, debt: number): { dividend: number; sell: number } {
  return { dividend: Math.round(debt * (0.1 + cardRand() * 0.2)), sell: round(debt * 0.08, 100) };
}
/** Lodge a claim: the dividend arrives in 40 weeks. */
export function collapseClaim(b: Biz, name: string, dividend: number): void {
  b.recv.push({ id: uid(b), client: 'Administrators for ' + name, amt: dividend, due: b.week + 40, lateRolled: true, adm: true });
}
/** Sell the debt to a collector, cash now. */
export function collapseSell(b: Biz, sell: number): void {
  b.bank += sell;
  book(b.acc, 'collections', sell);
  book(b.acc, 'badDebts', -sell);
}
/** A broker shops the insurance around: $1,500, and half the time it only goes up 15%. */
export function insureBroker(rand: Rand, b: ShockState): boolean {
  b.bank -= 1500;
  if (rand() < 0.5) {
    b.insX = 1.15;
    return true;
  }
  return false;
}

// ---------- selling up ----------

export interface SellUpState extends Biz {
  phase: string;
  rivals: Rival[];
  loan: Loan;
  odOver?: number;
  sellAsk?: number;
  payables?: { amt: number }[];
  soldUp?: Record<string, unknown>;
}

/** You're stretched: behind with the bank, over the limit, or deep in the overdraft (with at least two machines to sell). */
export function meStretched(b: SellUpState, odLimit: number): boolean {
  return b.fleet.length >= 2 && (b.loan.missed > 0 || (b.odOver || 0) > 0 || b.bank < -0.8 * odLimit);
}

/** Who'd buy: the richest outfit not stretched itself, bigger ones first. */
export function sellBuyer(rivals: readonly Rival[]): Rival | null {
  return rivals.filter((x) => rvPhase(x) !== 'stretched' && x.cash > 40000).sort((a, z) => Number(z.tier !== 'small') - Number(a.tier !== 'small') || z.cash - a.cash)[0] || null;
}

export function askSellUp(b: SellUpState, force: boolean): boolean {
  if (b.queue.some((q) => q.k === 'sellup')) return false;
  const x = sellBuyer(b.rivals);
  if (!x) return false;
  b.queue.push({ k: 'sellup', name: x.name, asked: !!force });
  b.sellAsk = b.week;
  return true;
}

/** Stretched, and not asked in the last 12 weeks: a 35% chance someone rings. */
export function sellUpWeek(rand: Rand, b: SellUpState, odLimit: number): void {
  if (b.phase !== 'play' || !meStretched(b, odLimit) || b.week - (b.sellAsk ?? -99) < 12 || rand() > 0.35) return;
  askSellUp(b, false);
}

export function sellGear(fleet: readonly Machine[]): Machine[] {
  return fleet.filter((m) => m.status !== 'auction');
}
function onOwnJob(b: Biz, m: Machine): boolean {
  const j = m.jobId ? b.jobs.find((x) => x.id === m.jobId) : undefined;
  return !!(j && j.kind === 'own' && ((j.ownedIds as string[]) || []).includes(m.id));
}
/** The two machines they'd take: idle or listed first, then off your own contract; most valuable first. */
export function sellBest(b: Biz): Machine[] {
  return b.fleet.filter((m) => m.status === 'idle' || m.status === 'listed' || onOwnJob(b, m)).sort((a, z) => Number(onOwnJob(b, a)) - Number(onOwnJob(b, z)) || value(z, b.week) - value(a, b.week)).slice(0, 2);
}
/** Whole business: 60% of the gear's value, moved by the market, plus $15k a star. */
export function sellPrice(b: Biz, mood: Mood, starsN: number): { v: number; price: number } {
  const v = sellGear(b.fleet).reduce((a, m) => a + value(m, b.week), 0);
  return { v, price: round(v * 0.6 * MOODS[mood].pm + starsN * 15000, 1000) };
}
/** What you'd walk away with after the loan, the subbies and any GST you're holding. */
export function walkAway(b: SellUpState, price: number, gstHeldInBank: number): number {
  return Math.round(price + b.bank + b.recv.reduce((a, x) => a + (x.due < 9999 ? x.amt : x.amt * 0.5), 0) - (b.payables || []).reduce((a, x) => a + x.amt, 0) - b.loan.bal - gstHeldInBank);
}

// ---------- retiring ----------

export interface RetireOffer {
  /** The outfit buying, or null for a contractor from the coast. */
  who: string | null;
  price: number;
  v: number;
  walk: number;
}

/** Sell up on your own terms: 85% of the gear (moved by the market), $25k a star, and up to $60k for contracts delivered. */
export function retireOffer(b: SellUpState & { ownDone?: number; majorDone?: number }, mood: Mood, starsN: number, gstHeldInBank: number): RetireOffer {
  const x = sellBuyer(b.rivals), v = sellGear(b.fleet).reduce((a, m) => a + value(m, b.week), 0);
  const price = round(v * 0.85 * MOODS[mood].pm + starsN * 25000 + Math.min(10, (b.ownDone || 0) + (b.majorDone || 0) * 3) * 6000, 1000);
  return { who: x ? x.name : null, price, v, walk: walkAway(b, price, gstHeldInBank) };
}

/** Sign and retire. The career ends. info: the stage and peak on the ladder, for the record. */
export function retire(b: SellUpState & { ownDone?: number; majorDone?: number }, mood: Mood, starsN: number, gstHeldInBank: number, info: Record<string, number>): RetireOffer {
  const o = retireOffer(b, mood, starsN, gstHeldInBank), x = b.rivals.find((y) => y.name === o.who);
  if (x) {
    x.fleet += sellGear(b.fleet).length;
    x.stars = Math.max(x.stars, starsN);
  }
  note(b, { k: 'retired', to: o.who, price: o.price });
  b.soldUp = { to: o.who ?? 'A contractor from the coast', price: o.price, walk: o.walk, week: b.week, ...info, fleet: sellGear(b.fleet).length, earned: Math.round(b.stats.earned), retired: true } as never;
  b.phase = 'sold';
  return o;
}

/** Sell them your two best spare machines for 72% of value. Anything pulled off a council job is replaced by dry hire there. */
export function sellTwo(b: SellUpState, x: Rival, mood: Mood): number {
  const best = sellBest(b), bprice = round(best.reduce((a, m) => a + value(m, b.week), 0) * 0.72 * MOODS[mood].pm, 500);
  for (const m of best) {
    if (onOwnJob(b, m)) {
      const j = b.jobs.find((y) => y.id === m.jobId)!;
      j.ownedIds = (j.ownedIds as string[]).filter((id) => id !== m.id);
      j.hireWeek = (j.hireWeek as number) + TYPES[m.type].dry;
    }
    b.fleet = b.fleet.filter((y) => y.id !== m.id);
  }
  b.bank += bprice;
  book(b.acc, 'capital', -bprice);
  x.fleet += best.length;
  x.cash -= bprice;
  note(b, { k: 'soldTwo', ms: best.map(mRef), to: x.name, price: bprice });
  news(b, { k: 'boughtGearOff', who: x.name });
  return bprice;
}

/** Sell the whole business. The career ends. info: the stage and peak on the ladder, for the record. */
export function sellAll(b: SellUpState, x: Rival, mood: Mood, starsN: number, gstHeldInBank: number, info: Record<string, number>): void {
  const sp = sellPrice(b, mood, starsN), walk = walkAway(b, sp.price, gstHeldInBank);
  x.fleet += sellGear(b.fleet).length;
  x.cash -= sp.price * 0.5;
  x.stars = Math.max(x.stars, starsN);
  b.soldUp = { to: x.name, price: sp.price, walk, week: b.week, ...info, fleet: sellGear(b.fleet).length, earned: Math.round(b.stats.earned) };
  note(b, { k: 'soldBusiness', to: x.name, price: sp.price });
  b.phase = 'sold';
}

// ---------- buying a rival out ----------

export interface BuyOutState extends SellUpState {
  won?: boolean;
  won2?: boolean;
  gone?: string[];
  buyouts?: number;
}

export interface YardMachine {
  type: MachineType;
  year: number;
  cond: number;
  hours: number;
}

/** You can buy a rival out once you've run your own contract, with no missed repayments. */
export function canBuyOut(b: BuyOutState): boolean {
  return !!b.won2 && !b.loan.missed;
}

/** A rival's yard, the same each time you look: a mix of graders, rollers and carts, mostly older gear. Rolled when first seen. */
export function rvYard(rand: Rand, x: Rival & { yard?: YardMachine[] }, week: number, won: boolean): YardMachine[] {
  if (!x.yard || x.yard.length !== x.fleet) {
    const mix: MachineType[] = ['grader', 'roller', 'cart', 'grader', 'cart', 'roller', 'cart', won ? 'truck' : 'cart'];
    x.yard = [];
    for (let i = 0; i < x.fleet; i++) {
      const y = int(rand, 2008, 2021), cond = int(rand, 50, 85), hours = (yearOf(week) - y) * int(rand, 650, 900);
      x.yard.push({ type: mix[i % mix.length]!, year: y, cond, hours });
    }
  }
  return x.yard;
}

/** Pay what cash you can spare (at least 30%) and the bank lends the rest against the gear you're buying, within your limit. */
export function buyOutPay(b: BuyOutState, price: number, addV: number, lendCap: number): { cash: number; loan: number; ok: boolean } {
  let cash = Math.max(round(price * 0.3, 500), Math.min(price, Math.max(0, b.bank - 15000))), loan = price - cash;
  if (loan > 0 && loan < 20000 && b.bank >= price) {
    cash = price;
    loan = 0;
  }
  const room = Math.max(0, round(lendCap + 0.65 * addV - b.loan.bal, 1000));
  return { cash, loan, ok: b.bank >= cash && loan <= room };
}

/** Pay for it: the cash, and anything borrowed goes on the loan with a 1% fee. */
export function payFor(b: BuyOutState, pp: { cash: number; loan: number }, from: string, two: boolean): void {
  b.bank -= pp.cash;
  book(b.acc, 'capital', pp.cash);
  if (pp.loan > 0) {
    const fee = round(pp.loan * 0.01, 10);
    topUp(b.loan, pp.loan);
    b.bank -= fee;
  }
  note(b, { k: 'youBoughtOut', from, two, cash: pp.cash, loan: pp.loan });
}

/** Their machines come into your yard; whatever doesn't fit goes straight to auction. Returns how many went. */
export function takeMachines(rand: Rand, b: BuyOutState, list: readonly YardMachine[], room: () => number): number {
  let over = 0;
  for (const g of list) {
    const m = newMachine(rand, uid(b), g.type, g.year, g.cond, g.hours);
    if (room() <= 0) {
      m.status = 'auction';
      over++;
    }
    b.fleet.push(m);
  }
  return over;
}

export interface BuyOutOffer {
  yard: YardMachine[];
  /** The whole outfit: 60% of its gear's value. */
  v: number;
  price: number;
  /** Their two best machines at 72%. */
  best: YardMachine[];
  bv: number;
  bprice: number;
  /** Operators who come with them. */
  crew: number;
}

export function buyOutOffer(cardRand: Rand, b: BuyOutState, x: Rival & { yard?: YardMachine[] }): BuyOutOffer {
  const yd = rvYard(cardRand, x, b.week, !!b.won), v = yd.reduce((a, g) => a + value(g, b.week), 0), price = round(v * 0.6, 1000);
  const best = yd.slice().sort((a, z) => value(z, b.week) - value(a, b.week)).slice(0, Math.min(2, yd.length));
  const bv = best.reduce((a, g) => a + value(g, b.week), 0);
  return { yard: yd, v, price, best, bv, bprice: round(bv * 0.72, 500), crew: Math.min(2, Math.max(1, Math.floor(x.fleet / 3))) };
}

/** Buy the whole outfit: their gear, one or two operators, and their track record (+2 a star, +2). */
export function buyOutAll(rand: Rand, b: BuyOutState, x: Rival, o: BuyOutOffer, pp: { cash: number; loan: number }, room: () => number): number {
  payFor(b, pp, x.name, false);
  const over = takeMachines(rand, b, o.yard, room);
  const taken = b.staff.map((p) => p.name);
  for (let i = 0; i < o.crew; i++) {
    const role: Role = i === 0 ? 'grader' : pick(rand, ['roller', 'cart'] as const);
    const left = NAMES.filter((n) => !taken.includes(n));
    // the prototype rolls for a name even when none are left, so this does too
    const nm = left.length ? pick(rand, left) : (rand(), 'Their operator');
    taken.push(nm);
    b.seq = (b.seq || 0) + 1;
    b.staff.push({ id: 'p' + b.seq, name: nm, role, skill: 'solid', wage: ROLES[role].wage, off: 0, jobId: null } as Person);
  }
  b.rep += 2 * x.stars + 2;
  b.rivals = b.rivals.filter((y) => y !== x);
  (b.gone = b.gone || []).push(x.name);
  b.buyouts = (b.buyouts || 0) + 1;
  news(b, { k: 'boughtOutNews', name: x.name });
  return over;
}

/** Just buy their best two machines: the cash keeps them going a bit longer. */
export function buyOutBest(rand: Rand, b: BuyOutState, x: Rival & { yard?: YardMachine[] }, o: BuyOutOffer, pp: { cash: number; loan: number }, room: () => number): number {
  payFor(b, pp, x.name, true);
  const over = takeMachines(rand, b, o.best, room);
  x.yard = o.yard.filter((g) => !o.best.includes(g));
  x.fleet -= o.best.length;
  x.cash += o.bprice;
  x.debt = Math.max(0, x.debt - o.bprice * 0.5);
  x.low = 0;
  return over;
}

