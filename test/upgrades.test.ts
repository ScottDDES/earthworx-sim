// Machine control on bulk gear (Scott, 22 Oct): laser control on scrapers, laser buckets and dozers (needed for laser
// levelling), GPS on top of it (and on an excavator), each a bit more done a day and a better finish. Laser control
// works off a job's Laser Gear: one Laser Gear a job, as many laser machines on it as you like.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ATTACH, GPS_COST, LASER_COST, bulkStart, compat, dayQuality, game, laserFree, workRate } from '../src';

type Career = game.Career;
const add = (c: Career, type: string, extra: Record<string, unknown> = {}) => {
  c.fleet.push({ id: 'm' + c.fleet.length, type, year: 2016, cond: 85, hours: 8000, svcAt: 8000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null, ...extra } as never);
  return c.fleet[c.fleet.length - 1]!;
};
const outfit = () => {
  const c = game.newCareer({ co: 'Laser Earthmoving', loan: 900000, town: 'gdi', path: 'bulk' }, 7);
  c.phase = 'play';
  c.yard = 'hub';
  c.bank = 3000000;
  c.bulk ??= { enq: [] };
  return c;
};
const m = (type: string, x: Record<string, unknown> = {}) => ({ type, ...x }) as never;

describe('machine control on bulk gear', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('laser on scrapers, laser buckets and dozers; GPS on a grader, an excavator, or anything that has laser', () => {
    const c = outfit();
    const pull = add(c, 'pull'), scr = add(c, 's627'), dz = add(c, 'd8'), ex = add(c, 'excavator'), gr = add(c, 'grader');
    expect(game.fitLaser(c, ex.id)).toBe(false);
    expect(game.fitLaser(c, gr.id)).toBe(false);
    expect(game.fitGps(c, scr.id)).toBe(false); // laser first
    const bank = c.bank;
    expect(game.fitLaser(c, pull.id) && game.fitLaser(c, scr.id) && game.fitLaser(c, dz.id)).toBe(true);
    expect(bank - c.bank).toBe(3 * LASER_COST);
    expect(game.fitLaser(c, scr.id)).toBe(false); // once
    expect(game.fitGps(c, scr.id) && game.fitGps(c, ex.id) && game.fitGps(c, dz.id)).toBe(true);
    expect(bank - c.bank).toBe(3 * LASER_COST + 3 * GPS_COST);
    // the prototype: GPS on graders only, no laser
    compat.prototype = true;
    const p = outfit();
    const pe = add(p, 'excavator'), ps = add(p, 's627');
    expect(game.fitGps(p, pe.id) || game.fitLaser(p, ps.id)).toBe(false);
    compat.prototype = false;
  });

  it('more gets done: laser only with the Laser Gear on the job, GPS anywhere', () => {
    const dam = (ms: never[], lzr = false) => workRate(ms, { dk: 'turkeyNest', haul: 60, lzr }).rates.dozers!;
    const plain = dam([m('d8')]);
    expect(dam([m('d8', { laser: true })])).toBeCloseTo(plain, 6);
    expect(dam([m('d8', { laser: true })], true) / plain).toBeCloseTo(1.05, 3);
    expect(dam([m('d8', { laser: true, gps: true })]) / plain).toBeCloseTo(1.1, 3);
    const ch = (x: Record<string, unknown>) => workRate([m('excavator', x)], { dk: 'channel', per: 2 }).rates.excavator!;
    expect(ch({ gps: true }) / ch({})).toBeCloseTo(1.1, 3);
  });

  it('and a better finish', () => {
    const q = (x: Record<string, unknown>, lzr = false) => dayQuality(workRate([m('d8', x), m('padfoot'), m('moxycart')], { dk: 'turkeyNest', haul: 60, lzr }), false);
    expect(q({ laser: true }, true)).toBeGreaterThan(q({}));
    expect(q({ laser: true, gps: true })).toBeGreaterThan(q({ laser: true }, true));
    expect(q({ laser: true })).toBe(q({}));
  });

  it('laser levelling takes laser-fitted scrapers or laser buckets, and one Laser Gear a job', () => {
    const lev = (ms: never[]) => workRate(ms, { dk: 'laser', haul: 80, per: 300 }, { laser: true }).perHour;
    expect(lev([m('pull'), m('pull'), m('grader')])).toBe(0);
    expect(lev([m('pull', { laser: true }), m('pull', { laser: true }), m('grader')])).toBeGreaterThan(0);

    const c = outfit();
    for (let i = 0; i < 4; i++) add(c, 'pull', { laser: true });
    add(c, 'grader');
    add(c, 'grader');
    expect(game.buyAttach(c, 'laser')).toBe(true);
    const job = (id: string) => ({ id, kind: 'bulk', dk: 'laser', state: 'waiting', client: 'Kelly', place: 'Toobeah', haul: 80, per: 300, est: 40, truth: 40, m3: 0, won: c.week, days: 0, done: 0 }) as never;
    c.jobs.push(job('L1'), job('L2'));
    bulkStart(c as never, []);
    const [a, b] = c.jobs as unknown as { state: string; lzr?: boolean }[];
    // one Laser Gear: the first job gets it (and its machines), the second waits for another
    expect(a!.state).toBe('running');
    expect(a!.lzr).toBe(true);
    expect(b!.state).toBe('waiting');
    expect(laserFree(c as never)).toBe(0);
    // more laser buckets in the yard: still no start, it's the Laser Gear it's waiting on
    add(c, 'pull', { laser: true });
    add(c, 'pull', { laser: true });
    bulkStart(c as never, []);
    expect(b!.state).toBe('waiting');
    // buy a second: now both run
    const bank = c.bank;
    expect(game.buyAttach(c, 'laser')).toBe(true);
    expect(bank - c.bank).toBe(ATTACH.laser);
    add(c, 'pull', { laser: true });
    add(c, 'pull', { laser: true });
    bulkStart(c as never, []);
    expect(b!.state).toBe('running');
    expect(b!.lzr).toBe(true);
  });
});
