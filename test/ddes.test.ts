// DDES in the mid and late game (Scott, 24 Oct): the retainer and its health checks, claims for overruns and wet
// weeks, tender writing, the ERP's modules, getting ready to sell, and what it saved you in the year in review.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BID_PTS, CHECK_WEEKS, CLAIM_FEE, CLAIM_FEE_RET, PLANT_BRK, PREP_LIFT, PREP_WEEKS, RET_MIN, SITE_WORK, WELLBEING_ADVISORY,
  choose, compat, drawCard, eotClaim, game, genEnquiry, retainerFee, seedRand, yearEnd, type FarmEnquiry,
} from '../src';
import { quietAdvisory } from '../src/safety';
import { invoice } from '../src/hire';
import { cardView } from '../src/text/cardView';
import { bulkLine } from '../src/text/bulk';

type Career = game.Career;
const outfit = () => {
  const c = game.newCareer({ co: 'DDES Client', loan: 900000, town: 'gdi', path: 'bulk', bulk: true } as never, 5);
  c.phase = 'play';
  c.won = c.won2 = c.won3 = true;
  c.yard = 'regional';
  c.bank = 9e6;
  c.queue = [];
  c.fleet = [];
  const add = (type: string, extra = {}) => c.fleet.push({ id: 'x' + c.fleet.length, type, year: 2024, cond: 90, hours: 1000, svcAt: 1000, status: 'idle', down: 0, cover: 0, warranty: 0, jobId: null, sale: null, ...extra } as never);
  ['s651', 's651', 'd9', 'd9', 'c825', 'moxycart', 'grader', 'excavator'].forEach((t) => add(t));
  c.bulk = { enq: [] };
  return c;
};
const weeks = (c: Career, n: number, pick?: (k: string) => number, stop?: (ev: any[]) => boolean) => {
  const all: any[] = [];
  for (let i = 0; i < n; i++) {
    const r = game.endWeek(c) as { events?: any[] } | null;
    for (let k = 0; c.queue.length && k < 30; k++) choose(c, pick ? pick(c.queue[0]!.k) : 0);
    all.push(...(r?.events ?? []));
    if (stop?.(r?.events ?? [])) break;
  }
  return all;
};
/** The claim's outcome, from the diary (it settles when the card's answered, or when the job's done). */
const paidNote = (c: Career) => ((c as { log?: { e: any }[] }).log ?? []).map((x) => x.e).find((e) => e.k === 'overrunPaid');
/** A ring tank won at its plans, where the dirt runs well over them. */
const overJob = (c: Career, over = 1.4): FarmEnquiry => {
  const e = genEnquiry(seedRand(4), c as never, 1, 'ringTank');
  e.truth = Math.round(e.vol * over);
  e.quoted = Math.round(e.budget * 0.8);
  e.week = c.week - 1;
  c.bulk!.enq = [e];
  return e;
};

describe('DDES in the mid and late game', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('a retainer: a weekly fee by turnover in the running costs, and the advisory calls are covered', () => {
    const c = outfit();
    expect(retainerFee(c)).toBe(RET_MIN);
    c.hist = Array.from({ length: 13 }, (_, i) => ({ w: i, inv: 600000 }) as never);
    expect(retainerFee(c)).toBe(2400);
    const before = game.overheads(c);
    expect(game.ddesRetainer(c, true)).toBe(true);
    expect(game.overheads(c) - before).toBe(2400);
    // a wellbeing check-in costs nothing, and goes in the tally
    const b0 = c.bank;
    quietAdvisory(c as never);
    expect(c.bank).toBe(b0);
    expect(c.ddes!.got).toBe(WELLBEING_ADVISORY);
    // a price check, free
    const d = outfit();
    expect(game.ddesRetainer(d, false)).toBe(true);
    d.won2 = false;
    expect(game.ddesRetainer(d, true)).toBe(false);
  });

  it('a health check every quarter on retainer, naming the one thing to fix', () => {
    const c = outfit();
    game.ddesRetainer(c, true);
    for (const m of c.fleet.slice(0, 4)) m.hours = m.svcAt + 400;
    let seen: any = null;
    for (let i = 0; i < CHECK_WEEKS + 1 && !seen; i++) {
      game.endWeek(c);
      const q = c.queue.find((x) => x.k === 'ddescheck');
      if (q) seen = drawCard(c as never, q as never);
      c.queue = [];
    }
    expect(seen?.data.find).toBe('svc');
    const v = cardView(c as never, { k: 'ddescheck' } as never, seen);
    expect(v.body).toContain('past their service');
    // not on retainer: no checks
    const d = outfit();
    weeks(d, CHECK_WEEKS + 2);
    expect(d.queue.some((x) => x.k === 'ddescheck')).toBe(false);
  });

  it('a job well over the plans: DDES claims a variation and gets most of it back, less its fee', () => {
    let got = 0, fees = 0, paid = 0;
    for (let s = 0; s < 12; s++) {
      const c = outfit();
      (c as { rngA?: number }).rngA = s;
      overJob(c);
      weeks(c, 40, (k) => (k === 'overrun' ? 0 : 0), (x) => x.some((y) => y.k === 'damDone'));
      weeks(c, 1);
      const p = paidNote(c);
      expect(p, 'seed ' + s).toBeTruthy();
      expect(p.who).toBe('ddes');
      if (p.amt) { got += p.amt; fees += p.fee; paid++; expect(p.fee).toBe(Math.round((p.amt * CLAIM_FEE) / 100) * 100); }
      expect(bulkLine({ ...p, farm: 'Kelly', place: 'Talwood', dk: 'ringTank' })).toMatch(/DDES got|knocked back/);
    }
    expect(paid).toBeGreaterThan(3);
    expect(got).toBeGreaterThan(fees * 5);
  });

  it('claimed yourself, a variation is paid less often than through DDES; on retainer the fee is lower', () => {
    const rate = (who: number, ret = false) => {
      let paid = 0, fee = 0, amt = 0;
      for (let s = 0; s < 30; s++) {
        const c = outfit();
        (c as { rngA?: number }).rngA = 100 + s;
        if (ret) game.ddesRetainer(c, true);
        overJob(c);
        weeks(c, 40, (k) => (k === 'overrun' ? who : 0), (x) => x.some((y) => y.k === 'damDone'));
        weeks(c, 1, (k) => (k === 'overrun' ? who : 0));
        const p = paidNote(c);
        if (p?.amt) { paid++; fee += p.fee; amt += p.amt; }
      }
      return { paid, fee, amt };
    };
    const ddes = rate(0), self = rate(1), ret = rate(0, true);
    expect(ddes.paid).toBeGreaterThan(self.paid);
    expect(self.fee).toBe(0);
    expect(ret.fee / ret.amt).toBeCloseTo(CLAIM_FEE_RET, 1);
  });

  it('a developer job late after a wet spell: an extension of time pushes the finish date out', () => {
    const c = outfit();
    const e = genEnquiry(seedRand(7), c as never, 1, 'dev');
    e.std = undefined;
    e.weeks = 1;
    e.quoted = Math.round(e.budget * 0.8);
    e.week = c.week - 1;
    c.bulk!.enq = [e];
    weeks(c, 2);
    const j = c.jobs.find((x) => x.dk === 'dev')!;
    j.wetD = 12;
    const due0 = j.due as number;
    c.week = due0;
    let card: any = null;
    for (let i = 0; i < 3 && !card; i++) {
      game.endWeek(c);
      const q = c.queue.find((x) => x.k === 'eot');
      if (q) { card = drawCard(c as never, q as never); c.queue = [q]; }
      else c.queue = [];
    }
    const wks = card?.data.wks as number;
    expect(wks).toBeGreaterThanOrEqual(2);
    (c as { rngA?: number }).rngA = 3;
    choose(c, 0);
    expect([due0, due0 + wks]).toContain(j.due);
    // granted, the date moves by the wet weeks, and DDES's fee is its share of the damages saved
    const k = outfit(), jj = { due: 20, wetD: 10 } as Record<string, unknown>;
    const g = eotClaim(() => 0, k as never, jj, 'ddes', 5000);
    expect(jj.due).toBe(22);
    expect(g.fee).toBe(Math.round((2 * 5000 * CLAIM_FEE) / 100) * 100);
  });

  it('DDES writing a council bid adds points on method when it closes', () => {
    const c = outfit();
    c.ctenders = [];
    let t: any = null;
    for (let s = 0; !t && s < 80; s++) {
      game.endWeek(c);
      c.queue = [];
      t = c.ctenders.find((x) => !x.major);
    }
    expect(t).toBeTruthy();
    game.submitCouncil(c, t.id);
    expect(game.ddesBid(c, t.id)).toBe(true);
    expect(t.dw).toBeGreaterThanOrEqual(6000);
    for (let i = 0; i < 6 && !t.result; i++) { game.endWeek(c); c.queue = []; }
    const me = t.result.find((x: any) => x.you);
    expect(me.method).toBe(t.mine.method + BID_PTS);
  });

  it("the ERP's modules: more branch work, fewer breakdowns, paid sooner", () => {
    const c = outfit();
    c.erp = true;
    expect(game.erpModule(c, 'site')).toBe(false); // no branch yet
    expect(game.erpModule(c, 'plant')).toBe(false); // too few machines
    expect(game.erpModule(c, 'claims')).toBe(true);
    const w0 = game.wctx(c).brk;
    while (c.fleet.length < 20) c.fleet.push({ ...c.fleet[0]!, id: 'y' + c.fleet.length });
    expect(game.erpModule(c, 'plant')).toBe(true);
    expect(game.wctx(c).brk).toBeCloseTo(w0 * PLANT_BRK, 6);
    const r0 = c.recv.length;
    game.endWeek(c);
    expect(SITE_WORK).toBeGreaterThan(1);
    // an invoice now: due a week sooner
    invoice(c as never, 'Kelly', 1000, 2, { invoiced: 0 });
    expect(c.recv[c.recv.length - 1]!.due).toBe(c.week + 1);
    expect(c.recv.length).toBeGreaterThan(r0);
  });

  it('getting ready to sell: six months on, sale and retirement offers are better', () => {
    const c = outfit();
    const r0 = game.retireQuote(c).price;
    expect(game.sellPrep(c)).toBe(true);
    expect(game.retireQuote(c).price).toBe(r0);
    c.week += PREP_WEEKS;
    const r1 = game.retireQuote(c).price;
    expect(r1 / r0).toBeGreaterThan(1 + PREP_LIFT - 0.01);
    expect(r1 / r0).toBeLessThan(1 + PREP_LIFT + 0.06);
    expect(game.sellPrep(c)).toBe(false); // once
  });

  it('the year in review says what DDES saved you, and starts the count again', () => {
    const c = outfit();
    game.ddesRetainer(c, true);
    c.ddes!.got = 42000;
    c.hist = Array.from({ length: 30 }, (_, i) => ({ w: i + 1, b: 0, gst: 0, nw: 0, inv: 1000, pd: 0, jc: 0, ws: 0, oh: 0, fin: 0, ot: 0, bd: 0, br: 0, cap: 0, md: 0, fl: 0, rain: 0, brk: 0, wih: 0, dr: 0, wg: 0, st: 0 }));
    const y = yearEnd(Object.assign(c, { staffN: 0, fleetN: 0 }) as never, 30, 0)!;
    expect(y.ddes).toBe(42000);
    expect(c.ddes!.got0).toBe(42000);
    const v = cardView(c as never, { k: 'yearend', i: 0 } as never, drawCard(c as never, { k: 'yearend', i: c.years!.length - 1 } as never)!);
    expect(v.body).toContain('DDES saved or got back $42,000');
  });

  it('none of it in the prototype', () => {
    compat.prototype = true;
    const c = outfit();
    expect(game.ddesRetainer(c, true)).toBe(false);
    expect(game.sellPrep(c)).toBe(false);
    c.erp = true;
    expect(game.erpModule(c, 'claims')).toBe(false);
    compat.prototype = false;
  });
});
