// Answering the card at the front of the queue. Each kind of card offers its options in the same order as
// the prototype (some only when they apply). The card's own numbers roll on its seed, set the first time it's
// drawn; what happens after the choice rolls on the career's stream. Each option has a short id: screens look
// up its words in text/cards.ts.

import { stream, room, hasCrew, tax, tickets, mood, type Career } from './game';
import { hashN, seedRand, type Rand } from './rng';
import { lateChase, lateFriendly, latePark, lateWait, release, stars, type Job } from './hire';
import { TOWNS } from './towns';
import { mgrIs } from './managers';
import { value } from './machines';
import { lendCap } from './market';
import { fleetValue } from './overheads';
import { nearMissCard, nearMissReport, nearMissShrug, quietDaysOff, quietLeave, quietYarn, seriousCard, seriousHide, seriousNotify, swmsPay, swmsSelf } from './safety';
import { dryDamBore, dryDamFar, dryDamFarMore, gravelArgue, gravelCart, gravelWork, pitFar, pitFarmer, staffOwn, staffSubs, swapCardKeep, swapIn, variationFree, variationLodge, variationWriting } from './contracts';
import { breakCard, breakFix, breakinCamera, breakinClaim, breakinWithout, callGrader, calloutPull, callWork, clearingBorrow, clearingCash, earlyClient, earlyTake, extraAgree, extraAsk, extraFree, hurtCover, hurtHome, hurtKeepGoing, rainCrews, rainDecide, svcFindDays, svcFix, svcPatch, turnoverKeep, turnoverSell } from './cards';
import { bankMoreTime, basPay, basPlan, basPlanOk, gstInBank, odLimit, repossess } from './office';
import { weeklyRepay } from './bank';
import { askSellUp, buyOutAll, buyOutBest, buyOutOffer, buyOutPay, canBuyOut, collapseCard, collapseClaim, collapseSell, insureBroker, sellAll, sellBest, sellBuyer, sellTwo } from './shocks';
import { brRaise, brTender, brTenderCard } from './branch';
import { pullOut, signSub } from './tenders';
import { pullOutCouncil, signOwn } from './council';
import { checkWin, rung, tcAdd } from './career';

/** A card option: a short id (its words are in text/cards.ts) and what it does. */
export interface CardOpt {
  id: string;
  go: () => void;
}
const o = (id: string, go: () => void): CardOpt => ({ id, go });

/** The card's seed: set the first time it's drawn, from the career's seed, the week, the card and where it sits. */
function cardSeed(c: Career, q: Career['queue'][number]): number {
  if (q.sd == null) q.sd = hashN((c.rngSeed || '') + '|' + c.week + '|' + q.k + '|' + (q.id || q.name || '') + '|' + c.queue.indexOf(q)) + 1;
  return q.sd;
}

const jobOf = (c: Career, id?: string) => c.jobs.find((j) => j.id === id);
const machOf = (c: Career, id?: string | null) => c.fleet.find((m) => m.id === id);

/** The options a card offers right now, or null when it no longer applies. Drawing it can mark a job as asked. */
export function cardOptions(c: Career, q: Career['queue'][number]): CardOpt[] | null {
  const cr: Rand = seedRand(cardSeed(c, q)), r = () => stream(c);
  const st = c as never;
  switch (q.k) {
    case 'swms':
      return [o('pay', () => swmsPay(st)), o('self', () => swmsSelf(st))];
    case 'serious': {
      const sj0 = c.jobs.find((j) => j.state === 'running' && !j.finished && (j.kind === 'sub' || j.kind === 'own')) || c.jobs.find((j) => !j.finished && !j.after);
      const card = seriousCard(cr, q.who ?? null, c.whs.sys, c.fleet.length, sj0 ? sj0.id : null);
      return [
        o('notify', () => { seriousNotify(st, card); if (sj0) sj0.stood = 1; }),
        o('hide', () => { seriousHide(r(), st, card, TOWNS[c.town].council); }),
      ];
    }
    case 'nearmiss': {
      const card = nearMissCard(cr, rainCrews(c.jobs));
      return [o('report', () => nearMissReport(st, card)), o('shrug', () => nearMissShrug(st))];
    }
    case 'quiet': {
      const p = c.staff.find((x) => x.id === q.id);
      if (!p) return null;
      return [
        o('yarn', () => { tcAdd(st, 'yarn'); quietYarn(r(), st, p); }),
        o('daysOff', () => { tcAdd(st, 'yarn'); quietDaysOff(st, p); }),
        o('leave', () => { quietLeave(r(), st, p); }),
      ];
    }
    case 'turnover': {
      const m = machOf(c, q.id);
      if (!m || m.status !== 'idle') return null;
      const vv = value(m, c.week), dl = mgrIs(c.staff, 'dealer');
      return [o('auction', () => turnoverSell(r(), m, 'auction', vv, dl)), o('list', () => turnoverSell(r(), m, 'list', vv, dl)), o('keep', () => turnoverKeep(st, m))];
    }
    case 'svcfind': {
      const m = machOf(c, q.id);
      if (!m) return null;
      const dd = svcFindDays(cr, q.by ?? null);
      return [o('fix', () => svcFix(st, m, q.fix, dd)), o('patch', () => svcPatch(st, m, q.part, q.fix))];
    }
    case 'swapin': {
      const j = jobOf(c, q.id);
      if (!j || j.finished || j.state !== 'running' || !j.gap || !((j.gap as Record<string, number>)[q.type]! > 0)) return null;
      const m = c.fleet.find((x) => x.type === q.type && x.status === 'idle' && x.down === 0);
      if (!m) return null;
      return [o('putOn', () => swapIn(st, j, m, q.type)), o('keepFree', () => swapCardKeep(st, j, q.type))];
    }
    case 'rainday':
      if (q.w !== c.week || !rainCrews(c.jobs)) return null;
      return [o('standDown', () => rainDecide(st, q as never, false)), o('pushOn', () => rainDecide(st, q as never, true))];
    case 'break': {
      const m = machOf(c, q.id);
      if (!m) return null;
      const card = breakCard(cr, st, m), j = jobOf(c, m.jobId ?? undefined), out: CardOpt[] = [];
      if (card.warranty) out.push(o('warranty', () => breakFix(st, m, card, 'warranty')));
      out.push(o('mobile', () => breakFix(st, m, card, 'mobile')), o('dealer', () => breakFix(st, m, card, 'dealer')));
      if (j && j.kind !== 'dry' && !card.warranty) out.push(o('hireIn', () => breakFix(st, m, card, 'hireIn')));
      return out;
    }
    case 'brtender':
    case 'brraise': {
      const B = c.branch;
      if (!B || !B.mgr) return null;
      if (q.k === 'brtender') {
        const card = brTenderCard(cr);
        return [o('sharp', () => brTender(r(), st, card, true)), o('proper', () => brTender(r(), st, card, false)), o('letGo', () => {})];
      }
      return [o('pay', () => brRaise(r(), st, true)), o('no', () => brRaise(r(), st, false))];
    }
    case 'collapse': {
      const card = collapseCard(cr, q.debt);
      return [o('claim', () => collapseClaim(st, q.name, card.dividend)), o('sell', () => collapseSell(st, card.sell))];
    }
    case 'freeze':
      return [o('ok', () => {})];
    case 'insure':
      return [o('wear', () => {}), o('broker', () => insureBroker(r(), st))];
    case 'bankcall': {
      const again = c.bankGrace != null && c.week - c.bankGrace < 26, out: CardOpt[] = [];
      if (!again && !c.hardcore) out.push(o('moreTime', () => bankMoreTime(st, !!q.od)));
      if (sellBuyer(c.rivals)) out.push(o('ringAround', () => askSellUp(st, true)));
      out.push(o('leave', () => {}));
      return out;
    }
    case 'bas': {
      const G = c.gst!, B = G.due.find((d) => d.id === q.id);
      if (!B) return null;
      const mode = tax(c), canPay = c.bank + odLimit(c) >= B.amt, planOk = basPlanOk(G, mode, c.week), out: CardOpt[] = [];
      if (canPay) out.push(o('pay', () => basPay(st, B, false)));
      if (!canPay && !planOk) out.push(o('payAnyway', () => basPay(st, B, true)));
      if (planOk) out.push(o('plan', () => basPlan(st, B, mode)));
      return out;
    }
    case 'yearend':
      if (!(c.years || [])[q.i]) return null;
      return [o('ok', () => {})];
    case 'late': {
      const x = c.recv.find((y) => y.id === q.id);
      if (!x) return null;
      const onHire = c.jobs.find((y) => y.client === x.client);
      return [o('chase', () => lateChase(st, x)), o('friendly', () => { lateFriendly(st, x); }), onHire ? o('park', () => latePark(st, x, onHire, [])) : o('wait', () => { lateWait(r(), st, x); })];
    }
    case 'clearing':
      return [o('borrow', () => clearingBorrow(r(), st)), o('cash', () => { clearingCash(r(), st); }), o('skip', () => {})];
    case 'hurt': {
      const p = c.staff.find((x) => x.id === q.id);
      if (!p) return null;
      return [o('home', () => hurtHome(p)), o('cover', () => hurtCover(st, p)), o('keepGoing', () => { hurtKeepGoing(r(), st, p); })];
    }
    case 'breakin':
      return [o('claim', () => breakinClaim(st)), o('camera', () => breakinCamera(st)), o('without', () => { breakinWithout(r(), st); })];
    case 'extra': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.extraAsked = true;
      return [o('ask', () => { extraAsk(r(), j); }), o('agree', () => extraAgree(j)), o('free', () => extraFree(st, j))];
    }
    case 'callout': {
      const g = callGrader(st);
      if (!g) return null;
      const gj = g.jobId ? jobOf(c, g.jobId) : undefined;
      return [gj ? o('pullOff', () => { calloutPull(r(), st, g, gj); }) : o('go', () => callWork(st, g)), o('flatOut', () => {})];
    }
    case 'early': {
      const ec = earlyClient(st);
      if (!ec) return null;
      return [o('take', () => { earlyTake(st, ec); }), o('wait', () => {})];
    }
    case 'tresult': {
      const t = q.t;
      if (t.direct && !t.result[0].you) return [o('ok', () => {})];
      if (t.result[0].you) {
        const out: CardOpt[] = [];
        if (hasCrew(c)) out.push(o('sign', () => { signSub(st, t); staffSubs(st, null); }));
        out.push(o('pullOut', () => pullOut(st, t)));
        return out;
      }
      return [o('ok', () => {})];
    }
    case 'cresult': {
      const t = q.t;
      if (t.result[0].you) return [o('sign', () => { signOwn(st, st, t); staffOwn(st, null); }), o('pullOut', () => pullOutCouncil(st))];
      return [o('ok', () => {})];
    }
    case 'variation': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.varAsked = true;
      return [o('lodge', () => { variationLodge(r(), j); }), o('writing', () => variationWriting(j)), o('free', () => variationFree(st, j))];
    }
    case 'gravel': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.gravAsked = true;
      return [o('cart', () => gravelCart(st, j)), o('work', () => { gravelWork(r(), j); }), o('argue', () => { gravelArgue(r(), st, j); })];
    }
    case 'drydam': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.damAsked = true;
      return [o('bore', () => dryDamBore(st, j)), o('far', () => dryDamFar(j)), o('farMore', () => dryDamFarMore(j))];
    }
    case 'pitout': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.pitAsked = true;
      return [o('far', () => pitFar(j, false)), o('farTrucks', () => pitFar(j, true)), o('farmer', () => pitFarmer(st, j))];
    }
    case 'repo':
      return [o('handOver', () => { repossess(st, (j: Job) => release(st, j, []), weeklyRepay); })];
    case 'buyout': {
      const x = c.rivals.find((y) => y.name === q.name);
      if (!x || !canBuyOut(st)) return null;
      const of = buyOutOffer(cr, st, x), cap = lendCap(fleetValue(c.fleet, c.week), c.won, c.won2, c.won3);
      const pa = buyOutPay(st, of.price, of.v, cap), pb = buyOutPay(st, of.bprice, of.bv, cap), out: CardOpt[] = [];
      const rm = () => room(c);
      if (pa.ok) out.push(o('whole', () => { buyOutAll(r(), st, x, of, pa, rm); }));
      if (pb.ok && of.best.length) out.push(o('best', () => { buyOutBest(r(), st, x, of, pb, rm); }));
      out.push(o('letGo', () => {}));
      return out;
    }
    case 'sellup': {
      const x = c.rivals.find((y) => y.name === q.name);
      if (!x || c.phase !== 'play') return null;
      const best = sellBest(st), out: CardOpt[] = [], m = mood(c);
      const held = c.gst && gstInBank(tax(c)) ? c.gst.held : 0;
      if (best.length) out.push(o('two', () => { sellTwo(st, x, m); }));
      out.push(o('all', () => { const g = rung(st); sellAll(st, x, m, stars(c.rep), held, { stage: g, peak: g }); }));
      out.push(o('hold', () => {}));
      return out;
    }
  }
  return null;
}

/** Answer the card at the front of the queue with option i. A card that no longer applies just goes. */
export function choose(c: Career, i: number): boolean {
  const q = c.queue[0];
  if (!q) return false;
  const opts = cardOptions(c, q);
  if (!opts) {
    c.queue.shift();
    return false;
  }
  (opts[i] ?? opts[0]!).go();
  tickets(c);
  c.queue.shift();
  checkWin(c as never);
  return true;
}
