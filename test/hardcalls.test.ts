// Hard calls (the real game): cards where the right thing costs something, and choices that come back later.
// Each choice's cost now, what lands weeks on, and that every new card and diary line is in words.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { believeOdds, choose, clientOdds, compat, drawCard, game, genEnquiry, laterWeek, injuryWeek, seedRand, wageNow, wages, GRUDGE_PRICE, UFD_LEGAL, UFD_WEEKS, type FarmEnquiry } from '../src';
import { cardView, resultText } from '../src/text/cardView';
import { diaryLines } from '../src/text/diary';

type Career = game.Career;
const person = (c: Career, id: string, off = 0) => {
  c.staff.push({ id, name: 'Shaz', role: 'cart', skill: 'solid', wage: 1500, off, jobId: null } as never);
  return c.staff[c.staff.length - 1]!;
};
const play = (c: Career) => { c.phase = 'play'; return c; };
const roads = (seed = 3) => play(game.newCareer({ co: 'Hard Calls', loan: 350000, town: 'gdi' }, seed));
const bulk = (seed = 3) => { const c = play(game.newCareer({ co: 'Hard Dirt', loan: 350000, town: 'gdi', path: 'bulk' }, seed)); c.bulk ??= { enq: [] }; return c; };
/** Answer the front card with the option of this id; returns its words and its result line. */
function answer(c: Career, id: string) {
  const q = c.queue[0]!, d = drawCard(c, q)!;
  const v = cardView(c, q, d);
  const i = d.opts.findIndex((o) => o.id === id);
  expect(i, q.k + ' has ' + id + ' (' + d.opts.map((o) => o.id) + ')').toBeGreaterThanOrEqual(0);
  const a = choose(c, i)!;
  return { v, line: resultText(c, a), a };
}
/** Land everything waiting, however far off. */
const landAll = (c: Career) => { for (const x of c.later ?? []) x.w = c.week; laterWeek(seedRand(1), c); };
const tender = (c: Career, tip: { name: string; price: number }) => ({ id: 't1', place: 'Talwood', hc: 'Border Civil', L: 6, haul: 10, mk: 0.06, bid: null, close: c.week + 1, q: { hfg: 1, mfg: 4, lfg: 1, resheet: 1200 }, cart: 0, crewDays: 20, weeks: 6, tip }) as never;

describe('hard calls', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it("hurt at work: workers' compensation pays 75% after four weeks, if it was reported; home without pay costs nothing", () => {
    const c = roads();
    const p = person(c, 's1', 16);
    p.inj = { wk: 0, rep: true };
    expect(wageNow(p)).toBe(1500);
    for (let i = 0; i < 4; i++) injuryWeek(c);
    expect(wageNow(p)).toBe(375);
    p.inj.rep = false;
    expect(wageNow(p)).toBe(1500);
    p.unpaid = 2;
    expect(wages([p])).toBe(0);
  });

  it('four weeks into a long injury, a card asks: keep them on, or let them go and risk an unfair dismissal claim', () => {
    const c = roads();
    const p = person(c, 's1', 16);
    p.inj = { wk: 0, rep: true, hid: true };
    for (let i = 0; i < 4; i++) injuryWeek(c);
    expect(c.queue.map((q) => q.k)).toContain('injured');
    c.queue = c.queue.filter((q) => q.k === 'injured');
    const { v, line } = answer(c, 'letGo');
    expect(v.title).toBe('What about Shaz?');
    expect(v.body).toMatch(/Workers' compensation now pays 75% of their wage/);
    expect(line).toMatch(/new operator is on the labour board/);
    expect(c.staff.some((x) => x.id === 's1')).toBe(false);
    expect(c.cands[0]?.role).toBe('cart');
    // the claim, and the hushed-up incident it brings out
    c.later = [{ w: c.week, k: 'ufd', name: 'Shaz', wage: 1500, hid: true }];
    c.rep = 10;
    const bank = c.bank;
    laterWeek(seedRand(1), c);
    expect(bank - c.bank).toBe(1500 * UFD_WEEKS + UFD_LEGAL + 60000);
    expect(c.rep).toBe(10 - 2 - 5);
    const words = diaryLines(c).map((l) => l.t).join(' ');
    expect(words).toMatch(/unfair dismissal claim settled/);
    expect(words).toMatch(/brought out the incident you kept quiet/);
  });

  it('keeping an injured worker on brings them back sooner, and the Yard can no longer sack them for free', () => {
    const c = roads();
    const p = person(c, 's1', 12);
    p.inj = { wk: 4, rep: true };
    c.queue = [{ k: 'injured', id: 's1' }];
    answer(c, 'keep');
    expect(p.off).toBe(6);
    let claims = 0;
    for (let s = 1; s <= 40; s++) {
      const d = roads(s), q = person(d, 'x', 10);
      q.inj = { wk: 5, rep: true };
      expect(game.letGo(d, 'x')).toBe(true);
      if ((d.later ?? []).some((x) => x.k === 'ufd')) claims++;
    }
    expect(claims).toBeGreaterThan(15);
    expect(claims).toBeLessThan(35);
  });

  it('the red zone: say no and the grazier holds it against you for a year; take it and the dam is yours', () => {
    const c = bulk();
    c.bulk!.rzDam = { ...genEnquiry(seedRand(2), c as never, 1, 'turkeyNest'), farm: 'Hartigan' };
    c.queue = [{ k: 'redzone', farm: 'Hartigan' }];
    const { v } = answer(c, 'no');
    expect(v.title).toBe('Col wants a favour');
    expect(v.opts.map((o) => o.label)).toEqual(["Tell Col you can't touch it", 'Tell Col to get a permit first', 'Push it over · $7,200 cash']);
    // nothing in the small print says how it ends
    for (const o of v.opts) expect(o.sub).not.toMatch(/fine|track record|chance/i);
    const e: FarmEnquiry = { ...genEnquiry(seedRand(5), c as never, 1, 'turkeyNest'), farm: 'Hartigan' };
    e.quoted = e.budget * 0.9;
    expect(clientOdds(c.bulk!, e, c.week)).toBe(0);
    e.quoted = e.budget * (GRUDGE_PRICE - 0.05);
    expect(clientOdds(c.bulk!, e, c.week)).toBeGreaterThan(0);
    // a year on, it's forgotten
    e.quoted = e.budget * 0.9;
    expect(clientOdds(c.bulk!, e, c.week + 53)).toBeGreaterThan(0);

    const t = bulk(4);
    t.bulk!.rzDam = { ...genEnquiry(seedRand(2), t as never, 1, 'turkeyNest'), farm: 'Hartigan' };
    t.queue = [{ k: 'redzone', farm: 'Hartigan' }];
    const bank = t.bank;
    answer(t, 'take');
    expect(t.bank - bank).toBe(7200);
    landAll(t);
    const dam = t.bulk!.enq.find((x) => x.farm === 'Hartigan')!;
    expect(dam).toBeTruthy();
    dam.quoted = dam.budget * 1.2;
    expect(clientOdds(t.bulk!, dam, t.week)).toBe(1);
  });

  it('a leaking wall: show them it is not your fault, and whether they believe you depends on how you built it', () => {
    expect(believeOdds(0.88, false)).toBeGreaterThan(0.75);
    expect(believeOdds(0.88, true)).toBeLessThan(0.25);
    expect(believeOdds(0.6, false)).toBeLessThan(0.3);
    const c = bulk();
    c.queue = [{ k: 'leak', farm: 'Kelly', place: 'Toobeah', dk: 'turkeyNest', price: 40000, fix: 6000, q: 0.55, wet: true, w: c.week }];
    const { v } = answer(c, 'show');
    expect(v.body).toMatch(/yabby holes/);
    expect(v.opts.find((o) => o.id === 'show')!.sub).toBe('Free today, if Bev believes you.');
  });

  it('a near miss sorted out properly costs a day on the job', () => {
    const c = roads();
    const j = { id: 'j1', kind: 'sub', state: 'running', client: 'Border Civil', place: 'Talwood', type: 'grader', days: 20, done: 3 } as never;
    c.jobs.push(j);
    c.queue = [{ k: 'nearmiss' }];
    const { v } = answer(c, 'report');
    expect(v.body).toMatch(/has rung twice this week/);
    expect((j as { halt?: number }).halt).toBe(c.week);
    // and the day is really lost: the same week played with and without it
    const done = (halt: boolean) => {
      const d = game.newCareer({ co: 'Same Week', loan: 350000, town: 'gdi' }, 21);
      game.buy(d, d.market!.listings.find((m) => m.type === 'grader')!.id);
      game.open(d);
      const o = d.offers.find((x) => x.kind === 'wet' || x.kind === 'council')!;
      game.accept(d, o.id);
      const jj = d.jobs[0]!;
      if (halt) jj.halt = d.week;
      d.queue = [];
      game.endWeek(d);
      return jj.done;
    };
    expect(done(false) - done(true)).toBe(1);
  });

  it('cash, no invoice: 10% off and paid in cash, and sometimes the tax office comes later', () => {
    const c = bulk();
    const j = { id: 'b1', kind: 'bulk', dk: 'turkeyNest', client: 'Kelly', place: 'Toobeah', fixed: 40000, state: 'running' } as never;
    c.jobs.push(j);
    c.queue = [{ k: 'cashjob', id: 'b1' }];
    const { v } = answer(c, 'cash');
    expect(v.title).toBe('Cash, no invoice');
    expect((j as { fixed: number }).fixed).toBe(36000);
    expect((j as { cash?: boolean }).cash).toBe(true);
    c.later = [{ w: c.week, k: 'audit', farm: 'Kelly', amt: 12600 }];
    const bank = c.bank;
    laterWeek(seedRand(1), c);
    expect(bank - c.bank).toBe(12600);
    expect(diaryLines(c)[0]!.t).toMatch(/audited your cash jobs/);
  });

  it("the engineer's offer: pay and the test passes on paper; a wall that would have failed comes back later", () => {
    const c = bulk();
    const j = { id: 'b2', kind: 'bulk', dk: 'turkeyNest', client: 'Kelly', place: 'Toobeah', fixed: 60000, tested: true, state: 'running', m3: 900, est: 1000 } as never;
    c.jobs.push(j);
    c.queue = [{ k: 'signoff', id: 'b2' }];
    const bank = c.bank;
    answer(c, 'sign');
    expect(bank - c.bank).toBe(1500);
    expect((j as { signed?: boolean }).signed).toBe(true);
    c.later = [{ w: c.week, k: 'signFail', farm: 'Kelly', place: 'Toobeah', cost: 14400 }];
    c.rep = 10;
    laterWeek(seedRand(1), c);
    expect(c.rep).toBe(6);
    expect(diaryLines(c)[0]!.t).toMatch(/signed off untested/);
  });

  it('a tip on the price: use it and your price goes in a hair under theirs', () => {
    const c = roads();
    const t = tender(c, { name: c.rivals[0]!.name, price: 150000 });
    c.tenders.push(t);
    c.queue = [{ k: 'tip', id: 't1' }];
    const { v, line } = answer(c, 'use');
    expect(v.body).toMatch(/estimator offers to tell you their number/);
    expect((t as { bid: number }).bid).toBe(147800);
    expect(line).toMatch(/a hair under/);
    // when it closes, the rival you were tipped about prices at that number
    const tt = t as { close: number; result?: { name: string; price: number }[]; tip: { name: string } };
    tt.close = c.week;
    c.queue = [];
    game.endWeek(c);
    expect(tt.result!.find((r) => r.name === tt.tip.name)?.price).toBe(150000);
  });

  it('every new card and diary line is in words', () => {
    const c = bulk();
    const p = person(c, 's1', 16);
    p.inj = { wk: 4, rep: true };
    c.jobs.push({ id: 'b1', kind: 'bulk', dk: 'turkeyNest', client: 'Kelly', place: 'Toobeah', fixed: 40000, state: 'running', tested: true, m3: 900, est: 1000 } as never);
    c.tenders.push(tender(c, { name: 'Bluegum Earthworks', price: 150000 }));
    for (const q of [{ k: 'injured', id: 's1' }, { k: 'cashjob', id: 'b1' }, { k: 'signoff', id: 'b1' }, { k: 'tip', id: 't1' }, { k: 'redzone', farm: 'Hartigan' }, { k: 'quiet', id: 's1' }, { k: 'hurt', id: 's1' }]) {
      const d = drawCard(c, q as never);
      if (!d) continue;
      const v = cardView(c, q as never, d);
      expect(v.title, q.k).toBeTruthy();
      for (const o of v.opts) expect(o.label, q.k + ' ' + o.id).not.toBe(o.id);
    }
    for (const e of [
      { k: 'quitOver', name: 'Mick', why: 'hushed', hurt: 'Shaz' }, { k: 'quitOver', name: 'Mick', why: 'unpaid' }, { k: 'ufdClaim', name: 'Shaz', cost: 27500 },
      { k: 'hiddenOut', fine: 60000 }, { k: 'rzDamRang', farm: 'Hartigan', place: 'Talwood', permit: true }, { k: 'grudgeLost', farm: 'Hartigan', place: 'Talwood', dk: 'channel' },
      { k: 'cashAudit', farm: 'Kelly', amt: 12600 }, { k: 'tipOut', hc: 'Border Civil', rival: 'Bluegum' }, { k: 'signFail', farm: 'Kelly', place: 'Toobeah', cost: 14400 }, { k: 'letGoInjured', name: 'Shaz' },
    ]) {
      c.log = [{ w: c.week, e }];
      expect(diaryLines(c)[0]!.t, e.k).not.toMatch(/^\[|undefined|NaN/);
    }
  });
});
