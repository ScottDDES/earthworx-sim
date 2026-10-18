// The fixes after the port: where the real game does better than the prototype.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUN_ANSWERS, canRunOn, choose, coachOff, compat, game, genOffers, runOn, seedRand, shuffled, whyNot } from '../src';

describe('a fair shuffle', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('every order of four comes up about equally often; the prototype\'s way does not', () => {
    const count = (fair: boolean) => {
      compat.prototype = !fair;
      const seen: Record<string, number> = {}, R = seedRand(1);
      for (let i = 0; i < 48000; i++) {
        const k = shuffled(R, ['a', 'b', 'c', 'd']).join('');
        seen[k] = (seen[k] || 0) + 1;
      }
      compat.prototype = false;
      return Object.values(seen);
    };
    // 24 orders, 2,000 each expected
    const fair = count(true), proto = count(false);
    expect(fair.length).toBe(24);
    expect(Math.min(...fair)).toBeGreaterThan(1800);
    expect(Math.max(...fair)).toBeLessThan(2200);
    // the random comparator: some orders never come up, or come up far more often than others
    expect(proto.length < 24 || Math.max(...proto) / Math.min(...proto) > 2).toBe(true);
  });

  it('the same seed gives the same order, and the list itself is untouched', () => {
    const list = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(shuffled(seedRand(9), list)).toEqual(shuffled(seedRand(9), list));
    expect([...list]).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});

describe('a career replays from its seed alone', () => {
  it('the same seed gives the same rain year and the same first weeks', () => {
    const play = (prototype: boolean) => {
      compat.prototype = prototype;
      const c = game.newCareer({ co: 'Replay Earthmoving', loan: 180000, town: 'gdi' }, 424242);
      const g = c.market!.listings.filter((m) => m.type === 'grader').sort((x, y) => x.price - y.price)[0]!;
      game.buy(c, g.id);
      game.open(c);
      for (let w = 0; w < 60; w++) {
        for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
        for (const o of c.offers.slice()) game.accept(c, o.id);
        for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
        game.endWeek(c);
      }
      compat.prototype = true;
      return JSON.stringify(c);
    };
    const a = play(false), b = play(false);
    expect(a).toBe(b);
    expect(JSON.parse(a).week).toBe(61);
  });

  it('the fix changes the game where it applies: calls about your idle gear', () => {
    // once you're subcontracting, head contractors ring about idle machines; which ones is a shuffle
    const c = game.newCareer({ co: 'Enquiry Earthmoving', loan: 350000, town: 'gdi' }, 77);
    for (const [i, type] of (['grader', 'roller', 'cart', 'cart', 'truck', 'grader', 'roller'] as const).entries()) {
      c.fleet.push({ id: 'm' + i, type, year: 2015, cond: 80, hours: 9000, svcAt: 9000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null });
    }
    c.won = true;
    let differs = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const offers = (prototype: boolean) => { compat.prototype = prototype; const x = genOffers(seedRand(seed), JSON.parse(JSON.stringify(c)), 1, true, true).filter((o) => o.enq).map((o) => o.type).join(); compat.prototype = true; return x; };
      if (offers(true) !== offers(false)) differs++;
    }
    expect(differs).toBeGreaterThan(10);
  });
});

describe('Run on answers the small cards itself', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  // a plain bot: a grader, take the work going, price the tenders, answer cards with the first option, run on
  const play = (proto: boolean) => {
    compat.prototype = proto;
    const lengths: number[] = [], answered: string[] = [], stops: Record<string, number> = {};
    for (let seed = 1; seed <= 12; seed++) {
      const c = game.newCareer({ co: 'Run On Test', loan: 150000, town: 'gdi' }, seed);
      const g = c.market!.listings.filter((m) => m.type === 'grader').sort((a, b) => a.price - b.price)[0]!;
      game.buy(c, g.id);
      game.open(c);
      coachOff(c);
      for (let k = 0; k < 40 && c.phase === 'play'; k++) {
        for (let j = 0; c.queue.length && j < 20; j++) choose(c, 0);
        for (const o of c.offers.slice()) if (!whyNot(c as never, o)) game.accept(c, o.id);
        for (const t of (c.tenders || []).slice()) if (!t.bid) game.submitBid(c, t.id);
        if (!canRunOn(c)) continue;
        const r = runOn(c);
        if (!r) break;
        lengths.push(r.run?.n ?? 1);
        const why = r.stop === 'needsYou' ? 'card:' + (c.queue[0]?.k ?? c.phase) : r.stop ?? 'ran 4';
        stops[why] = (stops[why] || 0) + 1;
        for (const h of r.handled || []) answered.push(h.k + ':' + h.id);
      }
    }
    compat.prototype = false;
    return { lengths, answered, avg: lengths.reduce((a, b) => a + b, 0) / lengths.length };
  };

  it('runs go longer than the prototype, and only the small cards get answered, with the safe answer', () => {
    const now = play(false), before = play(true);
    console.log(`run on: prototype ${before.avg.toFixed(2)} weeks a run, now ${now.avg.toFixed(2)}; answered ${now.answered.length} cards`);
    expect(now.avg).toBeGreaterThan(before.avg + 0.2);
    expect(before.answered.length).toBe(0);
    expect(now.answered.length).toBeGreaterThan(0);
    const safe = new Set([...Object.entries(RUN_ANSWERS).map(([k, id]) => k + ':' + id), 'tresult:ok', 'cresult:ok']);
    for (const a of now.answered) expect(safe.has(a)).toBe(true);
  });
});
