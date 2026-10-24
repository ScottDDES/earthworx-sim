// The coach's steps, Col's notes, and the one line above End week (the tip you're on, or what's next).

import type { Career } from '../game';
import { TICKETS, checks, checks2, checks3, checks4, rung } from '../career';
import { ownedCounts } from '../planning';
import { TYPES, type MachineType } from '../machines';
import { coachStep, type CoachStep, type Handled, type MentorNote, type RunStop, type TabId } from '../coach';
import { TICKET_TEXT, checkWords } from './career';

export const COACH_TEXT: Record<CoachStep, { t: string; d: string }> = {
  earn: { t: 'Get your grader earning', d: 'Take a job you can drive yourself. Wet hire and council day labour pay by the day; private jobs pay a fixed price but the rain days are on you.' },
  end: { t: 'End the week', d: 'Each week is one turn. Tap End week: your grader works whatever days the weather allows, then the week\'s docket shows what happened.' },
  late: { t: 'Money comes in late', d: 'You invoice as you work, but clients pay on their terms, two to four weeks later. Your loan repayment comes out every week, working or not. The Office tab shows what you\'re owed.' },
  health: { t: 'Keep the grader healthy', d: 'Every 250 hours it needs a service, and an overdue machine breaks down far more often. The Yard tab warns you before it\'s due.' },
  goal: { t: 'The first big goal', d: 'Own a grader, a roller and a water cart, and earn a star of track record. Then head contractors will ask you to price flood recovery work. The Career tab shows how close you are.' },
};

export const MENTOR_WHO = 'Col · forty years on the graders';

export const MENTOR: Record<MentorNote, string> = {
  office: 'Owners who go broke usually had plenty of work. What they ran out of was cash. Look at Worth a look and the forecast every few weeks, before the bank does.',
  overheads: 'Every week the gates are open costs you, win or lose: wages, insurance, the yard, your own pay. Price them into the job or the job only pays for itself. Got other work on? Let it carry a share and sharpen up.',
  score: 'Price is 60 points. The other 40 is whether they trust you: your track record, a safety system that\'s real, a business that isn\'t behind with the bank, and a crew that isn\'t spread over three jobs. You can lose on price and still win it.',
  plan: 'Plan it before you price it. Find what holds the crew up: water, gravel trucks or rollers. A crew waiting on water costs the same as one working.',
  bas: 'The GST was never yours. Put it aside every week and the BAS is just paperwork. Spend it and the tax office becomes your biggest creditor.',
  year: 'Read it the way the bank will. Margin and net worth tell you more than turnover. A big year at 3% is a lot of work for nothing.',
  rel: 'The project managers talk. Every job you finish on time is a reference, and every one you finish late is a story that gets around. Look after the two or three who send you the most work.',
  ddes: 'Once you\'re this size the little fees stop mattering and the big leaks start: a job running over, a branch going backwards, a claim nobody lodged. Have someone looking at the books every quarter, before the bank does.',
  claims: 'That job\'s past what you priced. Fixed price is for the work on the plans, not whatever\'s in the ground. More dirt than they showed you is a variation. Get it claimed properly, not on the back of a docket.',
  runon: 'Quiet stretch? Run on plays up to four weeks. It makes the small calls for you, like rain days and slow payers, and stops the moment something bigger needs you: a breakdown, a new tender, a win, the bank.',
};

/** The coach's steps for a bulk earthworks start. */
export const BULK_COACH_TEXT: Record<CoachStep, { t: string; d: string }> = {
  earn: { t: 'Get your gear earning', d: 'Hire your machine out by the day under Work on offer, or price a job a farmer rang about. A fixed price means the rain days, and any dirt the plans missed, are on you.' },
  end: COACH_TEXT.end,
  late: COACH_TEXT.late,
  health: { t: 'Keep the gear healthy', d: 'Every 250 hours a machine needs a service, and an overdue one breaks down far more often. The Yard tab warns you before it\'s due.' },
  goal: { t: 'The first big goal', d: 'Own something to move dirt, a compactor and a water cart, and earn a star of track record. Then the engineered jobs, with tested walls, are yours to price. The Career tab shows how close you are.' },
};

/** The line above End week: the coach's step while it's on, then the next thing on the ladder, then the next ticket. */
export function nextGoal(c: Career): { tip: boolean; t: string; tab: TabId } | null {
  const step = coachStep(c);
  if (step) return { tip: true, t: (c.path === 'bulk' ? BULK_COACH_TEXT : COACH_TEXT)[step.id].t, tab: step.tab || 'career' };
  const g = rung(c as never), st = { ...c, owned: ownedCounts(c.fleet) } as never;
  const first = (k: number, ok: boolean[]) => {
    const x = checkWords(k, st, ok).find((y) => !y.ok);
    return x ? x.t.replace(/ \((Yard|Office)[^)]*\)$/, '') : null;
  };
  const next = g < 3 ? first(3, checks(c as never)) : g === 3 ? (c.path === 'bulk' ? 'Finish your first bulk job (Work tab)' : 'Win your first subcontract (Work tab, Tenders)') : g === 4 ? first(4, checks2(c as never)) : g === 5 ? first(5, checks3(c as never)) : g === 6 ? first(7, checks4(c as never)) : null;
  if (next) return { tip: false, t: 'Next: ' + next, tab: g === 3 ? 'work' : 'career' };
  const t = TICKETS.find((x) => !(c.tix && c.tix[x.id]));
  return t ? { tip: false, t: 'Next ticket: ' + TICKET_TEXT[t.id]!.n + ' (' + TICKET_TEXT[t.id]!.d.replace(/\.$/, '').toLowerCase() + ')', tab: 'career' } : null;
}

/** Why Run on stopped, shown on the docket so a one-week run doesn't look like nothing happened. */
export const RUN_STOP: Record<RunStop, string> = {
  needsYou: 'Run on stopped here: something needs your answer.',
  stamp: 'Run on stopped here: you earned a stamp.',
  finished: 'Run on stopped here: a job finished.',
  tender: 'Run on stopped here: a new tender is out.',
  idleWork: 'Run on stopped here: there is work for an idle machine.',
  bank: 'Run on stopped here: the bank needs a look.',
  machine: 'Run on stopped here: a machine is in a bad way.',
};

/** One line for a card Run on answered for you. */
export function handledLine(h: Handled): string {
  const who = h.who || 'A crew member';
  const t: Record<string, string> = {
    rainday: 'Rain forecast: stood the crews down',
    late: 'Late payment: waited it out',
    quiet: who + ' was quiet: took them for a feed and a yarn',
    nearmiss: 'Near miss: reported it and talked it through',
    early: 'Early payment offer: waited for the full amount',
    tresult: 'Lost a tender',
    cresult: 'Lost a council tender',
  };
  const mach = h.type ? TYPES[h.type as MachineType]?.short ?? h.type : 'machine';
  if (h.k === 'break') t.break = 'The ' + mach + ' broke down: ' + (h.id === 'warranty' ? 'claimed it on the warranty' : h.id === 'patch' ? who + ' patched it up' : who + ' fixed it properly');
  if (h.k === 'svcfind') t.svcfind = 'Fault found on the ' + mach + ': ' + (h.id === 'patch' ? who + ' patched it up' : who + ' fixed it properly');
  return 'Wk ' + h.w + ' · ' + (t[h.k] ?? 'Handled a card');
}
