// A simple bot that plays the prototype, so tests can check the engine against real, lived-in careers:
// history, GST owing, loans, debts, contracts half done. It's the prototype's own code making every move.

import type { Proto } from './prototype';

/** The same small generator the prototype uses, for replacing Math.random while the bot plays. */
function mulberry(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BotOpts {
  loan: number;
  town: 'gdi' | 'ct';
  hc?: boolean;
  weeks: number;
  /** Called after each week with the prototype's career (live, not a copy). Return false to stop. */
  each?: (S: any, week: number) => boolean | void;
}

/**
 * Plays a career in the prototype: buys a grader, then each week takes what hire work it can, prices
 * every tender at the default margin, hires the odd hand and machine when there's money, answers every card
 * with its first choice, and ends the week.
 */
export function playProto(P: Proto, seed: number, o: BotOpts): any {
  const keep = Math.random;
  Math.random = mulberry(seed);
  try {
    P.UI.setup = { step: 1, co: 'Bot Earthmoving', loan: o.loan, town: o.town, hc: !!o.hc };
    P.start();
    let S = P.getS();
    const cheapest = (type: string) => (S.market.listings || []).filter((m: any) => m.type === type).sort((a: any, b: any) => a.price - b.price)[0];
    const g = cheapest('grader');
    if (g) P.buy(g.id);
    S.phase = 'play';
    S.queue = [];
    S.coach = { off: true };
    for (let w = 0; w < o.weeks && S.phase === 'play'; w++) {
      // cards first: the week won't end with any waiting
      for (let guard = 0; S.queue.length && guard < 20; guard++) P.choose(0);
      for (const of of (S.offers || []).slice()) if (!P.whyNot(of)) P.accept(of.id);
      for (const t of S.tenders || []) if (!t.bid) P.submitBid(t.id);
      for (const t of S.ctenders || []) if (!t.bid) P.submitCouncil(t.id);
      // grow a little when there's money about
      if (S.bank > 120000 && S.fleet.length < 10) {
        const need = ['roller', 'cart', 'grader', 'cart', 'truck'].find((k) => S.fleet.filter((m: any) => m.type === k).length < (k === 'cart' ? 2 : 1)) || 'grader';
        const m = cheapest(need);
        if (m) P.buy(m.id);
      }
      if (S.bank > 80000 && (S.cands || []).length && (S.staff || []).length < 4) P.hireCand(S.cands[0].id);
      for (let guard = 0; S.queue.length && guard < 20; guard++) P.choose(0);
      P.endWeek();
      S = P.getS();
      if (o.each && o.each(S, S.week) === false) break;
    }
    return S;
  } finally {
    Math.random = keep;
  }
}

/** The prototype's accounts, in the engine's names. */
export function accFromProto(A: any) {
  return {
    openingBank: A.b0, jobCosts: A.jc || 0, jobCostsOwed: A.jco || 0, workshop: A.ws || 0, capital: A.cap || 0, loan: A.loan || 0,
    collections: A.coll || 0, machineDays: A.md || 0, breakdowns: A.brk || 0, badDebts: A.bd || 0, branch: A.br || 0, gst: A.gst || 0,
  };
}
