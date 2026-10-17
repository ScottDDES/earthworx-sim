// Words for the office: what the workshop should look at, and the owner's flags on the dashboard.

import { alertMachines, type MachineAlert } from '../books';
import { TYPES, svcLeft, type Machine } from '../machines';
import { gstInBank, plOf, utilOf, workInHand, type WeekRow } from '../office';
import * as game from '../game';

export function alertText(a: MachineAlert, fleet: readonly Machine[]): string {
  const m = fleet.find((x) => x.id === a.id), nm = 'The ' + (m ? TYPES[m.type].short : 'machine');
  switch (a.k) {
    case 'overdue': return nm + ' is ' + a.hrs + ' hrs overdue for a service. Breakdowns are far more likely until it\'s done.';
    case 'due': return nm + ' is due for a service in ' + a.hrs + ' hrs, about a week\'s work.';
    case 'patched': return nm + ' is running on a patched-up ' + a.part + '. Fix it properly before it lets go.';
    case 'wornOut': return nm + ' is worn out (' + a.cond + '%). Expect breakdowns. Service it or sell it.';
    case 'badlyWorn': return nm + ' is badly worn (' + a.cond + '%). Each service brings back 12%.';
    case 'wearing': return nm + ' is starting to show wear (' + a.cond + '%). Breakdown odds are climbing.';
  }
}


type Career = game.Career;
const f = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-AU');
const fk = (n: number) => (n >= 1e6 ? '$' + Math.round(n / 1e4) / 100 + 'M' : n >= 1000 ? '$' + Math.round(n / 1000) + 'k' : f(n));
const fks = (n: number) => (n < 0 ? '−' : '') + fk(Math.abs(n));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** A person on the register: their name, You, or a casual. */
export function incName(c: Career, who: string): string {
  if (!who) return 'A casual';
  if (who === 'you') return 'You';
  return c.staff.find((p) => p.id === who)?.name ?? 'A casual';
}

export type FlagLevel = 'bad' | 'warn';
/** Where a flag sends you: the bank page, the Work tab, the Yard, or nowhere. */
export type FlagGo = 'bank' | 'work' | 'yard' | null;

/** What the owner should look at, worst first as the prototype lists them. cur is the period's weeks. */
export function ownerFlags(c: Career, cur: readonly WeekRow[]): [FlagLevel, string, FlagGo][] {
  const F: [FlagLevel, string, FlagGo][] = [], P = plOf(cur), W = c.whs, wkTurn = cur.length ? P.rev / cur.length : 0;
  const rw = game.runwayWeeks(c), wih = workInHand(c.jobs), fixed = game.overheads(c) + (c.loan.bal > 0 ? c.loan.weekly : 0);
  if ((c.freeze ?? 0) > c.week) F.push(['warn', 'Flood recovery funding is paused until week ' + c.freeze + '. Fewer tenders, slower council payments.', null]);
  if ((c.insHard ?? 0) > c.week) F.push(['warn', 'Insurance is up across the industry until week ' + c.insHard + '.', null]);
  if (c.loan.missed) F.push(['bad', 'You\'ve missed ' + c.loan.missed + ' loan repayment' + (c.loan.missed > 1 ? 's' : '') + '. Three and the bank takes a machine.', 'bank']);
  if (c.odOver) F.push(['bad', 'Over your overdraft limit, ' + c.odOver + ' of 3 weeks.', 'bank']);
  if (rw < 4) F.push(['bad', 'Cash and overdraft cover ' + (rw < 1 ? 'less than a week' : 'about ' + rw + ' week' + (rw > 1 ? 's' : '')) + ' of fixed costs (' + f(fixed) + ' a week, before any job costs).', 'bank']);
  else if (rw < 10) F.push(['warn', 'Cash and overdraft cover about ' + rw + ' weeks of fixed costs.', 'bank']);
  const od = c.recv.filter((x) => x.due >= 9999).reduce((a, x) => a + x.amt, 0);
  if (od) F.push(['warn', f(od) + ' owed to you is overdue. Chase it.', 'bank']);
  if (cur.length >= 4 && P.profit < 0) F.push(['bad', 'The business lost ' + f(-P.profit) + ' over the last ' + cur.length + ' weeks.', null]);
  if (cur.length >= 4 && wkTurn > 0 && wih < wkTurn * 4) F.push(['warn', 'Work in hand covers about ' + Math.max(0, Math.round(wih / wkTurn)) + ' week' + (Math.round(wih / wkTurn) === 1 ? '' : 's') + ' of turnover. Line up the next job.', 'work']);
  if (cur.length >= 4 && c.fleet.length >= 2) {
    const u = utilOf(cur);
    if (u < 45) F.push(['warn', 'Your gear worked ' + u + '% of the dry days. Idle machines still cost insurance and finance.', 'yard']);
  }
  const am = alertMachines(c.fleet);
  if (am) F.push([c.fleet.some((m) => svcLeft(m) < 0 || m.cond < 45) ? 'bad' : 'warn', am + ' machine' + (am > 1 ? 's need' : ' needs') + ' workshop attention.', 'yard']);
  const lt = W.inc.find((x) => (x.sev === 'lti' || x.sev === 'serious') && c.week - x.w < 13);
  if (lt) F.push(['bad', 'A ' + (lt.sev === 'serious' ? 'serious incident' : 'lost-time injury') + ' in week ' + lt.w + ' (' + incName(c, lt.who) + '). It costs you tender points and insurance for a year or more.', 'yard']);
  const inBank = !!c.gst && gstInBank(game.tax(c)), FC = game.cashAhead(c, 12), odl = game.odLimitOf(c);
  const past = FC.find((x) => x.bal < -odl), dip = c.bank >= 0 ? FC.find((x) => x.bal < 0) : null;
  if (past) F.push(['bad', 'On what\'s signed and owed, cash goes past your overdraft in week ' + past.w + '. Chase debtors, line up work or hold off buying.', 'bank']);
  else if (dip) F.push(['warn', 'On the forecast you dip into the overdraft around week ' + dip.w + '.', null]);
  if (inBank && c.gst!.held > 0 && c.bank < c.gst!.held) F.push(['warn', 'You hold ' + f(c.gst!.held) + ' of GST for the tax office but only ' + fks(c.bank) + ' in the bank. That GST has been spent.', 'bank']);
  const off = c.staff.filter((p) => p.off > 0);
  if (off.length) F.push(['warn', off.map((p) => p.name).join(', ') + ' off work at the moment.', null]);
  if (cur.length >= 8 && P.rev && P.ws / P.rev > 0.08) F.push(['warn', 'Workshop and repairs ate ' + pct(P.ws, P.rev) + '% of turnover. Worn gear costs more than it earns.', 'yard']);
  return F;
}
