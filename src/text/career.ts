// Words for the career ladder, unlocks and tickets. Keep ticket ids and list orders as they are: saved careers point into them.

export const STAGES = ['', 'Owner-operator', 'Small fleet', 'Ready to subcontract', 'Subcontractor', 'Your own contract', 'Regional contractor', 'Flood recovery contractor', 'Prestige contractor'] as const;

export const UNLOCK_TEXT: Record<string, string> = {
  swms: 'Head contractors will want SWMS and a WHS plan before you set foot on their sites. Safety is now in the Yard.',
  won: 'Ready to subcontract. You can now lease a depot with a workshop (and put on a fitter), run toolbox talks, set up a full IMS, fit GPS to graders and buy gear on finance.',
  won2: 'Council work in your own name. You can now hire site supervisors and an operations manager, move to a regional depot and go for ISO 45001.',
  won3: 'Regional contractor. A plant hub and a branch depot in the other town are now open to you.',
};

export const TICKET_CATS: Record<string, string> = {
  start: 'Starting out', contracts: 'Contracts', fleet: 'Fleet and yard', safety: 'Safety and crew', weather: 'Weather', money: 'Money', hardcore: 'Hardcore',
};

export const TICKET_TEXT: Record<string, { n: string; d: string }> = {
  firsthire: { n: 'Paid to drive', d: 'Finish your first hire job.' },
  fleet2: { n: 'Small fleet', d: 'Own two machines, or put someone on the payroll.' },
  staff1: { n: 'On the payroll', d: 'Hire your first staff member.' },
  swms: { n: 'Paperwork done', d: 'Get your SWMS and WHS plan sorted.' },
  ready: { n: 'Ready to sub', d: 'A grader, roller, water cart and a star of track record.' },
  firstsub: { n: 'First package', d: 'Win a subcontract from a head contractor.' },
  ontime: { n: 'On time', d: 'Finish a subcontract without damages.' },
  twocrews: { n: 'Two crews out', d: 'Have two subcontracts or contracts running at once.' },
  council: { n: 'Your name on it', d: 'Win a council tender in your own name.' },
  tenwins: { n: 'Ten from ten', d: 'Win ten tenders.' },
  regional: { n: 'Regional contractor', d: 'Get the council to let you price whole programs.' },
  program: { n: 'Program delivered', d: 'Deliver a flood recovery program.' },
  early: { n: 'Under the gun', d: 'Finish a flood recovery program at least a week before it\'s due.' },
  depot: { n: 'Shed and a workshop', d: 'Move into a depot with a workshop.' },
  hub: { n: 'Plant hub', d: 'Run the fleet out of a plant hub.' },
  fleet10: { n: 'Ten in the yard', d: 'Own ten machines.' },
  gps: { n: 'On the screens', d: 'Fit GPS machine control to a grader.' },
  multi: { n: 'Rubber on gravel', d: 'Own a multi-tyre roller.' },
  auction: { n: 'Hammer\'s down', d: 'Win a lot at auction.' },
  fitter: { n: 'Spanners', d: 'Put a fitter on in your workshop.' },
  ops: { n: 'Someone else\'s problem', d: 'Hire an operations manager.' },
  cleanyear: { n: 'Clean year', d: '52 weeks of work without a lost-time injury.' },
  speakup: { n: 'Speak up', d: 'Report three near misses.' },
  yarn: { n: 'You right, mate?', d: 'Check in on someone who\'s doing it tough.' },
  iso: { n: 'Audited', d: 'Get certified to ISO 45001.' },
  raincall: { n: 'Read the sky', d: 'Make the right call on rain five times.' },
  bust: { n: 'Rode it out', d: 'Get through a bust without losing a machine to the bank.' },
  loanfree: { n: 'Owe nobody', d: 'Pay the loan off.' },
  buyout: { n: 'Buy the opposition', d: 'Take over a rival outfit.' },
  hc1: { n: 'No safety net', d: 'Reach Ready to subcontract on hardcore.' },
  hc2: { n: 'All in', d: 'Win a council contract on hardcore.' },
  hc3: { n: 'Last one standing', d: 'Deliver a flood recovery program on hardcore.' },
  hc4: { n: 'Back from the brink', d: 'Get back above water after trading insolvent.' },
  million: { n: 'Seven figures', d: 'Build a net worth of $1 million.' },
};

/** The ladder, step by step: what it is, and what it opens up. */
export const STEPS: { t: string; d: string; u?: string }[] = [
  { t: 'Owner-operator', d: 'One machine and you on it. Wet hire, dry hire, council day labour, private jobs.' },
  { t: 'Small fleet', d: 'Two or more machines, or an operator on the payroll.', u: 'SWMS and a WHS plan' },
  { t: 'Ready to subcontract', d: 'The kit and the track record to run a section of a flood recovery job.', u: 'subcontract tenders, a depot with a workshop and a fitter, toolbox talks, a full IMS, GPS on graders, buying on finance' },
  { t: 'Subcontractor', d: 'Price flood works packages for head contractors, win some, and finish them on time.' },
  { t: 'Your own contract', d: 'Plan and tender council flood works packages in your own name.', u: 'council tenders, site supervisors, an operations manager, a regional depot, ISO 45001' },
  { t: 'Regional contractor', d: 'Several crews, and the council now lets you price whole flood recovery programs.', u: 'flood recovery programs, a plant hub, a branch depot in the other town' },
  { t: 'Flood recovery contractor', d: 'Dozens of roads, months of work, and a hard 30 June deadline.' },
  { t: 'Prestige contractor', d: 'The state roads department lets whole-area programs to a few certified outfits with the depot to run them. Better rates, bigger scale, and the big firms bidding against you.' },
];

/** A bulk earthworks outfit's ladder, step for step with the road one. */
export const BULK_STEPS: { t: string; d: string; u?: string }[] = [
  { t: 'Owner-operator', d: 'One machine and you on it. Hire it out by the day, or price farmers\' jobs it can do.' },
  { t: 'Small fleet', d: 'Two or more machines, or an operator on the payroll.', u: 'SWMS and a WHS plan' },
  { t: 'Ready for tested work', d: 'Something to move dirt, something to roll it and water to do it with. Engineered jobs want all three.', u: 'buying on finance, a depot with a workshop and a fitter, toolbox talks, a full IMS' },
  { t: 'Bulk contractor', d: 'Dams, banks, channels and clearing finished and paid for.' },
  { t: 'Engineered work', d: 'A name for walls that pass. Developers start ringing about bulk earthworks.', u: 'developers\' bulk earthworks, an operations manager, a regional depot, ISO 45001' },
  { t: 'Major earthworks contractor', d: 'A scraper spread, and a developer\'s job behind you.', u: 'a plant hub, a branch depot in the other town' },
  { t: 'Earthmoving heavyweight', d: 'Three developers\' jobs delivered.' },
  { t: 'Prestige contractor', d: 'Five developers\' jobs, certified to ISO 45001, run from a plant hub.' },
];

/** The ladder for the outfit you started: roads or bulk. */
export function stepsFor(path?: string): { t: string; d: string; u?: string }[] {
  return path === 'bulk' ? BULK_STEPS : STEPS;
}

export interface LadderState {
  path?: string;
  bulkDone?: number;
  devDone?: number;
  testsPassed?: number;
  rep: number;
  subsDone?: number;
  ownDone?: number;
  majorDone?: number;
  prestigeDone?: number;
  owned: Record<string, number>;
}

/** What each step needs, ticked off: step 3 (index 2) onwards. ok is from the engine's checks. */
export function checkWords(step: number, st: LadderState, ok: boolean[]): { t: string; ok: boolean }[] {
  const o = st.owned, m = (n: number | undefined, k: number) => Math.min(n || 0, k);
  if (st.path === 'bulk') {
    const B: Record<number, string[]> = {
      3: ['Own something to move dirt (a dozer, scraper or excavator), a compactor and a water cart', '1 star of track record (' + Math.min(st.rep, 5) + ' of 5 points)', 'No missed loan repayments', 'SWMS and a WHS plan (Yard, Safety)'],
      4: ['Finish 3 bulk jobs (' + m(st.bulkDone, 3) + ' of 3)', 'Pass a compaction test (' + m(st.testsPassed, 1) + ' of 1)', '2 stars of track record (' + Math.min(st.rep, 12) + ' of 12 points)'],
      5: ['Finish a developer\'s bulk earthworks (' + m(st.devDone, 1) + ' of 1)', 'Own a scraper spread: 2 scrapers, a dozer, a compactor and a water cart'],
      7: ['Finish 3 developers\' jobs (' + m(st.devDone, 3) + ' of 3)'],
      8: ['Finish 5 developers\' jobs (' + m(st.devDone, 5) + ' of 5)', 'Certified to ISO 45001', 'Run from a plant hub'],
    };
    return (B[step] ?? []).map((t, i) => ({ t, ok: !!ok[i] }));
  }
  const T: Record<number, string[]> = {
    3: ['Own a grader, roller and water cart', '1 star of track record (' + Math.min(st.rep, 5) + ' of 5 points)', 'No missed loan repayments', 'SWMS and a WHS plan (Yard, Safety)'],
    4: ['Finish 3 subcontracts (' + m(st.subsDone, 3) + ' of 3)', '2 stars of track record (' + Math.min(st.rep, 12) + ' of 12 points)'],
    5: ['Finish 2 council contracts (' + m(st.ownDone, 2) + ' of 2)', 'Own two full crews (graders ' + m(o.grader, 2) + '/2, rollers ' + m(o.roller, 2) + '/2, carts ' + m(o.cart, 2) + '/2)'],
    7: ['Deliver a flood recovery program by 30 June (' + m(st.majorDone, 1) + ' of 1)'],
    8: ['Deliver 2 flood recovery programs (' + m(st.majorDone, 2) + ' of 2)', 'Certified to ISO 45001', 'Run from a plant hub', 'Deliver a state road program (' + m(st.prestigeDone, 1) + ' of 1)'],
  };
  return (T[step] ?? []).map((t, i) => ({ t, ok: !!ok[i] }));
}

/** Stars as ★★☆. */
export const starTxt = (n: number) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);

/** What a rival's up to, on the district card. */
export function districtForm(form: string, jobs: number, idle: number, side = false): string {
  return (jobs ? 'On ' + jobs + ' job' + (jobs > 1 ? 's' : '') + ' · ' : side ? 'On private work · ' : '') + (form === 'new' ? 'New in town' : form === 'stretched' ? 'Short of cash, selling gear' : form === 'hungry' ? 'No work for ' + idle + ' weeks' : form === 'growing' ? 'Winning work, buying gear' : 'Steady');
}
