// TestFlight feedback (Scott, 25 Oct): a break-in with no GPS to take, the docket's "Dam finished" on banks,
// laser levelling without a grader, and politely declining work you've no gear for.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { choose, compat, dayQuality, drawCard, freeFor, game, genEnquiry, seedRand } from '../src';
import { BREAKIN_DIESEL, CAMERA_COST } from '../src/cards';
import { cardView } from '../src/text/cardView';
import { docketStamps } from '../src/text/docket';
import { diaryLines } from '../src/text/diary';

type Career = game.Career;
const outfit = (gps = false) => {
  const c = game.newCareer({ co: 'Feedback', loan: 900000, town: 'dby', path: 'bulk', bulk: true } as never, 5);
  c.phase = 'play';
  c.bank = 500000;
  c.queue = [];
  c.fleet = [];
  c.offers = [];
  const add = (type: string, extra = {}) => c.fleet.push({ id: 'x' + c.fleet.length, type, year: 2024, cond: 90, hours: 1000, svcAt: 1000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null, ...extra } as never);
  add('pull', { laser: true });
  add('pull', { laser: true });
  add('grader', gps ? { gps: true } : {});
  c.bulk = { enq: [], att: { laser: true } } as never;
  return c;
};
const ids = (c: Career) => drawCard(c, c.queue[0]!)!.opts.map((o) => o.id);

describe('TestFlight feedback, 25 Oct', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('a break-in with no GPS in the yard takes only the diesel', () => {
    const c = outfit();
    c.queue = [{ k: 'breakin' } as never];
    expect(ids(c)).toEqual(['camera', 'wear']);
    const v = cardView(c as never, c.queue[0] as never, drawCard(c, c.queue[0]!)!);
    expect(v.body).not.toMatch(/GPS/);
    expect(v.body).toContain('diesel');
    const b0 = c.bank;
    choose(c, 1);
    expect(c.bank).toBe(b0 - BREAKIN_DIESEL);
    // a camera's up already: only the diesel to top up
    const d = outfit();
    d.queue = [{ k: 'breakin' } as never];
    choose(d, 0);
    expect(d.bank).toBe(500000 - BREAKIN_DIESEL - CAMERA_COST);
    d.queue = [{ k: 'breakin' } as never];
    expect(ids(d)).toEqual(['wear']);
    // with a GPS machine it's the card it was
    const g = outfit(true);
    g.queue = [{ k: 'breakin' } as never];
    expect(ids(g)).toEqual(['claim', 'camera', 'without']);
    compat.prototype = true;
    const p = outfit();
    p.queue = [{ k: 'breakin' } as never];
    expect(ids(p)).toEqual(['claim', 'camera', 'without']);
    compat.prototype = false;
  });

  it('the docket says "Dam finished" only for a dam', () => {
    const c = outfit();
    const stamp = (dk: string) => docketStamps(c, { events: [{ k: 'damDone', jobId: 'j1' }], jobs: { j1: { id: 'j1', kind: 'bulk', dk, client: 'Pearce', place: 'Kogan' } } } as never)[0]!;
    expect(stamp('contour')).toMatch(/^Finished · /);
    expect(stamp('laser')).toMatch(/^Finished · /);
    expect(stamp('ringTank')).toMatch(/^Dam finished · /);
    compat.prototype = true;
    expect(stamp('contour')).toMatch(/^Dam finished · /);
    compat.prototype = false;
  });

  it('laser levelling: Laser Buckets do the finish, no grader to trim', () => {
    const c = outfit();
    expect(freeFor(c as never, 'laser').map((m) => m.type)).toEqual(['pull', 'pull']);
    const sr = { compacted: false, watered: false, precon: false, trimmed: false, ctlQ: 0.04 };
    expect(dayQuality(sr, false, 'laser')).toBeCloseTo(0.96, 6);
    compat.prototype = true;
    expect(dayQuality(sr, false, 'laser')).toBeCloseTo(0.69, 6);
    compat.prototype = false;
  });

  it('politely declining: hire work and a farmer\'s enquiry go, with a line in the diary', () => {
    const c = outfit();
    c.offers = [{ id: 'o1', kind: 'dry', type: 'd9', client: 'Dry Creek Civil', place: 'Jimbour', days: 15, rate: 900, terms: 28 } as never];
    expect(game.declineOffer(c, 'o1')).toBe(true);
    expect(c.offers).toHaveLength(0);
    expect(diaryLines(c)[0]!.t).toContain('Politely declined: ');
    expect(diaryLines(c)[0]!.t).toContain('Dry Creek Civil');
    const e = genEnquiry(seedRand(4), c as never, 1, 'ringTank');
    c.bulk!.enq = [e];
    expect(game.damDecline(c, e.id)).toBe(true);
    expect(c.bulk!.enq).toHaveLength(0);
    expect(diaryLines(c)[0]!.t).toContain('Rang ' + e.farm + ' back');
    // a price already sent can't be taken back this way
    const q = genEnquiry(seedRand(5), c as never, 1, 'ringTank');
    q.quoted = 50000;
    c.bulk!.enq = [q];
    expect(game.damDecline(c, q.id)).toBe(false);
    // the prototype has no such thing
    compat.prototype = true;
    c.offers = [{ id: 'o2', kind: 'dry', type: 'd9', client: 'X' } as never];
    expect(game.declineOffer(c, 'o2')).toBe(false);
    compat.prototype = false;
  });
  it('politely declining a head contractor: a point of standing while it is middling or worse, once in 8 weeks', () => {
    const c = outfit();
    const offer = (id: string, type = 'd9', client = 'Border Civil') => { c.offers = [{ id, kind: 'dry', type, client, place: 'Jimbour', days: 15, rate: 900, terms: 28 } as never]; };
    offer('a');
    game.declineOffer(c, 'a');
    expect(c.rel?.['Border Civil']).toBe(1);
    // again too soon: nothing
    offer('b');
    game.declineOffer(c, 'b');
    expect(c.rel?.['Border Civil']).toBe(1);
    c.week += game.DECLINE_WEEKS;
    offer('c');
    game.declineOffer(c, 'c');
    expect(c.rel?.['Border Civil']).toBe(2);
    // already in good standing: no more from declining
    c.rel!['Border Civil'] = game.DECLINE_CAP;
    c.week += game.DECLINE_WEEKS;
    offer('d');
    game.declineOffer(c, 'd');
    expect(c.rel?.['Border Civil']).toBe(game.DECLINE_CAP);
    // work you could have done: no credit for turning it down
    c.rel!['Hartley Bros'] = -4;
    offer('e', 'pull', 'Hartley Bros');
    game.declineOffer(c, 'e');
    expect(c.rel?.['Hartley Bros']).toBe(-4);
    // a farmer or a council isn't a head contractor
    offer('f', 'd9', 'Council');
    game.declineOffer(c, 'f');
    expect(c.rel?.['Council']).toBeUndefined();
  });
});
