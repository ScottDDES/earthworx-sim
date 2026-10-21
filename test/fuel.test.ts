// Bulk fuel and the diesel price (the real game only).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BULK_OFF, CALLOUT, buyTank, orderFuel, DIESEL_BASE, RISE_FALL, TANKS, compat, choose, drawCard, fuelIdle, fuelSettle, fuelStart, fuelWeek, game, hashN, newAccounts,
  newFuel, pumpPrice, seedRand, warMul, TYPES, dayHours, genEnquiry, type FuelBook, type FuelEvent,
} from '../src';

type FB = Parameters<typeof fuelStart>[0];
const biz = (o: Partial<FB> = {}): FB => ({ week: 30, bank: 100000, acc: newAccounts(0), yard: 'depot', staff: [], queue: [], fuel: newFuel(), ...o });

describe('bulk fuel', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('nothing changes without a tank at the normal price: the jobs already charge the base price', () => {
    const b = biz();
    fuelStart(b, []);
    b.fuel!.wk = 570 * 5;
    expect(fuelSettle(() => 0.99, b, 1, [])).toBe(0);
    expect(b.bank).toBe(100000);
  });

  it('a tank bought by the load saves on the pump, and its diesel was paid for when it came', () => {
    const b = biz({ bank: 200000 });
    expect(buyTank(b, 'mid')).toBe(true);
    const F = b.fuel!, at = DIESEL_BASE - BULK_OFF;
    expect(F.L).toBe(TANKS.mid.L);
    expect(b.bank).toBe(200000 - TANKS.mid.cost - Math.round(TANKS.mid.L * at));
    const before = b.bank;
    fuelStart(b, []);
    F.wk = 2100; // 1,000 litres at the base price, already charged by the jobs
    const extra = fuelSettle(() => 0.99, b, 1, []);
    expect(extra).toBe(-2100);
    expect(b.bank).toBe(before + 2100);
    expect(F.L).toBe(TANKS.mid.L - 1000);
  });

  it('a dry tank stands the work down a day, then the fuel truck charges the pump price and a call-out', () => {
    const b = biz();
    const F = b.fuel!;
    Object.assign(F, { tank: 'small', L: 600, avg: 1.95, last: 500 });
    fuelStart(b, []);
    expect(F.dry).toBe(1); // one day's diesel, so Tuesday waits on the fuel truck
    expect(fuelIdle(b, 1)).toBe(true);
    expect(fuelIdle(b, 0)).toBe(false);
    F.wk = 2000 * DIESEL_BASE;
    const ev: FuelEvent[] = [];
    const extra = fuelSettle(() => 0.99, b, 1, ev);
    expect(extra).toBe(Math.round(1400 * DIESEL_BASE + CALLOUT - 2000 * DIESEL_BASE));
    expect(ev.some((e) => e.k === 'fuelDry')).toBe(true);
    expect(F.L).toBe(0);
  });

  it('a dry tank costs a working day on a real career', () => {
    const run = (dry: boolean) => {
      const c = game.newCareer({ co: 'Fuel Test', loan: 350000, town: 'gdi' }, 31);
      const g = c.market!.listings.filter((m) => m.type === 'grader').sort((a, b) => a.price - b.price)[0]!;
      game.buy(c, g.id);
      game.open(c);
      c.yard = 'fenced';
      game.buyFuelTank(c, 'small');
      let lost = 0;
      for (let k = 0; k < 12 && c.phase === 'play'; k++) {
        for (let j = 0; c.queue.length && j < 20; j++) choose(c, 0);
        for (const o of c.offers.slice()) if (o.kind === 'council' || o.kind === 'private') game.accept(c, o.id);
        if (dry) Object.assign(c.fuel!, { L: 0, order: null });
        else game.orderDiesel(c, true);
        const r = game.endWeek(c);
        if (r) lost += r.lost;
      }
      return lost;
    };
    expect(run(true)).toBeGreaterThan(run(false));
  });

  it('council contracts pay most of a rise back; other work wears it, less a levy', () => {
    const b = biz();
    const F = b.fuel!;
    F.war = { from: 28, to: 40, peak: 1.5 };
    const pump = pumpPrice(F, 30);
    expect(pump).toBeCloseTo(DIESEL_BASE * 1.5, 2);
    fuelStart(b, []);
    F.wk = 1000 * DIESEL_BASE;
    F.wkRF = 1000 * DIESEL_BASE;
    const council = fuelSettle(() => 0.99, b, 1, []);
    expect(council).toBe(Math.round(1000 * (pump - DIESEL_BASE) * (1 - RISE_FALL)));
    fuelStart(b, []);
    F.wk = 1000 * DIESEL_BASE;
    const farm = fuelSettle(() => 0.99, b, 1, []);
    expect(farm).toBe(Math.round(1000 * (pump - DIESEL_BASE)));
    F.levy = 50;
    fuelStart(b, []);
    F.wk = 1000 * DIESEL_BASE;
    expect(fuelSettle(() => 0.99, b, 1, [])).toBe(Math.round(1000 * (pump - DIESEL_BASE) * 0.5));
  });

  it('the war climbs over a fortnight, holds, eases, and rations the loads', () => {
    const w = { from: 10, to: 18, peak: 1.5 };
    expect(warMul(w, 9)).toBe(1);
    expect(warMul(w, 10)).toBeGreaterThan(1);
    expect(warMul(w, 11)).toBeGreaterThan(warMul(w, 10));
    expect(warMul(w, 15)).toBe(1.5);
    expect(warMul(w, 20)).toBeLessThan(1.5);
    expect(warMul(w, 30)).toBe(1);
    const b = biz({ week: 12 });
    Object.assign(b.fuel!, { tank: 'mid', L: 1000, war: w });
    expect(orderFuel(b, true)).toBe(true);
    expect(b.fuel!.order!.L).toBe(TANKS.mid.L / 2);
    expect(b.fuel!.order!.due).toBe(14);
  });

  it('every career on the same seed sees the same prices and the same war, so a season stays fair', () => {
    const path = (staff: number) => {
      const b = biz({ week: 1, staff: Array.from({ length: staff }, () => ({ role: 'grader' })) });
      const px: number[] = [];
      let war = -1;
      for (let w = 1; w < 600; w++) {
        b.week = w;
        fuelWeek(seedRand(hashN('season-7|' + w + '|diesel')), b, 1, []);
        px.push(pumpPrice(b.fuel!, w));
        if (war < 0 && b.queue.some((q) => q.k === 'dieselWar')) war = w;
      }
      return { px, war, F: b.fuel as FuelBook };
    };
    const a = path(0), z = path(6);
    expect(a.px).toEqual(z.px);
    expect(a.war).toBe(z.war);
    expect(a.war).toBeGreaterThan(26);
    // the drift stays a few cents either side of normal outside a war
    expect(Math.min(...a.px)).toBeGreaterThanOrEqual(Math.round(DIESEL_BASE * 0.9 * 100) / 100);
  });

  it('the ops manager keeps it topped up; nobody else does', () => {
    for (const ops of [false, true]) {
      const b = biz({ staff: ops ? [{ role: 'ops' }] : [] });
      Object.assign(b.fuel!, { tank: 'mid', L: 2000, auto: true });
      const ev: FuelEvent[] = [];
      fuelWeek(() => 0.5, b, 1, ev);
      expect(!!b.fuel!.order).toBe(ops);
      expect(ev.some((e) => e.k === 'fuelAuto')).toBe(ops);
    }
  });

  it('the war card offers a load, a levy or wearing it', () => {
    const c = game.newCareer({ co: 'War Test', loan: 350000, town: 'gdi' }, 5);
    const g = c.market!.listings.filter((m) => m.type === 'grader').sort((a, b) => a.price - b.price)[0]!;
    game.buy(c, g.id);
    game.open(c);
    c.yard = 'depot';
    game.buyFuelTank(c, 'mid');
    c.fuel!.L = 5000;
    c.fuel!.war = { from: c.week, to: c.week + 8, peak: 1.4 };
    c.queue.unshift({ k: 'dieselWar' });
    expect(drawCard(c, c.queue[0]!)!.opts.map((o) => o.id)).toEqual(['fill', 'levy', 'wear']);
    const rep = c.rep;
    choose(c, 1);
    expect(c.fuel!.levy).toBeGreaterThan(c.week);
    expect(c.rep).toBe(Math.max(0, rep - 1));
  });

  it('none of it runs under the prototype', () => {
    compat.prototype = true;
    const b = biz();
    b.fuel = undefined;
    fuelStart(b, []);
    fuelWeek(() => 0, b, 1, []);
    expect(b.fuel).toBeUndefined();
    compat.prototype = false;
  });
});

describe('the hire schedule', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it("the real game charges Scott's schedule on a 10-hour day; the prototype keeps its own", () => {
    expect(TYPES.d8).toMatchObject({ wet: 2500, fuel: 1200, sub: 3700, dry: 8000 });
    expect(TYPES.grader.name).toBe('Grader 14ft');
    expect(TYPES.s627.short).toBe('627');
    expect(dayHours()).toBe(10);
    compat.prototype = true;
    expect(TYPES.d8).toMatchObject({ wet: 2350, fuel: 900, dry: 7800 });
    expect(TYPES.grader).toMatchObject({ name: 'Grader 12M', wet: 1665, fuel: 570, dry: 5100, sub: 2230 });
    expect(dayHours()).toBe(9);
    compat.prototype = false;
  });

  it('bulk work pays about 21% more in the real game (10% and 10% again), and your starting price moves with it', () => {
    const c = game.newCareer({ co: 'Dirt', loan: 180000, town: 'gdi', path: 'bulk' }, 4);
    const ask = (proto: boolean) => { compat.prototype = proto; const e = genEnquiry(seedRand(9), JSON.parse(JSON.stringify(c)), 1, 'turkeyNest'); compat.prototype = false; return e; };
    const was = ask(true), now = ask(false);
    expect(now.budget / was.budget).toBeGreaterThan(1.15);
    expect(now.budget / was.budget).toBeLessThan(1.27);
    expect(now.rate).toBeCloseTo(was.rate * 1.21, 1);
    expect(TYPES.d6).toMatchObject({ wet: 1900, fuel: 700, sub: 2600 });
  });
});
