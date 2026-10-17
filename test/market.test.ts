// The plant market against the prototype.

import { describe, expect, it } from 'vitest';
import {
  HEAD_CONTRACTORS, MOODS, bid, buyListing, canFinance, finDeposit, fleetValue, fmul, fundIdx, genMarket, hammer,
  inspect, int, lendCap, marketWeek, newAccounts, newLoan, newMarketMood, pick, salesWeek, seedRand, sell,
  type AuctionLot, type Buyer, type Clearance, type Machine, type MachineType, type Market, type Mood,
  type RivalSale, type SaleEvent, type TownId,
} from '../src';
import { loadPrototype, prototypeSalesStep } from './prototype';

const P = loadPrototype();
const MOOD_IDS: Mood[] = ['boom', 'steady', 'tight', 'bust'];
const KINDS: MachineType[] = ['grader', 'roller', 'cart', 'truck'];

function protoCareer(o: Record<string, unknown>): any {
  return { week: 1, town: 'gdi', wxStart: 0, fleet: [], staff: [], yard: 'home', jobs: [], queue: [], log: [], news: [], bank: 1e6, recv: [], seq: 0,
    loanStart: 180000, hardcore: false, ins: 1, tix: {}, stats: {}, coach: { off: true }, loan: newLoan(0), acc: { cap: 0 }, ...o };
}
const idsFrom = (S: { seq: number }) => () => 'i' + (S.seq = (S.seq || 0) + 1);

/** The prototype's lot, with its words turned back into the engine's codes. */
function lotAsEngine(lot: any) {
  const from = /clearance sale$/.test(lot.from) ? { k: 'clearance', name: lot.from.replace(/ clearance sale$/, '') }
    : { 'Ex-council clearance': { k: 'council' }, 'Contractor dispersal': { k: 'dispersal' }, 'Finance repossession': { k: 'repo' } }[lot.from as string];
  const { guide, ...rest } = lot;
  return { ...rest, from };
}

function randomMachine(R: () => number, i: number): Machine {
  return { id: 'm' + i, type: pick(R, KINDS), year: int(R, 2000, 2026), cond: int(R, 20, 95), hours: int(R, 3000, 15000), svcAt: 3000,
    status: pick(R, ['idle', 'idle', 'working', 'auction', 'listed']), down: 0, cover: 0, warranty: 0, jobId: null, sale: null };
}

describe('the mood of the market', () => {
  it('tables match', () => {
    expect(MOODS).toEqual(P.MOODS);
    expect([...HEAD_CONTRACTORS]).toEqual(Object.keys(P.CLIENTS));
  });

  for (const town of ['gdi', 'ct'] as TownId[]) {
    it(`${town}: funding and mood move the same week by week for 10 years`, () => {
      let turns = 0;
      for (const wxStart of [90, 4475, 7395, 10680]) {
        const wx = { town, wxStart }, S = protoCareer({ town, wxStart, week: 1 });
        P.setS(S);
        let M = newMarketMood(wx, 1);
        for (let w = 1; w <= 520; w++) {
          S.week = w;
          expect(fundIdx(wx, w)).toBeCloseTo(P.fundIdx(w), 12);
          const rep = { events: [] as string[] };
          P.marketWeek(rep);
          if (w === 1) M = newMarketMood(wx, 1);
          const turned = marketWeek(M, wx, w);
          expect(M.f).toBeCloseTo(S.mkt.f, 12);
          expect(M.mood).toBe(S.mkt.mood);
          expect(M.since).toBe(S.mkt.since);
          expect(!!turned).toBe(rep.events.length > 0);
          if (turned) turns++;
          const frozen = w % 50 < 5;
          S.freeze = frozen ? w + 1 : 0;
          expect(fmul(M, frozen)).toBeCloseTo(P.fmul(), 12);
        }
      }
      expect(turns).toBeGreaterThan(10);
    });
  }
});

describe("what's for sale", () => {
  it('the same listings, distress sales and auction lot', () => {
    const R = seedRand(41);
    let distress = 0, clearance = 0;
    for (let i = 0; i < 3000; i++) {
      const week = int(R, 1, 500), won = R() < 0.5, mood = pick(R, MOOD_IDS), seq = int(R, 0, 900), seed = int(R, 1, 1e9);
      const rivSell: RivalSale[] = R() < 0.3 ? Array.from({ length: int(R, 1, 3) }, () => ({ type: pick(R, KINDS), who: 'Weir River Plant' })) : [];
      const clear: Clearance[] = R() < 0.3 ? [{ name: 'Redgum Grading', n: int(R, 1, 3) }] : [];
      const S = protoCareer({ week, won, seq, mkt: { f: 1, mood }, rivSell: JSON.parse(JSON.stringify(rivSell)), clear: JSON.parse(JSON.stringify(clear)) });
      P.setS(S);
      P.withRNG(P.seedRand(seed), () => P.genMarket());
      const x = { week, won, mood, rivSell, clear };
      const mine = genMarket(seedRand(seed), x, idsFrom({ seq }));
      expect(mine.listings).toEqual(S.market.listings);
      const { guideLo, guideHi, ...lot } = mine.lot;
      expect(lot).toEqual(lotAsEngine(S.market.lot));
      expect(P.fk(guideLo) + '–' + P.fk(guideHi)).toBe(S.market.lot.guide);
      expect(x.rivSell).toEqual(S.rivSell);
      expect(x.clear).toEqual(S.clear);
      distress += mine.listings.filter((l) => l.distress).length;
      if (mine.lot.from.k === 'clearance') clearance++;
    }
    expect(distress).toBeGreaterThan(300);
    expect(clearance).toBeGreaterThan(300);
  });
});

describe('buying', () => {
  it('finance: the same deposit, lending limit and yes or no', () => {
    const R = seedRand(42);
    let yes = 0;
    for (let i = 0; i < 3000; i++) {
      const week = int(R, 1, 400), won = R() < 0.7, won2 = won && R() < 0.5, won3 = won2 && R() < 0.3, seq = int(R, 0, 500);
      const fleet = Array.from({ length: int(R, 0, 8) }, (_, k) => randomMachine(R, k));
      const loan = newLoan(int(R, 0, 12) * 50000);
      loan.missed = R() < 0.1 ? 1 : 0;
      const S = protoCareer({ week, won, won2, won3, seq, fleet, loan, mkt: { f: 1, mood: 'steady' } });
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => P.genMarket());
      const cap = lendCap(fleetValue(fleet, week), won, won2, won3);
      expect(cap).toBe(P.lendCap());
      for (const l of S.market.listings) {
        expect(finDeposit(l)).toBe(P.finDeposit(l));
        const ok = canFinance(l, week, loan, cap, won);
        expect(ok).toBe(P.canFinance(l));
        if (ok) yes++;
      }
    }
    expect(yes).toBeGreaterThan(500);
  });

  it('buying for cash or on finance does the same to the bank, the loan and the yard', () => {
    const R = seedRand(43);
    let bought = 0, financed = 0;
    for (let i = 0; i < 2000; i++) {
      const week = int(R, 1, 400), won = R() < 0.7, yard = pick(R, ['home', 'fenced', 'depot']), seq = int(R, 0, 500);
      const fleet = Array.from({ length: int(R, 0, 4) }, (_, k) => ({ ...randomMachine(R, k), status: 'idle' }));
      const bank = pick(R, [5000, 40000, 120000, 400000]), loan = newLoan(int(R, 0, 6) * 50000);
      const S = protoCareer({ week, won, yard, seq, fleet: JSON.parse(JSON.stringify(fleet)), bank, loan: { ...loan }, mkt: { f: 1, mood: 'steady' }, acc: { cap: 0 } });
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => P.genMarket());
      const market: Market = JSON.parse(JSON.stringify(S.market));
      market.lot = { ...market.lot } as unknown as AuctionLot;
      const l = pick(R, S.market.listings) as any, fin = R() < 0.5, seed = int(R, 1, 1e9);
      const room = { home: 2, fenced: 4, depot: 8 }[yard]! - fleet.length;
      const cap = P.lendCap();
      P.withRNG(P.seedRand(seed), () => P.buy(l.id, fin));
      const b: Buyer = { week, bank, fleet, loan, acc: newAccounts(bank), market };
      const res = buyListing(seedRand(seed), b, l.id, fin, room, cap, won, 'i' + (S.seq));
      expect(b.bank).toBe(S.bank);
      expect(b.loan).toEqual(S.loan);
      expect(b.fleet).toEqual(S.fleet);
      expect(b.market.listings).toEqual(S.market.listings);
      expect(b.acc.capital).toBe(S.acc.cap);
      if (res.ok) { bought++; if (res.lent) financed++; }
    }
    expect(bought).toBeGreaterThan(400);
    expect(financed).toBeGreaterThan(100);
  });

  it('an inspection costs $600 and shows the real condition', () => {
    const S = protoCareer({ mkt: { f: 1, mood: 'steady' }, bank: 5000 });
    P.setS(S);
    P.withRNG(P.seedRand(5), () => P.genMarket());
    const market = JSON.parse(JSON.stringify(S.market)), b = { bank: 5000, market };
    const l = S.market.listings.find((x: any) => !x.revealed) ?? S.market.listings[0];
    P.inspect(l.id);
    inspect(b, l.id);
    expect(b.bank).toBe(S.bank);
    expect(b.market.listings).toEqual(S.market.listings);
  });

  it('auction bidding and the hammer go the same way', () => {
    const R = seedRand(44);
    let won = 0, lost = 0, broke = 0;
    for (let i = 0; i < 2000; i++) {
      const week = int(R, 1, 300), seq = int(R, 0, 500), bank = pick(R, [5000, 30000, 80000, 300000]);
      const S = protoCareer({ week, seq, bank, mkt: { f: 1, mood: pick(R, MOOD_IDS) }, acc: { cap: 0 } });
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => P.genMarket());
      const lot: AuctionLot = { ...lotAsEngine(JSON.parse(JSON.stringify(S.market.lot))), guideLo: 0, guideHi: 0 } as AuctionLot;
      for (let k = 0, n = int(R, 0, 8); k < n; k++) {
        const step = pick(R, [500, 1000, 2500, 5000]);
        P.bid(step);
        bid(lot, step, 1);
        expect(lot.bid).toBe(S.market.lot.bid);
        expect(lot.leader).toBe(S.market.lot.leader);
      }
      const seed = int(R, 1, 1e9), b = { week, bank, fleet: [] as Machine[], acc: newAccounts(bank) };
      P.withRNG(P.seedRand(seed), () => P.hammer());
      const res = hammer(seedRand(seed), b, lot, 'i' + S.seq)!;
      expect(b.bank).toBe(S.bank);
      expect(b.fleet).toEqual(S.fleet);
      expect(b.acc.capital).toBe(S.acc.cap);
      if (res.k === 'won') won++; else if (res.k === 'lost') lost++; else broke++;
    }
    expect(won).toBeGreaterThan(200);
    expect(lost).toBeGreaterThan(200);
    expect(broke).toBeGreaterThan(20);
  });
});

describe('selling', () => {
  it('trade-in, auction and private listings, and the week they sell', () => {
    const R = seedRand(45), salesStep = prototypeSalesStep();
    let auctions = 0, privates = 0;
    for (let i = 0; i < 2000; i++) {
      const week = int(R, 1, 400), mood = pick(R, MOOD_IDS), dealer = R() < 0.3;
      const fleet = Array.from({ length: int(R, 1, 6) }, (_, k) => randomMachine(R, k));
      for (const m of fleet) if (m.status === 'listed') m.sale = { weeks: int(R, 1, 4), price: int(R, 40, 300) * 500 };
      const staff = dealer ? [{ id: 'w', name: 'Leanne', role: 'wsm', off: 0, trait: 'dealer' }] : [];
      const S = protoCareer({ week, fleet: JSON.parse(JSON.stringify(fleet)), staff, bank: 50000, mkt: { f: 1, mood }, acc: { cap: 0 } });
      P.setS(S);
      const b = { week, bank: 50000, fleet, acc: newAccounts(0) };

      // the player sells one
      const m = pick(R, fleet), mode = pick(R, ['trade', 'auction', 'list'] as const), seed = int(R, 1, 1e9);
      P.withRNG(P.seedRand(seed), () => P.sell(m.id, mode === 'list' ? undefined : mode));
      sell(seedRand(seed), b, m.id, mode, dealer);
      expect(b.fleet).toEqual(S.fleet);
      expect(b.bank).toBe(S.bank);

      // the week ends
      const s2 = int(R, 1, 1e9), ev: SaleEvent[] = [];
      const { rep } = salesStep(S, P.seedRand(s2));
      salesWeek(seedRand(s2), b, mood, ev);
      expect(b.fleet).toEqual(S.fleet);
      expect(b.bank).toBe(S.bank);
      expect(b.acc.capital).toBe(S.acc.cap);
      expect(ev.length).toBe(rep.events.length);
      auctions += ev.filter((e) => e.k === 'soldAtAuction').length;
      privates += ev.filter((e) => e.k === 'soldPrivately').length;
    }
    expect(auctions).toBeGreaterThan(300);
    expect(privates).toBeGreaterThan(300);
  });
});
