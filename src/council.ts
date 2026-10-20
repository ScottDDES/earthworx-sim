// Council tenders. Once you've run your own contract, the council lets flood works packages: several roads,
// two gravel pits (close but borderline, or good but far), and you plan the crews. Later, whole flood recovery
// programs: an area's roads split into lots, due by 30 June, planned crew by crew. Price scores 60, non-price
// 40, plus up to 6 for the program. Winning signs your own contract (contracts.ts runs it).

import { jobRef, note } from './diary';
import { BASE_YEAR, yearOf } from './calendar';
import { TOWNS } from './towns';
import { BOQ, CT_PITS, CT_ROADS, dmap, mapRival, mapWork, pickRoads, placePos } from './map';
import type { Mood } from './market';
import { int, pick, type Rand } from './rng';
import { compat, shuffled } from './compat';
import { rvOHFor, rvWin, whoPrices } from './rivals';
import {
  autoPlan, hm, newCrew, planCounts, planEval, planHasLoader, progRun, stdPlan, subCrewTerms, tidyCrew,
  type CouncilTender, type Counts, type PlanCtx, type PlanEval, type PlanRoad,
} from './planning';
import { RETAIN, gradeDays, npOf, ohShareDefault, tbs, type NonPrice, type Standing, type Tenderer } from './tenders';
import { uid, type Job } from './hire';

/** Damages per week late on your own council contract, and weeks the council takes to pay. */
export const LD_OWN = 6000;
export const COUNCIL_TERMS = 4;

const round = (n: number, to: number) => Math.round(n / to) * to;
const tenth = (x: number) => Math.round(x * 10) / 10;

/** The week 30 June falls in, for a year. */
export function juneWeek(y: number): number {
  return Math.ceil((12 * (y - BASE_YEAR) + 3) * 4.345);
}

/** Your price on a council job: the plan's cost, your share of overheads for its weeks, and margin. Rounded to $500. */
export function councilPrice(t: Pick<CouncilTender, 'oh' | 'mk'>, e: Pick<PlanEval, 'wks' | 'cost'>, overheadsWeek: number, contracts: number) {
  const sh = t.oh != null ? t.oh : ohShareDefault(contracts), wks = Math.max(1, e.wks || 1), oh = round(overheadsWeek * wks * sh, 500);
  return { sh, wk: overheadsWeek, wks, oh, price: round((e.cost + oh) * (1 + t.mk), 500) };
}

/** The parts of a career council tendering touches. */
export interface CouncilWorld extends Tenderer {
  ctenders: CouncilTender[];
  won2?: boolean;
  won3?: boolean;
  majorDone?: number;
  ownWon?: number;
}

/** The whole state of the State's prestige work: two programs done, ISO 45001 and a plant hub. */
export function canPrestige(st: { majorDone?: number }, whsSys: number, yard: string): boolean {
  return (st.majorDone || 0) >= 2 && whsSys >= 3 && yard === 'hub';
}

/**
 * Maybe a new council package this week. Up to 2 open (3 once you're a regional contractor).
 * Each is 3 to 5 roads, mostly heavy formation grading with 50 mm of gravel worked in (about 300 m³ a km).
 */
export function genCouncil(rand: Rand, st: CouncilWorld, p: PlanCtx, fmul: number): CouncilTender | null {
  if (!st.won2) return null;
  const cap = st.won3 ? 3 : 2, more = st.won3 ? 0.55 : 0.35;
  if (st.ctenders.length >= cap || (st.ctenders.length && rand() > more) || rand() > Math.min(0.95, (st.won3 ? 0.8 : 0.65) * fmul)) return null;
  const T = TOWNS[st.town];
  const pl = shuffled(rand, T.places), n = int(rand, 3, 5), roads: PlanRoad[] = [];
  // the place is picked before the map is touched: making the map rolls dice, so the order matters
  const mp0 = placePos(st.town, pick(rand, T.places)), M = dmap(rand, st), mids = pickRoads(M, mp0[0], mp0[1], 40);
  for (let i = 0; i < n; i++) {
    const L = int(rand, 5, 11), hk = tenth(L * (0.5 + rand() * 0.3)), lk = tenth(L * (0.05 + rand() * 0.15));
    const mr = mids[i] ? M.roads.find((x) => x.id === mids[i]) : undefined;
    const g = 0.85 + rand() * 0.3, extra = rand();
    roads.push({ name: mr ? mr.n : pl[i] + ' Road', mapId: mr ? mr.id : null, L, hfg: hk, mfg: tenth(L - hk - lk), lfg: lk, resheet: round(hk * 300 * g + (L - hk) * extra * 120, 10) });
  }
  const q = { hfg: 0, mfg: 0, lfg: 0, resheet: 0 };
  for (const x of roads) {
    q.hfg = tenth(q.hfg + x.hfg);
    q.mfg = tenth(q.mfg + x.mfg);
    q.lfg = tenth(q.lfg + x.lfg);
    q.resheet += x.resheet;
  }
  const id = uid(st), waterKm = int(rand, 2, 15), nearHaul = int(rand, 3, 8), farHaul = int(rand, 14, 30);
  const t: CouncilTender = {
    id, roads, q, km: roads.reduce((a, x) => a + x.L, 0), waterKm, close: st.week + 2, mk: 0.06, bid: null,
    pits: [
      { name: 'Near pit', haul: nearHaul, royalty: 5, marginal: true, note: 'Close, but the gravel is borderline on spec.' },
      { name: 'Far pit', haul: farHaul, royalty: 3, marginal: false, note: 'Good gravel, long haul.' },
    ],
    pl: { crews: 1, graders: 1, rollers: 1, carts: 2, trucks: 2, pit: 0 }, weeks: 0,
  };
  subCrewTerms(rand, t);
  t.weeks = Math.max(8, stdPlan(p, t).e.wks + 1);
  t.pl = JSON.parse(JSON.stringify(stdPlan(p, t).pl));
  st.ctenders.push(t);
  return t;
}

/**
 * Maybe a flood recovery program, once you're a regional contractor and nothing like it is on.
 * A fresh program each time, shaped like a real one: some of an area's roads, lengths and gravel varied,
 * hauls shifted, split into lots of about 55–95 km. The prestige version (whole area, one lot) needs canPrestige().
 */
export function genMajor(rand: Rand, st: CouncilWorld, p: PlanCtx, fmul: number, prestigeOk: boolean): CouncilTender | null {
  if (!st.won3 || st.ctenders.some((t) => t.major) || p.jobs.some((j) => j.major && !j.finished) || rand() > 0.14 * fmul) return null;
  let area: string, roads: [string, number, number, number, number, number, number][], pits: [string, number][];
  if (st.town === 'gdi') {
    const ks = Object.keys(BOQ);
    area = pick(rand, ks);
    roads = BOQ[area]!.roads.filter(() => rand() < 0.8).map((x) => {
      const k = 0.7 + rand() * 0.6, g = k * (0.85 + rand() * 0.3);
      const haul = x[4] ? Math.max(1, Math.round(x[4] * (0.75 + rand() * 0.5))) : int(rand, 4, 18);
      const xx = (x[5] || 0) + rand() * 2 - 1, yy = (x[6] || 0) + rand() * 2 - 1;
      return [x[0], Math.round(x[1] * k * 10) / 10, Math.round(x[2] * k * 10) / 10, Math.round(x[3] * g), haul, xx, yy];
    });
    pits = BOQ[area]!.pits.map((x) => [x[0], Math.max(1, Math.round(x[1] * (0.75 + rand() * 0.5)))]);
  } else {
    const pool: (typeof BOQ)[string]['roads'] = [];
    for (const k of Object.keys(BOQ)) pool.push(...BOQ[k]!.roads);
    const names = shuffled(rand, CT_ROADS);
    area = pick(rand, TOWNS.ct.places);
    const cx = int(rand, 30, 90) * (rand() < 0.5 ? -1 : 1), cy = int(rand, 20, 80) * (rand() < 0.5 ? -1 : 1);
    roads = names.slice(0, int(rand, 18, 30)).map((nm) => {
      const x = pick(rand, pool).slice() as (typeof pool)[number], k = 1.3 * (0.7 + rand() * 0.6);
      x[5] = cx + (rand() - 0.5) * 90;
      x[6] = cy + (rand() - 0.5) * 70;
      x[0] = nm + ' Rd';
      x[1] = Math.round(x[1] * k * 10) / 10;
      x[2] = Math.round(x[2] * k * 10) / 10;
      x[3] = Math.round(x[3] * k * (0.85 + rand() * 0.3));
      x[4] = Math.round(x[4] * 1.4 + 3);
      return x;
    });
    pits = CT_PITS.map((nm) => [nm, int(rand, 2, 40)]);
  }
  const prest = prestigeOk && rand() < 0.4, tot = roads.reduce((a, x) => a + x[1] + x[2], 0);
  const lots = prest ? 1 : Math.max(1, Math.min(4, Math.round(tot / int(rand, 55, 95))));
  roads = shuffled(rand, roads);
  const per = Math.ceil(roads.length / lots), lot = int(rand, 0, lots - 1), mine = roads.slice(lot * per, (lot + 1) * per).filter((x) => x[1] + x[2] >= 0.3);
  if (!mine.length) return null;
  const q = { hfg: 0, mfg: 0, lfg: 0, resheet: 0 }, hz: number[] = [];
  const rl: PlanRoad[] = mine.map((x) => {
    q.hfg = tenth(q.hfg + x[1]);
    q.mfg = tenth(q.mfg + x[2]);
    q.resheet += x[3];
    if (x[4]) hz.push(x[4]);
    const haul = Math.max(1, x[4] || int(rand, 4, 18)), water = int(rand, 2, 14);
    return { name: x[0], L: tenth(x[1] + x[2]), hfg: x[1], mfg: x[2], lfg: 0, resheet: x[3], haul, water, x: Math.round((x[5] || 0) * 10) / 10, y: Math.round((x[6] || 0) * 10) / 10 };
  });
  q.resheet = round(q.resheet, 10);
  hz.sort((a, b) => a - b);
  const M = dmap(rand, st);
  for (const x of rl) {
    const mr = M.roads.find((r) => r.n === x.name);
    if (mr) {
      x.mapId = mr.id;
      if (st.town !== 'gdi') {
        x.x = Math.round(mr.x * 10) / 10;
        x.y = Math.round(mr.y * 10) / 10;
      }
    }
  }
  const near = Math.max(2, hz[Math.floor(hz.length * 0.5)] || 8), far = Math.max(near + 6, (hz[Math.floor(hz.length * 0.75)] || 15) + int(rand, 2, 8));
  pits.sort((a, b) => Math.abs(a[1] - near) - Math.abs(b[1] - near));
  const pn = pits[0] ? pits[0][0] : 'Near pit', pf = (pits[1] || pits[0] || ['Far pit'])[0];
  const id = uid(st), waterKm = int(rand, 2, 15);
  const t: CouncilTender = {
    id, major: true, area, lot: lot + 1, lots, roads: rl, q, km: tenth(q.hfg + q.mfg), waterKm, close: st.week + 3, mk: 0.05, bid: null, stdCrews: 3,
    pits: [
      { name: pn, haul: Math.round(near), royalty: 5, marginal: true, note: 'The closest pit to most of the roads. Gravel is borderline on spec in places.' },
      { name: pf, haul: Math.round(far), royalty: 3, marginal: false, note: 'Good gravel, but a long haul for most of the roads.' },
    ],
    pl: { crews: 3, graders: 1, rollers: 1, carts: 2, trucks: 3, pit: 0, subs: 0 }, weeks: 0,
  };
  if (prest) {
    t.prestige = true;
    t.mk = 0.08;
  }
  subCrewTerms(rand, t);
  const need = stdPlan(p, t).e.wks + 4;
  let y = yearOf(st.week);
  while (juneWeek(y) - (t.close + 1) < need) y++;
  t.dlWeek = juneWeek(y);
  t.dlYear = y;
  t.weeks = t.dlWeek - (t.close + 1);
  st.ctenders.push(t);
  note(st, { k: 'programLet', t: tRef(t), year: y });
  return t;
}

/** Enough of a council tender to name it. */
const tRef = (t: CouncilTender) => ({ major: !!t.major, prestige: !!t.prestige, area: t.area, lot: t.lot, lots: t.lots, n: t.roads.length, km: t.km });

/** Put your price in, from your plan. Blocked at your limit of contracts with no operations manager. */
export function submitCouncil(p: PlanCtx, st: CouncilWorld, id: string, overheadsWeek: number, contracts: number, capFull: boolean): boolean {
  const t = st.ctenders.find((x) => x.id === id);
  if (!t || (capFull && !t.bid)) return false;
  const e = planEval(p, t, t.pl), P = councilPrice(t, e, overheadsWeek, contracts);
  t.bid = P.price;
  t.mine = { method: e.method, oh: P.oh, cost: e.cost, pl: JSON.parse(JSON.stringify(t.pl)) };
  note(st, { k: 'tendered', t: tRef(t), bid: t.bid });
  return true;
}

export type CouncilEvent = { k: 'councilWentTo'; name: string; price: number };

/**
 * The council tender closes. The rivals price off the standard plan (no better than the difficulty's cost
 * edge allows), with their method points rolled 3–6. Prestige work only goes to the big firms.
 */
export function closeCouncil(rand: Rand, st: CouncilWorld, p: PlanCtx, t: CouncilTender, me: Standing, coName: string, mood: Mood, ef: number, events: CouncilEvent[]): void {
  const sp = stdPlan(p, t);
  let bidders = whoPrices(rand, st.rivals, t.major ? 'major' : 'council');
  if (t.prestige) {
    const bigs = st.rivals.filter((x) => x.tier === 'big');
    if (bigs.length) bidders = bigs;
  }
  type Entry = { name: string; stars: number; method: number; oh?: number; dc?: number; price: number; rv?: (typeof bidders)[number]; you?: boolean; pp?: number; parts?: NonPrice; np?: number; tot?: number };
  const E: Entry[] = bidders.map((x) => {
    const method = int(rand, 3, 6), oh = rvOHFor(x, sp.e.wks), dc = sp.e.cost * Math.max(ef || 0.95, x.eff);
    return { name: x.name, stars: x.stars, method, oh, dc, price: round((dc + oh) * (1 + x.margin + (t.prestige ? 0.06 : 0)) * (0.94 + rand() * 0.12), 500), rv: x };
  });
  if (t.bid) E.push({ name: coName, stars: 0, method: t.mine!.method, price: t.bid, you: true, oh: t.mine!.oh, dc: t.mine!.cost });
  const low = Math.min(...E.map((e) => e.price));
  for (const e of E) {
    e.pp = (60 * low) / e.price;
    e.parts = npOf('council', e.rv ?? null, null, me, rand);
    e.np = Math.max(0, e.parts.tot + e.method);
    e.tot = e.pp + e.np;
  }
  E.sort((a, b) => b.tot! - a.tot!);
  const w = E[0]!;
  if (t.bid) {
    tbs(st).c[0]++;
    if (w.you) tbs(st).c[1]++;
  }
  for (const e of E) {
    if (!e.rv) continue;
    if (e === w) rvWin(rand, e.rv, e.price, sp.e.cost + e.oh! / e.rv.eff, t.weeks, mood);
    else e.rv.margin = Math.max(0, e.rv.margin - 0.02);
  }
  t.result = E.map((e) => ({ name: e.name, price: e.price, pp: Math.round(e.pp! * 10) / 10, np: e.np!, parts: e.parts, method: e.method, tot: Math.round(e.tot! * 10) / 10, you: !!e.you, oh: Math.round(e.oh || 0), dc: Math.round(e.dc || 0) }));
  if (!w.you) mapRival(st.dmap!, t.roads.map((x) => x.mapId).filter(Boolean) as string[], w.name, t.weeks, st.week);
  if (t.bid) st.queue.push({ k: 'cresult', t });
  else {
    events.push({ k: 'councilWentTo', name: w.name, price: w.price });
    note(st, { k: 'councilWentTo', t: tRef(t), name: w.name, price: w.price });
  }
}

/** The council picked you: sign it. Your own contract starts once you (or a supervisor) and the gear are free. */
export function signOwn(st: CouncilWorld & { jobs: Job[] }, p: PlanCtx, t: CouncilTender): Job {
  const pl = t.mine!.pl, pit = t.pits[pl.pit]!, e = planEval(p, t, pl);
  const j: Job = {
    id: uid(st), kind: 'own', type: 'grader', client: TOWNS[st.town].council, place: t.roads[0]!.name, state: 'waiting', planCost: e.cost, planOH: t.mine!.oh || 0,
    terms: t.major ? 6 : COUNCIL_TERMS, ownCap: pl.own ? JSON.parse(JSON.stringify(pl.own)) : null, hm: JSON.parse(JSON.stringify(pl.hm || {})),
    crews: pl.crews, graders: pl.graders || 1, rollers: pl.rollers || 1, carts: pl.carts, trucks: pl.trucks, waterKm: t.waterKm, haul: pit.haul,
    royalty: pit.royalty, marginal: pit.marginal, far: t.pits[1], g0: gradeDays(t.q), s0: t.q.resheet, price: t.bid, claimed: 0, retained: 0, extra: 0, earned: 0,
    done: 0, days: Math.ceil(e.cd), subCrews: e.SC || 0, subRate: t.subRate || 0, subPace: t.subPace || 0.85, prog: e.prog ? progRun(t, pl, e) : null,
    prestige: !!t.prestige, planOwned: e.prog ? planCounts(p, t.close + 1) : null, need: e.need || null, rate: t.bid! / Math.max(1, e.cd),
    due: t.major ? t.dlWeek : st.week + 1 + t.weeks, major: !!t.major, retain: t.major ? 0 : RETAIN, ld: t.major ? 0 : LD_OWN,
    half: st.week + 1 + Math.round(t.weeks / 2), dlYear: t.dlYear, nm: { roads: t.roads.length, km: t.km, area: t.area, lot: t.lot, lots: t.lots }, ownedIds: [], hireWeek: 0, casuals: 0, mId: null, who: null, idleWeeks: 0,
  } as unknown as Job;
  j.gLeft = j.g0;
  j.sLeft = j.s0;
  j.gravel = j.s0;
  // the real game: a loader at the pit (dry or wet if none of yours is free when it starts), or none
  if (!compat.prototype) j.ldr = planHasLoader(pl) && t.q.resheet > 0 ? hm(pl, 'loader') : null;
  st.jobs.push(j);
  st.ownWon = (st.ownWon || 0) + 1;
  mapWork(st.dmap!, t.roads.map((x) => x.mapId).filter(Boolean) as string[], j);
  note(st, { k: 'signedOwn', job: jobRef(j), bid: t.bid, due: j.due });
  return j;
}

/** You won but pull out: track record −3. Councils talk to each other. */
export function pullOutCouncil(st: { rep: number }): void {
  st.rep = Math.max(0, st.rep - 3);
}

// ---------- changing a plan (each change clears your price) ----------

export type PlanKey = 'subs' | 'crews' | 'graders' | 'rollers' | 'carts' | 'trucks' | 'pit' | 'loader';

/** Nudge a plan setting within its limits; 'own:grader' etc. caps how many of your own you put on it. */
export function setPlan(p: PlanCtx, t: CouncilTender, k: PlanKey | `own:${string}`, d: number): void {
  const lim: Record<PlanKey, [number, number]> = { subs: [0, t.subAvail || 0], crews: [1, t.major ? 6 : 3], graders: [1, 2], rollers: [1, 2], carts: [1, 4], trucks: [1, 8], pit: [0, 1], loader: [0, 1] };
  if (t.pl.graders == null) {
    t.pl.graders = 1;
    t.pl.rollers = 1;
  }
  if (t.pl.subs == null) t.pl.subs = 0;
  if (k.startsWith('own:')) {
    const ty = k.slice(4) as keyof Counts, av = planCounts(p, t.close + 1)[ty] || 0;
    t.pl.own = t.pl.own || {};
    const cur = t.pl.own[ty] != null ? Math.min(t.pl.own[ty]!, av) : av;
    t.pl.own[ty] = Math.max(0, Math.min(av, cur + d));
    t.bid = null;
    return;
  }
  const key = k as PlanKey;
  if (key === 'pit') t.pl.pit = +d;
  else if (key === 'loader') t.pl.loader = Math.max(0, Math.min(1, (t.pl.loader ?? 1) + d));
  else (t.pl as unknown as Record<string, number>)[key] = Math.max(lim[key][0], Math.min(lim[key][1], ((t.pl as unknown as Record<string, number>)[key] ?? 0) + d));
  t.bid = null;
}

/** Hire a machine type dry (your casual drives) or wet (a subbie with operator). */
export function setHm(t: CouncilTender, k: string, v: string): void {
  t.pl.hm = t.pl.hm || {};
  t.pl.hm[k] = v === 'wet' ? 'wet' : 'dry';
  t.bid = null;
}

export function setCmk(t: CouncilTender, d: number): void {
  t.mk = Math.max(-0.1, Math.min(0.6, Math.round((t.mk + d) * 1000) / 1000));
  t.bid = null;
}

/** Your share of overheads on a tender, in quarters from 0 to all of it. */
export function setOh(t: { oh?: number | null; bid: number | null }, d: number, contracts: number): void {
  const cur = t.oh != null ? t.oh : ohShareDefault(contracts);
  t.oh = Math.max(0, Math.min(1, Math.round((cur + d) * 4) / 4));
  t.bid = null;
}

export type ProgOp =
  | { op: 'add' } | { op: 'addsub' } | { op: 'del'; i: number } | { op: 'cfg'; i: number; k: 'gr' | 'ro' | 'ca' | 'tr'; d: number }
  | { op: 'mv'; i: number; j: number; d: number } | { op: 'un'; i: number; j: number } | { op: 'as'; road: number; to: number }
  | { op: 'auto' } | { op: 'tidy' };

/** Change a program's crews: add one (yours or a subbie's, six at most), remove, resize, reorder or move roads, auto-plan, tidy. */
export function progAct(t: CouncilTender, a: ProgOp): void {
  if (!t.pl.prog) return;
  const P = t.pl.prog, subs = P.crews.filter((x) => x.sub).length;
  if (a.op === 'add' && P.crews.length < 6) P.crews.push(newCrew(t, false));
  if (a.op === 'addsub' && P.crews.length < 6 && subs < (t.subAvail || 0)) P.crews.push(newCrew(t, true));
  if (a.op === 'del' && P.crews[a.i] && P.crews.length > 1) P.crews.splice(a.i, 1);
  if (a.op === 'cfg') {
    const c = P.crews[a.i];
    if (c && !c.sub) {
      const lim = { gr: [1, 2], ro: [1, 2], ca: [1, 4], tr: [1, 8] }[a.k];
      c[a.k] = Math.max(lim[0]!, Math.min(lim[1]!, c[a.k] + a.d));
    }
  }
  if (a.op === 'mv') {
    const c = P.crews[a.i], to = a.j + a.d;
    if (c && to >= 0 && to < c.seq.length) {
      const tmp = c.seq[to]!;
      c.seq[to] = c.seq[a.j]!;
      c.seq[a.j] = tmp;
    }
  }
  if (a.op === 'un') P.crews[a.i]?.seq.splice(a.j, 1);
  if (a.op === 'as') {
    for (const x of P.crews) x.seq = x.seq.filter((q) => q !== a.road);
    P.crews[a.to]?.seq.push(a.road);
  }
  if (a.op === 'auto') t.pl.prog = autoPlan(t, P.crews.length, P.crews);
  if (a.op === 'tidy') for (const x of P.crews) tidyCrew(t, x);
  t.bid = null;
}
