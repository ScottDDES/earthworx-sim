// Longevity (Scott, 22 Oct): developers want late-model, low-hour gear, so an outfit has to turn its fleet over.
// New machines come from the dealer: list price, 4 to 10 weeks, two years' warranty, finance and trade-ins.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEV_BIG, NEW_WARRANTY_WEEKS, TRADE_SHARE, bulkStart, compat, devStd, game, genEnquiry, genMarket, meetsStd, newPrice, seedRand, value, yearOf } from '../src';

type Career = game.Career;
const add = (c: Career, type: string, year: number, hours: number) => {
  c.fleet.push({ id: 'm' + c.fleet.length, type, year, cond: 85, hours, svcAt: hours, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null } as never);
  return c.fleet[c.fleet.length - 1]!;
};
const outfit = () => {
  const c = game.newCareer({ co: 'New Gear', loan: 900000, town: 'gdi', path: 'bulk' }, 9);
  c.phase = 'play';
  c.yard = 'hub';
  c.bank = 5000000;
  c.won = c.won2 = true;
  c.bulk ??= { enq: [] };
  return c;
};

describe('longevity: late-model gear and the dealer', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('developers set a standard: 10 years and 12,000 hours, or 5 and 6,000 on the big jobs', () => {
    expect(devStd(DEV_BIG - 10000)).toEqual({ age: 10, hrs: 12000 });
    expect(devStd(DEV_BIG)).toEqual({ age: 5, hrs: 6000 });
    const c = outfit(), yr = yearOf(c.week);
    expect(meetsStd({ year: yr - 4, hours: 5000 }, devStd(DEV_BIG), c.week)).toBe(true);
    expect(meetsStd({ year: yr - 6, hours: 5000 }, devStd(DEV_BIG), c.week)).toBe(false);
    expect(meetsStd({ year: yr - 4, hours: 7000 }, devStd(DEV_BIG), c.week)).toBe(false);
    expect(genEnquiry(seedRand(3), c as never, 1, 'dev').std).toBeTruthy();
  });

  it("gear that falls short can't go on a developer's job: it waits until the spread meets the standard", () => {
    const c = outfit(), yr = yearOf(c.week);
    for (const t of ['s637', 's637', 'c825', 'moxycart']) add(c, t, 2012, 15000);
    const e = genEnquiry(seedRand(4), c as never, 1, 'dev');
    c.jobs.push({ id: 'D1', kind: 'bulk', dk: 'dev', state: 'waiting', client: e.farm, place: e.place, haul: e.haul, est: e.vol, truth: e.truth, m3: 0, won: c.week, weeks: e.weeks, days: 0, done: 0, std: e.std, tested: true } as never);
    bulkStart(c as never, []);
    expect(c.jobs[0]!.state).toBe('waiting');
    for (const t of ['s637', 's637', 'c825', 'moxycart']) add(c, t, yr - 2, 2500);
    bulkStart(c as never, []);
    expect(c.jobs[0]!.state).toBe('running');
    // only the late-model machines went on it
    for (const m of c.fleet.filter((x) => x.jobId === 'D1')) expect(m.year).toBe(yr - 2);
  });

  it('order new from the dealer: paid now, delivered in 4 to 10 weeks with two years\' warranty, and it holds a spot in the yard', () => {
    const c = outfit(), bank = c.bank, room = game.room(c), price = newPrice('d8', game.mood(c));
    expect(game.orderNew(c, 'd8')).toBe(true);
    expect(bank - c.bank).toBe(price);
    expect(game.room(c)).toBe(room - 1);
    expect(c.orders![0]!.w - c.week).toBeGreaterThanOrEqual(4);
    expect(c.orders![0]!.w - c.week).toBeLessThanOrEqual(10);
    const due = c.orders![0]!.w;
    for (let i = 0; c.orders!.length && i < 12; i++) { c.queue = []; game.endWeek(c); }
    expect(c.week).toBe(due + 1);
    const m = c.fleet.find((x) => x.type === 'd8')!;
    expect(m.year).toBe(yearOf(c.week));
    expect(m.hours).toBeLessThan(30);
    expect(m.warranty - c.week).toBeGreaterThan(NEW_WARRANTY_WEEKS - 12);
    expect(c.orders).toEqual([]);
  });

  it('trade in an old machine against it, or put it on finance', () => {
    const c = outfit(), old = add(c, 'd8', 2012, 15000), bank = c.bank, price = newPrice('d8', game.mood(c));
    const credit = Math.round((value(old, c.week) * TRADE_SHARE) / 500) * 500;
    expect(game.orderNew(c, 'd8', false, old.id)).toBe(true);
    expect(bank - c.bank).toBe(price - credit);
    expect(c.fleet.includes(old)).toBe(false);
    const f = outfit();
    for (let i = 0; i < 4; i++) add(f, 'grader', yearOf(f.week) - 3, 4000);
    const b0 = f.bank, l0 = f.loan.bal;
    expect(game.orderNew(f, 'grader', true)).toBe(true);
    const p = newPrice('grader', game.mood(f));
    expect(b0 - f.bank).toBe(p - Math.round(p * 0.8));
    expect(f.loan.bal - l0).toBe(Math.round(p * 0.8));
  });

  it('late-model used gear turns up in the listings; the prototype has none, and no dealer', () => {
    const c = outfit(), yr = yearOf(c.week);
    let late = 0, all = 0;
    for (let i = 0; i < 60; i++) for (const l of genMarket(seedRand(i), { week: c.week, won: true, mood: 'steady', rivSell: [], clear: [] }, () => 'x' + i).listings) { all++; if (yr - l.year <= 6) late++; }
    expect(late / all).toBeGreaterThan(0.12);
    compat.prototype = true;
    const p = outfit();
    expect(game.orderNew(p, 'd8')).toBe(false);
    late = 0;
    for (let i = 0; i < 30; i++) for (const l of genMarket(seedRand(i), { week: p.week, won: true, mood: 'steady', rivSell: [], clear: [] }, () => 'y' + i).listings) if (yr - l.year <= 6) late++;
    expect(late).toBe(0);
    compat.prototype = false;
  });
});

describe('a trade-in worth more than the new machine', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });
  it('the dealer pays you the difference', () => {
    const c = outfit(), big = add(c, 's657', yearOf(c.week) - 2, 3000), bank = c.bank;
    const credit = Math.round((value(big, c.week) * TRADE_SHARE) / 500) * 500, price = newPrice('roller', game.mood(c));
    expect(credit).toBeGreaterThan(price);
    expect(game.orderNew(c, 'roller', false, big.id)).toBe(true);
    expect(c.bank - bank).toBe(credit - price);
  });
});
