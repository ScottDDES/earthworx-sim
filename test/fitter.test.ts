// Run on and breakdowns: your fitter makes the call (the real game only).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { answerSmall, choose, compat, drawCard, fitterCall, game, type Machine, type Person } from '../src';
import { handledLine } from '../src/text/coach';

function shop(skill: Person['skill'] | null, warranty = false) {
  const c = game.newCareer({ co: 'Fitter Test', loan: 350000, town: 'gdi' }, 3);
  c.phase = 'play';
  const m: Machine = { id: 'G1', type: 'grader', year: 2015, cond: 70, hours: 9000, svcAt: 8800, status: 'idle', down: 3, cover: 0, warranty: warranty ? c.week + 5 : 0, jobId: null, sale: null, repair: 4000 } as Machine;
  c.fleet.push(m);
  if (skill) c.staff.push({ id: 'F1', name: 'Robbo', role: 'fitter', skill, wage: 1600, off: 0, jobId: null } as Person);
  c.queue = [{ k: 'break', id: 'G1' }];
  return { c, m };
}

describe('your fitter on a breakdown', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('green patches it, a gun fixes it properly, solid goes both ways, and no fitter means Run on stops', () => {
    const call = (skill: Person['skill'] | null, week = 10) => { const { c } = shop(skill); c.week = week; const d = drawCard(c, c.queue[0]!)!; return fitterCall(c, c.queue[0]!, d.data); };
    expect(call('green')).toBe('patch');
    expect(call('gun')).toBe('fitterFix');
    expect(call(null)).toBeNull();
    const solid = new Set(Array.from({ length: 20 }, (_, w) => call('solid', w + 1)));
    expect(solid).toEqual(new Set(['patch', 'fitterFix']));
    const { c } = shop('green', true);
    expect(fitterCall(c, c.queue[0]!, drawCard(c, c.queue[0]!)!.data)).toBe('warranty');
  });

  it('a patch keeps it working with a bandaid on; a proper fix costs more and stands it down a day or so', () => {
    const p = shop('green'), dp = drawCard(p.c, p.c.queue[0]!)!, bank0 = p.c.bank;
    choose(p.c, dp.opts.findIndex((o) => o.id === 'patch'));
    expect(p.m.down).toBe(0);
    expect(p.m.band).toBeTruthy();
    const patchCost = bank0 - p.c.bank;
    const f = shop('gun'), df = drawCard(f.c, f.c.queue[0]!)!, bank1 = f.c.bank;
    choose(f.c, df.opts.findIndex((o) => o.id === 'fitterFix'));
    expect(f.m.down).toBeGreaterThanOrEqual(1);
    expect(f.m.band).toBeFalsy();
    expect(bank1 - f.c.bank).toBeGreaterThan(patchCost);
  });

  it('Run on answers the breakdown with the fitter, and says so; with no fitter it leaves it for you', () => {
    const g = shop('gun'), h: any[] = [];
    answerSmall(g.c, 10, h);
    expect(g.c.queue.length).toBe(0);
    expect(h[0]).toMatchObject({ k: 'break', id: 'fitterFix', who: 'Robbo', type: 'grader' });
    expect(handledLine(h[0])).toContain('Robbo fixed it properly');
    const n = shop(null), h2: any[] = [];
    answerSmall(n.c, 10, h2);
    expect(n.c.queue.length).toBe(1);
    expect(h2).toEqual([]);
  });

  it('the prototype has no fitter options on a breakdown', () => {
    compat.prototype = true;
    const { c } = shop('gun');
    expect(drawCard(c, c.queue[0]!)!.opts.map((o) => o.id)).not.toContain('patch');
    compat.prototype = false;
  });
});
