// The new engine against the prototype: same inputs, same answers.
// If one of these fails after a change, either the change is a mistake or it's a deliberate
// change of the rules, and the test should be updated to say so.

import { describe, expect, it } from 'vitest';
import {
  bankWeek, fromState, hashN, int, monthIdx, newLoan, pick, seedRand, weeklyRepay, yearOf,
  forecast, meanYearMm, rainChance, rainMm, recordDate, wetDay, type Loan, type TownId,
} from '../src';
import { loadPrototype, prototypeBankStep } from './prototype';

const P = loadPrototype();
const TOWN_IDS: TownId[] = ['gdi', 'ct'];

describe('random numbers', () => {
  it('a seed gives the same stream as the prototype', () => {
    for (const seed of [1, 42, 123456789, 2147483646]) {
      const mine = seedRand(seed), theirs = P.seedRand(seed);
      for (let i = 0; i < 1000; i++) expect(mine()).toBe(theirs());
    }
  });

  it('the saved stream carries on exactly like the prototype’s', () => {
    const st = { a: 987654 }, mine = fromState(st), theirs = P.seedRand(987654);
    for (let i = 0; i < 500; i++) expect(mine()).toBe(theirs());
    // and picks up again from the saved number
    const resumed = fromState({ a: st.a });
    for (let i = 0; i < 50; i++) expect(resumed()).toBe(theirs());
  });

  it('whole numbers, picks and text seeds match', () => {
    const list = ['grader', 'roller', 'cart', 'truck'];
    const mine = seedRand(7);
    P.withRNG(P.seedRand(7), () => {
      for (let i = 0; i < 300; i++) {
        expect(int(mine, 2, 9)).toBe(P.ri(2, 9));
        expect(pick(mine, list)).toBe(P.pick(list));
      }
    });
    for (const s of ['', 'season|wet-2010', '12345|17|tenders', 'Goondiwindi-district-1']) expect(hashN(s)).toBe(P.hashN(s));
  });
});

describe('calendar', () => {
  it('every week of a 10-year career lands in the same month and year', () => {
    for (let w = 1; w <= 520; w++) {
      expect(monthIdx(w)).toBe(P.monthIdx(w));
      expect(yearOf(w)).toBe(P.yearOf(w));
    }
  });
});

describe('weather', () => {
  // Careers starting in different years, plus starts near the end of the record so it wraps.
  const starts = [0, 90, 4475, 7395, 10680, 10950];

  for (const town of TOWN_IDS) {
    it(`${town}: rain, wet days and forecasts match day by day for 4 years`, () => {
      for (const wxStart of starts) {
        const ctx = { town, wxStart };
        P.setS({ town, wxStart, week: 1 });
        for (let w = 1; w <= 208; w++) {
          for (let d = 0; d < 7; d++) {
            const off = (w - 1) * 7 + d;
            expect(rainMm(ctx, off)).toBe(P.wxMm(off));
            expect(wetDay(ctx, w, d)).toBe(P.wetDay(w, d));
            expect(forecast(ctx, w, d)).toEqual(P.forecast(w, d));
          }
        }
        expect(recordDate(ctx, 123).getTime()).toBe(P.wxDate(123).getTime());
      }
    });

    it(`${town}: monthly odds and the yearly average match`, () => {
      for (let w = 1; w <= 52; w++) {
        P.setS({ town, wxStart: 0, week: w });
        expect(rainChance(town, monthIdx(w))).toBe(P.rainP());
      }
      P.setS({ town, wxStart: 0, week: 1 });
      expect(meanYearMm(town)).toBe(P.wxMean());
    });
  }
});

describe('bank', () => {
  it('repayments match for every loan size on offer', () => {
    for (let a = 0; a <= 1_000_000; a += 5_000) expect(weeklyRepay(a)).toBe(P.weeklyRepay(a));
  });

  it('a week at the bank matches the prototype in every situation', () => {
    const step = prototypeBankStep();
    const R = seedRand(99);
    for (let i = 0; i < 2000; i++) {
      // a spread of balances: flush, in the overdraft, over the limit, with and without arrears
      const loan: Loan = newLoan(int(R, 0, 6) * 50_000);
      loan.missed = int(R, 0, 2);
      loan.arrears = loan.missed * loan.weekly;
      const bank = int(R, -200_000, 60_000), od = pick(R, [20_000, 40_000, 150_000]);

      const mine = { bank, loan: { ...loan } };
      const theirs = { bank, loan: { ...loan } };
      const res = bankWeek(mine, od);
      const { rep, BK } = step(theirs, od);

      expect(mine.bank).toBeCloseTo(theirs.bank, 6);
      expect(mine.loan).toEqual(theirs.loan);
      expect(res.paid).toBeCloseTo(rep.costs, 6);
      expect(res.loanInterest).toBeCloseTo(BK.li, 6);
      expect(res.odInterest).toBe(BK.odi ?? 0);
      expect(res.missedNow).toBe(rep.events.some((e: string) => /Missed a loan repayment/.test(e)));
    }
  });
});
