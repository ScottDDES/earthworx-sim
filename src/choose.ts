// Answering the card at the front of the queue. Each kind of card offers its options in the same order as
// the prototype (some only when they apply). The card's own numbers roll on its seed, set the first time it's
// drawn; what happens after the choice rolls on the career's stream.
// Drawing a card gives its options (each with a short id) and its numbers (data); answering it gives what
// happened (result). Screens turn all three into words with text/cardView.ts.

import { mRef, news, note } from './diary';
import { stream, room, hasCrew, tax, tickets, mood, premiumNow, type Career } from './game';
import { hashN, pick, seedRand, type Rand } from './rng';
import { lateChase, lateFriendly, latePark, lateWait, release, stars, type Job } from './hire';
import { TOWNS } from './towns';
import { mgrIs } from './managers';
import { TYPES, overdue, value } from './machines';
import { lendCap } from './market';
import { fleetValue } from './overheads';
import { nearMissCard, nearMissReport, nearMissShrug, quietDaysOff, quietLeave, quietYarn, seriousCard, seriousHide, seriousNotify, swmsPay, swmsSelf } from './safety';
import { dryDamBore, dryDamFar, dryDamFarMore, gravelArgue, gravelCart, gravelCartCost, gravelWork, ownFlow, pitFar, pitFarmer, staffOwn, staffSubs, swapCardKeep, swapIn, variationFree, variationLodge, variationValue, variationWriting } from './contracts';
import { breakCard, breakFix, breakinCamera, breakinClaim, breakinWithout, callGrader, calloutPull, callWork, clearingBorrow, clearingCash, earlyClient, earlyTake, extraAgree, extraAsk, extraFree, hurtCover, hurtHome, hurtKeepGoing, rainCrews, rainDecide, svcFindDays, svcFix, svcPatch, turnoverKeep, turnoverSell } from './cards';
import { bankMoreTime, basInterest, basPay, basPlan, basPlanOk, gstInBank, odLimit, repoPick, repossess } from './office';
import { weeklyRepay } from './bank';
import { askSellUp, buyOutAll, buyOutBest, buyOutOffer, buyOutPay, canBuyOut, collapseCard, collapseClaim, collapseSell, insureBroker, sellAll, sellBest, sellBuyer, sellGear, sellPrice, sellTwo, walkAway } from './shocks';
import { brRaise, brTender, brTenderCard } from './branch';
import { pullOut, signSub } from './tenders';
import { pullOutCouncil, signOwn } from './council';
import { checkWin, rung, tcAdd } from './career';
import { crewMul, flow, hm } from './planning';

/** A card option: a short id (its words are in text/cards.ts) and what it does. go returns what happened, if it's worth saying. */
export interface CardOpt {
  id: string;
  go: () => unknown;
}
const o = (id: string, go: () => unknown): CardOpt => ({ id, go });

/** A drawn card: its options, and the numbers on it. */
export interface DrawnCard {
  opts: CardOpt[];
  data: Record<string, any>;
}

/** The card's seed: set the first time it's drawn, from the career's seed, the week, the card and where it sits. */
function cardSeed(c: Career, q: Career['queue'][number]): number {
  if (q.sd == null) q.sd = hashN((c.rngSeed || '') + '|' + c.week + '|' + q.k + '|' + (q.id || q.name || '') + '|' + c.queue.indexOf(q)) + 1;
  return q.sd;
}

const jobOf = (c: Career, id?: string | null) => c.jobs.find((j) => j.id === id);
const machOf = (c: Career, id?: string | null) => c.fleet.find((m) => m.id === id);
/** Who someone is, by name: you, one of your staff, or a casual. */
const whoName = (c: Career, who?: string | null): string => (who === 'you' ? 'You' : c.staff.find((p) => p.id === who)?.name ?? 'A casual');

function draw(c: Career, q: Career['queue'][number], data: Record<string, any>): CardOpt[] | null {
  const cr: Rand = seedRand(cardSeed(c, q)), r = () => stream(c);
  const st = c as never;
  switch (q.k) {
    case 'swms':
      return [o('pay', () => swmsPay(st)), o('self', () => swmsSelf(st))];
    case 'serious': {
      const sj0 = c.jobs.find((j) => j.state === 'running' && !j.finished && (j.kind === 'sub' || j.kind === 'own')) || c.jobs.find((j) => !j.finished && !j.after);
      const card = seriousCard(cr, q.who ?? null, c.whs.sys, c.fleet.length, sj0 ? sj0.id : null);
      const fsz = Math.min(1, 0.25 + c.fleet.length / 10);
      Object.assign(data, { card, job: sj0, who: q.who ?? null, sys: c.whs.sys, fineLo: Math.round(20000 * fsz / 1000) * 1000, fineHi: Math.round(60000 * fsz / 1000) * 1000 });
      return [
        o('notify', () => {
          const nm = whoName(c, q.who);
          seriousNotify(st, card);
          if (sj0) sj0.stood = 1;
          note(c, { k: 'seriousNotified', name: nm, story: card.story, fine: card.fine });
          news(c, { k: 'regulator', co: c.co });
          return card.fine;
        }),
        o('hide', () => {
          const res = seriousHide(r(), st, card, TOWNS[c.town].council);
          if (res.found) news(c, { k: 'unreportedFine', co: c.co, fine: res.fine });
          return res;
        }),
      ];
    }
    case 'nearmiss': {
      const card = nearMissCard(cr, rainCrews(c.jobs));
      Object.assign(data, { card, job: c.jobs.find((j) => j.state === 'running' && !j.finished && (j.kind === 'sub' || j.kind === 'own')) });
      return [o('report', () => nearMissReport(st, card)), o('shrug', () => nearMissShrug(st))];
    }
    case 'quiet': {
      const p = c.staff.find((x) => x.id === q.id);
      if (!p) return null;
      data.person = p;
      return [
        o('yarn', () => { tcAdd(st, 'yarn'); return quietYarn(r(), st, p); }),
        o('daysOff', () => { tcAdd(st, 'yarn'); quietDaysOff(st, p); }),
        o('leave', () => quietLeave(r(), st, p)),
      ];
    }
    case 'turnover': {
      const m = machOf(c, q.id);
      if (!m || m.status !== 'idle') return null;
      const vv = value(m, c.week), dl = mgrIs(c.staff, 'dealer');
      Object.assign(data, { m, value: vv, listPrice: Math.round((vv * 0.95 * (dl ? 1.05 : 1)) / 500) * 500, by: q.by });
      return [o('auction', () => { turnoverSell(r(), m, 'auction', vv, dl); note(c, { k: 'toAuctionAdvice', m: mRef(m), by: q.by }); }), o('list', () => turnoverSell(r(), m, 'list', vv, dl)), o('keep', () => turnoverKeep(st, m))];
    }
    case 'svcfind': {
      const m = machOf(c, q.id);
      if (!m) return null;
      const dd = svcFindDays(cr, q.by ?? null);
      Object.assign(data, { m, dd, job: jobOf(c, m.jobId), part: q.part, fix: q.fix, by: q.by ?? null, patch: Math.round((q.fix * 0.15) / 50) * 50 });
      return [o('fix', () => svcFix(st, m, q.fix, dd)), o('patch', () => svcPatch(st, m, q.part, q.fix))];
    }
    case 'swapin': {
      const j = jobOf(c, q.id);
      if (!j || j.finished || j.state !== 'running' || !j.gap || !((j.gap as Record<string, number>)[q.type]! > 0)) return null;
      const m = c.fleet.find((x) => x.type === q.type && x.status === 'idle' && x.down === 0);
      if (!m) return null;
      Object.assign(data, { j, m, type: q.type, wet: hm(j as never, q.type) === 'wet' && !j.prog, ops: !!c.won2 && !c.staff.some((p) => p.role === 'ops' && p.off === 0) });
      return [o('putOn', () => swapIn(st, j, m, q.type)), o('keepFree', () => swapCardKeep(st, j, q.type))];
    }
    case 'rainday':
      if (q.w !== c.week || !rainCrews(c.jobs)) return null;
      Object.assign(data, { crews: rainCrews(c.jobs), d: q.d, fmm: q.fmm, pc: q.pc });
      return [o('standDown', () => rainDecide(st, q as never, false)), o('pushOn', () => rainDecide(st, q as never, true))];
    case 'break': {
      const m = machOf(c, q.id);
      if (!m) return null;
      const card = breakCard(cr, st, m), j = jobOf(c, m.jobId), out: CardOpt[] = [];
      Object.assign(data, { card, m, job: j, overdue: overdue(m), patched: m.bandBroke ?? null });
      if (card.warranty) out.push(o('warranty', () => breakFix(st, m, card, 'warranty')));
      out.push(o('mobile', () => breakFix(st, m, card, 'mobile')), o('dealer', () => breakFix(st, m, card, 'dealer')));
      if (j && j.kind !== 'dry' && !card.warranty) out.push(o('hireIn', () => breakFix(st, m, card, 'hireIn')));
      return out;
    }
    case 'brtender':
    case 'brraise': {
      const B = c.branch;
      if (!B || !B.mgr) return null;
      Object.assign(data, { town: B.town, mgr: B.mgr.name });
      if (q.k === 'brtender') {
        const card = brTenderCard(cr);
        data.card = card;
        const go = (sharp: boolean) => () => { const won = brTender(r(), st, card, sharp); if (won) note(c, { k: 'brWon', town: B.town, val: card.val }); return won; };
        return [o('sharp', go(true)), o('proper', go(false)), o('letGo', () => {})];
      }
      return [o('pay', () => brRaise(r(), st, true)), o('no', () => { const nm = B.mgr!.name, res = brRaise(r(), st, false); if (res === 'quit') note(c, { k: 'brQuit', name: nm, town: B.town }); return res; })];
    }
    case 'collapse': {
      const card = collapseCard(cr, q.debt);
      Object.assign(data, { card, name: q.name, debt: q.debt, week: c.week });
      return [o('claim', () => collapseClaim(st, q.name, card.dividend)), o('sell', () => collapseSell(st, card.sell))];
    }
    case 'freeze':
      data.until = q.until;
      return [o('ok', () => {})];
    case 'insure':
      data.premium = premiumNow(c);
      return [o('wear', () => {}), o('broker', () => insureBroker(r(), st))];
    case 'bankcall': {
      const again = c.bankGrace != null && c.week - c.bankGrace < 26, out: CardOpt[] = [];
      Object.assign(data, { od: !!q.od, again, hc: !!c.hardcore });
      if (!again && !c.hardcore) out.push(o('moreTime', () => { bankMoreTime(st, !!q.od); note(c, { k: 'moreTime', fee: 750 }); }));
      if (sellBuyer(c.rivals)) out.push(o('ringAround', () => askSellUp(st, true)));
      out.push(o('leave', () => {}));
      return out;
    }
    case 'bas': {
      const G = c.gst!, B = G.due.find((d) => d.id === q.id);
      if (!B) return null;
      const mode = tax(c), canPay = c.bank + odLimit(c) >= B.amt, planOk = basPlanOk(G, mode, c.week), out: CardOpt[] = [];
      Object.assign(data, { B, canPay, planOk, hc: mode === 'hardcore', interest: basInterest(B.amt, mode), plans: G.plans, short: c.bank < B.amt });
      const qd = { qm: B.qm, qy: B.qy, amt: B.amt };
      if (canPay) out.push(o('pay', () => { basPay(st, B, false); note(c, { k: 'basPaid', ...qd }); }));
      if (!canPay && !planOk) out.push(o('payAnyway', () => { basPay(st, B, true); note(c, { k: 'basTaken', ...qd }); }));
      if (planOk) out.push(o('plan', () => { const each = basPlan(st, B, mode); note(c, { k: 'basPlan', ...qd, each }); return each; }));
      return out;
    }
    case 'yearend': {
      const Yr = (c.years || [])[q.i];
      if (!Yr) return null;
      Object.assign(data, { y: Yr, prev: (c.years || [])[q.i - 1] ?? null });
      return [o('ok', () => {})];
    }
    case 'late': {
      const x = c.recv.find((y) => y.id === q.id);
      if (!x) return null;
      const onHire = c.jobs.find((y) => y.client === x.client);
      Object.assign(data, { x, onHire, weekly: c.loan.weekly, amt: x.amt });
      return [o('chase', () => lateChase(st, x)), o('friendly', () => lateFriendly(st, x)), onHire ? o('park', () => latePark(st, x, onHire, [])) : o('wait', () => lateWait(r(), st, x))];
    }
    case 'clearing':
      Object.assign(data, { place: pick(cr, TOWNS[c.town].places), bank: c.bank });
      return [
        o('borrow', () => { clearingBorrow(r(), st); note(c, { k: 'clearing', price: 49500 }); return c.loan.weekly; }),
        o('cash', () => { const got = clearingCash(r(), st); if (got) note(c, { k: 'clearing', price: 46000 }); return got; }),
        o('skip', () => {}),
      ];
    case 'hurt': {
      const p = c.staff.find((x) => x.id === q.id);
      if (!p) return null;
      data.person = p;
      return [o('home', () => hurtHome(p)), o('cover', () => hurtCover(st, p)), o('keepGoing', () => { const hurt = hurtKeepGoing(r(), st, p); if (hurt) note(c, { k: 'badBack', name: p.name }); return hurt; })];
    }
    case 'breakin':
      data.home = c.yard === 'home';
      return [o('claim', () => breakinClaim(st)), o('camera', () => breakinCamera(st)), o('without', () => breakinWithout(r(), st))];
    case 'extra': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.extraAsked = true;
      data.job = j;
      return [o('ask', () => extraAsk(r(), j)), o('agree', () => extraAgree(j)), o('free', () => extraFree(st, j))];
    }
    case 'callout': {
      const g = callGrader(st);
      if (!g) return null;
      const gj = jobOf(c, g.jobId);
      Object.assign(data, { g, job: gj, place: pick(cr, TOWNS[c.town].places), council: TOWNS[c.town].council });
      return [gj ? o('pullOff', () => calloutPull(r(), st, g, gj)) : o('go', () => callWork(st, g)), o('flatOut', () => {})];
    }
    case 'early': {
      const ec = earlyClient(st);
      if (!ec) return null;
      const tot = c.recv.filter((y) => y.client === ec && y.due < 9999).reduce((a, y) => a + y.amt, 0);
      Object.assign(data, { client: ec, total: tot, net: Math.round(tot * 0.97) });
      return [o('take', () => earlyTake(st, ec)), o('wait', () => {})];
    }
    case 'tresult': {
      const t = q.t, top = t.result[0], me = t.result.find((e: { you: boolean }) => e.you);
      Object.assign(data, { t, top, me, won: !!top.you, direct: !!t.direct, week: c.week, crew: hasCrew(c), diff: me ? Math.round((me.price / top.price - 1) * 100) : 0 });
      if (t.direct && !top.you) return [o('ok', () => {})];
      if (top.you) {
        const out: CardOpt[] = [];
        if (hasCrew(c)) out.push(o('sign', () => { signSub(st, t); staffSubs(st, null); }));
        out.push(o('pullOut', () => pullOut(st, t)));
        return out;
      }
      return [o('ok', () => {})];
    }
    case 'cresult': {
      const t = q.t, top = t.result[0], me = t.result.find((e: { you: boolean }) => e.you);
      Object.assign(data, { t, top, me, won: !!top.you, diff: me ? Math.round((me.price / top.price - 1) * 100) : 0 });
      if (top.you) return [o('sign', () => { signOwn(st, st, t); staffOwn(st, null); }), o('pullOut', () => pullOutCouncil(st))];
      return [o('ok', () => {})];
    }
    case 'variation': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.varAsked = true;
      Object.assign(data, { job: j, value: variationValue(j) });
      return [o('lodge', () => variationLodge(r(), j)), o('writing', () => variationWriting(j)), o('free', () => variationFree(st, j))];
    }
    case 'gravel': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.gravAsked = true;
      Object.assign(data, { job: j, cost: gravelCartCost(j) });
      return [o('cart', () => gravelCart(st, j)), o('work', () => gravelWork(r(), j)), o('argue', () => gravelArgue(r(), st, j))];
    }
    case 'drydam': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.damAsked = true;
      const mul = crewMul(j as never), crews = j.crews as number;
      Object.assign(data, {
        job: j, now: ownFlow(j).wf, further: flow(mul, j.carts as number, j.trucks as number, (j.waterKm as number) + 12, j.haul as number).wf,
        more: flow(mul, (j.carts as number) + 1, j.trucks as number, (j.waterKm as number) + 12, j.haul as number).wf, cartWk: crews * TYPES.cart.dry,
      });
      return [o('bore', () => dryDamBore(st, j)), o('far', () => dryDamFar(j)), o('farMore', () => dryDamFarMore(j))];
    }
    case 'pitout': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.pitAsked = true;
      const mul = crewMul(j as never), far = j.far as { haul: number };
      Object.assign(data, {
        job: j, left: Math.round(Math.max(0, j.sLeft as number)), farHaul: far.haul,
        farSupply: flow(mul, j.carts as number, j.trucks as number, j.waterKm as number, far.haul).supply,
        farSupply2: flow(mul, j.carts as number, (j.trucks as number) + 2, j.waterKm as number, far.haul).supply,
      });
      return [o('far', () => pitFar(j, false)), o('farTrucks', () => pitFar(j, true)), o('farmer', () => pitFarmer(st, j))];
    }
    case 'repo': {
      const best = repoPick(c.fleet, c.week);
      Object.assign(data, { od: !!q.od, m: best, got: best ? Math.round(value(best, c.week) * 0.6) : 0 });
      return [o('handOver', () => { repossess(st, (j: Job) => release(st, j, []), weeklyRepay); return c.loan.weekly; })];
    }
    case 'buyout': {
      const x = c.rivals.find((y) => y.name === q.name);
      if (!x || !canBuyOut(st)) return null;
      const of = buyOutOffer(cr, st, x), cap = lendCap(fleetValue(c.fleet, c.week), c.won, c.won2, c.won3);
      const pa = buyOutPay(st, of.price, of.v, cap), pb = buyOutPay(st, of.bprice, of.bv, cap), out: CardOpt[] = [];
      const rm = () => room(c);
      Object.assign(data, { x, offer: of, pa, pb, fit: Math.max(0, room(c)) });
      if (pa.ok) out.push(o('whole', () => buyOutAll(r(), st, x, of, pa, rm)));
      if (pb.ok && of.best.length) out.push(o('best', () => buyOutBest(r(), st, x, of, pb, rm)));
      out.push(o('letGo', () => {}));
      return out;
    }
    case 'sellup': {
      const x = c.rivals.find((y) => y.name === q.name);
      if (!x || c.phase !== 'play') return null;
      const best = sellBest(st), out: CardOpt[] = [], m = mood(c);
      const held = c.gst && gstInBank(tax(c)) ? c.gst.held : 0, sp = sellPrice(st, m, stars(c.rep));
      Object.assign(data, {
        x, asked: !!q.asked, mood: m, sp, walk: walkAway(st, sp.price, held), best, bv: best.reduce((a, b) => a + value(b, c.week), 0),
        gear: sellGear(c.fleet).length, staff: c.staff.length, jobs: c.jobs.filter((j) => !j.finished).length, stars: stars(c.rep),
        why: c.loan.missed ? 'missed' : c.odOver ? 'over' : 'deep', missed: c.loan.missed,
      });
      data.bprice = Math.round((data.bv * 0.72 * ({ boom: 1.08, steady: 1, tight: 0.93, bust: 0.85 } as Record<string, number>)[m]!) / 500) * 500;
      if (best.length) out.push(o('two', () => sellTwo(st, x, m)));
      out.push(o('all', () => { const g = rung(st); sellAll(st, x, m, stars(c.rep), held, { stage: g, peak: g }); }));
      out.push(o('hold', () => {}));
      return out;
    }
  }
  return null;
}

/** Draw the card: its options and its numbers, or null when it no longer applies. Drawing it can mark a job as asked. */
export function drawCard(c: Career, q: Career['queue'][number]): DrawnCard | null {
  const data: Record<string, any> = {};
  const opts = draw(c, q, data);
  return opts ? { opts, data } : null;
}

/** Just the options. */
export function cardOptions(c: Career, q: Career['queue'][number]): CardOpt[] | null {
  return drawCard(c, q)?.opts ?? null;
}

export interface Answer {
  q: Career['queue'][number];
  id: string;
  data: Record<string, any>;
  result: unknown;
  /** Tickets earned by this choice. */
  tix: string[];
}

/** Answer the card at the front of the queue with option i. A card that no longer applies just goes. */
export function choose(c: Career, i: number): Answer | null {
  const q = c.queue[0];
  if (!q) return null;
  const d = drawCard(c, q);
  if (!d) {
    c.queue.shift();
    return null;
  }
  const op = d.opts[i] ?? d.opts[0]!;
  const result = op.go();
  const tix = tickets(c);
  c.queue.shift();
  checkWin(c as never);
  return { q, id: op.id, data: d.data, result, tix };
}
