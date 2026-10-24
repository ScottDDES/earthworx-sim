// Words for a card with its names and amounts filled in, and the line that says what happened after you chose.
// The prototype's sentences, word for word. choose.ts draws the card (its options and numbers); this reads them.

import type { Career } from '../game';
import type { Answer, DrawnCard } from '../choose';
import { TYPES, machineName, type Machine, type MachineType } from '../machines';
import { TOWNS } from '../towns';
import { MOODS } from '../market';
import { REWORK_HEAVY, REWORK_LIGHT, RAIN_HEAVY } from '../cards';
import { LD_OWN } from '../council';
import { TRUCK_DAY } from '../planning';
import { WHS_SYS } from '../overheads';
import { HURT_ADVISORY, WELLBEING_ADVISORY, nearMissAdvisoryCost, seriousAdvisoryCost } from '../advisory';
import { compat } from '../compat';
import { DAM_KIND, comeback, comebackDoubt, farmer, firstName } from './bulk';
import { RTW_ADVISORY } from '../advisory';
import { BID_PTS, onRetainer } from '../ddes';
import { STAGE_NAME, qty } from './bulk';
import { KINDS } from '../bulk';
import { COMP_SHARE, COMP_AFTER } from '../staff';
import { UFD_ODDS } from '../later';
import { yearOf } from '../calendar';
import { councilTitle, jobTitle, pmOf, subTenderTitle } from './work';
import { NEAR_MISS_STORIES, QUIET_REPLIES, SERIOUS_STORIES } from './safety';
import { TICKET_TEXT } from './career';
import { rw } from './real';

const f = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-AU');
const fk = (n: number) => (n >= 1e6 ? '$' + Math.round(n / 1e4) / 100 + 'M' : n >= 1000 ? '$' + Math.round(n / 1000) + 'k' : f(n));
const round = (n: number, to: number) => Math.round(n / to) * to;
const s = (n: number) => (n > 1 ? 's' : '');
const cap = (t: string) => t.replace(/^./, (x) => x.toUpperCase());
/** The real game: an advisory fee, or nothing on retainer. */
const adv = (c: Career, fee: string) => (onRetainer(c) ? 'on your retainer' : fee);
const label = (m: Pick<Machine, 'type' | 'multi' | 'year'>) => machineName(m) + ', ' + m.year;
const short = (k: MachineType) => TYPES[k].short;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const QNAME: Record<number, string> = { 6: 'April to June', 9: 'July to September', 0: 'October to December', 3: 'January to March' };

export const BREAK_STORIES = ['A hydraulic hose has blown.', 'The starter motor\'s gone.', 'The transmission is slipping.', 'A blade cylinder is leaking.'] as const;

/** A BAS quarter, as the tax office names it. */
export const quarterName = (qm: number, qy: number) => QNAME[qm] + ' ' + qy;
/** A year in review: "FY 2027–28", or the first long stretch. */
export const fyName = (y: { w: number; first?: boolean; weeks: number }) => (y.first ? 'Your first ' + y.weeks + ' weeks' : 'FY ' + (yearOf(y.w) - 1) + '–' + String(yearOf(y.w)).slice(2));

export interface ResultRow {
  name: string;
  price: number;
  score: number;
  method?: number;
  you: boolean;
}

export interface CardView {
  tag: string;
  title: string;
  body: string;
  opts: { id: string; label: string; sub: string }[];
  /** A tender result's table, and why the top two scored what they did. */
  table?: { rows: ResultRow[]; why: { text: string; you: boolean }[]; council: boolean };
}

type Opt = { label: string; sub: string };

function whoName(c: Career, who: string | null): string {
  if (who === 'you') return 'You';
  return c.staff.find((p) => p.id === who)?.name ?? 'A casual';
}
const jt = (j: unknown) => jobTitle(j as never);

/** Why the winner and you scored what you did. */
function scoreWhy(R: any[], council: boolean): { text: string; you: boolean }[] {
  const row = (e: any) => {
    const p = e.parts;
    if (!p) return null;
    return e.name + ': price ' + e.pp.toFixed(1) + ', record ' + p.rec + ', safety ' + (p.saf > 0 ? '+' : '') + p.saf + (p.fin ? ', finances ' + p.fin : '') + (p.load ? ', work on ' + p.load : '') + (p.rel ? ', standing ' + (p.rel > 0 ? '+' : '') + p.rel : '') + (council ? ', program ' + e.method : '');
  };
  const me = R.find((e) => e.you), top = R[0], out: { text: string; you: boolean }[] = [];
  if (top && top.parts) out.push({ text: row(top)!, you: !!top.you });
  if (me && me !== top && me.parts) out.push({ text: row(me)!, you: true });
  out.push({ you: false, text: 'Price out of 60 (cheapest gets 60). Non-price out of 40: track record, safety, finances and work already on' + (council ? ', plus up to 6 for the program' : '') + '.' });
  return out;
}
const table = (R: any[], council: boolean): CardView['table'] => ({
  rows: R.map((e) => ({ name: e.name, price: e.price, score: e.tot, method: e.method, you: !!e.you })), why: scoreWhy(R, council), council,
});

/** The card as the player sees it. d is what drawCard gave. */
export function cardView(c: Career, q: Career['queue'][number], d: DrawnCard): CardView {
  const v = cardView0(c, q, d);
  return { ...v, tag: rw(v.tag), title: rw(v.title), body: rw(v.body), opts: v.opts.map((o) => ({ ...o, label: rw(o.label), sub: rw(o.sub) })) };
}

function cardView0(c: Career, q: Career['queue'][number], d: DrawnCard): CardView {
  const D = d.data, by: Record<string, Opt> = {}, out = (tag: string, title: string, body: string, tbl?: CardView['table']): CardView =>
    ({ tag, title, body, opts: d.opts.map((x) => ({ id: x.id, label: by[x.id]?.label ?? x.id, sub: by[x.id]?.sub ?? '' })), table: tbl });
  const put = (id: string, label: string, sub: string) => { by[id] = { label, sub }; };
  switch (q.k) {
    case 'swms':
      if (compat.prototype) put('pay', 'Pay someone to write them · ' + f(WHS_SYS[1]!.cost), 'Done properly this week. You can tender straight away.');
      else put('pay', 'Ring DDES Advisory · ' + f(WHS_SYS[1]!.cost), 'They write your SWMS, WHS plan and inductions this week. You can tender straight away.');
      put('self', 'Write them yourself at night', 'Free, but you\'re flat out: off the tools for 3 days next week while you finish them.');
      return out('Safety', 'Head contractors want your SWMS', 'You\'ve got the gear and the track record to subcontract. Before they\'ll send you a package, head contractors want safe work method statements for each task, a WHS plan, and proof your crew is inducted.');
    case 'serious': {
      const nm = whoName(c, D.who), what = SERIOUS_STORIES[D.card.story];
      put('notify', 'Notify the regulator and cooperate', 'The site stands down for a week while they investigate. ' + (D.sys >= 2 ? 'Your system shows you did what you could, so a fine is unlikely.' : 'With ' + (D.sys ? 'only SWMS' : 'nothing written down') + ', expect a fine of ' + fk(D.fineLo) + ' to ' + fk(D.fineHi) + '.') + ' Insurance up 25%, track record −2.');
      put('hide', 'Keep it quiet and get the job going', 'No stand-down today. If it comes out, and these things do, it\'s a much bigger fine and the council won\'t touch you for six months.');
      if (compat.prototype) return out('Serious incident', nm + ' is in hospital', nm + ' ' + what + '. They\'re in hospital and will be off for months. It\'s a notifiable incident: the safety regulator must be told, and the site preserved.' + (D.job ? ' It happened on ' + jt(D.job) + '.' : ''));
      put('advisory', 'Ring DDES Advisory · ' + adv(c, (D.sys >= 2 ? f(seriousAdvisoryCost(0)) : fk(seriousAdvisoryCost(D.fineLo)) + ' to ' + fk(seriousAdvisoryCost(D.fineHi))) + ' all up'), 'They deal with the regulator, run the investigation and do the paperwork, and any fine is in that price. Cheaper than going it alone. The site still stands down for a week. Insurance up 10%, track record −1.');
      {
        // the client on the phone, the hush with nothing in the small print about how it ends
        const pm = D.hc ? pmOf(D.hc) : null;
        put('notify', 'Ring the regulator', 'The site stops for a week while they investigate. ' + (D.sys >= 2 ? 'Your system shows you did what you could, so a fine is unlikely.' : 'With ' + (D.sys ? 'only SWMS' : 'nothing written down') + ', expect a fine of ' + fk(D.fineLo) + ' to ' + fk(D.fineHi) + '.') + ' Insurance up 25%, track record −2.' + (D.hc ? ' ' + D.hc + ' will have something to say about it.' : ''));
        put('hide', 'Get the crew going again, sort the paperwork later', 'Nobody from outside saw it. The crew did.');
        const who = nm === 'You' ? 'you' : nm, off = (nm === 'You' ? 'You\'re' : 'They\'re') + ' off for months.';
        const call = pm ? ' Ten minutes later ' + pm + ' rang: "We\'re behind on this package. I can\'t have the site shut."' : D.job && D.job.kind === 'own' ? ' The council\'s works supervisor rang within the hour: "How long are you going to be off the job?"' : '';
        return out('Serious incident', nm + ' is in hospital', (D.job ? 'On ' + jt(D.job) + ', ' : '') + who + ' ' + what + '. ' + off + call + ' The law says you tell the safety regulator and leave the site as it is.');
      }
    }
    case 'nearmiss':
      put('report', 'Report it and talk it through · ' + f(D.card.cost), 'Stop the crew for an hour, change the SWMS, log it. The hazard gets fixed and the crew sees you mean it.');
      put('shrug', 'Have a word and move on', 'No time lost. The hazard\'s still there, and the crew learns near misses don\'t matter.');
      if (!compat.prototype) {
        put('advisory', 'Ring DDES Advisory · ' + adv(c, f(nearMissAdvisoryCost(D.card.cost))), 'They look into it, update your SWMS and run the talk. The crew barely stops, and the fix is a proper one.');
        put('report', (D.job ? 'Stop the job and sort it out · ' : 'Stop and sort it out · ') + f(D.card.cost), D.job ? 'The crew stands down for a day while you redo the plan with them. A day more behind.' : 'Stop the crew, change the SWMS, log it.');
        put('shrug', 'Have a word and keep going', D.job ? 'You stay on program.' : 'No time lost.');
        return out('Near miss', 'That was close', NEAR_MISS_STORIES[D.card.story] + ' Nobody was hurt.' + (D.job ? ' It was on ' + jt(D.job) + ', and ' + (D.job.kind === 'sub' ? pmOf(D.job.client) + ' has rung twice this week asking when you\'ll be done.' : 'the council wants it finished.') : ''));
      }
      return out('Near miss', 'That was close', NEAR_MISS_STORIES[D.card.story] + ' Nobody was hurt.' + (D.job ? ' On ' + jt(D.job) + '.' : ''));
    case 'quiet': {
      const n = D.person.name;
      put('yarn', 'Take ' + n + ' for a feed and a yarn', '$80 and an hour of your time. Just ask how they\'re going, and listen.');
      put('daysOff', 'Give ' + n + ' a few days off, paid', 'Their wage for nothing back this week, and their seat goes to a casual.');
      put('leave', 'Leave it, they\'ll be right', 'None of your business. Probably.');
      if (!compat.prototype) {
        put('advisory', 'Ring DDES Advisory · ' + adv(c, f(WELLBEING_ADVISORY)), 'They run a wellbeing check-in for the whole crew and leave a support line number in the smoko room.');
        put('yarn', 'Take ' + n + ' for a feed anyway', '$80 and an hour. They might not want to talk.');
        put('daysOff', 'Give ' + n + ' a few days off, paid', 'Their wage for nothing back, and a casual on their machine. They might take it the wrong way.');
        put('leave', 'Take ' + n + ' at their word', 'They asked you to leave it.');
        return out('Crew', n + '\'s been quiet lately', n + ' hasn\'t been themselves for a couple of weeks: short with the others, last to the ute, first to leave. You asked on Monday if they were right. "I\'m good, boss. Don\'t make a thing of it."');
      }
      return out('Crew', n + '\'s been quiet lately', n + ' hasn\'t been themselves for a couple of weeks: short with the others, last to the ute, first to leave. Things might be tough at home.');
    }
    case 'turnover': {
      const m = D.m as Machine;
      put('auction', 'Put it in next week\'s auction', 'Goes to the highest bidder.');
      put('list', 'List it privately · ' + f(D.listPrice), 'Takes 2 to 5 weeks to sell.');
      put('keep', 'Keep it going another six months', D.by + ' won\'t raise it again until then.');
      return out('Workshop', D.by + ' reckons the ' + short(m.type) + ' is done', '"The ' + label(m) + ' is down to ' + Math.round(m.cond) + '%. It\'s worth about ' + f(D.value) + ' now, and every month it\'ll cost you more in breakdowns and lose more value. Time to turn it over and buy something newer."');
    }
    case 'svcfind': {
      const m = D.m as Machine, dd = D.dd as number, j = D.job;
      put('fix', 'Fix it properly now · ' + f(D.fix), dd ? 'Down ' + dd + ' days' + (j ? ': that crew stands for those days.' : '.') + ' Then it\'s sorted.' : 'No time lost. Then it\'s sorted.');
      put('patch', 'Bandaid it · ' + f(D.patch), 'Keeps working. Breakdown odds go up every day it works until it\'s fixed properly, and a failure costs about ' + f(D.fix * 1.8) + '. You can fix it properly later from the Yard.');
      return out('Workshop', (D.by ? D.by + ' found a problem on the ' : 'The service turned up a problem on the ') + short(m.type),
        'A ' + D.part + '. Fixing it properly is about ' + f(D.fix) + (dd ? ' and ' + dd + ' days in the workshop' + (j ? ', with the machine off ' + jt(j) + '.' : '.') : ', and ' + D.by + ' can do it in the workshop tonight.') + ' Patch it and it\'ll keep going, but it\'s more likely to let go, and dearer when it does.');
    }
    case 'swapin': {
      const k = D.type as MachineType, T = TYPES[k], wet = D.wet as boolean, title = jt(D.j);
      const hire = wet ? 'a subbie\'s ' + T.short + ' at ' + f(T.sub) + ' a working day' : 'a hired ' + T.short + ' at ' + f(T.dry) + ' a week';
      put('putOn', 'Put it on ' + title, wet ? 'Saves about ' + f(T.sub - T.fuel) + ' a working day, less an operator.' : 'Saves ' + f(T.dry) + ' a week of hire.');
      put('keepFree', 'Keep it free for hire work', 'The hire-in stays on. I won\'t ask about this job again for 4 weeks.');
      return out('Your fleet', 'Your ' + T.short + ' is back in the yard', 'The ' + label(D.m) + ' is free. You\'re paying for ' + hire + ' on ' + title + '. Put yours on and that stops; you pay its fuel and ' + (wet ? 'an operator' : 'wear') + ' instead.' + (D.ops ? ' An operations manager would make this call for you.' : ''));
    }
    case 'rainday': {
      const day = DAYS[D.d]!, cr = D.crews as number, bk = (D.bulk as number) || 0, rd = cr - bk;
      if (bk) {
        // bulk work in the mix: wet dirt, not wet formation
        const have = (rd ? rd + ' road crew' + s(rd) + ' and ' : '') + bk + ' bulk job' + s(bk) + ' going';
        put('standDown', 'Send everyone home ' + day, 'Lose the day whatever falls. No rework.');
        put('pushOn', 'Push on and work through it', 'If it misses you, you get the day in. Light rain costs about ' + f(REWORK_LIGHT * cr) + ' drying out and reworking the top layer. Over ' + RAIN_HEAVY + ' mm the fill turns to slop: about ' + f(REWORK_HEAVY * cr) + ' to strip it out, and the day\'s lost anyway.');
        return out('Weather', 'Rain forecast for ' + day, 'The forecast has about ' + D.fmm + ' mm on ' + day + ' around ' + TOWNS[c.town].name + ' (' + D.pc + '% chance). You have ' + have + '. Wet dirt won\'t push, cart or compact' + (rd ? ', and 4 mm stops work on unsealed formation.' : '.'));
      }
      put('standDown', 'Stand the crews down ' + day, 'Lose the day whatever falls. No rework.');
      put('pushOn', 'Push on and work through it', 'If it misses you, you get the day in. Light rain costs about ' + f(REWORK_LIGHT * cr) + ' in touch-up passes. Over ' + RAIN_HEAVY + ' mm the formation pugs up: about ' + f(REWORK_HEAVY * cr) + ' of rework and the day\'s lost anyway.');
      return out('Weather', 'Rain forecast for ' + day, 'The forecast has about ' + D.fmm + ' mm on ' + day + ' around ' + TOWNS[c.town].name + ' (' + D.pc + '% chance). You have ' + cr + ' crew' + s(cr) + ' out. 4 mm stops work on unsealed formation.');
    }
    case 'break': {
      const m = D.m as Machine, k = D.card, j = D.job;
      put('warranty', 'Claim it on the dealer warranty', 'Free. Down for ' + k.dd + ' days while their mechanic gets out.');
      if (D.fitter) {
        put('fitterFix', D.fitter + ' fixes it properly · ' + f(D.fitFix), 'Parts and their time. Down ' + D.fitDays + ' day' + (D.fitDays === 1 ? '' : 's') + ', then it\'s sorted.');
        put('patch', D.fitter + ' patches it up · ' + f(D.fitPatch), 'Back working tomorrow. Breakdown odds go up until it\'s fixed properly, and it costs more when it lets go.');
      }
      put('mobile', 'Get a mobile mechanic out', f(k.cost * 1.25) + '. Back working next week.');
      put('dealer', 'Wait for the dealer\'s workshop', f(k.cost) + '. Down about ' + k.dd + ' days next week.');
      if (k.rc != null) put('hireIn', 'Hire in a replacement', f(k.cost + k.rc) + ' all up. The client never misses a day.');
      put('adFix', 'Watch an ad: the mechanic\'s on us', 'Free. Fixed on the spot, back to work tomorrow.');
      return out('Breakdown', 'The ' + short(m.type) + ' has broken down', (D.patched ? 'The patched-up ' + D.patched + ' has let go, and taken more with it.' : BREAK_STORIES[k.story]) + ' The repair is about ' + f(k.cost) + (j ? '. It was on ' + jt(j) + '.' : '.') + (D.overdue ? ' It was overdue for a service.' : ''));
    }
    case 'brtender': {
      const bn = TOWNS[D.town as keyof typeof TOWNS].name;
      put('sharp', 'Go in sharp', 'Good odds of winning, thin margin.');
      put('proper', 'Price it properly', 'Less likely, but it pays.');
      put('letGo', 'Let it go', 'Keep the crews on their usual work.');
      return out('Your branch', D.mgr + ' has a council package in ' + bn, '"The shire\'s letting ' + fk(D.card.val) + ' of resheeting over about ' + D.card.wk + ' weeks. We\'ve got the crews for it. How sharp do you want to go?"');
    }
    case 'brraise': {
      const bn = TOWNS[D.town as keyof typeof TOWNS].name;
      put('pay', 'Pay it · +' + f(400) + '/wk', 'Keeps them, and they might step up.');
      put('no', 'Say no', 'Saves the money. They might walk.');
      return out('Your branch', D.mgr + ' wants a raise', '"I\'ve built ' + bn + ' up from nothing. Another ' + f(400) + ' a week and I\'m here for the long haul."');
    }
    case 'collapse':
      put('claim', 'Lodge a claim with the administrators', 'Free. Wait and see what the dividend is.');
      put('sell', 'Sell the debt to a collector · ' + f(D.card.sell), 'Cash this week, and you never think about it again.');
      return out('The industry', D.name + ' has gone into administration', 'The administrators changed the locks this morning. You were owed ' + f(D.debt) + ', counting retention on any job you had with them, and that work has stopped. Unsecured creditors usually see 10 to 30 cents in the dollar, most of a year from now.');
    case 'freeze':
      put('ok', 'Batten down', 'Keep the gear working on hire, chase what you\'re owed, and hold off buying.');
      return out('The industry', 'Flood recovery funding is on hold', 'The state has paused new flood recovery funding while it reviews the program. Expect far fewer packages and council tenders until about week ' + D.until + ', and the council will take four weeks longer to pay claims.');
    case 'insure':
      put('wear', 'Wear it', 'Pay the new rate for the year.');
      put('broker', 'Get a broker to shop it around · $1,500', 'Half the time a broker finds cover that only goes up 15%.');
      return out('The industry', 'Insurance has gone up across the board', 'After a run of big claims, insurers have put premiums up 35% across earthmoving for the next year. Yours goes from about ' + f(Math.round(D.premium / 1.35)) + ' to ' + f(D.premium) + ' a week.');
    case 'bankcall':
      put('moreTime', 'Ask for more time · $750 fee', D.od ? 'Three more weeks to get back under the limit.' : 'They reset the count: one missed repayment, not two. The arrears still stand.');
      put('ringAround', 'Ring around about selling gear', 'A bigger outfit may pay cash for machines this week.');
      put('leave', 'Leave it with them', 'Next time it\'s a machine.');
      return out('The bank', 'The bank manager is on the phone', (D.od ? 'You\'ve been over your overdraft limit two weeks running.' : 'You\'ve missed two loan repayments.') + ' One more and they\'ll take a machine and sell it at auction prices.' + (D.again ? ' They gave you more time not long ago and won\'t again.' : D.hc ? ' On Hardcore they don\'t do extensions.' : ''));
    case 'bas': {
      const B = D.B, qn = quarterName(B.qm, B.qy);
      put('pay', 'Lodge and pay · ' + f(B.amt), 'On time and square with the tax office.' + (D.short ? ' It takes you into the overdraft.' : ''));
      put('payAnyway', 'Pay it anyway · ' + f(B.amt), 'The tax office won\'t give you another plan this year. It takes the money, overdraft or not, and the councils hear about it.');
      put('plan', 'Ask for a payment plan', 'Three payments over 12 weeks, about ' + f(D.interest) + ' in interest.' + (D.hc ? ' One plan a year, no more.' : '') + (D.plans ? ' Another plan so soon and they\'ll look harder at you.' : ''));
      return out('Tax office', 'Your BAS for ' + qn + ' is due', 'You collected ' + f(B.qIn) + ' of GST from clients and paid ' + f(B.qOut) + ' to suppliers, so ' + f(B.amt) + ' goes to the tax office.' + (D.canPay ? '' : ' You haven\'t got it, even with the overdraft.') + ' GST was never your money: it\'s best kept aside each week.');
    }
    case 'yearend': {
      const Y = D.y;
      put('ok', 'On to the new financial year', 'It\'s all in the Office under Past years.');
      const yr = !compat.prototype && Y.first && Y.weeks < 26 ? 'start' : 'year';
      return out('Year in review', fyName(Y) + ' in review', (Y.profit >= 0 ? 'A profitable ' + yr + ': ' + f(Y.profit) + ' on ' + f(Y.rev) + ' of work.' : 'A losing ' + yr + ': ' + f(-Y.profit) + ' down on ' + f(Y.rev) + ' of work.') + ' Net worth went from ' + f(Y.nw0) + ' to ' + f(Y.nw) + '.' + (Y.ddes ? ' DDES saved or got back ' + f(Y.ddes) + ' for you, after its fees.' : ''));
    }
    case 'late': {
      const x = D.x;
      put('chase', 'Chase it under Security of Payment', 'You\'ll be paid in 3 weeks. ' + x.client + ' won\'t hire you for six months.');
      put('friendly', 'Ring the boss, keep it friendly', 'Maybe half now. The relationship stays.');
      put('adPay', 'Watch an ad: get paid now', 'The full ' + f(D.amt) + ' lands this week. No phone call, no hard feelings.');
      put('park', 'Park your machine until they pay', 'They need it. Leverage, but you lose the rest of the hire.');
      put('wait', 'Wait it out', 'Usually turns up within a fortnight.');
      return out('Money', x.client + ' hasn\'t paid', 'Your ' + f(D.amt) + ' invoice is overdue. The bank repayment of ' + f(D.weekly) + ' still comes out every week.');
    }
    case 'clearing':
      put('borrow', 'Borrow $20k and go bid', 'Higher repayments, but you can take on pads and private jobs yourself.');
      put('cash', 'Go with cash only', 'If it goes past $46k, you walk away.');
      put('skip', 'Skip it, keep building cash', 'Safe. You\'ll keep hiring rollers in.');
      return out('Opportunity', 'A roller at a clearing sale, Saturday', 'A farm clearing sale near ' + D.place + ' has a smooth drum roller. Worth about $65k; bidding usually stalls in the mid-forties. You have ' + f(D.bank) + ' in the bank.');
    case 'hurt': {
      const n = D.person.name;
      if (D.sub) put('home', 'Send ' + n + ' home, put ' + D.sub + ' on it', D.sub + ' takes ' + n + '\'s machine and the job keeps going. ' + n + ' is off for 2 weeks and knows you look after your crew.');
      else put('home', 'Send ' + n + ' home to get it checked', 'Their job stops for 2 weeks, and the client may not wait. ' + n + ' knows you look after your crew.');
      put('cover', 'Jump on the machine yourself', 'Their job keeps going. Yours stops for a week.');
      put('keepGoing', 'Let ' + n + ' keep going', 'No lost time. A real risk of a WHS incident.');
      if (!compat.prototype) {
        put('advisory', 'Ring DDES Advisory · ' + adv(c, f(HURT_ADVISORY)), 'They manage the injury: the right doctor this week and a return-to-work plan. ' + n + ' is back in a week, not two.');
        put('homePaid', 'Send ' + n + ' home on full pay', 'Two weeks\' wages for nothing back' + (D.sub ? '. ' + D.sub + ' takes their machine.' : ', and their job stops.'));
        put('home', 'Send ' + n + ' home', (D.sub ? D.sub + ' takes their machine. ' : 'Their job stops, and ') + (D.sub ? n + '\'s pay stops for the two weeks.' : 'so does their pay.'));
        put('keepGoing', 'Let ' + n + ' keep going', 'It\'s their back, and their call.');
        return out('Crew', n + '\'s back has gone', n + ' says a week of rough tracks has done their back in. "I\'ll be right. I need the hours, boss. The bank\'s on me about the house."');
      }
      return out('Crew', n + '\'s back has gone', n + ' says a week of rough tracks has done their back in, but wants to keep going.');
    }
    case 'wetclay': {
      const t = (DAM_KIND[D.job.dk as keyof typeof DAM_KIND] ?? 'dam').toLowerCase();
      put('wait', 'Wait for it to dry', 'Two working days lost while the clay dries out. The wall goes in right.');
      put('push', 'Push on', 'No days lost, but wet clay won\'t compact: this week\'s layers go in soft.' + (D.tested ? ' The wall gets tested at the end.' : ' It might hold. It might leak.'));
      if (!compat.prototype) {
        const dam = ['ringTank', 'turkeyNest'].includes(D.job.dk), who = D.job.dk === 'dev' ? D.job.client : firstName(D.job.client);
        put('wait', 'Wait for it to dry', 'Two working days lost. ' + who + ' won\'t be happy.');
        put('push', 'Push on', who + ' gets it on time. This week\'s layers go in wet.');
        return out('Bulk and Ag', 'The clay\'s wet', D.mm + ' mm last week. The clay in the pit on ' + (D.job.dk === 'dev' ? D.job.client : farmer(D.job.client)) + '\'s ' + t + ' near ' + D.job.place + ' is too wet to roll down. '
          + (dam ? who + ' rang this morning: "I\'ve got 400 head coming in a month. I need water in that dam."' : who + ' rang this morning: "The builders are booked for next month. It has to be ready."'));
      }
      return out('Bulk and Ag', 'The clay\'s wet', D.mm + ' mm last week. The clay in the pit on ' + D.job.client + '\'s ' + t + ' near ' + D.job.place + ' is too wet to roll down.');
    }
    case 'leak': {
      const cb = comeback(D.dk);
      put('fix', 'Go back and fix it · ' + f(D.fix), 'Float a spread back out and put it right properly this time.');
      put('argue', cb.argue, 'Free today. ' + D.farm + ' will tell everyone at the field day. Track record −2.');
      if (!compat.prototype && q.q != null) {
        const dz = comebackDoubt(D.dk, D.farm);
        put('fix', 'Go back and fix it · ' + f(D.fix), 'Float a spread out and put it right. Your cost.');
        put('show', dz.show, 'Free today, if ' + firstName(D.farm) + ' believes you.');
        return out('Bulk and Ag', cb.title(farmer(D.farm)), cb.body(farmer(D.farm), D.place) + ' ' + dz.body);
      }
      return out('Bulk and Ag', cb.title(D.farm), cb.body(D.farm, D.place));
    }
    case 'redzone':
      if (!compat.prototype && D.farm) {
        const fn = firstName(D.farm);
        put('no', 'Tell ' + fn + ' you can\'t touch it', fn + '\'s got other dozer blokes\' numbers.');
        put('permit', 'Tell ' + fn + ' to get a permit first', 'You\'ll do it when the paperwork\'s through. That\'s months, and ' + fn + ' wants it done now.');
        put('take', 'Push it over · ' + f(D.cash) + ' cash', 'Three days on the dozer. Cash on Friday, and the dam\'s still yours.');
        return out('Bulk and Ag', fn + ' wants a favour', farmer(D.farm) + ' rang. ' + (D.dam ? fn + '\'s got a turkey nest dam lined up for you after this, about ' + fk(D.dam.budget) + '. ' : '') + 'Before that, ' + fn + ' wants 40 acres of brigalow pushed over on the back paddock. You\'ve seen the map: it\'s marked as not to be cleared. "Nobody\'s been out there in twenty years. Cash, no paperwork. You\'re my dozer bloke, aren\'t you?"');
      }
      put('no', 'Say no', 'It\'s not allowed to be cleared, and the fine would land on you as well as them. They might ring someone else for their next dam.');
      put('take', 'Take it · ' + f(D.cash) + ' cash', 'Three days on the dozer, hourly, cash in hand. If it comes out over the next year: a fine of about ' + f(D.fine) + ' and track record −3.');
      return out('Bulk and Ag', 'A job off the books', 'A grazier rang. They want a patch of scrub pushed over on the back of the place: country you know is mapped as not to be cleared. Hourly rate, cash, no paperwork. "Nobody goes out there."');
    case 'injured': {
      const n = D.person.name, wk = D.left as number;
      put('keep', 'Keep ' + n + ' on and plan the return to work', 'You pay a quarter of their wage until they\'re back, and find them light duties when the doctor says so.');
      put('letGo', 'Let ' + n + ' go and take on the new operator', 'Saves the wage, and you\'ve a full-time operator now.');
      put('advisory', 'Ring DDES Advisory · ' + adv(c, f(RTW_ADVISORY)), 'They run the return-to-work plan with the insurer and the doctor.');
      return out('Crew', 'What about ' + n + '?', n + ' has been off ' + COMP_AFTER + ' weeks. Workers\' compensation now pays ' + Math.round(COMP_SHARE * 100) + '% of their wage and you pay the rest. The doctor says light duties in about six weeks, full duties in ' + wk + '. A casual\'s been on their machine, and a good operator from the next town is looking for work.');
    }
    case 'cashjob': {
      const j = D.job, fn = firstName(j.client);
      put('invoice', 'Tell ' + fn + ' it goes through the books', 'Full price, ' + f(D.price) + ', on an invoice. ' + fn + ' might remember it next time.');
      put('cash', 'Do it for cash · ' + f(D.cashPrice), 'Cash in hand when it\'s done. Nothing on paper.');
      return out('Bulk and Ag', 'Cash, no invoice', farmer(j.client) + ' rang about the ' + (DAM_KIND[j.dk as keyof typeof DAM_KIND] ?? 'job').toLowerCase() + ' near ' + j.place + '. "Knock ten per cent off and I\'ll pay cash. No invoice, no GST, nothing on paper. Everyone does it."');
    }
    case 'signoff': {
      const j = D.job;
      put('test', 'Tell him to do the tests', 'The wall gets tested like any other.');
      put('sign', 'Pay him · ' + f(D.bribe), 'The tests pass, whatever the wall\'s like.');
      return out('Bulk and Ag', 'The engineer\'s offer', 'The engineer doing the compaction tests on ' + farmer(j.client) + '\'s ' + (DAM_KIND[j.dk as keyof typeof DAM_KIND] ?? 'wall').toLowerCase() + ' near ' + j.place + ' leaned on your ute. "I can sign these off without pulling cores. A carton and ' + f(D.bribe) + ' for my trouble, and you\'re done."');
    }
    case 'tip': {
      const t = D.t;
      put('no', 'Tell them you\'d rather not know', 'You price it blind, like everyone else.');
      put('use', 'Take the number and go in just under it', 'Your price goes in a hair under theirs.');
      return out('Tenders', 'A tip on the price', 'Over a beer at the pub, ' + t.tip.name + '\'s estimator offers to tell you their number on ' + subTenderTitle(t) + ', closing this week. "Just so we don\'t cut each other\'s throats."');
    }
    case 'dieselWar':
      if (D.load) put('fill', 'Get a load in now · ' + f(D.load.cost), 'Half a tank, ' + D.load.L.toLocaleString('en-AU') + ' litres at $' + D.load.at.toFixed(2) + ' a litre, before it climbs further. Rationed: it takes two weeks to come.');
      put('levy', 'Ask your clients for a fuel levy', 'They pay back about half the rise on your fuel until it settles. Not everyone likes being asked: track record −1.');
      put('wear', 'Wear it', 'Pay what diesel costs. Council contracts pay most of the rise back anyway (rise and fall). Farmers and private clients don\'t.');
      return out('News', 'Diesel through the roof', 'War has broken out overseas, and diesel is up to $' + D.pump.toFixed(2) + ' a litre at the pump. The fuel companies say it will keep climbing for a fortnight. Loads are rationed: half loads only, and two weeks to come. '
        + (D.tank ? 'Your tank has ' + D.L.toLocaleString('en-AU') + ' litres in it' + (D.order ? ', and a load is on its way.' : '.') : 'You\'re buying it at the pump.'));
    case 'xmas':
      put('party', 'Christmas party at the pub · ' + f(D.cost.party), 'A proper night out for the crew and their partners. They\'ll be talking about it for weeks.');
      put('bbq', 'A slab and a barbie in the yard · ' + f(D.cost.bbq), 'Friday arvo, sausages and a few beers. Better than nothing.');
      put('skip', 'Skip it this year', 'Saves the money. The crew notices.');
      return out('Crew', 'Christmas', 'From next week the district shuts down for two weeks: the council, the head contractors and the farmers all knock off. Your jobs stop and pick up again in January, and any contract deadlines move back two weeks. Wages are still paid. How do you send the crew off?');
    case 'breakin':
      put('claim', 'Claim it on insurance', '$1,000 excess. Your premium goes up 8% and eases back over the year.');
      put('camera', 'Replace it yourself and put up a camera', '$3,800 now. Halves the chance of it happening again.');
      put('without', 'Run without GPS for now', 'Grade by eye. Saves money today, if nobody notices.');
      return out('Bad luck', 'Someone\'s been in the yard', 'The GPS screen is gone from a machine and 400 litres of diesel are missing.' + (D.home ? ' Behind the house, anyone can walk in.' : ''));
    case 'extra':
      put('ask', 'Do it, then ask to be paid', 'Keeps them happy. You might not get paid for it.');
      put('agree', 'Agree a price first', 'A day lost sorting it out, but you\'ll get paid.');
      put('free', 'Do it free to keep them sweet', 'They\'ll talk you up around town.');
      return out('Client', 'The client wants a bit extra', 'On ' + jt(D.job) + ', the owner asks you to "just do the track down to the dam while you\'re here". It isn\'t in your price. About 2 more days.');
    case 'callout': {
      const gj = D.job, pay = 3 * 2100;
      put('go', 'Get out there', '3 days at $2,100 a day, paid in 14 days. The council remembers who turned up.');
      if (gj) put('pullOff', 'Pull your grader off ' + jt(gj), 'Earn ' + f(pay) + ' and +1 track record. Your current job runs 3 days longer' + (gj.kind === 'wet' ? ', and ' + gj.client + ' may not like it' : '') + '.');
      put('flatOut', 'Tell them you\'re flat out', 'Nothing gained, nothing lost.');
      return out('Opportunity', 'Storm\'s cut the road to ' + D.place, 'A washout has closed the road to ' + D.place + '. The ' + D.council + ' needs a grader there tomorrow for three days, at an emergency rate.');
    }
    case 'early':
      put('take', 'Take ' + f(D.net) + ' now', 'Cash in the bank today, ' + f(D.total - D.net) + ' less overall.');
      put('wait', 'Wait for the full amount', 'Paid in full on their terms.');
      return out('Money', D.client + ' offers to pay early', 'Their accounts team will pay everything they owe you, ' + f(D.total) + ', this week if you knock 3% off. Otherwise it comes on their usual terms.');
    case 'tresult': {
      const t = D.t, top = D.top, title = subTenderTitle(t);
      if (D.direct && !D.won) {
        put('ok', 'Carry on', 'Price closer to their number next time.');
        return out('Tender result', 'Over their budget: ' + title, pmOf(t.hc) + ' had ' + f(t.budget) + ' for it. Your ' + f(t.bid) + ' was too dear, so it went to the next outfit on their list. No hard feelings.');
      }
      if (D.won) {
        put('sign', 'Sign the contract', t.crewDays + ' crew-days, due by week ' + (D.week + t.weeks) + '. Starts when your grader, roller and water cart are free.');
        put('pullOut', 'Pull out', (D.crew ? '' : 'You no longer have the gear for it. ') + 'Track record −2, and ' + t.hc + ' won\'t ask you to price for six months.');
        return out('Tender result', 'You won ' + title, t.hc + ' has awarded you the package at ' + f(t.bid) + '.', table(t.result, false));
      }
      put('ok', 'Carry on', 'Rivals who win price higher next time. Rivals who lose sharpen up.');
      return out('Tender result', 'Lost: ' + title, top.name + ' won it at ' + f(top.price) + '. ' + (D.diff > 0 ? 'You were ' + D.diff + '% dearer.' : 'You were ' + -D.diff + '% cheaper, but their track record outscored yours.'), table(t.result, false));
    }
    case 'cresult': {
      const t = D.t, top = D.top, me = D.me, title = councilTitle(t);
      if (D.won) {
        const pl = t.mine.pl;
        put('sign', 'Sign the contract', t.major ? 'Due 30 June ' + t.dlYear + '. Fall behind and the council moves roads to other contractors.' : 'You run it full time. Due ' + t.weeks + ' weeks after you start, then ' + f(LD_OWN) + ' a week in damages.');
        put('pullOut', 'Pull out', 'Track record −3. Councils talk to each other.');
        return out('Tender result', 'The council picked you', 'You won ' + title + ' at ' + f(t.bid) + '. Your plan: ' + pl.crews + ' crew' + s(pl.crews) + ', ' + pl.carts + ' water cart' + s(pl.carts) + ' and ' + pl.trucks + ' truck' + s(pl.trucks) + ' per crew, from the ' + t.pits[pl.pit].name.toLowerCase() + '.', table(t.result, true));
      }
      put('ok', 'Carry on', 'More packages come out most months.');
      return out('Tender result', 'Lost: ' + title, top.name + ' won it at ' + f(top.price) + '. ' + (D.diff > 0 ? 'You were ' + D.diff + '% dearer.' : 'You were cheaper, but lost on the non-price score.') + (me.method < 6 ? ' A tighter program would have scored more method points.' : '') +
        (me.dc && top.dc ? ' Where the gap was: the job itself cost you about ' + fk(me.dc) + ' against their ' + fk(top.dc) + ', and you priced in ' + fk(me.oh) + ' of overheads against their ' + fk(top.oh) + '.' + (me.oh > top.oh * 1.5 ? ' Your overheads are the gap: a lower overheads share wins more, but leaves less to cover them.' : '') : ''), table(t.result, true));
    }
    case 'variation':
      put('lodge', 'Do it, then lodge a variation', 'Keeps the job moving. You\'ll need your site diary to prove it was asked for.');
      put('writing', 'Get it in writing first', 'A day lost to paperwork, then you\'re covered.');
      put('free', 'Do it free to keep them sweet', 'Two unpaid days. They\'ll remember it.');
      return out('Contract', 'The supervisor wants extra culverts', 'On ' + jt(D.job) + ', the supervisor asks you to also clear 6 blocked culverts "while you\'re there". It isn\'t in your scope. About 2 crew-days.');
    // the real game: DDES's claims and the quarter's health check
    case 'overrun': {
      const j = D.job, pc = Math.round(((j.m3 as number) / (j.est as number) - 1) * 100);
      const what = j.stages ? STAGE_NAME[j.stages[j.si].id as keyof typeof STAGE_NAME].toLowerCase() + ' on the ' + jt(j).replace(/^./, (x: string) => x.toLowerCase()) : jt(j).replace(/^./, (x: string) => x.toLowerCase());
      put('ddes', 'Get DDES to claim it', 'They pull together the plans, the survey and your dockets and lodge a variation. Paid only if it\'s paid: ' + Math.round(D.fee * 100) + '% of what they get back.' + (D.contract ? ' Contract clients usually pay a well-made claim.' : ' Farmers pay less often, and they don\'t hold it against DDES.'));
      put('self', 'Claim it yourself', 'No fee, but a claim on the back of a docket gets knocked back more often, and gets you less.' + (D.contract ? '' : ' A farmer might take it personally.'));
      put('wear', 'Wear it', 'Your price was your price.');
      if (D.done) return out('DDES', 'More dirt than the plans', 'The ' + what + ' is finished, ' + pc + '% past what you priced off the plans. At your own rate the extra was worth about ' + f(D.value) + '.');
      return out('DDES', 'More dirt than the plans', 'The ' + what + ' is ' + pc + '% past what you priced, and there\'s more to come. You priced ' + qty(Math.round(j.est as number), KINDS[j.dk as keyof typeof KINDS].unit) + ' off the plans. At your own rate the extra is worth about ' + f(D.value) + ' so far.');
    }
    case 'eot': {
      const j = D.job;
      put('ddes', 'Get DDES to claim an extension of time', 'They lodge it with the rain records and your diary. Usually granted. Their fee is ' + Math.round(D.fee * 100) + '% of the damages it saves you.');
      put('self', 'Claim it yourself', 'No fee. Less often granted.');
      put('none', 'Take the damages', f(D.ld) + ' a week until it\'s done.');
      return out('DDES', 'The finish date\'s here', jt(j) + ' was due this week and isn\'t finished. The wet cost ' + D.wetD + ' working days on it. That\'s about ' + D.wks + ' week' + s(D.wks) + ' of extension, and damages are ' + f(D.ld) + ' a week.');
    }
    case 'ddescheck': {
      const T = 'Your quarterly health check';
      switch (D.find) {
        case 'cash':
          put('ok', 'Thanks', 'Slow the buying and chase what you\'re owed.');
          return out('DDES', T, 'DDES went through your books. "You\'re ' + f(-c.bank) + ' into the overdraft and it\'s going the wrong way. The bank will ring before ' + fk(D.od) + '. Chase your debtors this week, and hold off on gear until the forecast turns."');
        case 'over':
          put('claim', 'Get DDES to claim it', 'A variation, paid only if it\'s paid: ' + Math.round(D.fee * 100) + '% of what they get back.');
          put('later', 'Leave it for now', 'You can still be asked when it\'s further over.');
          return out('DDES', T, 'DDES went through your jobs. "' + cap(jt(D.job)) + ' is running past what you priced off the plans: about ' + f(D.value) + ' of extra work at your rate. That\'s claimable. Want us to put it in?"');
        case 'branch':
          put('close', 'Close the ' + TOWNS[D.town as keyof typeof TOWNS].name + ' branch', 'The gear floats home and the losses stop.');
          put('keep', 'Give it more time', 'Its reputation builds the longer it runs.');
          return out('DDES', T, 'DDES went through your branches. "' + TOWNS[D.town as keyof typeof TOWNS].name + ' has lost ' + fk(D.loss) + ' over the last quarter. Give the manager more gear, or cut it loose."');
        case 'svc':
          put('book', 'Book them in' + (D.idle ? ' · ' + f(D.cost) : ''), D.idle ? D.idle + ' idle machine' + s(D.idle) + ' serviced this week.' : 'They\'re all busy: the workshop will catch them when they\'re free.');
          put('later', 'Leave it', 'They\'ll run. Breakdowns are likelier.');
          return out('DDES', T, 'DDES went through your plant register. "' + D.n + ' machines are past their service. That\'s where your breakdowns are coming from."');
        default:
          put('ok', 'Good to hear', '');
          return out('DDES', T, 'DDES went through your books, jobs, branches and plant. "Nothing to worry about this quarter. Keep doing what you\'re doing."');
      }
    }
    case 'gravel':
      put('cart', 'Cart from the better pit further out', 'About ' + f(D.cost) + ' more in cartage for the rest of the job. A sure thing.');
      put('work', 'Work it harder: more water, more passes', '2 more crew-days, unpaid. It might not pass.');
      put('argue', 'Argue it\'s within spec', 'Costs nothing if you\'re right.');
      return out('Contract', 'The gravel failed its test', 'The pit gravel on ' + jt(D.job) + ' failed compaction testing. ' + D.job.client + ' won\'t accept it as it is.');
    case 'drydam':
      put('bore', 'Pay a landholder for bore water', '$4,000, same distance. Crews keep going at ' + Math.round(D.now * 100) + '%.');
      put('far', 'Cart from the next dam', 'No cost now. Crews drop to ' + Math.round(D.further * 100) + '% pace.');
      put('farMore', 'Cart from the next dam and hire another cart per crew', f(D.cartWk) + ' a week more, plus casuals. Crews stay at ' + Math.round(D.more * 100) + '%.');
      return out('Contract', 'The dam\'s down to mud', 'The dam you\'ve been carting water from for ' + jt(D.job) + ' is dry. The next one is 12 km further out.');
    case 'pitout':
      put('far', 'Switch to the far pit', 'Same trucks. They\'ll bring in ' + Math.round(D.farSupply) + ' m³ a day per crew.');
      put('farTrucks', 'Switch and add two trucks per crew', 'Keeps gravel up at ' + Math.round(D.farSupply2) + ' m³ a day, for ' + f(2 * TRUCK_DAY) + ' more per crew-day.');
      put('farmer', 'Buy from a farmer\'s pit next door', 'Same short haul, $8/m³ more: about ' + f(D.left * 8) + '.');
      return out('Contract', 'The near pit\'s run out', 'The near pit is worked out with ' + D.left.toLocaleString('en-AU') + ' m³ still to place on ' + jt(D.job) + '. The far pit is ' + D.farHaul + ' km away.');
    case 'repo':
      put('handOver', 'Hand over the keys', 'It\'s sold for about 60% of its value, which comes off your loan.');
      return out('The bank', D.od ? 'The bank has called in your overdraft' : 'Three missed repayments', D.m ? 'The bank is taking your ' + label(D.m) + ' and selling it at auction prices. Your career carries on.' : 'The bank has nothing left to take. You keep going with what you\'ve got.');
    case 'buyout': {
      const x = D.x, o = D.offer, pa = D.pa, fit = D.fit as number, counts: Record<string, number> = {};
      for (const g of o.yard) counts[g.type] = (counts[g.type] || 0) + 1;
      const gear = Object.keys(counts).map((t) => counts[t] + ' ' + short(t as MachineType) + (counts[t]! > 1 ? 's' : '')).join(', ');
      put('whole', 'Buy the whole outfit · ' + f(o.price), x.fleet + ' machines worth about ' + f(o.v) + ', ' + o.crew + ' of their operators, and their track record with the council (+' + (2 * x.stars + 2) + ' points). One less outfit pricing against you.' + (x.fleet > fit ? ' ' + (x.fleet - fit) + ' won\'t fit in your yard and ' + (x.fleet - fit > 1 ? 'go' : 'goes') + ' straight to auction.' : '') + (pa.loan ? ' ' + f(pa.cash) + ' cash, ' + f(pa.loan) + ' borrowed' + (!compat.prototype && c.bank > pa.cash ? ', leaving ' + f(c.bank - pa.cash) + ' in the bank' : '') + '.' : ''));
      put('best', 'Just buy their best gear · ' + f(o.bprice), cap(o.best.map((g: Machine) => short(g.type) + ' (' + g.year + ')').join(' and ')) + '. Dearer per machine, but no crew or yard to absorb. The cash might keep them going.' + (!compat.prototype && o.best.length > fit ? ' ' + (o.best.length - fit) + ' won\'t fit in your yard and ' + (o.best.length - fit > 1 ? 'go' : 'goes') + ' straight to auction.' : ''));
      put('letGo', 'Let them go', 'Their gear will probably turn up in a clearance sale, or a bigger outfit will snap them up.');
      return out('Opportunity', x.name + ' wants out', 'The owner of ' + x.name + ' rang. A run of bad jobs has them behind with the bank, and they\'d rather sell to you than watch the auctioneer do it. Their yard: ' + gear + ', worth about ' + f(o.v) + ' on the open market.' + (!pa.ok ? ' You can\'t fund the whole outfit right now: you\'d need ' + f(pa.cash) + ' cash and room to borrow ' + f(pa.loan) + '.' : ''));
    }
    case 'sellup': {
      const x = D.x, best = D.best as Machine[], walk = D.walk as number, onOwn = best.some((m) => m.jobId && c.jobs.find((j) => j.id === m.jobId)?.kind === 'own');
      const why = D.why === 'missed' ? D.missed + ' missed repayment' + s(D.missed) + ' behind' : D.why === 'over' ? 'over your overdraft limit' : 'deep in the overdraft';
      put('two', 'Sell them two machines · ' + f(D.bprice), cap(best.map((m) => short(m.type) + ' (' + m.year + ')').join(' and ')) + ', worth about ' + f(D.bv) + '. Cash this week, no auction gamble. They get stronger for it.' + (onOwn ? ' Anything pulled off a council job is replaced by dry hire on that job.' : ''));
      put('all', 'Sell them the whole business · ' + f(D.sp.price), 'All ' + D.gear + ' machines (worth about ' + f(D.sp.v) + ')' + (D.staff ? ', your crew' : '') + (D.jobs ? ', and the ' + D.jobs + ' job' + s(D.jobs) + ' you\'re on' : '') + (D.stars ? ', plus ' + f(D.stars * 15000) + ' for your track record' : '') + '. Once the loan, overdraft and subbies are paid out you walk away ' + (walk >= 0 ? 'with about ' + f(walk) : 'still owing about ' + f(-walk)) + '. This career ends.');
      put('hold', 'Hold on and trade out of it', 'Say no. Sell gear yourself, chase what you\'re owed, and win your way out. They might ring again if it gets worse.');
      return out('Opportunity', D.asked ? x.name + ' will talk' : x.name + ' has heard you\'re struggling', (D.asked ? 'You rang around and ' + x.name + ' was keen.' : 'Word gets around: you\'re ' + why + '. ' + x.name + '\'s owner rang this morning.') + ' They\'ll take your best spare gear off your hands, or buy the whole business at a price that suits them. The market is ' + MOODS[D.mood as keyof typeof MOODS].t.toLowerCase() + '.');
    }
  }
  return out('', '', '');
}

/** What happened, in a line. Read straight after choose(), from the answer and the career as it is now. */
export function resultText(c: Career, a: Answer): string {
  const D = a.data, R = a.result as any;
  return rw(line(c, a.q.k, a.id, D, R)) + (a.tix.length ? ' New ticket: ' + a.tix.map((t) => TICKET_TEXT[t]?.n ?? t).join(', ') + '.' : '');
}

function line(c: Career, k: string, id: string, D: Record<string, any>, R: any): string {
  switch (k) {
    case 'swms': return id === 'pay' ? (compat.prototype ? 'SWMS, WHS plan and induction pack in the ute.' : 'DDES Advisory dropped off your SWMS, WHS plan and induction pack.') : 'Late nights, but they\'re done. You\'re catching up on sleep next week.';
    case 'serious': {
      const nm = whoName(c, D.who);
      if (id === 'advisory') return 'DDES Advisory handled it start to finish: ' + (R ? f(R) + ' all up.' : 'covered by your retainer.') + ' ' + nm + (nm === 'You' ? ' are' : ' is') + ' off for months.';
      if (id === 'notify') return 'The inspectors have been and gone.' + (R ? ' The fine: ' + f(R) + '.' : ' No fine: your records showed the controls were in place.') + ' ' + nm + ' is off for months.';
      return R.found ? 'The hospital reported it. The regulator fined you ' + f(R.fine) + ', insurance is up 40%, track record −5, and the council has suspended you for six months.' : 'Nobody asked. The crew know what happened, though, and they\'re not happy.';
    }
    case 'nearmiss': return id === 'report' ? (!compat.prototype && D.job ? 'Stood the crew down, redid the plan with them and logged it. A day behind, and the crew noticed.' : 'Logged and fixed. The crew noticed.') : id === 'advisory' ? 'DDES Advisory sorted it: SWMS updated, crew briefed, logged.' : 'Back to work.';
    case 'quiet': {
      const n = D.person.name;
      if (id === 'yarn') return R === 3 ? n + ' didn\'t say much over the pie. Maybe next time.' : QUIET_REPLIES[R as number]!(n);
      if (id === 'daysOff') return n + ' took the days. They came back looking better.';
      if (id === 'advisory') return 'The whole crew had a yarn with someone who knows what to ask. ' + n + ' stayed back to talk afterwards.';
      return R === 'nearThing' ? n + ' had a near thing on the machine later in the week: their head\'s not on the job.' : R === 'offWork' ? n + ' didn\'t turn up Monday, or the week after. When they came back they said they\'d hit a wall.' : 'Nothing came of it this time.';
    }
    case 'turnover': return id === 'auction' ? 'In the auction. Have a look in the Market for a replacement.' : id === 'list' ? 'Listed.' : 'Kept. ' + D.by + ' isn\'t happy about it.';
    case 'svcfind': return id === 'fix' ? (D.dd ? 'In the workshop. Back in ' + D.dd + ' days.' : 'Fixed overnight. Back out in the morning.') : 'Patched up. Keep an eye on it.';
    case 'swapin': return id === 'putOn' ? 'On site tomorrow. The hire-in goes back.' : 'It stays in the yard.';
    case 'rainday': { const day = DAYS[D.d]; return id === 'standDown' ? 'Crews told to stay home ' + day + '.' : 'Crews out ' + day + '. Fingers crossed.'; }
    case 'break': {
      const k = D.card;
      if (id === 'warranty') return 'Fixed under warranty. Lost ' + k.dd + ' days.';
      if (id === 'fitterFix') return D.fitter + ' fixed it properly. ' + f(D.fitFix) + ', and ' + D.fitDays + ' day' + (D.fitDays === 1 ? '' : 's') + ' down.';
      if (id === 'patch') return D.fitter + ' patched it up for ' + f(D.fitPatch) + '. Keep an eye on it.';
      if (id === 'mobile') return 'Fixed on the spot for ' + f(k.cost * 1.25) + '.';
      if (id === 'adFix') return 'The mechanic sorted it on the spot. No charge.';
      if (id === 'dealer') return 'Booked in. ' + f(k.cost) + ', and ' + k.dd + ' days off the job.';
      return 'Replacement on site the next morning. ' + f(k.cost + k.rc) + ' all up.';
    }
    case 'brtender':
      if (id === 'letGo') return 'Passed on it.';
      if (id === 'sharp') return R ? 'Won it. Thin, but the crews are flat out and the shire knows your name.' : 'Lost on price to a local outfit.';
      return R ? 'Won it at a proper rate.' : 'Lost. Someone hungrier took it.';
    case 'brraise':
      if (id === 'pay') return R === 'stepUp' ? 'Done. ' + D.mgr + ' is winning more work already.' : 'Done. ' + D.mgr + ' stays.';
      return R === 'quit' ? D.mgr + ' handed in the keys on Friday. Hire a new manager from the Yard.' : D.mgr + ' grumbled, but stayed.';
    case 'collapse': return id === 'claim' ? 'Claim lodged. They estimate about ' + f(D.card.dividend) + ', around week ' + (D.week + 40) + '.' : f(D.card.sell) + ' in the bank. The rest is gone.';
    case 'freeze': return 'Noted. Lean weeks ahead.';
    case 'insure': return id === 'wear' ? 'Renewed at the new rate.' : R ? 'The broker found a better policy: up 15%, not 35%.' : 'Every insurer quoted the same. $1,500 for nothing.';
    case 'bankcall': return id === 'moreTime' ? 'Granted, once. Don\'t make them ring again.' : id === 'ringAround' ? 'You\'ve made some calls.' : 'The bank manager sighs and hangs up.';
    case 'bas': {
      const B = D.B;
      if (id === 'pay') return 'Lodged and paid. ' + f(B.amt) + ' to the tax office.';
      if (id === 'payAnyway') return 'Taken out of your account. Track record −2.';
      return 'Plan agreed: ' + f(R) + ' every four weeks.' + ((c.gst?.plans ?? 0) > 1 ? ' Track record −1: the councils run credit checks too.' : '');
    }
    case 'yearend': return 'New year, new books.';
    case 'late': {
      const x = D.x;
      if (id === 'chase') return 'Payment claim served. ' + x.client + ' has you on its "difficult" list.';
      if (id === 'friendly') return 'Half paid now (' + f(R) + '). The rest is promised in 4 weeks.';
      if (id === 'adPay') return 'Paid in full: ' + f(D.amt) + '.';
      if (id === 'park') return 'Paid in full within 2 days. The hire is over and they won\'t call you for a while.';
      return R === 'soon' ? 'They say it\'s in the next pay run, in 2 weeks.' : 'Still nothing. Their accounts person says another 6 weeks.';
    }
    case 'clearing':
      if (id === 'borrow') return 'Won it at $49,500. The hours were higher than listed. Repayments now ' + f(R) + ' a week.';
      if (id === 'cash') return R ? 'Knocked down to you at $46,000.' : 'It went for $47,500. You watched someone else drive it home.';
      return 'Nothing changes. The bank balance looks better than the fleet.';
    case 'hurt': {
      const n = D.person.name;
      if (id === 'homePaid') return D.sub ? n + ' is off for two weeks on full pay. ' + D.sub + ' is on their machine from Monday.' : n + ' is off for two weeks on full pay. Their job sits idle meanwhile.';
      if (id === 'home' && !compat.prototype) return n + ' went home without pay. They didn\'t say much.';
      if (id === 'home') return D.sub ? n + ' is off for two weeks. ' + D.sub + ' is on their machine from Monday.' : n + ' is off for two weeks and back fit. Their job sits idle meanwhile.';
      if (id === 'cover') return 'You\'re on ' + n + '\'s machine this week. Your own job waits.';
      if (id === 'advisory') return n + ' saw a physio on Tuesday and is back on Monday with light duties sorted.';
      return R ? n + ' finished the week, then was off for 6 weeks. Insurance claim lodged and your premium is up.' : n + ' got through it. You got lucky this time.';
    }
    case 'wetclay': if (!compat.prototype && id === 'wait') return 'Stood the spread down for two days to let it dry. ' + (D.job.dk === 'dev' ? D.job.client : firstName(D.job.client)) + ' wasn\'t impressed.';
      return id === 'wait' ? 'Stood the spread down for two days to let it dry.' : 'Pushed on. The layers this week went in heavy and soft.';
    case 'leak':
      if (id === 'show') return R ? firstName(D.farm) + ' walked the wall with you and came round. Nothing more said.' : firstName(D.farm) + ' got an engineer out. It was your work after all: you paid the fix anyway (' + f(D.fix) + '), and track record −2.';
      return id === 'fix' ? 'Back out there with a spread. Fixed properly this time: ' + f(D.fix) + '.' : D.farm + ' isn\'t happy, and neither are the neighbours who heard about it.';
    case 'redzone':
      if (!compat.prototype && D.farm) return id === 'take' ? f(D.cash) + ' in an envelope. Don\'t mention it.' : id === 'permit' ? firstName(D.farm) + ' said they\'d think about it.' : 'Said no. ' + firstName(D.farm) + ' hung up without saying goodbye.';
      return id === 'take' ? f(D.cash) + ' in an envelope. Don\'t mention it.' : 'Said no. They didn\'t sound surprised.';
    case 'injured': {
      const n = D.person.name;
      if (id === 'keep') return 'You rang ' + n + ' and told them the job\'s there when they\'re ready. Light duties in about six weeks.';
      if (id === 'advisory') return 'DDES Advisory has a return-to-work plan with the insurer and the doctor. ' + n + ' is back on light duties in about four weeks.';
      return n + ' got a letter and a week\'s pay. The new operator is on the labour board in the Yard this week.';
    }
    case 'cashjob': return id === 'cash' ? 'Shook on it. Cash when it\'s done.' : R ? firstName(D.job.client) + ' grumbled about the GST and paid it.' : firstName(D.job.client) + ' said fair enough.';
    case 'overrun': {
      if (id === 'wear') return 'Your price was your price.';
      if (!D.done) return id === 'ddes' ? 'DDES is on it. You\'ll hear when the job\'s done.' : 'You\'ve put it in writing. You\'ll hear when the job\'s done.';
      const x = R as { amt: number; fee: number } | null;
      return x && x.amt ? (id === 'ddes' ? 'DDES got ' + f(x.amt) + ' back for the extra work, less its ' + f(x.fee) + ' fee.' : 'They paid ' + f(x.amt) + ' for the extra work.') : 'Knocked back.';
    }
    case 'eot': {
      const r = R as { wks: number; fee: number } | undefined;
      if (id === 'none') return 'No claim. The damages run until it\'s done.';
      return r && r.wks ? 'Granted: ' + r.wks + ' week' + s(r.wks) + ' more before damages.' + (r.fee ? ' DDES\'s fee: ' + f(r.fee) + '.' : '') : 'Knocked back. The damages run from now.';
    }
    case 'ddescheck': return id === 'claim' ? 'DDES is lodging the variation.' : id === 'close' ? 'Closed. The gear\'s on its way home.' : id === 'book' ? 'Booked in.' : 'Noted.';
    case 'signoff': return id === 'sign' ? 'Paid him. The paperwork will say it passed.' : 'He shrugged and started pulling cores.';
    case 'tip': return id === 'use' ? 'Priced at ' + f(R) + ', a hair under ' + D.t.tip.name + '. Don\'t mention it.' : 'You told them you\'d rather not know. They laughed and bought the next round.';
    case 'dieselWar': return id === 'fill' ? 'Ordered: half a tank, here in two weeks.' : id === 'levy' ? 'Most clients grumbled and paid. One said they\'d remember it.' : 'You\'ll wear it. The fuel bill is going to hurt for a while.';
    case 'xmas': return id === 'party' ? 'Great night. A few sore heads on Saturday, and the crew is still talking about it.' : id === 'bbq' ? 'Good arvo. Everyone heads off for the break in good spirits.' : 'Everyone just knocked off on Friday. Nobody said much.';
    case 'breakin':
      if (id === 'claim') return 'Claim paid. Premiums are up for a while.';
      if (id === 'camera') return 'Fixed and the camera\'s up.';
      return R ? 'A client complained about the finish. $900 of rework.' : 'Nobody noticed. You got away with it.';
    case 'extra':
      if (id === 'ask') return R ? 'They agreed to $2,700 extra.' : 'They reckon it was part of the job. Two days for nothing.';
      if (id === 'agree') return 'Agreed at $2,970, in writing.';
      return 'Two free days. Your track record goes up by 1 on word of mouth.';
    case 'callout':
      if (id === 'go') return 'Road open again by Thursday. ' + f(3 * 2100) + ' invoiced, and track record +1.';
      if (id === 'pullOff') return R ? 'Road open again. ' + D.job.client + ' was filthy about losing you for 3 days. Track record +1 from the council, −1 from them.' : 'Road open again, and your other client didn\'t mind.';
      return 'Someone else got the call.';
    case 'early': return id === 'take' ? f(R) + ' landed this week.' : 'No change. The invoices come in when they\'re due.';
    case 'tresult':
      if (D.direct && !D.won) return 'Noted.';
      if (D.won) return id === 'sign' ? 'Signed. ' + D.t.hc + ' expects you on site.' : 'You pulled out. Word gets around.';
      return 'Noted. There\'ll be more packages.';
    case 'cresult':
      if (D.won) return id === 'sign' ? 'Signed. Crews mobilise as soon as you\'re free.' : 'You pulled out. It\'ll be remembered.';
      return 'Noted.';
    case 'variation':
      if (id === 'lodge') return R ? 'Variation approved at ' + f(D.value) + ' once you produced the diary entry.' : 'Knocked back: "should have been in writing." Two days for nothing.';
      if (id === 'writing') return 'Approved in writing at ' + f(D.value) + '. The supervisor thinks you\'re fussy, but fair.';
      return 'Two free days. Track record +1, and ' + (pmOf(D.job.client) === D.job.client ? 'the supervisor' : pmOf(D.job.client)) + ' won\'t forget it.';
    case 'gravel':
      if (id === 'cart') return f(D.cost) + ' of extra cartage. It passes first time.';
      if (id === 'work') return R ? 'Passed on the retest.' : 'Failed again. Two more days before it passed.';
      return R ? 'The retest came back fine. You were right.' : 'You were wrong. Three days of rework, and ' + D.job.client + ' is less keen. Track record −1.';
    case 'drydam':
      if (id === 'bore') return 'Deal done over the fence. $4,000.';
      if (id === 'far') return 'Longer water runs from tomorrow. Crews at ' + Math.round(D.further * 100) + '%.';
      return D.job.hm?.cart === 'wet' ? 'A subbie\'s carts are on site by Monday.' : 'Extra carts on site by Monday.';
    case 'pitout': return id === 'far' ? 'Trucks on the long run now.' : id === 'farTrucks' ? 'Two more trucks per crew from tomorrow.' : 'Paid the farmer. Trucks barely miss a beat.';
    case 'repo': return D.m ? 'Gone. ' + f(D.got) + ' came off the loan. Repayments are now ' + f(R) + ' a week.' : 'The arrears are written into the loan.';
    case 'buyout': {
      const x = D.x, o = D.offer;
      if (id === 'whole') {
        const counts: Record<string, number> = {};
        for (const g of o.yard) counts[g.type] = (counts[g.type] || 0) + 1;
        const gear = Object.keys(counts).map((t) => counts[t] + ' ' + short(t as MachineType) + (counts[t]! > 1 ? 's' : '')).join(', ');
        return 'It\'s yours: ' + gear + ', and ' + o.crew + ' of their operators have signed on with you. Track record +' + (2 * x.stars + 2) + '.' + (R ? ' ' + R + ' machine' + (R > 1 ? 's go' : ' goes') + ' to auction this week: no room in the yard.' : '');
      }
      if (id === 'best') return 'Done. ' + x.name + ' has some breathing room, and you have their best ' + o.best.map((g: Machine) => short(g.type)).join(' and ') + '.' + (R ? ' No room in the yard, so ' + R + ' goes to auction this week.' : '');
      return 'You passed. Watch the auctions over the next few weeks.';
    }
    case 'sellup':
      if (id === 'two') return f(R) + ' is in the bank. ' + D.x.name + ' takes the ' + (D.best as Machine[]).map((m) => short(m.type)).join(' and ') + ' on Monday.';
      if (id === 'all') return 'Signed. ' + D.x.name + ' takes over on Monday.';
      return 'You told ' + D.x.name + ' you\'re not selling.';
  }
  return '';
}
