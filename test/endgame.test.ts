// The end game (Scott, 24 Oct): more farm and developer work for a big bulk outfit, fewer dry-hire calls, bulk and ag
// outfits of their own who win the work you price and lose, and mines hiring the big gear for six months or more.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEV_BIG, DEV_GAP, MINES, devStd, MINE_STD, MINE_WEEKS, bulkWeek, clientOdds, compat, game, genEnquiry, genOffers, mkBulkRivals, seedRand, whyNot, yearOf, yesOdds,
} from '../src';
import { bulkLine } from '../src/text/bulk';

type Career = game.Career;
const add = (c: Career, type: string, year: number, hours: number) => {
  c.fleet.push({ id: 'm' + c.fleet.length, type, year, cond: 85, hours, svcAt: hours, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null } as never);
  return c.fleet[c.fleet.length - 1]!;
};
const outfit = () => {
  const c = game.newCareer({ co: 'End Game', loan: 900000, town: 'gdi', path: 'bulk' }, 9);
  c.phase = 'play';
  c.yard = 'hub';
  c.bank = 5000000;
  c.won = c.won2 = true;
  c.fleet = [];
  c.bulk = { enq: [] };
  c.week = 300;
  return c;
};
const fixed = (x: number) => () => x;

describe('the end game', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('a bigger bulk fleet hears about more work: up to three calls a week', () => {
    const calls = (n: number) => {
      const c = outfit();
      for (let i = 0; i < n; i++) add(c, 'd8', 2020, 3000);
      bulkWeek(fixed(0.3), c as never, 1, []);
      return c.bulk!.enq.length;
    };
    expect(calls(0)).toBe(1);
    expect(calls(6)).toBe(2);
    expect(calls(12)).toBe(3);
  });

  it(`a developer rings once ${DEV_GAP} weeks go by without one`, () => {
    const c = outfit();
    c.bulk!.devLast = c.week - DEV_GAP;
    bulkWeek(fixed(0.3), c as never, 1, []);
    expect(c.bulk!.enq.map((e) => e.kind)).toEqual(['dev']);
    expect(c.bulk!.devLast).toBe(c.week);
    // not before
    const d = outfit();
    d.bulk!.devLast = d.week - DEV_GAP + 1;
    bulkWeek(fixed(0.3), d as never, 1, []);
    expect(d.bulk!.enq.map((e) => e.kind)).not.toContain('dev');
  });

  it('a price you lose names who got it and what they went for', () => {
    const c = outfit(), S = c.bulk!;
    const e = genEnquiry(seedRand(5), c as never, 1, 'ringTank');
    e.quoted = Math.round(e.budget * 1.2);
    e.week = c.week - 1;
    S.enq = [e];
    S.rv = mkBulkRivals('gdi');
    const ev: { k: string; who?: string; wp?: number }[] = [];
    bulkWeek(seedRand(8), c as never, 1, ev as never);
    const lost = ev.find((x) => x.k === 'damLost')!;
    expect(S.rv.map((x) => x.name)).toContain(lost.who);
    expect(lost.wp).toBeLessThan(e.quoted);
    const x = S.rv.find((r) => r.name === lost.who)!;
    expect(x.beat).toBe(1);
    expect(x.on?.farm).toBe(e.farm);
    expect(bulkLine(lost)).toContain(lost.who!);
    // they're dam people, not a road crew
    expect(c.rivals.map((r) => r.name)).not.toContain(lost.who);
  });

  it('when the other outfits are flat out, clients are keener on your price; when they are idle, less', () => {
    const c = outfit(), S = c.bulk!;
    const e = genEnquiry(seedRand(6), c as never, 1, 'ringTank');
    e.quoted = Math.round(e.budget * 1.0);
    S.rv = mkBulkRivals('gdi');
    const idle = clientOdds(S, e, c.week);
    for (const x of S.rv) x.busy = 5;
    const busy = clientOdds(S, e, c.week);
    expect(idle).toBeLessThan(yesOdds(e));
    expect(busy).toBeGreaterThan(yesOdds(e));
  });

  it('the bulk outfits find work of their own and finish it', () => {
    const c = outfit();
    let own = 0;
    for (let i = 0; i < 30; i++) {
      c.week++;
      bulkWeek(seedRand(100 + i), c as never, 1, []);
      // work you never saw: no farmer you priced for
      own += c.bulk!.rv!.filter((x) => x.on && !x.on.farm).length;
    }
    const rv = c.bulk!.rv!;
    expect(own).toBeGreaterThan(0);
    for (const x of rv) expect(!!x.on).toBe(x.busy > 0);
  });

  it('fewer dry-hire calls about idle gear: three at most', () => {
    const c = outfit();
    for (let i = 0; i < 20; i++) add(c, 'd8', 2020, 3000);
    for (let s = 0; s < 20; s++) expect(genOffers(seedRand(s), c as never, 1, true, true).filter((o) => o.enq).length).toBeLessThanOrEqual(3);
  });

  it('a mine hires the big gear for six months or more, late-model and low-hour only', () => {
    const c = outfit(), yr = yearOf(c.week);
    const old = add(c, 'd10', yr - 9, 20000);
    let o = null;
    for (let s = 0; !o && s < 400; s++) o = genOffers(seedRand(s), c as never, 1, true, true).find((x) => x.mine) ?? null;
    expect(o).toBeTruthy();
    expect(o!.type).toBe('d10');
    expect(MINES.gdi).toContain(o!.client);
    expect(o!.std).toEqual(MINE_STD);
    // the same standard as a developer's big job
    expect(MINE_STD).toEqual(devStd(DEV_BIG));
    const wks = o!.kind === 'wet' ? o!.days / 5 : o!.days;
    expect(wks).toBeGreaterThanOrEqual(MINE_WEEKS[0]);
    c.offers = [o!];
    expect(whyNot(c as never, o!)).toBe('tooOld');
    const nw = add(c, 'd10', yr - 1, 900);
    expect(whyNot(c as never, o!)).toBeNull();
    expect(game.accept(c, o!.id)).toBe(true);
    const j = c.jobs.find((x) => x.id === nw.jobId);
    expect(j?.mine).toBe(true);
    expect(old.jobId).toBeNull();
  });
});
