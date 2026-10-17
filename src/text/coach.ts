// The coach's steps, Col's notes, and the one line above End week (the tip you're on, or what's next).

import type { Career } from '../game';
import { TICKETS, checks, checks2, checks3, checks4, rung } from '../career';
import { ownedCounts } from '../planning';
import { coachStep, type CoachStep, type MentorNote, type TabId } from '../coach';
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
  runon: 'Quiet stretch? Run on plays up to four weeks and stops the moment something needs you: a tender, a breakdown, a result, a bill.',
};

/** The line above End week: the coach's step while it's on, then the next thing on the ladder, then the next ticket. */
export function nextGoal(c: Career): { tip: boolean; t: string; tab: TabId } | null {
  const step = coachStep(c);
  if (step) return { tip: true, t: COACH_TEXT[step.id].t, tab: step.tab || 'career' };
  const g = rung(c as never), st = { ...c, owned: ownedCounts(c.fleet) } as never;
  const first = (k: number, ok: boolean[]) => {
    const x = checkWords(k, st, ok).find((y) => !y.ok);
    return x ? x.t.replace(/ \((Yard|Office)[^)]*\)$/, '') : null;
  };
  const next = g < 3 ? first(3, checks(c as never)) : g === 3 ? 'Win your first subcontract (Work tab, Tenders)' : g === 4 ? first(4, checks2(c as never)) : g === 5 ? first(5, checks3(c as never)) : g === 6 ? first(7, checks4(c as never)) : null;
  if (next) return { tip: false, t: 'Next: ' + next, tab: g === 3 ? 'work' : 'career' };
  const t = TICKETS.find((x) => !(c.tix && c.tix[x.id]));
  return t ? { tip: false, t: 'Next ticket: ' + TICKET_TEXT[t.id]!.n + ' (' + TICKET_TEXT[t.id]!.d.replace(/\.$/, '').toLowerCase() + ')', tab: 'career' } : null;
}
