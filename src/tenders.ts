// Subbie tenders: a head contractor puts a road out to price. You price it on your crew-day cost plus a share
// of your overheads plus margin; the rivals free to price do the same on theirs. Price scores up to 60
// (cheapest gets 60), non-price up to 40 (track record, safety, finances, work already on, standing with the
// head contractor). A head contractor you're preferred with sometimes offers a road direct, against their budget.

import { jobRef, note } from './diary';
import { YARDS, type YardId } from './yards';
import { TYPES, type Machine } from './machines';
import { HEAD_CONTRACTORS, type Mood } from './market';
import { dmap, mapRival, mapWork, pickRoads, placePos, type MapHolder } from './map';
import { relAdd, relOf, relPts } from './relations';
import { int, pick, type Rand } from './rng';
import { rvOHFor, rvPhase, rvWhs, rvWin, whoPrices, type Rival } from './rivals';
import { whsNp, whsNpSub, type Whs } from './safety';
import { ROLES } from './staff';
import { TOWNS, type TownId } from './towns';
import { CLIENTS, stars, uid, type Job } from './hire';

/** Mobilising a crew to a subbie job, paid when it finishes. */
export const MOB = 2500;

/** Unsealed-road treatments. per = what one crew (grader, roller, water cart) does in a day. */
export const TREAT = {
  hfg: { name: 'Heavy formation grading', unit: 'km', per: 1 },
  mfg: { name: 'Medium formation grading', unit: 'km', per: 1.33 },
  lfg: { name: 'Light formation grading', unit: 'km', per: 1.5 },
  resheet: { name: 'Gravel resheeting, 100 mm', unit: 'm³', per: 220 },
} as const;

/** Quantities: km of each grade, and m³ of gravel. */
export interface Quantities {
  hfg: number;
  mfg: number;
  lfg?: number;
  resheet: number;
}

/** Liquidated damages per week late, retention held on progress claims, and the longest terms a head contractor can set. */
export const LD_WEEK = 3000;
export const RETAIN = 0.05;
export const BIF_WEEKS = 5;

export function gradeDays(q: Quantities): number {
  return q.hfg / TREAT.hfg.per + q.mfg / TREAT.mfg.per + (q.lfg || 0) / TREAT.lfg.per;
}

export interface SubTender {
  id: string;
  place: string;
  /** The head contractor. */
  hc: string;
  /** km. */
  L: number;
  /** Gravel haul, km. */
  haul: number;
  /** Your margin. */
  mk: number;
  /** Your price, once you've priced it. */
  bid: number | null;
  /** Week it closes. */
  close: number;
  q: Quantities;
  mapIds?: string[];
  /** Water cart cost per m³ of gravel (longer haul, more water). */
  cart: number;
  crewDays: number;
  /** Weeks to finish once signed. */
  weeks: number;
  /** Offered direct, against the head contractor's budget. */
  direct?: boolean;
  budget?: number;
  /** Your share of overheads to price in (null: the default for how much work you've got on). */
  oh?: number | null;
  result?: TenderResult[];
  winner?: string;
}

export interface NonPrice {
  rec: number;
  saf: number;
  fin: number;
  load: number;
  rel: number;
  tot: number;
}

export interface TenderResult {
  name: string;
  price: number;
  pp: number;
  np: number;
  parts?: NonPrice;
  tot: number;
  you: boolean;
  method?: number;
  oh?: number;
  dc?: number;
}

/** What a typical rival's crew-day costs: some own both carts, some hire one. */
export const STD_CREW_DAY = 4250;

/** Your crew-day: fuel for the crew, casuals on the roller and two carts, wear, and a hired second cart if you own fewer than two. */
export function crewDayCost(fleet: readonly Machine[], yard: YardId): number {
  const carts = fleet.filter((m) => m.type === 'cart' && m.status !== 'auction' && m.status !== 'listed' && m.status !== 'branch').length;
  const round = (n: number, to: number) => Math.round(n / to) * to;
  return TYPES.grader.fuel + TYPES.roller.fuel + 2 * TYPES.cart.fuel + ROLES.roller.casual + 2 * ROLES.cart.casual + round(350 * YARDS[yard].svc, 10) + (carts < 2 ? round(TYPES.cart.dry / 4, 10) : 0);
}

/** The job's direct cost at a crew-day rate: grading days and gravel days, the water for the gravel, and floating the crew there and back. */
export function tCost(t: Pick<SubTender, 'q' | 'cart'>, day: number): number {
  const q = t.q;
  return Math.round((gradeDays(q) + q.resheet / TREAT.resheet.per) * day + q.resheet * t.cart + 2 * MOB);
}

export function subWks(t: Pick<SubTender, 'crewDays'>): number {
  return Math.max(1, Math.ceil(t.crewDays / 4));
}

/** Contracts on the go (subbie and your own). */
export function otherContracts(jobs: readonly Job[]): number {
  return jobs.filter((j) => !j.finished && (j.kind === 'own' || j.kind === 'sub')).length;
}

/** With nothing else on, a job carries all your overheads; with one other, half; with two or more, a quarter. */
export function ohShareDefault(contracts: number): number {
  return contracts >= 2 ? 0.25 : contracts === 1 ? 0.5 : 1;
}

export interface SubPrice {
  /** Overhead share used. */
  sh: number;
  /** Weekly overheads. */
  wk: number;
  wks: number;
  /** Overheads priced in. */
  oh: number;
  price: number;
}

/** Your price: direct cost at your crew-day, plus your share of overheads for the weeks, plus margin. */
export function subPrice(t: SubTender, overheadsWeek: number, contracts: number, crewDay: number): SubPrice {
  const sh = t.oh != null ? t.oh : ohShareDefault(contracts), wks = subWks(t), oh = Math.round((overheadsWeek * wks * sh) / 100) * 100;
  return { sh, wk: overheadsWeek, wks, oh, price: Math.round(((tCost(t, crewDay) + oh) * (1 + t.mk)) / 100) * 100 };
}

/** Payment terms on a subbie job: their usual, capped at 5 weeks, a week sooner if you're preferred. Never under 2. */
export function subTerms(rel: Record<string, number> | undefined, hc: string): number {
  return Math.max(2, Math.min(CLIENTS[hc]!.terms, BIF_WEEKS) - (relOf(rel, hc) >= 6 ? 1 : 0));
}

/** A day on this job at a typical crew's cost, with the gravel's water spread over the days. */
export function dayCostOf(t: Pick<SubTender, 'q' | 'cart' | 'crewDays'>): number {
  return TYPES.grader.fuel + TYPES.roller.fuel + 2 * TYPES.cart.fuel + ROLES.roller.casual + 2 * ROLES.cart.casual + Math.round((t.q.resheet * t.cart) / t.crewDays);
}

/** Cash you're out of pocket before the first claim lands: about 3 working days a week until it's paid. */
export function carryCash(t: SubTender, rel: Record<string, number> | undefined): number {
  return Math.round((dayCostOf(t) * Math.min(t.crewDays, 3 * subTerms(rel, t.hc)) + MOB + 1) / 1000) * 1000;
}

/** Can you tender at all? A full crew (grader, roller, water cart), a star, and SWMS. */
export function canTender(owns: (t: 'grader' | 'roller' | 'cart') => boolean, rep: number, whsSys: number): boolean {
  return owns('grader') && owns('roller') && owns('cart') && stars(rep) >= 1 && whsSys >= 1;
}

/** How you look to an assessor, apart from price. */
export interface Standing {
  rep: number;
  whs: Whs;
  week: number;
  /** Behind with the bank, over the overdraft, or (hardcore) under water. */
  stretched: boolean;
  contracts: number;
  /** Easy: finances and workload don't count against you. */
  soft: boolean;
  rel?: Record<string, number>;
}

/**
 * Non-price points. Track record: 20 + 4 a star on subbie work, 25 + 3 on council work. Safety, finances,
 * work already on, and standing with the head contractor (subbie work only). A rival is scored the same way
 * from their own books; looking at their safety system the first time sets it (one roll).
 */
export function npOf(kind: 'sub' | 'council' | 'major', rv: Rival | null, hc: string | null, me: Standing, rand: Rand): NonPrice {
  const st = rv ? rv.stars : stars(me.rep);
  const o = { rec: kind === 'sub' ? 20 + 4 * st : 25 + 3 * st } as NonPrice;
  if (rv) {
    const w = rvWhs(rand, rv);
    o.saf = kind === 'sub' ? Math.min(6, w + 2) : w;
    o.fin = rvPhase(rv) === 'stretched' ? -4 : 0;
    o.load = rv.jobs.length ? -1 : 0;
  } else {
    o.saf = kind === 'sub' ? whsNpSub(me.whs, me.week) : whsNp(me.whs, me.week);
    o.fin = me.stretched ? -4 : 0;
    const n = me.contracts;
    o.load = n >= 2 ? -2 : n === 1 ? -1 : 0;
    if (me.soft) {
      o.fin = 0;
      o.load = 0;
    }
  }
  o.rel = !rv && kind === 'sub' && hc ? relPts(me.rel, hc) : 0;
  o.tot = o.rec + o.saf + o.fin + o.load + o.rel;
  return o;
}

/** The parts of a career subbie tendering touches. */
export interface Tenderer extends MapHolder {
  seq: number;
  rep: number;
  blocked: Record<string, number>;
  rel?: Record<string, number>;
  rivals: Rival[];
  tenders: SubTender[];
  queue: { k: string; [x: string]: unknown }[];
  /** Tender stats: subbie [priced, won], council [priced, won], since week. */
  tb?: { s: [number, number]; c: [number, number]; since: number };
  subsWon: number;
}

export function tbs(st: Tenderer): NonNullable<Tenderer['tb']> {
  if (!st.tb) st.tb = { s: [0, 0], c: [0, 0], since: st.week };
  return st.tb;
}

const tenth = (x: number) => Math.round(x * 10) / 10;

/**
 * Maybe a new subbie tender this week. Up to 2 open (3 in a boom); fewer come up when the work's quiet.
 * canTender: see canTender(). fmul: how busy the work is.
 */
export function genTenders(rand: Rand, st: Tenderer, can: boolean, mood: Mood, fmul: number): SubTender | null {
  if (!can || st.tenders.length >= (mood === 'boom' ? 3 : 2)) return null;
  if (rand() > 0.35 + 0.65 * Math.min(1, fmul) || (st.tenders.length && rand() > 0.45 * Math.min(1.3, fmul))) return null;
  const hcs = HEAD_CONTRACTORS.filter((c) => !(st.blocked[c]! > st.week) && relOf(st.rel, c) > -6);
  if (!hcs.length) return null;
  const pref = hcs.filter((c) => relOf(st.rel, c) >= 6);
  const direct = !!pref.length && !st.tenders.some((x) => x.direct) && rand() < 0.25;
  const place = pick(rand, TOWNS[st.town as TownId].places), L = int(rand, 4, 12);
  const hk = tenth(L * (0.15 + rand() * 0.2)), lk = tenth(L * (0.2 + rand() * 0.2)), rs = tenth(L * (0.2 + rand() * 0.35));
  const id = uid(st), hc = pick(rand, hcs), haul = int(rand, 4, 25);
  const t: SubTender = { id, place, hc, L, haul, mk: 0.06, bid: null, close: st.week + 1, q: { hfg: hk, mfg: tenth(L - hk - lk), lfg: lk, resheet: Math.round((rs * 600) / 10) * 10 }, cart: 0, crewDays: 0, weeks: 0 };
  const pp = placePos(st.town, place), cx = pp[0] + rand() * 30 - 15, cy = pp[1] + rand() * 30 - 15;
  t.mapIds = pickRoads(dmap(rand, st), cx, cy, L);
  t.cart = Math.round((10 + 0.9 * t.haul) * 2) / 2;
  t.crewDays = Math.ceil(gradeDays(t.q) + t.q.resheet / TREAT.resheet.per);
  t.weeks = Math.ceil(t.crewDays / 3) + 2;
  if (direct) {
    t.hc = pick(rand, pref);
    t.direct = true;
    t.close = st.week + 2;
    t.mk = 0.12;
    t.budget = Math.round((tCost(t, STD_CREW_DAY) * 1.3) / 100) * 100;
  }
  st.tenders.push(t);
  return t;
}

/** Put your price in. Blocked when you're at your limit of contracts (no operations manager). */
export function submitBid(st: Tenderer, id: string, price: number, capFull: boolean): boolean {
  const t = st.tenders.find((x) => x.id === id);
  if (!t || (capFull && !t.bid)) return false;
  t.bid = price;
  note(st, { k: 'priced', place: t.place, L: t.L, hc: t.hc, bid: price });
  return true;
}

export function withdrawBid(st: Tenderer, id: string): void {
  const t = st.tenders.find((x) => x.id === id);
  if (t) t.bid = null;
}

/** Nudge your margin, −10% to +60%; your price has to be put in again. */
export function setMk(st: Tenderer, id: string, d: number): void {
  const t = st.tenders.find((x) => x.id === id);
  if (!t) return;
  t.mk = Math.max(-0.1, Math.min(0.6, Math.round((t.mk + d) * 1000) / 1000));
  t.bid = null;
}

export type CloseEvent = { k: 'directLapsed'; hc: string } | { k: 'wentTo'; name: string; price: number };

/**
 * The tender closes. A direct offer is yours if you're within their budget. Otherwise the rivals free to
 * price put theirs in, everyone's scored, and the best total wins. The winning rival carries the job and
 * sharpens their costs; the losers sharpen their margins. If you priced, a result card waits for you.
 */
export function closeTender(rand: Rand, st: Tenderer, t: SubTender, me: Standing, coName: string, mood: Mood, events: CloseEvent[]): void {
  if (t.direct) {
    if (!t.bid) {
      note(st, { k: 'directLapsed', place: t.place, L: t.L, hc: t.hc });
      relAdd(st, t.hc, -1);
      events.push({ k: 'directLapsed', hc: t.hc });
      return;
    }
    const okd = t.bid <= t.budget!;
    t.result = okd
      ? [{ name: coName, price: t.bid, pp: 60, np: 0, tot: 60, you: true }]
      : [{ name: t.hc + "'s budget", price: t.budget!, pp: 60, np: 0, tot: 60, you: false }, { name: coName, price: t.bid, pp: 60, np: 0, tot: 0, you: true }];
    t.winner = okd ? coName : t.hc;
    st.queue.push({ k: 'tresult', t });
    return;
  }
  const std = tCost(t, STD_CREW_DAY), bidders = whoPrices(rand, st.rivals, 'sub');
  type Entry = { name: string; stars: number; price: number; oh?: number; rv?: Rival; you?: boolean; pp?: number; parts?: NonPrice; np?: number; tot?: number };
  const E: Entry[] = bidders.map((x) => {
    const oh = rvOHFor(x, subWks(t));
    return { name: x.name, stars: x.stars, oh, price: Math.round(((std * x.eff + oh) * (1 + x.margin) * (0.94 + rand() * 0.12)) / 100) * 100, rv: x };
  });
  if (t.bid) E.push({ name: coName, stars: stars(st.rep), price: t.bid, you: true });
  const low = Math.min(...E.map((e) => e.price));
  for (const e of E) {
    e.pp = (60 * low) / e.price;
    e.parts = npOf('sub', e.rv ?? null, t.hc, me, rand);
    e.np = Math.max(0, e.parts.tot);
    e.tot = e.pp + e.np;
  }
  E.sort((a, b) => b.tot! - a.tot!);
  const w = E[0]!;
  if (t.bid) {
    tbs(st).s[0]++;
    if (w.you) tbs(st).s[1]++;
  }
  for (const e of E) {
    if (!e.rv) continue;
    if (e === w) {
      rvWin(rand, e.rv, e.price, std + e.oh! / e.rv.eff, t.weeks, mood);
      e.rv.eff = Math.max(0.86, e.rv.eff - 0.01);
    } else e.rv.margin = Math.max(0, e.rv.margin - 0.02);
  }
  t.result = E.map((e) => ({ name: e.name, price: e.price, pp: Math.round(e.pp! * 10) / 10, np: e.np!, parts: e.parts, tot: Math.round(e.tot! * 10) / 10, you: !!e.you }));
  t.winner = w.name;
  if (!w.you) mapRival(st.dmap!, t.mapIds, w.name, t.weeks, st.week);
  if (t.bid) st.queue.push({ k: 'tresult', t });
  else {
    events.push({ k: 'wentTo', name: w.name, price: w.price });
    note(st, { k: 'subWentTo', place: t.place, L: t.L, hc: t.hc, name: w.name, price: w.price });
  }
}

/** You won: sign it. It starts once a grader, roller, water cart and a driver are free (contracts.ts staffs it). */
export function signSub(st: Tenderer & { jobs: Job[] }, t: SubTender): Job {
  const j: Job = {
    id: uid(st), kind: 'sub', type: 'grader', client: t.hc, place: t.place, days: t.crewDays, base: t.crewDays, paid: 0, done: 0,
    rate: t.bid! / t.crewDays, terms: subTerms(st.rel, t.hc), fuelPaid: false, mId: null, rollerId: null, cartId: null, who: null,
    hireIn: 0, extra: 0, earned: 0, idleWeeks: 0, state: 'waiting', due: st.week + t.weeks, retained: 0, gravel: t.q.resheet, cart: t.cart, bid: t.bid,
    dayCost: dayCostOf(t), nm: { L: t.L },
  };
  st.jobs.push(j);
  st.subsWon++;
  mapWork(st.dmap!, t.mapIds, j);
  note(st, { k: 'signedSub', job: jobRef(j), bid: t.bid, due: j.due });
  return j;
}

/** You won but pull out: track record −2, they won't ask you for 26 weeks, and standing −4. */
export function pullOut(st: Tenderer, t: SubTender): void {
  st.rep = Math.max(0, st.rep - 2);
  st.blocked[t.hc] = st.week + 26;
  relAdd(st, t.hc, -4);
}
