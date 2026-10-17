// Whole careers, side by side. The prototype starts a career; the engine starts the same one from the same
// seed. Each week a bot reads the prototype's state, decides, and makes the same moves on both; then both
// end the week. After every step the two careers are compared (words aside), and the first difference is reported.

import { describe, expect, it } from 'vitest';
import { SEASONS, canRunOn, choose, coachOk, drawCard, game, int, pick, play, replaySeason, runOn, seedRand, startSeason, type SeasonId } from '../src';
import { cardView, resultText } from '../src/text/cardView';
import { hammerText, lotFrom, lotGuide } from '../src/text/market';
import { ownerFlags } from '../src/text/office';
import { roadNote } from '../src/text/map';
import { diaryLines } from '../src/text/diary';
import { nextGoal } from '../src/text/coach';
import { jobTitle } from '../src/text/work';
import { docketLines, docketStamps, eventText } from '../src/text/docket';
import { LTI_STORIES } from '../src/text/safety';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const QNAME: Record<number, string> = { 6: 'April to June', 9: 'July to September', 0: 'October to December', 3: 'January to March' };
const ACC: Record<string, string> = { b0: 'openingBank', jc: 'jobCosts', jco: 'jobCostsOwed', ws: 'workshop', cap: 'capital', loan: 'loan', coll: 'collections', md: 'machineDays', brk: 'breakdowns', bd: 'badDebts', br: 'branch', gst: 'gst' };
const WORDS = new Set(['title', 'detail', 'catch', 'pay', 'sd', 'nm']);

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
  // a season: the prototype keeps its name and its own version number, and records taps where the engine records commands
  if (c.season) { delete c.season.n; delete c.season.v; }
  delete c.alog;
  for (const k of ['log', 'news', 'report', 'careerId', 'schema', 'seenWin', 'seenWin2', 'seenWin3', 'dayNow', 'staffN', 'fleetN', 'season', 'lb', 'alog', 'savedAt']) delete c[k];
  // accounts: one set of names
  if (!engine && c.acc) c.acc = Object.fromEntries(Object.entries(c.acc).map(([k, v]) => [ACC[k] ?? k, v]));
  if (c.acc) for (const k of Object.keys(c.acc)) if (!c.acc[k] && k !== 'openingBank') delete c.acc[k];
  // the auction lot: the engine keeps codes and a number range, the prototype words
  if (c.market?.lot) {
    const L = c.market.lot;
    if (engine) { L.guide = lotGuide(L); delete L.guideLo; delete L.guideHi; L.from = lotFrom(L.from); if (L.result) L.result = hammerText(L.result); }
  }
  // GST quarters in words
  if (engine && c.gst) c.gst.due = c.gst.due.map(({ qm, qy, ...d }: any) => ({ ...d, q: QNAME[qm] + ' ' + qy }));
  // the incident register: when and how bad (names and stories are words)
  if (c.whs) c.whs.inc = c.whs.inc.map((x: any) => ({ w: x.w, sev: x.sev }));
  // the job log and the year in review
  if (engine && c.jlog) c.jlog = c.jlog.map(({ tn, ...x }: any) => x);
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
function sideBySide(seed: number, setup: { loan: number; town: 'gdi' | 'ct'; hc: boolean; season?: SeasonId }, weeks: number): { weeks: number; diff: string | null; at: string; S: any; c?: any } {
  const keep = Math.random;
  Math.random = mulberry(seed);
  let at = 'start';
  try {
    P.UI.setup = { step: 1, co: 'Side By Side Earthmoving', loan: setup.loan, town: setup.town, hc: setup.hc };
    if (setup.season) P.startSeason(setup.season, 'Side By Side Earthmoving'); else P.start();
    let S = P.getS();
    const c = setup.season ? startSeason(setup.season, 'Side By Side Earthmoving') : game.newCareer({ co: 'Side By Side Earthmoving', ...setup }, +S.rngSeed, S.wxStart);
    const G: any = setup.season ? { ...game, ...play } : { ...game, choose, runOn, coachOk };
    const check = (where: string) => {
      at = where;
      const d = firstDiff(common(c, true), common(P.getS(), false));
      if (d) throw new Error(`${where}: ${d}`);
      // the site diary and the district news, word for word
      const PS = P.getS(), un = (L: any[]) => L.map((x) => 'wk ' + x.w + ': ' + x.t);
      for (const [k, mine, theirs] of [['diary', c.log, PS.log], ['news', c.news, PS.news || []]] as const) {
        const A = un(diaryLines(c, mine)), B = un(theirs);
        for (const x of mine) KINDS.add(x.e.k);
        for (let i = 0; i < Math.max(A.length, B.length); i++) {
          if (A[i] !== B[i]) throw new Error(`${where}: ${k} differs at line ${i}\n  engine: ${A[i]}\n  proto:  ${B[i]}`);
        }
      }
    };
    check('start');
    const both = (where: string, proto: () => void, engine: () => void) => { proto(); engine(); check(where); };
    // a card reads the same as the prototype's, and so does what happened after choosing
    const same = (what: string, a: string, b: string) => { if (a !== b) throw new Error(`${what}
  engine: ${a}
  proto:  ${b}`); };
    // the bot takes each option in turn, so every result line gets read
    let n = seed;
    const answer = (W: number) => {
      const pc = P.curve(S.queue[0]), k = S.queue[0].k, i = pc ? n++ % pc.opts.length : 0;
      both(`week ${W} card ${k} option ${i}`, () => P.choose(i), () => {
        const q = c.queue[0]!, d = drawCard(c, q);
        if (!!d !== !!pc) throw new Error(`card ${k}: engine ${d ? 'drew it' : 'skipped it'}`);
        if (d) {
          const v = cardView(c, q, d);
          same(`${k} tag`, v.tag, pc.tag);
          same(`${k} title`, v.title, pc.title);
          same(`${k} body`, v.body, pc.body);
          same(`${k} options`, v.opts.map((o) => o.label + ' | ' + o.sub).join(' // '), pc.opts.map((o: any) => o.label + ' | ' + o.sub).join(' // '));
        }
        const a = G.choose(c, i);
        if (a && d) { same(`${k} result`, resultText(c, a), P.UI.result.res); SEEN.add(k); }
      });
    };
    // the first grader, then open for business
    const g = (S.market.listings || []).filter((m: any) => m.type === 'grader').sort((a: any, b: any) => a.price - b.price)[0];
    if (S.phase === 'shop') {
      both('buy first grader', () => P.buy(g.id), () => G.buy(c, g.id));
      both('open', () => P.__open(), () => G.open(c));
    }
    for (let w = 0; w < weeks && S.phase === 'play'; w++) {
      const W = S.week;
      for (let k = 0; S.queue.length && k < 20; k++) answer(W);
      for (const of of (S.offers || []).slice()) if (!P.whyNot(of)) both(`week ${W} accept ${of.kind}`, () => P.accept(of.id), () => G.accept(c, of.id));
      for (const t of (S.tenders || []).slice()) if (!t.bid) both(`week ${W} price subbie tender`, () => P.submitBid(t.id), () => G.submitBid(c, t.id));
      for (const t of (S.ctenders || []).slice()) if (!t.bid) both(`week ${W} price council tender`, () => P.submitCouncil(t.id), () => G.submitCouncil(c, t.id));
      if (P.room() <= 0) {
        const next = S.yard === 'home' ? 'fenced' : S.yard === 'fenced' && S.won ? 'depot' : S.yard === 'depot' && S.won2 ? 'regional' : null;
        const cost: Record<string, number> = { fenced: 4000, depot: 18000, regional: 60000 };
        if (next && S.bank > cost[next]! + 40000) both(`week ${W} move to ${next}`, () => P.moveYard(next), () => G.moveYard(c, next as never));
      }
      if (S.fleet.length < 10 && P.room() > 0) {
        const want: Record<string, number> = { roller: 1, cart: 2, grader: 2, truck: 1 };
        const need = ['roller', 'cart', 'grader', 'truck'].find((k) => S.fleet.filter((m: any) => m.type === k).length < want[k]!) || 'grader';
        const m = (S.market.listings || []).filter((x: any) => x.type === need).sort((a: any, b: any) => a.price - b.price)[0];
        if (m && S.bank > m.price * 1.1 + 15000) both(`week ${W} buy ${need}`, () => P.buy(m.id), () => G.buy(c, m.id));
      }
      // now and then: a mechanic's check on a private listing, and a go at the auction
      const pv = (S.market.listings || []).find((x: any) => x.seller === 'private' && !x.revealed);
      if (pv && W % 4 === 1 && S.bank > 20000) both(`week ${W} inspect`, () => P.inspect(pv.id), () => G.inspectListing(c, pv.id));
      const lot = S.market.lot;
      if (lot && !lot.done && W % 5 === 2 && P.room() > 0 && S.bank > 60000) {
        for (let k = 0; k < 1 + (W % 3); k++) both(`week ${W} bid`, () => P.bid(5000), () => G.bid(c, 5000));
        both(`week ${W} hammer`, () => P.hammer(), () => G.hammer(c));
      }
      // service the most overdue machine when there's money for it, and now and then sell a worn one
      const due = S.fleet.filter((m: any) => m.hours - m.svcAt > 250 && m.status !== 'auction' && m.status !== 'listed').sort((a: any, b: any) => (b.hours - b.svcAt) - (a.hours - a.svcAt))[0];
      if (due && S.bank > 30000) both(`week ${W} service`, () => P.service(due.id), () => G.service(c, due.id));
      const worn = S.fleet.find((m: any) => m.status === 'idle' && m.cond < 30);
      if (worn && S.fleet.length > 3) { const mode = (['trade', 'auction', 'list'] as const)[W % 3]!; both(`week ${W} sell ${mode}`, () => P.sell(worn.id, mode === 'list' ? undefined : mode), () => G.sellMachine(c, worn.id, mode)); }
      if (S.bank > 80000 && (S.cands || []).length && (S.staff || []).length < 4) { const id = S.cands[0].id; both(`week ${W} hire`, () => P.hireCand(id), () => G.hireCand(c, id)); }
      for (let k = 0; S.queue.length && k < 20; k++) answer(W);
      // the coach's last step waits for "Got it"; now and then the bot says it
      if (S.coach && !S.coach.off && S.coach.i === 4 && W % 7 === 0) both(`week ${W} coach ok`, () => { S.coach.ok = true; P.coachTick(); }, () => G.coachOk(c));
      // and sometimes it runs quiet weeks on instead of ending just the one
      if (W % 9 === 3 && P.canRunOn() !== false && canRunOn(c)) {
        both(`week ${W} run on`, () => P.runOn(), () => {
          const r = G.runOn(c), PR = P.getS().report;
          if (!r || !PR) throw new Error('run on: engine ' + !!r + ', prototype ' + !!PR);
          same(`week ${W} run`, JSON.stringify(r.run ?? null), JSON.stringify(PR.run ? { n: PR.run.n, from: PR.run.from, to: PR.run.to, invoiced: PR.run.invoiced, paid: PR.run.paid, costs: PR.run.costs, rain: PR.run.rain, worked: PR.run.worked } : null));
          RUNS.push(r.run?.n ?? 1);
        });
        S = P.getS();
        continue;
      }
      both(`week ${W} end`, () => P.endWeek(), () => {
        const r = G.endWeek(c), PR = P.getS().report;
        if (!r || !PR) return;
        same(`week ${W} docket`, docketLines(c, r).join(' // '), PR.events.join(' // '));
        same(`week ${W} stamps`, docketStamps(c, r).join(' / '), (PR.hl || []).join(' / '));
        same(`week ${W} days`, JSON.stringify(r.days), JSON.stringify(PR.days));
        same(`week ${W} lost`, String(r.lost), String(PR.lost));
        // the office dashboard's flags, over each period
        for (const N of [13, 52]) {
          const pc = P.getS().hist.slice(-N), mine = ownerFlags(c, (c.hist || []).slice(-N));
          same(`week ${W} flags (${N} wks)`, mine.map((x) => x.join(' | ')).join(' // '), P.ownerFlags(pc, P.plOf(pc)).map((x: any) => x.join(' | ')).join(' // '));
          FLAGS += mine.length;
        }
        for (const e of r.events as { k: string }[]) if (eventText(c, r, e) != null) EVENTS.add(e.k);
        // the line above End week
        const ng = nextGoal(c), png = P.nextGoal();
        same(`week ${W} goal`, ng ? (ng.tip ? 'Tip' : 'Goal') + ' | ' + ng.t + ' | ' + ng.tab : 'none', png ? (P.coachOn() ? 'Tip' : 'Goal') + ' | ' + png.t + ' | ' + png.tab : 'none');
        GOALS.add(ng ? ng.t.replace(/:.*/, '') : 'none');
        // a tapped road on the map, one of each state
        const st = new Set<string>();
        for (const x of c.dmap!.roads) {
          if (st.has(x.st)) continue;
          st.add(x.st);
          P.UI.road = x.id;
          const h: string = P.mapTab(), i = h.indexOf('border:2px solid var(--ink)');
          const m = h.slice(i).match(/<b class="grow">(.*?)<\/b>.*?<div class="small muted">(.*?)<\/div>/)!;
          const un = (t: string) => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
          const j = x.jobId ? c.jobs.find((y) => y.id === x.jobId) : null;
          same(`week ${W} road ${x.st}`, x.n + ' | ' + roadNote(x, j ? jobTitle(j) : null), un(m[1]!) + ' | ' + un(m[2]!));
          ROADS.add(x.st);
        }
        P.UI.road = null;
      });
      S = P.getS();
    }
    return { weeks, diff: null, at, S, c };
  } catch (e) {
    return { weeks: 0, diff: (e as Error).message, at, S: P.getS() };
  } finally {
    Math.random = keep;
  }
}

/** The kinds of card whose words were checked. */
const SEEN = new Set<string>();
/** The kinds of docket line that were checked. */
const EVENTS = new Set<string>();
let FLAGS = 0;
/** The kinds of goal line read. */
const GOALS = new Set<string>();
/** How many weeks each run-on went. */
const RUNS: number[] = [];
/** The kinds of diary and news entry that were checked. */
const KINDS = new Set<string>();
/** The road states whose words were checked. */
const ROADS = new Set<string>();

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
    console.log('cards worded: ' + [...SEEN].sort().join(', '));
    console.log('docket lines: ' + [...EVENTS].sort().join(', '));
    console.log('goal lines: ' + [...GOALS].sort().join(', '));
    console.log('run on: ' + RUNS.length + ' runs, lengths ' + [1, 2, 3, 4].map((n) => n + ':' + RUNS.filter((x) => x === n).length).join(' '));
    expect(new Set(RUNS).size).toBeGreaterThanOrEqual(3);
    console.log('diary kinds: ' + [...KINDS].sort().join(', '));
    console.log('roads worded: ' + [...ROADS].sort().join(', '));
    expect(ROADS.size).toBe(6);
    expect(FLAGS).toBeGreaterThan(1000);
    expect(LTI_STORIES.length).toBe(4);
  });
});

describe('seasons', () => {
  it('each season plays the same as the prototype, and its recorded moves replay to the same score', () => {
    const out: string[] = [];
    for (const D of SEASONS) {
      for (const seed of [11, 22, 33]) {
        const r = sideBySide(seed, { loan: D.loan, town: D.town, hc: false, season: D.id }, 120);
        if (r.diff) { console.log(out.join(' // ')); expect(r.diff).toBeNull(); }
        const c = r.c, S = r.S;
        expect(c.phase).toBe('seasonEnd');
        expect(c.season.score).toBe(S.season.score);
        expect(c.season.done).toBe(S.season.done);
        // the server's check: play the recording again from nothing
        const re = replaySeason(D.id, JSON.parse(JSON.stringify(c.alog)));
        expect(re).toEqual({ ok: true, score: c.season.score, week: c.season.done });
        out.push(`${D.id} seed ${seed}: ${c.season.score >= 0 ? '+' : ''}${c.season.score} in ${c.season.done} weeks, ${c.alog.length} moves`);
      }
    }
    console.log(out.join(' // '));
  });

  it('a doctored recording does not replay to the claimed score', () => {
    const D = SEASONS[0]!, r = sideBySide(44, { loan: D.loan, town: D.town, hc: false, season: D.id }, 120), moves = JSON.parse(JSON.stringify(r.c.alog));
    expect(replaySeason(D.id, [...moves, ['giveMeMoney', 1e9]]).ok).toBe(true);
    // a move that isn't a command is refused outright, wherever it sits
    expect(replaySeason(D.id, [['giveMeMoney', 1e9], ...moves])).toEqual({ ok: false, why: 'unknown move' });
    // dropping moves changes the result (or never finishes the season)
    const cut = replaySeason(D.id, moves.filter((m: any[]) => m[0] !== 'buy'));
    expect(cut.ok && cut.score === r.c.season.score).toBe(false);
    expect(replaySeason('nope', moves).ok).toBe(false);
  });
});
