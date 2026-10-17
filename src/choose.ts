// Answering the card at the front of the queue. Each kind of card offers its options in the same order as
// the prototype (some only when they apply). The card's own numbers roll on its seed, set the first time it's
// drawn; what happens after the choice rolls on the career's stream.

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
import { bankMoreTime, basPay, basPlan, basPlanOk, odLimit, repossess } from './office';
import { weeklyRepay } from './bank';
import { askSellUp, buyOutAll, buyOutBest, buyOutOffer, buyOutPay, canBuyOut, collapseCard, collapseClaim, collapseSell, insureBroker, sellAll, sellBest, sellBuyer, sellTwo } from './shocks';
import { brRaise, brTender, brTenderCard } from './branch';
import { pullOut, signSub } from './tenders';
import { pullOutCouncil, signOwn } from './council';
import { checkWin, rung, tcAdd } from './career';
import { gstInBank } from './office';

type Opt = () => void;

/** The card's seed: set the first time it's drawn, from the career's seed, the week, the card and where it sits. */
function cardSeed(c: Career, q: Career['queue'][number]): number {
  if (q.sd == null) q.sd = hashN((c.rngSeed || '') + '|' + c.week + '|' + q.k + '|' + (q.id || q.name || '') + '|' + c.queue.indexOf(q)) + 1;
  return q.sd;
}

const jobOf = (c: Career, id?: string) => c.jobs.find((j) => j.id === id);
const machOf = (c: Career, id?: string | null) => c.fleet.find((m) => m.id === id);

/** The options a card offers right now, or null when it no longer applies. Drawing it can mark a job as asked. */
export function cardOptions(c: Career, q: Career['queue'][number]): Opt[] | null {
  const cr: Rand = seedRand(cardSeed(c, q)), r = () => stream(c);
  const st = c as never;
  switch (q.k) {
    case 'swms':
      return [() => swmsPay(st), () => swmsSelf(st)];
    case 'serious': {
      const sj0 = c.jobs.find((j) => j.state === 'running' && !j.finished && (j.kind === 'sub' || j.kind === 'own')) || c.jobs.find((j) => !j.finished && !j.after);
      const card = seriousCard(cr, q.who ?? null, c.whs.sys, c.fleet.length, sj0 ? sj0.id : null);
      return [
        () => { seriousNotify(st, card); if (sj0) sj0.stood = 1; },
        () => { seriousHide(r(), st, card, TOWNS[c.town].council); },
      ];
    }
    case 'nearmiss': {
      const card = nearMissCard(cr, rainCrews(c.jobs));
      return [() => nearMissReport(st, card), () => nearMissShrug(st)];
    }
    case 'quiet': {
      const p = c.staff.find((x) => x.id === q.id);
      if (!p) return null;
      return [
        () => { tcAdd(st, 'yarn'); quietYarn(r(), st, p); },
        () => { tcAdd(st, 'yarn'); quietDaysOff(st, p); },
        () => { quietLeave(r(), st, p); },
      ];
    }
    case 'turnover': {
      const m = machOf(c, q.id);
      if (!m || m.status !== 'idle') return null;
      const vv = value(m, c.week), dl = mgrIs(c.staff, 'dealer');
      return [() => turnoverSell(r(), m, 'auction', vv, dl), () => turnoverSell(r(), m, 'list', vv, dl), () => turnoverKeep(st, m)];
    }
    case 'svcfind': {
      const m = machOf(c, q.id);
      if (!m) return null;
      const dd = svcFindDays(cr, q.by ?? null);
      return [() => svcFix(st, m, q.fix, dd), () => svcPatch(st, m, q.part, q.fix)];
    }
    case 'swapin': {
      const j = jobOf(c, q.id);
      if (!j || j.finished || j.state !== 'running' || !j.gap || !((j.gap as Record<string, number>)[q.type]! > 0)) return null;
      const m = c.fleet.find((x) => x.type === q.type && x.status === 'idle' && x.down === 0);
      if (!m) return null;
      return [() => swapIn(st, j, m, q.type), () => swapCardKeep(st, j, q.type)];
    }
    case 'rainday':
      if (q.w !== c.week || !rainCrews(c.jobs)) return null;
      return [() => rainDecide(st, q as never, false), () => rainDecide(st, q as never, true)];
    case 'break': {
      const m = machOf(c, q.id);
      if (!m) return null;
      const card = breakCard(cr, st, m), j = jobOf(c, m.jobId ?? undefined), o: Opt[] = [];
      if (card.warranty) o.push(() => breakFix(st, m, card, 'warranty'));
      o.push(() => breakFix(st, m, card, 'mobile'), () => breakFix(st, m, card, 'dealer'));
      if (j && j.kind !== 'dry' && !card.warranty) o.push(() => breakFix(st, m, card, 'hireIn'));
      return o;
    }
    case 'brtender':
    case 'brraise': {
      const B = c.branch;
      if (!B || !B.mgr) return null;
      if (q.k === 'brtender') {
        const card = brTenderCard(cr);
        return [() => brTender(r(), st, card, true), () => brTender(r(), st, card, false), () => {}];
      }
      return [() => brRaise(r(), st, true), () => brRaise(r(), st, false)];
    }
    case 'collapse': {
      const card = collapseCard(cr, q.debt);
      return [() => collapseClaim(st, q.name, card.dividend), () => collapseSell(st, card.sell)];
    }
    case 'freeze':
      return [() => {}];
    case 'insure':
      return [() => {}, () => insureBroker(r(), st)];
    case 'bankcall': {
      const again = c.bankGrace != null && c.week - c.bankGrace < 26, o: Opt[] = [];
      if (!again && !c.hardcore) o.push(() => bankMoreTime(st, !!q.od));
      if (sellBuyer(c.rivals)) o.push(() => askSellUp(st, true));
      o.push(() => {});
      return o;
    }
    case 'bas': {
      const G = c.gst!, B = G.due.find((d) => d.id === q.id);
      if (!B) return null;
      const mode = tax(c), canPay = c.bank + odLimit(c) >= B.amt, planOk = basPlanOk(G, mode, c.week), o: Opt[] = [];
      if (canPay) o.push(() => basPay(st, B, false));
      if (!canPay && !planOk) o.push(() => basPay(st, B, true));
      if (planOk) o.push(() => basPlan(st, B, mode));
      return o;
    }
    case 'yearend':
      if (!(c.years || [])[q.i]) return null;
      return [() => {}];
    case 'late': {
      const x = c.recv.find((y) => y.id === q.id);
      if (!x) return null;
      const onHire = c.jobs.find((y) => y.client === x.client);
      return [() => lateChase(st, x), () => { lateFriendly(st, x); }, onHire ? () => latePark(st, x, onHire, []) : () => { lateWait(r(), st, x); }];
    }
    case 'clearing':
      return [() => clearingBorrow(r(), st), () => { clearingCash(r(), st); }, () => {}];
    case 'hurt': {
      const p = c.staff.find((x) => x.id === q.id);
      if (!p) return null;
      return [() => hurtHome(p), () => hurtCover(st, p), () => { hurtKeepGoing(r(), st, p); }];
    }
    case 'breakin':
      return [() => breakinClaim(st), () => breakinCamera(st), () => { breakinWithout(r(), st); }];
    case 'extra': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.extraAsked = true;
      return [() => { extraAsk(r(), j); }, () => extraAgree(j), () => extraFree(st, j)];
    }
    case 'callout': {
      const g = callGrader(st);
      if (!g) return null;
      const gj = g.jobId ? jobOf(c, g.jobId) : undefined;
      return [gj ? () => { calloutPull(r(), st, g, gj); } : () => callWork(st, g), () => {}];
    }
    case 'early': {
      const ec = earlyClient(st);
      if (!ec) return null;
      return [() => { earlyTake(st, ec); }, () => {}];
    }
    case 'tresult': {
      const t = q.t;
      if (t.direct && !t.result[0].you) return [() => {}];
      if (t.result[0].you) {
        const o: Opt[] = [];
        if (hasCrew(c)) o.push(() => { signSub(st, t); staffSubs(st, null); });
        o.push(() => pullOut(st, t));
        return o;
      }
      return [() => {}];
    }
    case 'cresult': {
      const t = q.t;
      if (t.result[0].you) return [() => { signOwn(st, st, t); staffOwn(st, null); }, () => pullOutCouncil(st)];
      return [() => {}];
    }
    case 'variation': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.varAsked = true;
      return [() => { variationLodge(r(), j); }, () => variationWriting(j), () => variationFree(st, j)];
    }
    case 'gravel': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.gravAsked = true;
      return [() => gravelCart(st, j), () => { gravelWork(r(), j); }, () => { gravelArgue(r(), st, j); }];
    }
    case 'drydam': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.damAsked = true;
      return [() => dryDamBore(st, j), () => dryDamFar(j), () => dryDamFarMore(j)];
    }
    case 'pitout': {
      const j = jobOf(c, q.id);
      if (!j) return null;
      j.pitAsked = true;
      return [() => pitFar(j, false), () => pitFar(j, true), () => pitFarmer(st, j)];
    }
    case 'repo':
      return [() => { repossess(st, (j: Job) => release(st, j, []), weeklyRepay); }];
    case 'buyout': {
      const x = c.rivals.find((y) => y.name === q.name);
      if (!x || !canBuyOut(st)) return null;
      const o = buyOutOffer(cr, st, x), cap = lendCap(fleetValue(c.fleet, c.week), c.won, c.won2, c.won3);
      const pa = buyOutPay(st, o.price, o.v, cap), pb = buyOutPay(st, o.bprice, o.bv, cap), out: Opt[] = [];
      const rm = () => room(c);
      if (pa.ok) out.push(() => { buyOutAll(r(), st, x, o, pa, rm); });
      if (pb.ok && o.best.length) out.push(() => { buyOutBest(r(), st, x, o, pb, rm); });
      out.push(() => {});
      return out;
    }
    case 'sellup': {
      const x = c.rivals.find((y) => y.name === q.name);
      if (!x || c.phase !== 'play') return null;
      const best = sellBest(st), out: Opt[] = [], m = mood(c);
      const held = c.gst && gstInBank(tax(c)) ? c.gst.held : 0;
      if (best.length) out.push(() => { sellTwo(st, x, m); });
      out.push(() => { const g = rung(st); sellAll(st, x, m, stars(c.rep), held, { stage: g, peak: g }); });
      out.push(() => {});
      return out;
    }
  }
  return null;
}

/** Answer the card at the front of the queue with option i. A card that no longer applies just goes. */
export function choose(c: Career, i: number): boolean {
  const q = c.queue[0];
  if (!q) return false;
  const o = cardOptions(c, q);
  if (!o) {
    c.queue.shift();
    return false;
  }
  (o[i] ?? o[0]!)();
  tickets(c);
  c.queue.shift();
  checkWin(c as never);
  return true;
}

