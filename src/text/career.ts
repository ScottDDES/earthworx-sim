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
