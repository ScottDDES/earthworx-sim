// The district map and subbie tenders against the prototype.

import { describe, expect, it } from 'vitest';
import {
  BOQ, DIFFICULTY, HEAD_CONTRACTORS, PLACE_POS, TREAT, canTender, carryCash, closeTender, crewDayCost, dayCostOf, dmap,
  genTenders, int, mapStats, mapWeek, mkRivals, newLoan, newWhs, npOf, ohShareDefault, otherContracts, pick, pickRoads,
  placePos, pullOut, seedRand, signSub, subPrice, subTerms, tCost,
  type CloseEvent, type Difficulty, type Machine, type MachineType, type MapEvent, type Mood, type Standing, type SubTender, type Tenderer, type TownId,
} from '../src';
import { diaryMark, diarySame } from './diaryCheck';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const LOAN_FOR: Record<Difficulty, number> = { easy: 350000, normal: 180000, hard: 80000, hc: 80000 };
const MOOD_IDS: Mood[] = ['boom', 'steady', 'tight', 'bust'];
const strip = (o: any) => { const c = { ...o }; delete c.title; delete c.nm; return c; };

function protoCareer(o: Record<string, unknown>): any {
  return { week: 1, town: 'gdi', fleet: [], staff: [], yard: 'home', jobs: [], queue: [], log: [], news: [], bank: 100000, recv: [], seq: 0,
    co: 'Black Soil Earthmoving', loanStart: 180000, hardcore: false, ins: 1, rep: 10, blocked: {}, loan: newLoan(0), tenders: [], subsWon: 0, tix: {}, stats: { earned: 0 }, ...o };
}

function randomFleet(R: () => number): Machine[] {
  const kinds: MachineType[] = ['grader', 'roller', 'cart', 'cart', 'truck'];
  return Array.from({ length: int(R, 0, 6) }, (_, i) => ({ id: 'm' + i, type: pick(R, kinds), year: 2012, cond: 70, hours: 9000, svcAt: 8900,
    status: pick(R, ['idle', 'idle', 'job', 'listed']), down: 0, cover: 0, warranty: 0, jobId: null, sale: null }));
}

/** A tendering business in both shapes, with its map made the way a career start makes it. */
function randomTenderer(R: () => number) {
  const town: TownId = pick(R, ['gdi', 'ct']), d: Difficulty = pick(R, ['easy', 'normal', 'hard', 'hc']);
  const week = int(R, 1, 300), seq = int(R, 0, 900), rep = int(R, 0, 30), mapSeed = int(R, 1, 1e9);
  const st: Tenderer = { town, week, seq, rep, blocked: {}, rivals: mkRivals(seedRand(int(R, 1, 1e9)), town), tenders: [], queue: [], subsWon: 0, jobs: [] };
  if (R() < 0.6) st.rel = Object.fromEntries(HEAD_CONTRACTORS.map((c) => [c, int(R, -8, 10)]));
  if (R() < 0.2) st.blocked[pick(R, HEAD_CONTRACTORS)] = week + 10;
  dmap(seedRand(mapSeed), st);
  const whs = { ...newWhs(true), sys: int(R, 1, 3) };
  const S = protoCareer({ ...JSON.parse(JSON.stringify(st)), loanStart: LOAN_FOR[d], hardcore: d === 'hc', whs: JSON.parse(JSON.stringify(whs)), fleet: randomFleet(R) });
  return { st, S, d, whs };
}

function standing(S: any, whs: any, d: Difficulty): Standing {
  P.setS(S);
  return { rep: S.rep, whs, week: S.week, stretched: P.playerStretched(), contracts: P.otherContracts(), soft: !!DIFFICULTY[d].soft, rel: S.rel };
}

describe('the district map', () => {
  it('the same roads, places and starting damage', () => {
    expect(BOQ).toEqual(P.BOQ);
    expect(PLACE_POS).toEqual(P.PLACE_POS);
    for (const town of ['gdi', 'ct'] as TownId[]) for (let seed = 1; seed < 60; seed++) {
      const st: any = { town, week: 1, jobs: [] }, S = protoCareer({ town });
      P.setS(S);
      P.withRNG(P.seedRand(seed), () => P.dmap());
      expect(dmap(seedRand(seed), st)).toEqual(S.dmap);
      expect(mapStats(st.dmap)).toEqual(P.mapStats());
    }
  });

  it('roads near a spot, and places on the map, are picked the same', () => {
    const R = seedRand(81);
    for (let i = 0; i < 2000; i++) {
      const { st, S } = randomTenderer(R);
      const cx = int(R, -140, 140), cy = int(R, -70, 150), km = int(R, 2, 60);
      P.setS(S);
      expect(pickRoads(st.dmap!, cx, cy, km)).toEqual(P.pickRoads(cx, cy, km));
      const pl = pick(R, ['Talwood', 'Texas', 'Pentland', 'Nowhere Special', 'Basalt']);
      expect(placePos(st.town, pl)).toEqual(P.placePos(pl));
    }
  });

  it('three years of the map: damage, repairs, flood events and big rain', () => {
    const R = seedRand(82);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 40; i++) {
      const { st, S } = randomTenderer(R);
      for (let wk = 1; wk <= 156; wk++) {
        const mood = wk % 30 < 8 ? 'boom' : pick(R, MOOD_IDS), f = mood === 'boom' ? 1.6 : 1.1, mm = pick(R, [0, 5, 20, 45, 95, 140]), seed = int(R, 1, 1e9);
        st.week = S.week = wk;
        Object.assign(S, { mkt: { f, mood }, freeze: 0 });
        P.setS(S);
        const rep = { mm, events: [] as string[] }, ev: MapEvent[] = [];
        P.withRNG(P.seedRand(seed), () => P.mapWeek(rep));
        mapWeek(seedRand(seed), st.dmap!, wk, Math.max(0.5, Math.min(1.5, f / 1.1)), mood, mm, st.rivals.map((x) => x.name), ev);
        expect(st.dmap).toEqual(S.dmap);
        expect(ev.length).toBe(rep.events.length);
        for (const e of ev) seen[e.k] = (seen[e.k] || 0) + 1;
      }
    }
    expect(seen.floodEvent).toBeGreaterThan(20);
    expect(seen.roadsCut).toBeGreaterThan(100);
  });
});

describe('pricing a subbie tender', () => {
  it('costs, overheads, terms and carry cash match', () => {
    const R = seedRand(83);
    for (let i = 0; i < 2000; i++) {
      const { st, S } = randomTenderer(R);
      S.yard = pick(R, ['home', 'fenced', 'depot', 'hub']);
      S.jobs = Array.from({ length: int(R, 0, 3) }, (_, k) => ({ id: 'j' + k, kind: pick(R, ['sub', 'own', 'wet']), finished: R() < 0.2 }));
      st.jobs = S.jobs;
      S.whs = { ...newWhs(true), sys: int(R, 1, 3), talks: R() < 0.5 };
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => { for (let g = 0; g < 30 && !S.tenders.length; g++) P.genTenders(); });
      const t: SubTender | undefined = S.tenders[0];
      if (!t) continue;
      t.mk = pick(R, [-0.05, 0.06, 0.2]);
      if (R() < 0.3) t.oh = pick(R, [0, 0.25, 0.8]);
      expect(crewDayCost(S.fleet, S.yard)).toBe(P.crewDayCost());
      const day = P.crewDayCost();
      expect(tCost(t, day)).toBe(P.tCost(t));
      expect(otherContracts(st.jobs as any)).toBe(P.otherContracts());
      expect(ohShareDefault(otherContracts(st.jobs as any))).toBe(P.ohShareDefault());
      expect(subPrice(t, P.overheads(), P.otherContracts(), day)).toEqual(P.subPrice(t));
      expect(dayCostOf(t)).toBe(P.dayCostOf(t));
      expect(subTerms(S.rel, t.hc)).toBe(P.subTerms(t.hc));
      expect(carryCash(t, S.rel)).toBe(P.carryCash(t));
    }
    expect(TREAT).toEqual(P.TREAT);
  });

  it('non-price points: you and the rivals', () => {
    const R = seedRand(84);
    for (let i = 0; i < 3000; i++) {
      const { st, S, d } = randomTenderer(R);
      S.whs.inc = R() < 0.3 ? [{ w: S.week - int(R, 0, 120), sev: pick(R, ['lti', 'serious']), who: '' }] : [];
      S.loan.missed = R() < 0.15 ? 1 : 0;
      S.bank = pick(R, [50000, -10000, -60000]);
      S.won = R() < 0.6;
      S.jobs = Array.from({ length: int(R, 0, 3) }, (_, k) => ({ id: 'j' + k, kind: 'sub', finished: false }));
      const kind = pick(R, ['sub', 'council', 'major'] as const), hc = pick(R, [...HEAD_CONTRACTORS, null]);
      const me = standing(S, JSON.parse(JSON.stringify(S.whs)), d);
      expect(npOf(kind, null, hc, me, seedRand(1))).toEqual(P.npOf(kind, null, hc));
      const k = int(R, 0, st.rivals.length - 1), seed = int(R, 1, 1e9);
      const theirs = P.withRNG(P.seedRand(seed), () => P.npOf(kind, S.rivals[k], hc));
      expect(npOf(kind, st.rivals[k]!, hc, me, seedRand(seed))).toEqual(theirs);
      expect(st.rivals[k]).toEqual(S.rivals[k]);
    }
  });
});

describe('subbie tenders', () => {
  it('the same tenders come up, on the same roads', () => {
    const R = seedRand(85);
    let made = 0, direct = 0;
    for (let i = 0; i < 3000; i++) {
      const { st, S } = randomTenderer(R);
      const mood = pick(R, MOOD_IDS), f = pick(R, [0.6, 1.1, 1.7]), seed = int(R, 1, 1e9);
      S.mkt = { f, mood };
      S.fleet = [{ type: 'grader', status: 'idle' }, { type: 'roller', status: 'idle' }, { type: 'cart', status: 'idle' }].filter(() => R() < 0.9);
      if (R() < 0.3) { const t0 = { id: 'tx', direct: R() < 0.5, hc: 'Border Civil', close: S.week + 1 }; st.tenders.push(t0 as any); S.tenders.push({ ...t0 }); }
      P.setS(S);
      const can = P.canTender();
      expect(canTender((k) => S.fleet.some((m: any) => m.type === k && m.status !== 'auction'), S.rep, S.whs.sys)).toBe(can);
      P.withRNG(P.seedRand(seed), () => P.genTenders());
      const t = genTenders(seedRand(seed), st, can, mood, Math.max(0.5, Math.min(1.5, f / 1.1)));
      expect(st.tenders).toEqual(S.tenders.map(strip));
      expect(st.seq).toBe(S.seq);
      expect(st.dmap).toEqual(S.dmap);
      if (t) { made++; if (t.direct) direct++; }
    }
    expect(made).toBeGreaterThan(500);
    expect(direct).toBeGreaterThan(30);
  });

  it('closing: the same prices, scores, winner, and what it does to the rivals and the map', () => {
    const R = seedRand(86);
    let won = 0, lost = 0, notPriced = 0;
    const said = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const { st, S, d } = randomTenderer(R);
      const mood = pick(R, MOOD_IDS);
      S.mkt = { f: 1.1, mood };
      S.fleet = [{ type: 'grader', status: 'idle' }, { type: 'roller', status: 'idle' }, { type: 'cart', status: 'idle' }];
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => { for (let g = 0; g < 30 && !S.tenders.length; g++) P.genTenders(); });
      if (!S.tenders.length) continue;
      st.tenders = JSON.parse(JSON.stringify(S.tenders.map(strip)));
      st.seq = S.seq;
      st.dmap = JSON.parse(JSON.stringify(S.dmap));
      const t = st.tenders[0]!, pt = S.tenders[0];
      if (R() < 0.75) { t.bid = pt.bid = Math.round(tCost(t, 4250) * (0.9 + R() * 0.7) / 100) * 100; }
      const seed = int(R, 1, 1e9), me = standing(S, JSON.parse(JSON.stringify(S.whs)), d), ev: CloseEvent[] = [];
      P.setS(S);
      const mk = diaryMark(P, st);
      P.withRNG(P.seedRand(seed), () => P.closeTender(pt));
      closeTender(seedRand(seed), st, t, me, S.co, mood, ev);
      for (const k of diarySame(P, st, mk)) said.add(k);
      expect(t.result).toEqual(pt.result);
      expect(t.winner).toEqual(pt.winner);
      expect(st.rivals).toEqual(S.rivals);
      expect(st.dmap).toEqual(S.dmap);
      expect(st.tb).toEqual(S.tb);
      expect(st.rel ?? {}).toEqual(S.rel ?? {});
      expect(st.queue.map((q: any) => q.k)).toEqual(S.queue.map((q: any) => q.k));
      if (!t.bid) notPriced++; else if (t.result?.[0]?.you) won++; else lost++;
    }
    expect(won).toBeGreaterThan(200);
    for (const k of ['subWentTo', 'directLapsed']) expect(said.has(k), k).toBe(true);
    expect(lost).toBeGreaterThan(200);
    expect(notPriced).toBeGreaterThan(200);
  });

  it('signing a win, or pulling out', () => {
    const R = seedRand(87);
    for (let i = 0; i < 1500; i++) {
      const { st, S } = randomTenderer(R);
      S.fleet = [{ type: 'grader', status: 'idle' }, { type: 'roller', status: 'idle' }, { type: 'cart', status: 'idle' }];
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => { for (let g = 0; g < 30 && !S.tenders.length; g++) P.genTenders(); });
      if (!S.tenders.length) continue;
      const pt = S.tenders[0], t: SubTender = JSON.parse(JSON.stringify(strip(pt)));
      pt.bid = t.bid = 150000;
      st.seq = S.seq; st.dmap = JSON.parse(JSON.stringify(S.dmap));
      // an empty yard, so the prototype's staffing step (contracts) leaves the new job waiting
      S.fleet = [];
      if (R() < 0.7) {
        P.setS(S);
        P.signSub(pt);
        signSub(st as Tenderer & { jobs: any[] }, t);
        expect(st.jobs.map(strip)).toEqual(S.jobs.map(strip));
        expect(st.dmap).toEqual(S.dmap);
        expect(st.subsWon).toBe(S.subsWon);
      } else {
        P.setS(S);
        pt.result = [{ you: true, name: 'x', price: 1, tot: 1 }];
        P.withRNG(P.seedRand(1), () => { const c = P.curve({ k: 'tresult', t: pt, sd: 1 }); c.opts[c.opts.length - 1].go(); });
        pullOut(st, t);
        expect(st.rep).toBe(S.rep);
        expect(st.blocked).toEqual(S.blocked);
        expect(st.rel ?? {}).toEqual(S.rel ?? {});
      }
    }
  });
});
