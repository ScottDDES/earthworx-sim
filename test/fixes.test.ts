// The fixes after the port: where the real game does better than the prototype.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUN_ANSWERS, canRunOn, choose, coachOff, compat, ATTACH, coverOff, dayQuality, doable, drawCard, rung, game, genEnquiry, genOffers, isBulk, leakOdds, passOdds, pricingVol, REDZONE_CASH, spreadRate, nearMissAdvisoryCost, value, seriousAdvisoryCost, runOn, seedRand, shutWeek, shuffled, whyNot, rainBulk, rainCrews, type Job } from '../src';
import { cardView } from '../src/text/cardView';

/** Bulk jobs seen so far: finished ones come off c.jobs, so tests keep hold of them here. */
const track = (c: { jobs: Job[] }, seen: Set<Job>) => { for (const j of c.jobs) if (j.kind === 'bulk') seen.add(j); };

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

describe('Bulk and Ag pack, step 2: farm dams', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  const outfit = (seed: number, gear: string[]) => {
    const c = game.newCareer({ co: 'Dam Earthmoving', loan: 900000, town: 'gdi' }, seed);
    c.phase = 'play';
    c.yard = 'regional';
    c.bank = 400000;
    for (const [i, type] of gear.entries()) c.fleet.push({ id: 'b' + i, type, year: 2016, cond: 85, hours: 8000, svcAt: 8000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null } as never);
    game.setPack(c, 'bulk', true);
    return c;
  };

  it('the dam sum prices it, the spread builds it at the slowest machine\'s pace, and the farmer pays', () => {
    let done = 0, profit = 0, n = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const c = outfit(seed, ['s631', 's631', 'd9', 'c825', 'moxycart']), seen = new Set<Job>();
      for (let w = 0; w < 60; w++) {
        for (const e of c.bulk?.enq ?? []) if (!e.quoted && !c.jobs.some((j) => j.kind === 'bulk' && !j.finished)) { game.damSurvey(c, e.id); game.damQuote(c, e.id); }
        for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
        track(c, seen);
        game.endWeek(c);
      }
      for (const j of [...seen].filter((x) => x.finished)) {
        expect(c.jobs.includes(j), 'finished bulk work comes off the books').toBe(false);
        done++;
        profit += (j.fixed as number) - (j.spent || 0);
        expect(j.m3 as number).toBeGreaterThanOrEqual(j.truth as number);
        expect(c.fleet.filter((m) => m.jobId === j.id).length).toBe(0);
      }
      n++;
    }
    expect(done).toBeGreaterThan(5);
    // a decent spread at $4.20 a m³ on surveyed volumes makes money on the day costs
    expect(profit).toBeGreaterThan(0);
  });

  it('the spread is only as fast as its slowest part: no push dozer, no open-bowl scrapers', () => {
    const fast = spreadRate([{ type: 's631' }, { type: 's631' }, { type: 'd9' }], 250), none = spreadRate([{ type: 's631' }, { type: 's631' }], 250);
    expect(fast.perHour).toBeGreaterThan(400);
    expect(none.perHour).toBe(0);
    // push-pull and elevating scrapers load themselves
    expect(spreadRate([{ type: 's637' }, { type: 's637' }], 250).perHour).toBeGreaterThan(300);
    // a compactor slower than the scrapers sets the pace
    const capped = spreadRate([{ type: 's657' }, { type: 's657' }, { type: 's657' }, { type: 'padfoot' }], 150);
    expect(capped.slowest).toBe('compactor');
  });

  it('eyeballing a dam that is bigger than the plans loses money a survey would have caught', () => {
    const c = outfit(3, ['d9']);
    const e = genEnquiry(seedRand(5), c as never, 1, 'turkeyNest');
    e.truth = Math.round(e.vol * 1.2);
    e.survey = Math.round(e.truth * 1.01);
    expect(pricingVol(e)).toBe(e.vol);
    e.surveyed = true;
    expect(pricingVol(e)).toBeGreaterThan(e.vol * 1.15);
  });
});

describe('Bulk and Ag pack, step 3: what goes wrong', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  const outfit = (seed: number, gear: string[]) => {
    const c = game.newCareer({ co: 'Wall Earthmoving', loan: 900000, town: 'gdi' }, seed);
    c.phase = 'play';
    c.yard = 'regional';
    c.bank = 2000000;
    for (const [i, type] of gear.entries()) c.fleet.push({ id: 'b' + i, type, year: 2016, cond: 85, hours: 8000, svcAt: 8000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null } as never);
    game.setPack(c, 'bulk', true);
    return c;
  };
  const run = (gear: string[], opts: { tested?: boolean; precon?: boolean; answer?: (k: string) => number }) => {
    let walls = 0, passed = 0, tested = 0;
    const cards: Record<string, number> = {};
    for (let seed = 1; seed <= 25; seed++) {
      const c = outfit(seed, gear), seen = new Set<Job>();
      for (let w = 0; w < 70; w++) {
        for (const e of c.bulk?.enq ?? []) {
          if (opts.tested != null) e.tested = opts.tested;
          if (!e.quoted && !c.jobs.some((j) => j.kind === 'bulk' && !j.finished)) { e.rate = 2; game.damQuote(c, e.id); }
        }
        for (const j of c.jobs) if (j.kind === 'bulk' && opts.precon) game.damPrecon(c, j.id, true);
        for (let k = 0; c.queue.length && k < 20; k++) { const q = c.queue[0]!; cards[q.k] = (cards[q.k] || 0) + 1; choose(c, opts.answer ? opts.answer(q.k) : 0); }
        track(c, seen);
        const r = game.endWeek(c);
        for (const e of (r?.events ?? []) as { k: string }[]) { if (e.k === 'damPassed') { passed++; tested++; } if (e.k === 'damFailed') tested++; }
      }
      walls += [...seen].filter((j) => j.finished).length;
    }
    return { walls, passed, tested, cards };
  };

  it('quality, test odds and leak odds move the right way', () => {
    const poor = dayQuality({ compacted: false, watered: false, precon: false }, false), full = dayQuality({ compacted: true, watered: true, precon: true }, false);
    expect(poor).toBeLessThan(0.6);
    expect(full).toBe(1);
    expect(dayQuality({ compacted: true, watered: true, precon: false }, true)).toBeLessThan(dayQuality({ compacted: true, watered: true, precon: false }, false));
    expect(passOdds(0.95)).toBe(1);
    expect(passOdds(0.5)).toBe(0);
    expect(leakOdds(0.9)).toBe(0);
    expect(leakOdds(0.55)).toBeGreaterThan(0.4);
  });

  it('a dozer on its own builds walls that leak; a full spread rarely does', () => {
    const rough = run(['d9'], { tested: false }), proper = run(['s637', 's637', 'c825', 'moxycart'], { tested: false });
    expect(rough.walls).toBeGreaterThan(10);
    expect(proper.walls).toBeGreaterThan(10);
    expect((rough.cards.leak || 0) / rough.walls).toBeGreaterThan(0.25);
    expect((proper.cards.leak || 0) / proper.walls).toBeLessThan(0.05);
  });

  it('preconditioning the pit gets tested walls through', () => {
    const plain = run(['s631', 's631', 'd8', 'padfoot'], { tested: true }), pre = run(['s631', 's631', 'd8', 'd8', 'c825', 'moxycart', 'moxycart'], { tested: true, precon: true });
    expect(plain.tested).toBeGreaterThan(5);
    expect(pre.tested).toBeGreaterThan(5);
    expect(pre.passed / pre.tested).toBeGreaterThan(plain.passed / plain.tested);
    expect(pre.passed / pre.tested).toBeGreaterThan(0.9);
  });

  it('wet weeks bring the wet-clay card, and a big dozer brings the red-zone call', () => {
    const r = run(['s637', 's637', 'd9', 'c825', 'moxycart'], {});
    expect(r.cards.wetclay || 0).toBeGreaterThan(0);
    expect(r.cards.redzone || 0).toBeGreaterThan(0);
  });

  it('taking the red-zone job pays cash, and sometimes comes out', () => {
    let found = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const c = outfit(seed, ['d9']);
      c.queue = [{ k: 'redzone' }];
      const bank = c.bank;
      choose(c, 1);
      expect(c.bank).toBe(bank + REDZONE_CASH);
      for (let w = 0; w < 55; w++) { c.queue = []; game.endWeek(c); }
      if (c.bulk?.rzFound) found++;
    }
    expect(found).toBeGreaterThan(5);
    expect(found).toBeLessThan(40);
  });
});

describe('Bulk and Ag pack, step 4: the rest of the work', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  const outfit = (seed: number, gear: string[], att: string[] = []) => {
    const c = game.newCareer({ co: 'Ag Earthmoving', loan: 900000, town: 'gdi' }, seed);
    c.phase = 'play';
    c.yard = 'hub';
    c.bank = 3000000;
    c.won2 = true;
    for (const [i, type] of gear.entries()) c.fleet.push({ id: 'b' + i, type, year: 2016, cond: 85, hours: 8000, svcAt: 8000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null } as never);
    game.setPack(c, 'bulk', true);
    c.bulk ??= { enq: [] };
    for (const a of att) game.buyAttach(c, a as never);
    c.bank = 3000000;
    return c;
  };
  /** Only enquiries of one kind, priced low so they're won; plays until one finishes. */
  const one = (kind: string, gear: string[], att: string[] = [], seed = 1, weeks = 60) => {
    const c = outfit(seed, gear, att), seen = new Set<Job>();
    const evs: { k: string }[] = [];
    for (let w = 0; w < weeks; w++) {
      c.bulk!.enq = c.bulk!.enq.filter((e) => e.kind === kind || e.quoted);
      if (!c.bulk!.enq.some((e) => e.kind === kind) && !c.jobs.some((j) => j.kind === 'bulk')) c.bulk!.enq.push(genEnquiry(seedRand(seed * 100 + w), c as never, 1, kind as never));
      for (const e of c.bulk!.enq) if (!e.quoted && !c.jobs.some((j) => j.kind === 'bulk' && !j.finished)) { e.rate = e.rate * 0.5; game.damQuote(c, e.id); }
      for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
      track(c, seen);
      const r = game.endWeek(c);
      evs.push(...((r?.events ?? []) as { k: string }[]));
      if ([...seen].some((j) => j.finished)) break;
    }
    return { c, evs, job: [...seen].find((j) => j.finished) ?? [...seen][0] };
  };

  it('each kind of work gets done with the right gear', () => {
    const cases: [string, string[], string[]][] = [
      ['laser', ['pull', 'pull', 'grader'], ['laser']],
      ['channel', ['excavator', 'd6'], []],
      ['contour', ['d6'], []],
      ['pad', ['excavator', 'moxy', 'moxy', 'padfoot', 'cart', 'grader'], []],
      ['rake', ['d8'], ['rake']],
      ['cutter', ['d9'], ['cutter']],
      ['dev', ['s637', 's637', 's637', 'c825', 'moxycart', 'moxycart'], []],
    ];
    for (const [kind, gear, att] of cases) {
      const { job } = one(kind, gear, att, 2, 120);
      expect(job, kind).toBeTruthy();
      expect(job!.finished, kind + ' finished').toBe(true);
      expect((job!.m3 as number) >= (job!.truth as number) || job!.cut, kind).toBe(true);
    }
  });

  it('no attachment, no start: laser levelling, raking and cutter barring wait for their gear', () => {
    for (const [kind, gear] of [['laser', ['pull', 'grader']], ['rake', ['d8']], ['cutter', ['d9']]] as const) {
      const { job } = one(kind, [...gear], [], 3, 5);
      expect(job?.state ?? 'waiting', kind).toBe('waiting');
    }
    const c = outfit(4, [], []);
    const bank = c.bank;
    expect(game.buyAttach(c, 'rake')).toBe(true);
    expect(c.bank).toBe(bank - ATTACH.rake);
    expect(game.buyAttach(c, 'rake')).toBe(false);
  });

  it('a cutter bar is harder on a dozer than a stick rake', () => {
    const cut = one('cutter', ['d9'], ['cutter'], 5, 40), rake = one('rake', ['d9'], ['rake'], 5, 40);
    const wearOf = (r: typeof cut) => { const m = r.c.fleet.find((x) => x.type === 'd9')!; return (85 - m.cond) / Math.max(1, (m.hours - 8000) / 9); };
    expect(wearOf(cut)).toBeGreaterThan(wearOf(rake) * 1.4);
  });

  it('windrows finished in fire season wait for October to be burnt, and paid', () => {
    const c = outfit(6, ['d8'], ['rake']);
    // start in late July, on a big block
    c.week = 17;
    c.bulk!.enq = [genEnquiry(seedRand(9), c as never, 1, 'rake')];
    const e = c.bulk!.enq[0]!;
    e.vol = e.truth = e.survey = 60;
    e.rate = 1;
    game.damQuote(c, e.id);
    let burnWait = 0, burnt = 0;
    for (let w = 0; w < 14; w++) {
      c.bulk!.enq = c.bulk!.enq.filter((x) => x.quoted);
      for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
      const r = game.endWeek(c);
      for (const ev of (r?.events ?? []) as { k: string }[]) { if (ev.k === 'burnWait') burnWait = c.week; if (ev.k === 'burnt') burnt = c.week; }
    }
    expect(burnWait).toBeGreaterThan(0);
    expect(burnt).toBeGreaterThan(burnWait);
  });

  it('developers pay monthly claims less retention, and some go under owing you', () => {
    const { job: dj, evs } = one('dev', ['s637', 's637', 's637', 'c825', 'moxycart', 'moxycart'], [], 7, 120);
    expect(evs.filter((e) => e.k === 'devClaim').length).toBeGreaterThan(0);
    expect(dj!.retained as number).toBeGreaterThan(0);
    let busts = 0;
    for (let seed = 1; seed <= 30; seed++) if (one('dev', ['s637', 's637', 'c825', 'moxycart'], [], seed, 120).evs.some((e) => e.k === 'devBust')) busts++;
    expect(busts).toBeGreaterThan(0);
    expect(busts).toBeLessThan(15);
  });
});

describe('Bulk and Ag in the beta: on from the start', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('a new career with the pack on has bulk gear for sale from day one and plays a year without trouble', () => {
    const c = game.newCareer({ co: 'Beta Earthmoving', loan: 180000, town: 'gdi', bulk: true }, 99);
    expect(c.packs?.bulk).toBe(true);
    expect(c.market!.listings.some((m) => isBulk(m.type))).toBe(true);
    const g = c.market!.listings.filter((m) => m.type === 'grader').sort((x, y) => x.price - y.price)[0]!;
    game.buy(c, g.id);
    game.open(c);
    for (let w = 0; w < 52; w++) {
      for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
      for (const o of c.offers.slice()) game.accept(c, o.id);
      game.endWeek(c);
    }
    expect(c.week).toBe(53);
    expect(Number.isFinite(c.bank)).toBe(true);
    expect((c.bulk?.enq ?? []).length).toBeGreaterThan(0);
    // and without it, the same seed is the base game
    const off = game.newCareer({ co: 'Beta Earthmoving', loan: 180000, town: 'gdi' }, 99);
    expect(off.packs?.bulk).toBeFalsy();
    expect(off.market!.listings.some((m) => isBulk(m.type))).toBe(false);
  });
});

describe('Starting as a bulk earthworks outfit', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  const bulkCareer = (seed: number, loan = 180000) => game.newCareer({ co: 'Dirt Earthmoving', loan, town: 'gdi', path: 'bulk' }, seed);

  it('opens with bulk gear for sale, no grader needed, and a couple of calls about work it can do', () => {
    const c = bulkCareer(1);
    expect(c.path).toBe('bulk');
    expect(c.packs?.bulk).toBe(true);
    expect(c.market!.listings.every((m) => isBulk(m.type))).toBe(true);
    const ex = c.market!.listings.filter((m) => m.type === 'excavator').sort((a, b) => a.price - b.price)[0]!;
    // the cheapest way in is affordable on the smallest loan
    expect(ex.price).toBeLessThan(40000 + 60000);
    expect(game.buy(c, ex.id)).toBeTruthy();
    game.open(c);
    expect(c.bulk!.enq.length).toBe(2);
    expect(c.bulk!.enq.every((e) => e.kind === 'channel')).toBe(true);
    // hire work rings for the excavator, not for graders it doesn't have
    expect(c.offers.length).toBeGreaterThan(0);
    expect(c.offers.filter((o) => o.kind !== 'dry' || !o.enq).every((o) => o.type === 'excavator')).toBe(true);
  });

  it('a bulk career climbs its own ladder: ready for tested work without a grader', () => {
    const c = bulkCareer(2, 350000);
    for (const t of ['d6', 'padfoot', 'moxycart'] as const) c.fleet.push({ id: 'x' + t, type: t, year: 2015, cond: 80, hours: 9000, svcAt: 9000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null });
    c.phase = 'play';
    expect(rung(c as never)).toBe(2);
    c.rep = 6;
    c.whs.sys = 1;
    expect(rung(c as never)).toBe(3);
    c.bulkDone = 1;
    expect(rung(c as never)).toBe(4);
    // and a road career with the same gear is still waiting on a grader
    const road = { ...c, path: 'roads' };
    expect(rung(road as never)).toBe(2);
  });

  it('a bulk outfit can play two years from an excavator and make a living', () => {
    let alive = 0, jobs = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const c = bulkCareer(seed, 180000);
      const ex = c.market!.listings.filter((m) => m.type === 'excavator').sort((a, b) => b.price - a.price).find((m) => m.price < c.bank - 40000)!;
      game.buy(c, ex.id);
      game.open(c);
      for (let w = 0; w < 104 && c.phase === 'play'; w++) {
        for (const e of c.bulk?.enq ?? []) if (!e.quoted && doable(c as never).includes(e.kind) && !c.jobs.some((j) => j.kind === 'bulk' && !j.finished)) game.damQuote(c, e.id);
        for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
        for (const o of c.offers.slice()) game.accept(c, o.id);
        for (let k = 0; c.queue.length && k < 20; k++) choose(c, 0);
        game.endWeek(c);
      }
      if (c.phase === 'play') alive++;
      jobs += c.bulkDone || 0;
    }
    expect(alive).toBeGreaterThanOrEqual(6);
    expect(jobs).toBeGreaterThan(8);
  });
});

describe('Bulk work and the rain card', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('only bulk jobs under way count as crews out, and the card talks dirt, not formation', () => {
    const c = game.newCareer({ co: 'Wet Dirt', loan: 180000, town: 'gdi', path: 'bulk' }, 5);
    const bj = (state: string, finished = false) => ({ id: 'b' + state + finished, kind: 'bulk', state, finished, client: 'Smith', place: 'Toobeah', dk: 'dam' }) as unknown as Job;
    c.jobs = [bj('waiting'), bj('running', true)];
    expect(rainCrews(c.jobs)).toBe(0);
    c.jobs.push(bj('running'));
    expect(rainCrews(c.jobs)).toBe(1);
    expect(rainBulk(c.jobs)).toBe(1);
    const q = { k: 'rainday', w: c.week, d: 2, fmm: 14, pc: 70 } as never;
    const v = cardView(c, q, drawCard(c, q)!);
    expect(v.body).toContain('1 bulk job going');
    expect(v.body).not.toContain('formation');
    expect(v.opts.map((o) => o.label).join(' ')).not.toContain('crews');
  });
});
