// Demo careers, for looking at later screens without playing up to them. Open the app with ?demo=council.
// A business that's run its own contract, with a fleet, a few hands, and a council package and a flood
// recovery program out to tender. ?demo=bulk is the same business with the Bulk and Ag pack on and some of its gear.

import { mentorOff, genCouncil, genEnquiry, genMajor, newAccounts, newFuel, newMachine, seedRand, uid, game, type MachineType } from '@engine';

export function demoCareer(kind: string): game.Career | null {
  if (kind !== 'council' && kind !== 'bulk' && kind !== 'fuel' && kind !== 'war') return null;
  const c = game.newCareer({ co: 'Black Soil Earthmoving', loan: 350000, town: 'gdi' }, 20261017);
  const rand = seedRand(7);
  c.phase = 'play';
  c.yard = 'regional';
  c.bank = 600000;
  c.rep = 26;
  c.week = 60;
  c.won = c.won2 = c.won3 = true;
  c.subsWon = 4;
  c.subsDone = 4;
  c.ownWon = 1;
  c.ownDone = 2;
  c.whs.sys = 2;
  // a seasoned player: the tips are done and every tab's open
  c.coach = { i: 5, at: 1, off: true };
  c.tabs = { map: 1, bank: 1, board: 1 };
  const kinds: MachineType[] = ['grader', 'grader', 'roller', 'roller', 'cart', 'cart', 'cart', 'truck', 'truck'];
  for (const k of kinds) c.fleet.push(newMachine(rand, uid(c), k, 2016, 80, 9000));
  c.staff.push({ id: uid(c), name: 'Dave', role: 'grader', skill: 'solid', wage: 2100, off: 0, jobId: null }, { id: uid(c), name: 'Kylie', role: 'roller', skill: 'gun', wage: 1840, off: 0, jobId: null });
  // the books start from here, so the demo's made-up bank balance isn't counted as income
  c.acc = newAccounts(c.bank);
  const p = game.planCtx(c);
  for (let i = 0; i < 200 && !c.ctenders.some((t) => !t.major); i++) genCouncil(seedRand(100 + i), c as never, p, 1.4);
  for (let i = 0; i < 400 && !c.ctenders.some((t) => t.major); i++) genMajor(seedRand(900 + i), c as never, p, 1.5, false);
  if (kind === 'bulk') {
    for (const k of ['d8', 'd9', 's631', 's631', 'c825', 'moxycart'] as MachineType[]) c.fleet.push(newMachine(rand, uid(c), k, 2015, 78, 11000));
    game.setPack(c, 'bulk', true);
    c.bulk = { enq: [genEnquiry(seedRand(31), c as never, 1, 'turkeyNest'), genEnquiry(seedRand(44), c as never, 1, 'channel'), genEnquiry(seedRand(52), c as never, 1, 'laser')], att: { rake: true } };
    c.bulk.enq[1]!.surveyed = true;
  }
  if (kind === 'fuel' || kind === 'war') {
    // a 30,000 litre tank running low, the price climbing with a war on, and an ops manager on the books
    c.staff.push({ id: uid(c), name: 'Marg', role: 'ops', skill: 'solid', wage: 3000, off: 0, jobId: null });
    const F = newFuel();
    Object.assign(F, { tank: 'mid', L: 6400, avg: 1.97, last: 1450, walk: 1.02, auto: false, war: { from: 57, to: 66, peak: 1.45 } });
    F.hist = [2.08, 2.11, 2.13, 2.1, 2.07, 2.09, 2.12, 2.14, 2.11, 2.09, 2.1, 2.12, 2.16, 2.62, 2.92, 3.1];
    c.fuel = F;
    if (kind === 'war') {
      Object.assign(F, { war: { from: 60, to: 69, peak: 1.45 }, L: 11800 });
      F.hist = F.hist.slice(0, 13).concat([2.53]);
      c.queue.push({ k: 'dieselWar' });
    }
  }
  // ?shots: for store screenshots, Col's notes off; &card=break or rainday puts a card up
  const q = new URLSearchParams(location.search);
  if (q.has('shots')) mentorOff(c);
  const card = q.get('card');
  if (card === 'break') { Object.assign(c.fleet[0]!, { repair: 6400, down: 3 }); c.queue.push({ k: 'break', id: c.fleet[0]!.id }); }
  if (card === 'rainday') c.queue.push({ k: 'rainday', w: c.week, d: 2, fmm: 14, pc: 70 } as never);
  return c;
}
