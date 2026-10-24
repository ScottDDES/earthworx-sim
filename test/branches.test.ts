// Branches across Queensland (Scott, 24 Oct): up to three, in any town, each once the others make money; floats priced
// by the distance; bulk gear works there too, on the town's own farms and mines.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BR_FLOAT, BR_MAX, BR_PROVE, BR_SETUP, brAt, brBulkWork, brFloat, brTowns, branchWhy, branches, choose, compat, drawCard, game, type TownId,
} from '../src';
import { eventText } from '../src/text/docket';

type Career = game.Career;
const add = (c: Career, type: string) => {
  c.fleet.push({ id: 'm' + c.fleet.length, type, year: 2024, cond: 85, hours: 3000, svcAt: 3000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null } as never);
  return c.fleet[c.fleet.length - 1]!;
};
const outfit = () => {
  const c = game.newCareer({ co: 'Branching Out', loan: 900000, town: 'gdi' }, 7);
  c.phase = 'play';
  c.yard = 'regional';
  c.bank = 9000000;
  c.won = c.won2 = c.won3 = true;
  c.fleet = [];
  c.queue = [];
  return c;
};
/** Pretend a branch has run in profit for long enough. */
const proven = (c: Career) => { for (const B of branches(c as never)) B.hist = Array.from({ length: BR_PROVE }, (_, i) => ({ w: i, days: 5, rev: 30000, cost: 20000, crews: 1, dry: 5 })); };

describe('branches across Queensland', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('any town, nearest first, and the float costs more the further it is', () => {
    const c = outfit(), ts = brTowns(c as never);
    expect(ts).not.toContain('gdi');
    expect(ts.length).toBe(8);
    expect(ts.slice(0, 2).sort()).toEqual(['dby', 'stg']);
    expect(ts[ts.length - 1]).toBe('wei');
    expect(brFloat('gdi', 'stg')).toBeLessThan(brFloat('gdi', 'emd'));
    expect(brFloat('gdi', 'emd')).toBeLessThan(brFloat('gdi', 'wei'));
    // the old run to Charters Towers costs what it always did
    expect(brFloat('gdi', 'ct')).toBe(BR_FLOAT);
  });

  it(`a second branch once the first has made money for ${BR_PROVE} weeks, and ${BR_MAX} at most`, () => {
    const c = outfit();
    expect(game.openBranchDepot(c, 'gun', 'stg')).toBe(true);
    expect(c.branch!.town).toBe('stg');
    expect(c.bank).toBe(9000000 - BR_SETUP);
    expect(branchWhy(c as never)).toBe('proving');
    expect(game.openBranchDepot(c, 'gun', 'mbh')).toBe(false);
    proven(c);
    expect(game.openBranchDepot(c, 'green', 'mbh')).toBe(true);
    expect(game.openBranchDepot(c, 'green', 'mbh')).toBe(false); // one a town
    proven(c);
    expect(game.openBranchDepot(c, 'green', 'isa')).toBe(true);
    expect(branches(c as never).map((B) => B.town)).toEqual(['stg', 'mbh', 'isa']);
    proven(c);
    expect(branchWhy(c as never)).toBe('max');
    expect(game.openBranchDepot(c, 'green', 'wei')).toBe(false);
    // a branch running at a loss holds the next one up
    const d = outfit();
    game.openBranchDepot(d, 'gun', 'dby');
    proven(d);
    d.branch!.hist[3]!.cost = 200000;
    expect(branchWhy(d as never)).toBe('proving');
  });

  it("each branch works its own gear; closing one brings only its gear home, and the others carry on", () => {
    const c = outfit();
    game.openBranchDepot(c, 'gun', 'stg');
    proven(c);
    game.openBranchDepot(c, 'gun', 'emd');
    const g = add(c, 'grader'), r = add(c, 'roller'), w = add(c, 'cart'), d9 = add(c, 'd9');
    for (const m of [g, r, w]) expect(game.sendToBranch(c, m.id, 'stg')).toBe(true);
    const before = c.bank;
    expect(game.sendToBranch(c, d9.id, 'emd')).toBe(true);
    expect(before - c.bank).toBe(brFloat('gdi', 'emd'));
    expect(brAt(c as never, 'stg').map((m) => m.type)).toEqual(['grader', 'roller', 'cart']);
    expect(brAt(c as never, 'emd').map((m) => m.type)).toEqual(['d9']);
    // the first one closes: its gear comes home, Emerald's D9 stays, and Emerald is now the first branch
    game.closeBranchDepot(c, 'stg');
    expect([g, r, w].map((m) => m.status)).toEqual(['idle', 'idle', 'idle']);
    expect(d9.status).toBe('branch');
    expect(c.branch!.town).toBe('emd');
    expect(brAt(c as never, 'emd')).toEqual([d9]);
    expect(game.bringHome(c, d9.id)).toBe(true);
    expect(d9.status).toBe('idle');
  });

  it('bulk gear at a branch earns from the farms and mines, and the docket says so', () => {
    const c = outfit();
    game.openBranchDepot(c, 'gun', 'mbh');
    const d9 = add(c, 'd9'), s651 = add(c, 's651');
    game.sendToBranch(c, d9.id, 'mbh');
    game.sendToBranch(c, s651.id, 'mbh');
    let rev = 0, line = '';
    for (let i = 0; i < 12; i++) {
      const r = game.endWeek(c) as { events?: { k: string }[] } | null;
      c.queue = [];
      const e = r?.events?.find((x) => x.k === 'branchWeek') as { rev: number; bulk?: number } | undefined;
      if (e?.bulk) { rev += e.rev; line = eventText(c as never, r as never, e) ?? ''; }
    }
    expect(rev).toBeGreaterThan(0);
    expect(line).toContain('days on the bulk gear');
    expect(line).toContain('Moranbah branch');
    expect(d9.hours).toBeGreaterThan(3000);
    // the mine towns keep bulk gear busiest, the cane and bauxite towns less so
    expect(brBulkWork('mbh')).toBeGreaterThan(brBulkWork('mky'));
    expect(brBulkWork('isa')).toBeGreaterThan(brBulkWork('wei'));
  });

  it("a manager's call is about their own branch", () => {
    const c = outfit();
    game.openBranchDepot(c, 'gun', 'stg');
    proven(c);
    game.openBranchDepot(c, 'gun', 'emd');
    const mgr = branches(c as never)[1]!.mgr!.name;
    c.queue = [{ k: 'brraise', town: 'emd' as TownId }];
    const d = drawCard(c as never, c.queue[0] as never) as { data?: { town?: string; mgr?: string } } | null;
    expect(d?.data?.town).toBe('emd');
    expect(d?.data?.mgr).toBe(mgr);
    const w0 = branches(c as never)[1]!.mgr!.wage;
    choose(c, 0);
    expect(branches(c as never)[1]!.mgr!.wage).toBe(w0 + 400);
  });

  it('the prototype keeps one branch, in the other town, at the old float', () => {
    compat.prototype = true;
    const c = outfit();
    expect(brTowns(c as never)).toEqual(['ct']);
    expect(game.openBranchDepot(c, 'gun', 'stg')).toBe(true);
    expect(c.branch!.town).toBe('ct');
    proven(c);
    expect(branchWhy(c as never)).toBe('max');
    expect(brFloat('gdi', 'ct')).toBe(BR_FLOAT);
    compat.prototype = false;
  });
});
