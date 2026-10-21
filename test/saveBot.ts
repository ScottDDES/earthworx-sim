// A plain bot that plays the real game through the engine's own moves: takes hire work, prices every tender
// at the default, quotes every bulk enquiry, answers each card with its first choice, and ends the week.
// Kept simple and only uses moves every build has had, so old builds can make saves with it too.

import { choose, game } from '../src';

type Career = game.Career;

/** A new career with its first machine bought and the doors open. */
export function startCareer(seed: number, o: { town: 'gdi' | 'ct'; loan: number; hc?: boolean; bulk?: boolean }): Career {
  const g = game as any;
  const c = game.newCareer({ co: 'Save Bot ' + seed, loan: o.loan, town: o.town, hc: !!o.hc, ...(o.bulk ? { path: 'bulk', bulk: true } : {}) } as never, seed);
  const L = (c.market?.listings || []) as { id: string; type: string; price: number }[];
  const first = L.filter((m) => (o.bulk ? m.type !== 'grader' : m.type === 'grader')).sort((a, b) => a.price - b.price)[0];
  if (first) game.buy(c, first.id);
  game.open(c);
  if (o.bulk && !c.path) g.setPack?.(c, 'bulk', true);
  return c;
}

/** Plays n weeks. `look` sees every card before it's answered and every week's report. */
export function playWeeks(c: Career, n: number, look?: { card?: (c: Career, q: any) => void; report?: (c: Career, r: any) => void }): void {
  const g = game as any;
  for (let w = 0; w < n && c.phase !== 'bust' && c.phase !== 'sold'; w++) {
    for (const o of (c.offers || []).slice()) game.accept(c, o.id);
    // grow: a full road crew, then trucks, with money to spare; a hand for each machine
    // a bigger yard when this one's full
    for (const y of ['fenced', 'depot', 'regional']) if (c.yard !== y && w % 6 === 3 && c.bank > 120000) (game as any).moveYard?.(c, y);
    if (w % 6 === 0 && c.bank > 140000) {
      const have = (t: string) => c.fleet.filter((m) => m.type === t).length;
      const want = ['grader', 'roller', 'cart', 'truck', 'roller', 'grader', 'truck'].find((t, i, A) => have(t) < A.slice(0, i + 1).filter((x) => x === t).length);
      const l = want && ((c.market?.listings || []) as any[]).filter((m) => m.type === want).sort((x, y) => x.price - y.price)[0];
      if (l && l.price < c.bank - 80000) game.buy(c, l.id);
    }
    if (c.staff.length < c.fleet.length - 1 && c.cands?.[0] && c.bank > 60000) game.hireCand(c, c.cands[0].id);
    for (const t of (c.tenders || []) as any[]) if (!t.bid) game.submitBid(c, t.id);
    for (const t of ((c as any).ctenders || []) as any[]) if (!t.bid) game.submitCouncil(c, t.id);
    for (const e of ((c as any).bulk?.enq || []) as any[]) if (!e.quoted) { g.damSurvey?.(c, e.id); g.damQuote?.(c, e.id); }
    for (let k = 0; c.queue.length && k < 30; k++) { look?.card?.(c, c.queue[0]); choose(c, 0); }
    const r = game.endWeek(c);
    if (r) look?.report?.(c, r);
  }
}
