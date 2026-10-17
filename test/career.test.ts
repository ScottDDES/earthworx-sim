// Whole careers, side by side. The prototype starts a career; the engine starts the same one from the same
// seed. Each week a bot reads the prototype's state, decides, and makes the same moves on both; then both
// end the week. After every step the two careers are compared (words aside), and the first difference is reported.

import { describe, expect, it } from 'vitest';
import { choose, game, int, pick, seedRand } from '../src';
import { LTI_STORIES } from '../src/text/safety';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const QNAME: Record<number, string> = { 6: 'April to June', 9: 'July to September', 0: 'October to December', 3: 'January to March' };
const ACC: Record<string, string> = { b0: 'openingBank', jc: 'jobCosts', jco: 'jobCostsOwed', ws: 'workshop', cap: 'capital', loan: 'loan', coll: 'collections', md: 'machineDays', brk: 'breakdowns', bd: 'badDebts', br: 'branch', gst: 'gst' };
const WORDS = new Set(['title', 'detail', 'catch', 'pay', 'sd']);

/** Deep copy without the words (titles and the like) and the card seeds. */
function strip(x: any): any {
  if (Array.isArray(x)) return x.map(strip);
  if (x && typeof x === 'object') {
    const o: any = {};
    for (const k of Object.keys(x)) if (!WORDS.has(k) && x[k] !== undefined) o[k] = strip(x[k]);
    return o;
  }
  return x;
}

/** The parts of a career both sides keep, in one shape. */
function common(S: any, engine: boolean): any {
  const c = strip(S);
  for (const k of ['log', 'news', 'report', 'coach', 'tabs', 'tabsNew', 'careerId', 'schema', 'seenWin', 'seenWin2', 'seenWin3', 'dayNow', 'staffN', 'fleetN', 'season', 'lb', 'alog', 'savedAt']) delete c[k];
  // accounts: one set of names
  if (!engine && c.acc) c.acc = Object.fromEntries(Object.entries(c.acc).map(([k, v]) => [ACC[k] ?? k, v]));
  if (c.acc) for (const k of Object.keys(c.acc)) if (!c.acc[k] && k !== 'openingBank') delete c.acc[k];
  // the auction lot: the engine keeps codes and a number range, the prototype words
  if (c.market?.lot) {
    const L = c.market.lot;
    if (engine) { delete L.guideLo; delete L.guideHi; L.from = L.from.k === 'clearance' ? L.from.name + ' clearance sale' : { council: 'Ex-council clearance', dispersal: 'Contractor dispersal', repo: 'Finance repossession' }[L.from.k as string]; }
    else delete L.guide;
  }
  // GST quarters in words
  if (engine && c.gst) c.gst.due = c.gst.due.map(({ qm, qy, ...d }: any) => ({ ...d, q: QNAME[qm] + ' ' + qy }));
  // the incident register: when and how bad (names and stories are words)
  if (c.whs) c.whs.inc = c.whs.inc.map((x: any) => ({ w: x.w, sev: x.sev }));
  // the job log and the year in review
  if (!engine && c.jlog) c.jlog = c.jlog.map((x: any) => ({ w: x.w, kind: x.k, client: x.c, rev: x.rev, cost: x.cost, plan: x.plan, oh: x.oh, cut: x.cut, sub: x.sub, part: x.part }));
  if (c.years) c.years = c.years.map((y: any) => { const { fy, first, best, worst, ...r } = y; return { ...r, best: best ? best.rev : null, worst: worst ? worst.rev : null }; });
  return c;
}

/** Where two values first differ, as a path, with both sides. */
function firstDiff(a: any, b: any, path = ''): string | null {
  if (a === b || (a == null && b == null)) return null;
  if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return `${path}: engine ${JSON.stringify(a)} vs prototype ${JSON.stringify(b)}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const d = firstDiff(a[k], b[k], path + (Array.isArray(a) ? `[${k}]` : '.' + k));
    if (d) return d;
  }
  return null;
}

function mulberry(seed: number) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Plays one career on both sides. Returns how far it got before they differed (or the weeks asked for). */
function sideBySide(seed: number, setup: { loan: number; town: 'gdi' | 'ct'; hc: boolean }, weeks: number): { weeks: number; diff: string | null; at: string; S: any } {
  const keep = Math.random;
  Math.random = mulberry(seed);
  let at = 'start';
  try {
    P.UI.setup = { step: 1, co: 'Side By Side Earthmoving', loan: setup.loan, town: setup.town, hc: setup.hc };
    P.start();
    let S = P.getS();
    const c = game.newCareer({ co: 'Side By Side Earthmoving', ...setup }, +S.rngSeed, S.wxStart);
    const check = (where: string) => {
      at = where;
      const d = firstDiff(common(c, true), common(P.getS(), false));
      if (d) throw new Error(`${where}: ${d}`);
    };
    check('start');
    const both = (where: string, proto: () => void, engine: () => void) => { proto(); engine(); check(where); };
    // the first grader, then open for business
    const g = (S.market.listings || []).filter((m: any) => m.type === 'grader').sort((a: any, b: any) => a.price - b.price)[0];
    both('buy first grader', () => P.buy(g.id), () => game.buy(c, g.id));
    both('open', () => P.__open(), () => game.open(c));
    for (let w = 0; w < weeks && S.phase === 'play'; w++) {
      const W = S.week;
      for (let k = 0; S.queue.length && k < 20; k++) both(`week ${W} card ${S.queue[0].k}`, () => P.choose(0), () => choose(c, 0));
      for (const of of (S.offers || []).slice()) if (!P.whyNot(of)) both(`week ${W} accept ${of.kind}`, () => P.accept(of.id), () => game.accept(c, of.id));
      for (const t of (S.tenders || []).slice()) if (!t.bid) both(`week ${W} price subbie tender`, () => P.submitBid(t.id), () => game.submitBid(c, t.id));
      for (const t of (S.ctenders || []).slice()) if (!t.bid) both(`week ${W} price council tender`, () => P.submitCouncil(t.id), () => game.submitCouncil(c, t.id));
      if (P.room() <= 0) {
        const next = S.yard === 'home' ? 'fenced' : S.yard === 'fenced' && S.won ? 'depot' : S.yard === 'depot' && S.won2 ? 'regional' : null;
        const cost: Record<string, number> = { fenced: 4000, depot: 18000, regional: 60000 };
        if (next && S.bank > cost[next]! + 40000) both(`week ${W} move to ${next}`, () => P.moveYard(next), () => game.moveYard(c, next as never));
      }
      if (S.fleet.length < 10 && P.room() > 0) {
        const want: Record<string, number> = { roller: 1, cart: 2, grader: 2, truck: 1 };
        const need = ['roller', 'cart', 'grader', 'truck'].find((k) => S.fleet.filter((m: any) => m.type === k).length < want[k]!) || 'grader';
        const m = (S.market.listings || []).filter((x: any) => x.type === need).sort((a: any, b: any) => a.price - b.price)[0];
        if (m && S.bank > m.price * 1.1 + 15000) both(`week ${W} buy ${need}`, () => P.buy(m.id), () => game.buy(c, m.id));
      }
      if (S.bank > 80000 && (S.cands || []).length && (S.staff || []).length < 4) { const id = S.cands[0].id; both(`week ${W} hire`, () => P.hireCand(id), () => game.hireCand(c, id)); }
      for (let k = 0; S.queue.length && k < 20; k++) both(`week ${W} card ${S.queue[0].k}`, () => P.choose(0), () => choose(c, 0));
      both(`week ${W} end`, () => P.endWeek(), () => game.endWeek(c));
      S = P.getS();
    }
    return { weeks, diff: null, at, S };
  } catch (e) {
    return { weeks: 0, diff: (e as Error).message, at, S: P.getS() };
  } finally {
    Math.random = keep;
  }
}

describe('whole careers', () => {
  it('play the same, week after week, start to finish', () => {
    const R = seedRand(401);
    const runs: string[] = [];
    for (let i = 0; i < 40; i++) {
      const setup = { loan: pick(R, [80000, 180000, 350000]), town: pick(R, ['gdi', 'ct'] as const), hc: R() < 0.25 };
      const r = sideBySide(int(R, 1, 1e9), setup, 208);
      const S = r.S, x = { week: S.week, phase: S.phase, bank: Math.round(S.bank), fleet: S.fleet.length, staff: (S.staff || []).length, rung: P.rung(), subs: S.subsWon, council: S.ownWon, programs: S.majorDone || 0, rivals: S.rivals.length, years: (S.years || []).length };
      runs.push(`${JSON.stringify(setup)}: ${r.diff ?? 'same to week ' + S.week} ${JSON.stringify(x)}`);
      if (r.diff) { console.log(runs.join('\n')); expect(r.diff).toBeNull(); }
    }
    console.log(runs.join('\n'));
    expect(LTI_STORIES.length).toBe(4);
  });
});
