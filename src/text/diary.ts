// The site diary and the district news in words, as the prototype wrote them.

import type { Career, Report } from '../game';
import type { DiaryEntry, JobRef, MRef } from '../diary';
import type { Job } from '../hire';
import { TYPES, an, machineName } from '../machines';
import { TOWNS } from '../towns';
import { YARDS } from '../yards';
import { ROLES } from '../staff';
import { MGR } from '../managers';
import { HC_WEEKS } from '../office';
import { WHS_SYS } from '../overheads';
import { TIER_NAME, councilTitle, jobTitle, pmOf, subTenderTitle } from './work';
import { eventText } from './docket';
import { SERIOUS_STORIES } from './safety';
import { DAM_KIND, farmer as farmerName } from './bulk';
const dk = (k: string) => (DAM_KIND[k as keyof typeof DAM_KIND] ?? 'job').toLowerCase();
import { TICKET_TEXT } from './career';
import { rw } from './real';

const f = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-AU');
const fk = (n: number) => (n >= 1e6 ? '$' + Math.round(n / 1e4) / 100 + 'M' : n >= 1000 ? '$' + Math.round(n / 1000) + 'k' : f(n));
const s = (n: number) => (n > 1 ? 's' : '');
const QNAME: Record<number, string> = { 6: 'April to June', 9: 'July to September', 0: 'October to December', 3: 'January to March' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const MGR_ROLE: Record<string, string> = { ops: 'operations manager', wsm: 'workshop manager' };

const label = (m: MRef) => machineName(m as never) + ', ' + m.year;
const title = (j: JobRef) => jobTitle(j as Job);
const ctitle = (t: { n: number }) => councilTitle({ ...t, roads: Array(t.n) } as never);
const town = (t: string) => TOWNS[t as keyof typeof TOWNS].name;
const short = (t: keyof typeof TYPES) => TYPES[t].short;

/** One diary or news entry in words. */
export function diaryText(c: Career, e: any): string {
  switch (e.k) {
    case 'started': return 'Started ' + e.co + ' in ' + TOWNS[e.town as keyof typeof TOWNS].name + ' with a ' + fk(e.loan) + ' loan.';
    case 'open': return 'Open for business.';
    case 'presetRegional': return 'Two crews, a regional depot and a flood recovery program won at ' + (e.bid != null ? f(e.bid) : '') + '. Deliver it by 30 June.';
    case 'seasonOver': return 'Season over: ' + (e.score >= 0 ? '+' : '') + f(e.score) + ' net worth in ' + e.done + ' weeks.';
    case 'ticket': return 'New ticket: ' + TICKET_TEXT[e.id]!.n + '.';
    // the market
    case 'financed': return 'Financed ' + f(e.lent) + ' of the price over five years. Loan repayments are now ' + f(e.weekly) + ' a week.';
    case 'bought': return 'Bought ' + label(e.m) + ' for ' + f(e.price) + (e.dealer ? ' with 8 weeks\' warranty.' : '.');
    case 'boughtOffRival': return e.who + ' sold it to you. The true condition shows once it\'s working.';
    case 'inspected': return 'Paid a mechanic ' + f(e.cost) + ' to check the ' + short(e.type) + '.';
    case 'cantSettle': return 'Failed to settle an auction. ' + f(e.fine) + ' fine.';
    case 'wonAuction': return 'Won ' + label(e.m) + ' at auction for ' + f(e.total) + '.';
    case 'tradedIn': return 'Traded in ' + label(e.m) + ' for ' + f(e.got) + '.';
    case 'toAuction': return 'Put ' + label(e.m) + ' in next week\'s auction.';
    case 'listed': return 'Listed ' + label(e.m) + ' privately at ' + f(e.price) + '.';
    case 'unlisted': return 'Took ' + label(e.m) + ' off the market.';
    case 'soldAtAuction': return 'Sold ' + label(e.m) + ' at auction for ' + f(e.got) + '.';
    case 'soldPrivately': return 'Sold ' + label(e.m) + ' privately for ' + f(e.got) + '.';
    // hire work
    case 'tookOn': return 'Took on: ' + title(e.job) + '. Float in ' + f(e.float) + '.';
    case 'bookedIn': return 'Booked in: ' + title(e.job) + ', straight after ' + title(e.after) + '. Float in ' + f(e.float) + '.';
    case 'saidNo': {
      const who = e.job.kind === 'council' ? 'The council' : e.job.client || 'The client';
      const why = e.why === 'rain' ? 'they want it done before the rain forecast this week' : e.why === 'roster' ? 'the council needs it started this week and has another operator on the list' : e.why === 'tooLong' ? "they can't wait " + e.wait + ' days' : "they've got someone who can start tomorrow";
      return 'Asked ' + who.replace(/^The /, 'the ') + ' to wait for ' + title(e.job) + '. They said no: ' + why + '.';
    }
    case 'finished': return 'Finished ' + title(e.job) + '. Earned ' + f(e.earned) + '.';
    case 'terminated': return e.job.client + ' terminated ' + title(e.job) + '.';
    case 'bookedNoMachine': return title(e.job) + ' was booked in, but there was no ' + short(e.type) + ' free to start it. The float is gone.';
    // subbie tenders
    case 'priced': return 'Priced ' + subTenderTitle(e) + ' for ' + e.hc + ' at ' + f(e.bid) + '.';
    case 'directLapsed': return e.hc + ' gave ' + subTenderTitle(e) + " to someone else. You didn't price it.";
    case 'subWentTo': return subTenderTitle(e) + ' for ' + e.hc + ' went to ' + e.name + ' at ' + f(e.price) + ". You didn't price it.";
    case 'signedSub': return 'Signed ' + title(e.job) + ' at ' + f(e.bid) + '. Due by week ' + e.due + '.';
    case 'pushedOn': return 'Pushed on through ' + e.mm + ' mm on ' + DAYS[e.d] + '. ' + f(e.cost) + ' of rework.';
    // council tenders
    case 'programLet': return 'The council has let ' + ctitle(e.t) + '. Due 30 June ' + e.year + '.';
    case 'tendered': return 'Tendered ' + f(e.bid) + ' to the council for ' + ctitle(e.t) + '.';
    case 'councilWentTo': return "The council's " + ctitle(e.t) + ' went to ' + e.name + ' at ' + f(e.price) + '.';
    case 'signedOwn': return 'Signed the council contract: ' + title(e.job) + ' at ' + f(e.bid) + '. Due by week ' + e.due + '.';
    // crews and contracts
    case 'cartTaken': return 'Your second water cart came off ' + title(e.job) + ' for the next crew. ' + title(e.job) + ' hires one in at ' + f(e.hire) + ' a week.';
    case 'movedOnSub': return 'The crew moved straight on to ' + title(e.job) + ': a day to float the gear and set up, then work.';
    case 'movedOnOwn': return 'Crews moved straight on to ' + title(e.job) + ': a day to float the gear and set up, then work.';
    case 'floated': return 'Floated the crew to ' + e.place + ' (' + f(e.cost) + '). ' + (e.cart2 ? '' : 'Hired a second water cart at ' + f(e.hire) + ' a week. ') + (e.names.length ? e.names.join(' and ') + ' on the crew. ' : '') + (e.casuals ? 'Casuals from labour hire for the rest.' : '');
    case 'spareCart': return 'Your spare water cart went onto ' + title(e.job) + ' in place of the hired one.';
    case 'tookOverThe': return e.name + ' took over the ' + short(e.type) + ' on ' + title(e.job) + ' from a labour-hire casual.';
    case 'tookOverA': return e.name + ' took over ' + an(short(e.type)) + ' on ' + title(e.job) + ' from a labour-hire casual.';
    case 'swappedIn': return (e.by ? e.by + ' put your ' : 'Your ') + short(e.type) + (e.by ? '' : ' went') + ' onto ' + title(e.job) + ' in place of a ' + (e.wet ? 'subbie' : 'hire-in') + '.';
    case 'onSite': return 'Crews on site for ' + title(e.job) + '. ' + e.owned + ' of your machines, ' + (e.hireWeek ? f(e.hireWeek) + ' a week of hire-ins, ' : '') + (e.subDay ? f(e.subDay) + ' a day of subbies, ' : '') + e.staff + ' of your staff and ' + e.casuals + ' casuals.';
    case 'roadsMoved': return 'Council moved roads off ' + title(e.job) + '.';
    case 'ownDone': return 'Finished the council contract ' + title(e.job) + '. Claimed ' + f(e.earned) + '.';
    case 'subbedOut': return 'Subbed ' + title(e.job) + ' out to ' + e.name + ' (' + e.crews + ' crew' + s(e.crews) + '). ' + (e.job.kind === 'own' ? 'They get ' + f(e.cost) + ' of the contract.' : 'They get ' + f(e.rate) + ' a crew-day.');
    case 'tookBack': return 'Took ' + title(e.job) + ' back off ' + e.name + '. Your crew picks it up from here.';
    // the yard and the workshop
    case 'movedYard': { const n = YARDS[e.yard as keyof typeof YARDS].name; return 'Moved the gear to ' + n.charAt(0).toLowerCase() + n.slice(1) + (e.setup ? ' (' + f(e.setup) + ' to set up).' : '.'); }
    case 'serviced': return 'Serviced the ' + short(e.type) + ' (' + f(e.cost) + ').';
    case 'foundAndFixed': return e.name + ' found a worn ' + e.part + ' on the ' + short(e.type) + ' and had it fixed properly (' + f(e.cost) + ').';
    case 'foundAndPatched': return e.name + ' patched a ' + e.part + ' on the ' + short(e.type) + ' to save cash (' + f(e.cost) + '). It\'ll be fixed properly when money allows.';
    // people
    case 'hired': return 'Hired ' + e.name + ', ' + ROLES[e.role as keyof typeof ROLES].name.toLowerCase() + ', at ' + f(e.wage) + ' a week.';
    case 'hiredMgr': return 'Hired ' + e.name + ' (' + MGR[e.trait as keyof typeof MGR].n.replace(/^The /, '').toLowerCase() + ') as ' + MGR_ROLE[e.role] + ', ' + f(e.wage) + ' a week.';
    case 'standing': return pmOf(e.hc) + ' at ' + e.hc + ": you're now " + TIER_NAME[e.tier]!.toLowerCase() + ' with them.';
    case 'lti': return 'Lost-time injury: ' + e.name + ', off ' + e.wks + ' weeks.';
    // the branch
    case 'brOpened': return 'Opened a branch depot in ' + town(e.town) + ' (' + f(e.cost) + '). ' + e.mgr + ' runs it.';
    case 'brMgr': return e.name + ' takes over the ' + town(e.town) + ' branch.';
    case 'toBranch': return 'Floated the ' + label(e.m) + ' to the ' + town(e.town) + ' branch.';
    case 'toHome': return 'Brought the ' + label(e.m) + ' home from the branch.';
    case 'brClosed': return 'Closed the ' + town(e.town) + ' branch and floated the gear home.';
    // cards
    case 'seriousNotified': return 'Serious incident: ' + e.name + ' ' + SERIOUS_STORIES[e.story] + '. Regulator notified' + (e.fine ? ', fined ' + f(e.fine) : '') + '.';
    case 'regulator': return 'The safety regulator is investigating an incident on a ' + e.co + ' site.';
    case 'unreportedFine': return e.co + ' fined ' + f(e.fine) + ' over an unreported incident.';
    case 'badBack': return e.name + ' injured. Off 6 weeks; insurance up 10%.';
    case 'toAuctionAdvice': return 'Put ' + label(e.m) + " in next week's auction on " + e.by + "'s advice.";
    case 'brWon': return TOWNS[e.town as keyof typeof TOWNS].name + ' branch won a ' + fk(e.val) + ' council package.';
    case 'brQuit': return e.name + ' quit the ' + TOWNS[e.town as keyof typeof TOWNS].name + ' branch.';
    case 'moreTime': return 'The bank gave you more time (' + f(e.fee) + ' fee).';
    case 'basPaid': return 'Paid the BAS for ' + QNAME[e.qm] + ' ' + e.qy + ': ' + f(e.amt) + '.';
    case 'basTaken': return 'The tax office took ' + f(e.amt) + ' for the BAS for ' + QNAME[e.qm] + ' ' + e.qy + '.';
    case 'basPlan': return 'Payment plan with the tax office for ' + QNAME[e.qm] + ' ' + e.qy + ': three payments of ' + f(e.each) + '.';
    case 'clearing': return 'Bought a 2009 roller at a clearing sale for ' + f(e.price) + '.';
    case 'youBoughtOut': return 'Bought ' + (e.two ? 'two machines off ' : '') + e.from + ': ' + f(e.cash) + ' cash' + (e.loan ? ' and ' + f(e.loan) + ' borrowed against the gear' : '') + '.';
    case 'boughtOutNews': return c.co + ' has bought out ' + e.name + '.';
    // shocks
    case 'collapse': return e.name + ' went into administration owing you ' + f(e.debt) + '.';
    case 'collapseNews': return e.name + ' has gone into administration.';
    case 'freeze': return 'Flood recovery funding paused until week ' + e.until + '.';
    case 'insure': return 'Insurers put premiums up 35% across the industry.';
    // selling up
    case 'soldTwo': return 'Sold ' + e.ms.map(label).join(' and ') + ' to ' + e.to + ' for ' + f(e.price) + '.';
    case 'boughtGearOff': return e.who + ' has bought gear off ' + c.co + '.';
    case 'soldBusiness': return 'Sold ' + c.co + ' to ' + e.to + ' for ' + f(e.price) + '.';
    case 'handedOn': return 'Handed ' + c.co + ' to the next generation.';
    case 'nextGen': return 'Generation ' + e.gen + ' takes over ' + e.co + ', with ' + f(e.gift) + ' of the family money and a name people know.';
    case 'retired': return 'Sold ' + c.co + ' to ' + (e.to ?? 'A contractor from the coast') + ' for ' + f(e.price) + ' and retired.';
    case 'callout': return 'Storm call-out for the council: ' + f(e.amt) + ' invoiced.';
    case 'knockedBack': return e.name + ' knocked back ' + f(e.offer) + ' a week.';
    case 'letGo': return 'Let ' + e.name + " go with a week's pay.";
    case 'letGoInjured': return 'Let ' + e.name + " go while they were off injured, with a week's pay.";
    case 'quitOver': return e.why === 'unpaid' ? e.name + ' handed in their notice. Two weeks without pay when their back went was the last straw.' : e.name + ' handed in their notice: "Not after what happened' + (e.hurt ? ' to ' + e.hurt : '') + '."';
    case 'ufdClaim': return e.name + "'s unfair dismissal claim settled: " + f(e.cost) + ' in compensation and legal costs. Track record −2, and the crew knows why.';
    case 'hiddenOut': return 'The claim brought out the incident you kept quiet. The regulator fined you ' + f(e.fine) + ', insurance is up 40%, track record −5, and the council has suspended you for six months.';
    case 'rzDamRang': return e.permit ? farmerName(e.farm) + "'s permit came through. The dam's back on: a price is in Work." : farmerName(e.farm) + ' rang about the dam, as promised. A price is in Work.';
    case 'grudgeLost': return farmerName(e.farm) + ' gave the ' + dk(e.dk) + ' near ' + e.place + ' to someone else. Still hasn\'t forgotten.';
    case 'cashAudit': return 'The tax office audited your cash jobs. The ' + farmerName(e.farm) + ' job: ' + f(e.amt) + ' in back tax and penalties, and track record −2.';
    case 'tipOut': return e.hc + ' found out you priced off ' + (e.rival ? e.rival + "'s" : 'a rival\'s') + ' number. No more packages from them for six months, and track record −3.';
    case 'signFail': return farmerName(e.farm) + "'s wall near " + e.place + ' failed, the one signed off untested. The engineer has lost his ticket. You paid ' + f(e.cost) + ' to rebuild it, and track record −4.';
    case 'fixedProperly': return 'Fixed the ' + e.part + ' on the ' + short(e.type) + ' properly (' + f(e.cost) + ').';
    case 'gps': return 'Fitted GPS machine control to the ' + label(e.m) + ' (' + f(e.cost) + ').';
    case 'ordered': return 'Ordered a new ' + TYPES[e.type as keyof typeof TYPES].name + ' from the dealer (' + f(e.price) + '). Due week ' + e.w + '.';
    case 'tradedIn': return 'Traded in the ' + label(e.m) + ' (' + f(e.credit) + ' allowed).';
    case 'newArrived': return 'Your new ' + label(e.m) + ' arrived. Two years\' warranty.';
    case 'laserFit': return 'Fitted laser control to the ' + label(e.m) + ' (' + f(e.cost) + ').';
    case 'roadtrain': return 'Put a second trailer and dolly behind the ' + label(e.m) + ': it\'s a roadtrain now (' + f(e.cost) + ').';
    case 'whsSetUp': return 'Set up ' + WHS_SYS[e.sys]!.n + ' (' + f(e.cost) + ').';
    // the bank
    case 'insolventWeek': return 'Trading insolvent, week ' + e.weeks + ' of ' + HC_WEEKS + '.';
    case 'administration': return 'Went into administration.';
    case 'wentBust': return c.co + ' has gone into administration.';
    case 'repossessed': return 'The bank repossessed the ' + label(e.m) + ' for ' + f(e.got) + '.';
    case 'quarterClosed': return 'Quarter closed: ' + QNAME[e.qm] + '. ' + (e.amt >= 0 ? f(e.amt) + ' of GST to pay by week ' + e.due + '.' : 'The tax office owes you ' + f(-e.amt) + ' of GST.');
    case 'borrowed': return 'Borrowed ' + f(e.amt) + ' against the fleet (' + f(e.fee) + ' establishment fee). Repayments now ' + f(e.weekly) + ' a week.';
    case 'paidDown': return 'Paid ' + f(e.amt) + ' off the loan. ' + (e.bal ? 'Repayments now ' + f(e.weekly) + ' a week.' : 'Loan cleared.');
  }
  // the rest read as they do on the docket
  return eventText(c, NO_REPORT, e) ?? '[' + e.k + ']';
}

const NO_REPORT = { events: [], tix: [], days: [] } as unknown as Report;

/** The diary as lines: week and words, newest first. */
export function diaryLines(c: Career, L: readonly DiaryEntry[] = c.log): { w: number; t: string }[] {
  return L.map((x) => ({ w: x.w, t: rw(diaryText(c, x.e)) }));
}

