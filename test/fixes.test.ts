// The fixes after the port: where the real game does better than the prototype.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUN_ANSWERS, canRunOn, choose, coachOff, compat, coverOff, drawCard, game, genOffers, isBulk, nearMissAdvisoryCost, value, seriousAdvisoryCost, runOn, seedRand, shutWeek, shuffled, whyNot } from '../src';

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

describe('playtest fixes, 19 October 2026', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  const career = (seed: number) => {
    const c = game.newCareer({ co: 'Playtest Earthmoving', loan: 350000, town: 'gdi' }, seed);
    for (const [i, type] of (['grader', 'grader', 'roller', 'cart'] as const).entries()) {
      c.fleet.push({ id: 'm' + i, type, year: 2015, cond: 80, hours: 9000, svcAt: 9000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null });
    }
    c.phase = 'play';
    return c;
  };

  it('a council suspension means no council work: no day labour, no tenders, no price looked at', () => {
    const c = career(5);
    c.blocked['Goondiwindi council'] = c.week + 26;
    let council = 0;
    for (let seed = 1; seed <= 200; seed++) council += genOffers(seedRand(seed), JSON.parse(JSON.stringify(c)), 1, true, true).filter((o) => o.kind === 'council').length;
    expect(council).toBe(0);
    for (let w = 0; w < 20; w++) {
      for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
      game.endWeek(c);
      expect(c.offers.some((o) => o.kind === 'council')).toBe(false);
      expect(c.ctenders.filter((t) => t.close > c.week - 1).length).toBe(0);
    }
    // and once it's over, the council rings again
    delete c.blocked['Goondiwindi council'];
    let back = 0;
    for (let seed = 1; seed <= 50; seed++) back += genOffers(seedRand(seed), JSON.parse(JSON.stringify(c)), 1, true, true).filter((o) => o.kind === 'council').length;
    expect(back).toBeGreaterThan(0);
  });

  it('a driver off hurt: someone free who drives that machine takes the seat', () => {
    const c = career(6);
    c.staff.push({ id: 'p1', name: 'Shaz', role: 'grader', skill: 'solid', wage: 1500, off: 0, jobId: null } as never);
    c.staff.push({ id: 'p2', name: 'Robbo', role: 'grader', skill: 'solid', wage: 1500, off: 0, jobId: null } as never);
    c.offers = [{ id: 'o1', kind: 'wet', type: 'grader', place: 'Talwood', client: 'Dry Creek Civil', days: 15, rate: 1500, terms: 4, fuelPaid: false }];
    expect(game.accept(c, 'o1')).toBe(true);
    const j = c.jobs.at(-1)!;
    expect(j.who).toBe('p1');
    c.staff[0]!.off = 16;
    expect(coverOff(c as never)).toEqual([{ jobId: j.id, from: 'p1', to: 'p2' }]);
    expect(j.who).toBe('p2');
    expect(c.staff[0]!.jobId).toBeNull();
    // nobody free: the job waits, as before
    c.staff[1]!.off = 3;
    expect(coverOff(c as never)).toEqual([]);
  });

  it('Christmas: a card the week before, then two weeks where nobody works and deadlines move', () => {
    const c = career(7);
    c.staff.push({ id: 'p1', name: 'Shaz', role: 'grader', skill: 'solid', wage: 1500, off: 0, jobId: null } as never);
    let card = 0, shutWorked = 0;
    while (c.week < 42) {
      for (let k = 0; c.queue.length && k < 20; k++) {
        if (c.queue[0]!.k === 'xmas') { card = c.week; expect(drawCard(c, c.queue[0]!)!.opts.map((o) => o.id)).toEqual(['party', 'bbq', 'skip']); }
        choose(c, 0);
      }
      for (const o of c.offers.slice()) game.accept(c, o.id);
      for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
      const r = game.endWeek(c)!;
      if (r && shutWeek(r.week)) { expect(r.shut).toBe(true); shutWorked += r.worked; }
    }
    expect(card).toBe(38);
    expect(shutWorked).toBe(0);
  });

  it('the best-two offer only comes up when it is not their whole yard', () => {
    const c = career(8);
    Object.assign(c, { won: true, won2: true });
    const x = c.rivals[0]!;
    x.fleet = 2;
    c.queue = [{ k: 'buyout', name: x.name }];
    expect(drawCard(c, c.queue[0]!)!.opts.map((o) => o.id)).not.toContain('best');
    x.fleet = 4;
    (x as { yard?: unknown }).yard = undefined;
    c.queue = [{ k: 'buyout', name: x.name }];
    const d = drawCard(c, c.queue[0]!)!;
    if (d.data.pb.ok) expect(d.opts.map((o) => o.id)).toContain('best');
  });

  it('a short first year gets its own review instead of rolling into a 66-week one', () => {
    const c = career(9);
    for (let w = 0; w < 70 && !(c.years || []).length; w++) {
      for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
      game.endWeek(c);
    }
    const y = c.years![0]!;
    expect(y.weeks).toBeLessThan(26);
    expect(y.first).toBe(true);
  });
});

describe('DDES Advisory and the DDES ERP', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  const career = (seed: number) => {
    const c = game.newCareer({ co: 'Advisory Earthmoving', loan: 350000, town: 'gdi' }, seed);
    c.fleet.push({ id: 'm0', type: 'grader', year: 2015, cond: 80, hours: 9000, svcAt: 9000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null });
    c.staff.push({ id: 'p1', name: 'Shaz', role: 'grader', skill: 'solid', wage: 1500, off: 0, jobId: null } as never);
    c.phase = 'play';
    return c;
  };

  it('every WHS card offers DDES Advisory, and it is the cheaper way out of a serious incident', () => {
    for (const k of ['serious', 'nearmiss', 'hurt', 'quiet', 'swms']) {
      const c = career(11);
      const q = (k === 'hurt' || k === 'quiet' ? { k, id: 'p1' } : k === 'serious' ? { k, who: 'p1' } : { k }) as never;
      const d = drawCard(c, q)!;
      expect(d, k).toBeTruthy();
      const ids = d.opts.map((o) => o.id);
      expect(k === 'swms' ? ids.includes('pay') : ids.includes('advisory'), k).toBe(true);
    }
    for (let fine = 0; fine <= 60000; fine += 1000) {
      if (fine >= 3000) expect(seriousAdvisoryCost(fine)).toBeLessThan(fine);
    }
    // a near miss handled by them costs less than stopping the crew
    for (const crews of [1, 2, 4]) expect(nearMissAdvisoryCost(450 * crews)).toBeLessThan(450 * crews);
  });

  it('a price check gives a band the sharpest rival usually lands in', () => {
    let inBand = 0, n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = career(seed);
      Object.assign(c, { won: true, rep: 8 });
      c.whs.sys = 1;
      for (const [i, type] of (['roller', 'cart'] as const).entries()) c.fleet.push({ id: 'n' + i, type, year: 2015, cond: 80, hours: 9000, svcAt: 9000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null });
      for (let w = 0; w < 30 && !c.tenders.some((t) => !t.direct); w++) { for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0); game.endWeek(c); }
      const t = c.tenders.find((x) => !x.direct);
      if (!t) continue;
      const bank = c.bank;
      expect(game.priceCheck(c, t.id)).toBe(true);
      expect(c.bank).toBe(bank - 900);
      expect(game.priceCheck(c, t.id)).toBe(false);
      const band = t.adv!;
      // close it with no bid of ours and see where the sharpest rival landed
      t.close = c.week;
      game.endWeek(c);
      for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
      const res = (t as { result?: { price: number }[] }).result;
      if (!res?.length) continue;
      const low = Math.min(...res.map((e) => e.price));
      n++;
      if (low >= band.lo * 0.97 && low <= band.hi * 1.03) inBand++;
    }
    expect(n).toBeGreaterThan(5);
    expect(inBand / n).toBeGreaterThan(0.6);
  });

  it('the ERP comes with a regional depot, and cuts the overheads', () => {
    const c = career(12);
    c.bank = 200000;
    expect(game.buyErp(c)).toBe(false);
    c.yard = 'regional';
    c.whs.sys = 3;
    c.whs.talks = true;
    for (let i = 0; i < 6; i++) c.staff.push({ id: 'x' + i, name: 'N' + i, role: 'roller', skill: 'solid', wage: 1400, off: 0, jobId: null } as never);
    const before = game.overheads(c);
    expect(game.erpSaving(c)).toBeGreaterThan(0);
    expect(game.buyErp(c)).toBe(true);
    expect(game.overheads(c)).toBeLessThan(before);
    expect(game.buyErp(c)).toBe(false);
  });
});

describe('Bulk and Ag pack, step 1: the machines', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  const play = (bulk: boolean, buy: boolean) => {
    const c = game.newCareer({ co: 'Bulk Earthmoving', loan: 900000, town: 'gdi' }, 4242);
    const g = c.market!.listings.filter((m) => m.type === 'grader').sort((x, y) => x.price - y.price)[0]!;
    game.buy(c, g.id);
    game.open(c);
    if (bulk) game.setPack(c, 'bulk', true);
    let bought = 0;
    for (let w = 0; w < 80; w++) {
      for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
      for (const o of c.offers.slice()) game.accept(c, o.id);
      if (buy && bulk && game.room(c) > 0) {
        const l = c.market!.listings.find((m) => isBulk(m.type) && m.price < c.bank - 60000);
        if (l && game.buy(c, l.id)) bought++;
      }
      for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
      game.endWeek(c);
    }
    return { c, bought };
  };

  it('with the pack on, bulk machines come up for sale every week; with it off, none do', () => {
    const on = play(true, false).c, off = play(false, false).c;
    expect(on.market!.listings.filter((m) => isBulk(m.type)).length).toBe(3);
    expect(off.market!.listings.some((m) => isBulk(m.type))).toBe(false);
  });

  it('switching the pack on changes nothing else: the same career, week for week', () => {
    const strip = (c: game.Career) => { const x = JSON.parse(JSON.stringify(c)); x.market.listings = x.market.listings.filter((m: { type: string }) => !isBulk(m.type as never)); delete x.packs; delete x.seq; return JSON.stringify({ ...x, market: { ...x.market, listings: x.market.listings.map((m: any) => ({ ...m, id: 0 })), lot: { ...x.market.lot, id: 0 } } }); };
    const on = play(true, false).c, off = play(false, false).c;
    expect(on.bank).toBe(off.bank);
    expect(on.week).toBe(off.week);
    expect(on.rep).toBe(off.rep);
    expect(strip(on).length).toBeGreaterThan(1000);
  });

  it('bulk gear can be bought, sits in the yard, wears and costs money like any machine', () => {
    const { c, bought } = play(true, true);
    expect(bought).toBeGreaterThan(0);
    const bulk = c.fleet.filter((m) => isBulk(m.type));
    expect(bulk.length).toBeGreaterThan(0);
    expect(Number.isFinite(c.bank)).toBe(true);
    expect(Number.isFinite(game.overheads(c))).toBe(true);
    for (const m of bulk) expect(value(m, c.week)).toBeGreaterThan(0);
  });

  it('a leaderboard season can\'t switch the pack on', () => {
    const c = game.newCareer({ co: 'Season Earthmoving', loan: 180000, town: 'gdi' }, 1);
    (c as { season?: unknown }).season = { id: 'wet2010', weeks: 26, v: 4, nw0: 0 };
    expect(game.setPack(c, 'bulk', true)).toBe(false);
    expect(c.packs?.bulk).toBeFalsy();
  });
});
