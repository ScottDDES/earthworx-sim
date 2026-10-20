// Words for the week's docket: each event the week reported, as the prototype wrote it, and the stamps
// across the top. Events that only went in the prototype's log (not the docket) give null here.

import { bulkLine } from './bulk';
import type { Career, Report } from '../game';
import type { Job } from '../hire';
import { TYPES } from '../machines';
import { TOWNS } from '../towns';
import { MOODS } from '../market';
import { HC_WEEKS } from '../office';
import { jobTitle } from './work';
import { LTI_MACHINES, LTI_STORIES } from './safety';
import { UNLOCK_TEXT } from './career';
import { fuelLine } from './fuel';
import { ERP_NAME } from './office';

const f = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-AU');
const s = (n: number) => (n > 1 ? 's' : '');
const crewL = (i: number) => String.fromCharCode(65 + i);

function whoName(c: Career, who: string | null): string {
  if (!who) return 'A casual';
  if (who === 'you') return 'You';
  return c.staff.find((p) => p.id === who)?.name ?? 'A casual';
}

/** One event as a docket line, or null when it isn't one. */
export function eventText(c: Career, r: Report, e: any): string | null {
  const job = (id: string): Job | undefined => r.jobs?.[id] ?? c.jobs.find((j) => j.id === id);
  const title = (id: string) => { const j = job(id); return j ? jobTitle(j) : 'the job'; };
  switch (e.k) {
    // the rain call
    case 'stoodDown': return 'Crews stood down ' + DAYS[e.d] + '. ' + (e.right ? e.mm + ' mm fell: the right call.' : 'Only ' + e.mm + ' mm fell. You could have worked it.');
    case 'pugged': return e.mm + ' mm came down on ' + DAYS[e.d] + ' with the crews out. The formation pugged up: ' + f(e.cost) + ' of rework and the day\'s lost.';
    case 'touchUp': return 'Worked through ' + e.mm + ' mm on ' + DAYS[e.d] + '. The day\'s in, with ' + f(e.cost) + ' of touch-up passes.';
    case 'missedUs': return 'The rain missed you on ' + DAYS[e.d] + ' (' + e.mm + ' mm). A full day in.';
    // jobs and contracts
    case 'damWon': case 'damLost': case 'damLapsed': case 'damStarted': case 'damDone': case 'damGone': case 'damPassed': case 'damFailed': case 'redzoneFound': case 'burnWait': case 'burnt': case 'devClaim': case 'devBust': return bulkLine(e, e.jobId ? title(e.jobId) : undefined);
    case 'fuelIn': case 'fuelAuto': case 'fuelDry': case 'fuelStolen': case 'warOver': return fuelLine(e, DAYS, ERP_NAME);
    case 'breakdown': return 'Your ' + TYPES[e.type as keyof typeof TYPES].short + ' broke down.';
    case 'terminated': return e.client + ' terminated ' + title(e.jobId) + ': you never started it. Track record −3, and they won\'t use you for six months.';
    case 'subPulled': return e.name + ' pulled their crew off ' + title(e.jobId) + ' for a week to finish a private job.';
    case 'crewHome': return 'Crew ' + crewL(e.crew) + (e.sub ? ' (subbie)' : '') + ' has finished its roads on ' + title(e.jobId) + '.' + (e.machines ? ' Its ' + e.machines + ' machine' + (e.machines > 1 ? 's are' : ' is') + ' back in the yard for other work.' : '');
    case 'halfway': return e.cut
      ? 'Halfway to 30 June and only ' + Math.round(e.done * 100) + '% of ' + title(e.jobId) + ' is done. The council moved some roads to another contractor: ' + f(e.cut) + ' of work gone. Track record −1.'
      : 'Halfway check on ' + title(e.jobId) + ': ' + Math.round(e.done * 100) + '% done. The council is happy with the pace.';
    case 'deadline': return '30 June has passed. The council gave the rest of ' + title(e.jobId) + ' to other contractors: ' + f(e.cut) + ' of work you won\'t be paid for. Track record −3.';
    case 'downtime': return e.client + ' knocked ' + f(e.off) + ' off for downtime.';
    case 'gaveUp': return e.client + ' gave up waiting and found another machine. Track record −1.';
    case 'subFinished': return e.ld
      ? 'Finished ' + e.late + ' week' + s(e.late) + ' late: ' + f(e.ld) + ' in damages comes off your retention.'
      : 'Retention of ' + f(e.retained) + (e.extra ? ' plus ' + f(e.extra) + ' of variations' : '') + ' invoiced, due in ' + e.terms + ' weeks.';
    case 'finishPoints': return e.council
      ? 'Council noted the finish on ' + title(e.jobId) + '. Track record +' + e.pts + ' extra.'
      : 'The finish on ' + title(e.jobId) + ' stood out' + (e.pts > 1 ? ': GPS grading and a multi-tyre roller' : '') + '. Track record +' + e.pts + ' extra.';
    case 'finished': return 'Finished: ' + title(e.jobId) + '. Track record +' + e.gain + '.';
    case 'ownFinished': return (e.major ? 'Flood recovery program delivered: ' : 'Council contract finished: ') + title(e.jobId) + (e.subbedTo ? ', by ' + e.subbedTo : '') + '. ' + (e.ld ? e.late + ' week' + s(e.late) + ' late, ' + f(e.ld) + ' in damages.' : 'On time.') + ' Track record +' + e.gain + (job(e.jobId)?.subEver ? ' (less for work you subbed out)' : '') + '.';
    // the workshop
    case 'noWorkshop': return e.who === 'fitters'
      ? 'Your fitter' + (e.names.length > 1 ? 's have' : ' has') + ' no workshop. Move to a depot to put them to work.'
      : e.names[0] + ' has no workshop to run. Move to a depot to put them to work.';
    case 'fitterWork': return e.names.join(' and ') + ' ' + (e.serviced ? 'serviced ' + e.serviced + ' machine' + s(e.serviced) : '') + (e.serviced && e.fixed.length ? ' and ' : '') + (e.fixed.length ? 'fixed the patched-up ' + e.fixed.map((t: keyof typeof TYPES) => TYPES[t].short).join(', ') : '') + ' in the workshop: ' + f(e.parts) + ' in parts.';
    case 'dealerBookings': return e.name + ' booked ' + (e.serviced ? e.serviced + ' service' + s(e.serviced) + ' out to the dealer' : '') + (e.serviced && e.fixedBands ? ' and ' : '') + (e.fixedBands ? 'had the patched-up gear fixed properly' : '') + ': ' + f(e.cost) + '.';
    case 'shortFitters': return e.name + ': "We need ' + e.more + ' more fitter' + s(e.more) + '. ' + e.without + ' machines are going without, so they\'re breaking down more."';
    // safety
    case 'lti': {
      const nm = whoName(c, e.who), st = e.story;
      const t = st.k === 'lti' ? LTI_STORIES[st.i]!(LTI_MACHINES[st.machine]!) : '';
      return 'Lost-time injury: ' + nm + ' ' + t + '. Off ' + e.wks + ' weeks. $1,500 excess, insurance up 10%, track record −1.';
    }
    case 'medical': return whoName(c, e.who) + ' needed stitches after a slip on the steps. Medical treatment: $600, and the insurer notes it.';
    case 'firstAid': return 'First aid for ' + whoName(c, e.who) + ': a cut hand. Logged in the register.';
    // the branch
    case 'branchWeek': return TOWNS[e.town as keyof typeof TOWNS].name + ' branch: ' + (e.crews ? e.days + ' crew-days, ' + f(e.rev) + ' invoiced' : 'no full crew there, so no work') + (e.broke ? ', ' + e.broke + ' breakdown' + s(e.broke) : '') + '.';
    // the bank
    case 'caughtUp': return 'Caught up ' + f(e.amt) + ' of missed repayments.';
    case 'missedRepay': return 'Missed a loan repayment (' + e.n + ' of 3).';
    case 'overLimit': return 'Over your ' + (e.limit ? f(e.limit) + ' overdraft' : 'bank balance') + ' (' + e.weeks + ' of 3 weeks).';
    case 'paidOff': return 'Loan paid off.';
    case 'backAbove': return 'Back above water. Net worth ' + f(e.nw) + '.';
    case 'insolvent': return 'Trading insolvent: you owe ' + f(-e.nw) + ' more than you\'re worth. Week ' + e.weeks + ' of ' + HC_WEEKS + '. Sell gear, chase what you\'re owed or find a buyer, or the administrators move in.';
    // sales
    case 'soldAtAuction': return 'Your ' + TYPES[e.type as keyof typeof TYPES].short + ' sold at auction for ' + f(e.got) + ' after fees.';
    case 'soldPrivately': return 'Sold your ' + TYPES[e.type as keyof typeof TYPES].short + ' privately for ' + f(e.got) + '.';
    // tax
    case 'bookkeeperLodged': return 'Your bookkeeper lodged the BAS for ' + QNAME[e.qm] + ' ' + e.qy + ': ' + (e.amt >= 0 ? f(e.amt) + ' paid from the GST set aside.' : f(-e.amt) + ' refunded.');
    case 'gstRefund': return 'GST refund for ' + QNAME[e.qm] + ' ' + e.qy + ': ' + f(e.amt) + ' back from the tax office.';
    // the market, rivals and the district
    case 'mood': return 'The market has turned ' + MOODS[e.mood as keyof typeof MOODS].t.toLowerCase() + '. ' + MOODS[e.mood as keyof typeof MOODS].d;
    case 'grewMid': return e.name + ' has grown into a mid-size outfit. Expect them on council packages now.';
    case 'grewBig': return e.name + ' is now one of the big players, pricing whole flood recovery programs.';
    case 'sellingGear': return e.name + ' is short of cash and selling gear. Look for it under Buy in the Market.';
    case 'boughtOut': return e.buyer + ' has bought out ' + e.name + ': ' + e.fleet + ' machines and the crews. One less outfit pricing work.';
    case 'wentUnder': return e.name + ' has gone under after ' + (e.losses ? 'a run of losing jobs' : 'months without enough work') + '. Their gear goes to a clearance sale at auction, starting next week.';
    case 'newSmall': return 'New outfit in town: ' + e.name + ', ' + e.fleet + ' machines and pricing sharp to get a start.';
    case 'newMid': return 'A bigger outfit has moved in from out of town: ' + e.name + ', ' + e.fleet + ' machines.';
    case 'newBig': return 'A big civil firm has opened a depot here: ' + e.name + '. They\'ll be after the flood recovery programs.';
    case 'floodEvent': return 'Flooding has been assessed and a new flood recovery event declared: ' + e.roads + ' roads across the district are on the damage list.';
    case 'roadsCut': return e.mm + ' mm this week has cut ' + e.roads + ' road' + s(e.roads) + ' across the district' + (e.mine ? ', ' + e.mine + ' of them roads you\'d fixed' : '') + '. More flood recovery work to come.';
    case 'unlocked': return 'Unlocked: ' + UNLOCK_TEXT[e.id];
  }
  return null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const QNAME: Record<number, string> = { 6: 'April to June', 9: 'July to September', 0: 'October to December', 3: 'January to March' };

/** The docket's lines, in the order the prototype shows them: trading insolvent goes first. */
export function docketLines(c: Career, r: Report): string[] {
  const ev = r.events as any[], first = ev.filter((e) => e.k === 'insolvent'), rest = ev.filter((e) => e.k !== 'insolvent');
  return [...first, ...rest].map((e) => eventText(c, r, e)).filter((t): t is string => t != null);
}

/** The stamps across the top: a subcontract or council contract finished, a program delivered, something unlocked. */
export function docketStamps(c: Career, r: Report): string[] {
  const out: string[] = [];
  for (const e of r.events as any[]) {
    const j = e.jobId ? r.jobs?.[e.jobId] ?? c.jobs.find((x) => x.id === e.jobId) : undefined;
    if (e.k === 'finished' && e.kind === 'sub' && j) out.push('Finished · ' + jobTitle(j));
    if (e.k === 'ownFinished' && j) out.push((e.major ? 'Program delivered · ' : 'Contract finished · ') + jobTitle(j));
    if (e.k === 'damDone' && j) out.push('Dam finished · ' + jobTitle(j));
    if (e.k === 'unlocked') out.push('Unlocked');
  }
  return out;
}
