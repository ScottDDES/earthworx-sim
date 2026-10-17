// Demo careers, for looking at later screens without playing up to them. Open the app with ?demo=council.
// A business that's run its own contract, with a fleet, a few hands, and a council package and a flood
// recovery program out to tender.

import { genCouncil, genMajor, newAccounts, newMachine, seedRand, uid, game, type MachineType } from '@engine';

export function demoCareer(kind: string): game.Career | null {
  if (kind !== 'council') return null;
  const c = game.newCareer({ co: 'Demo Earthmoving', loan: 350000, town: 'gdi' }, 20261017);
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
  const kinds: MachineType[] = ['grader', 'grader', 'roller', 'roller', 'cart', 'cart', 'cart', 'truck', 'truck'];
  for (const k of kinds) c.fleet.push(newMachine(rand, uid(c), k, 2016, 80, 9000));
  c.staff.push({ id: uid(c), name: 'Dave', role: 'grader', skill: 'solid', wage: 2100, off: 0, jobId: null }, { id: uid(c), name: 'Kylie', role: 'roller', skill: 'gun', wage: 1840, off: 0, jobId: null });
  // the books start from here, so the demo's made-up bank balance isn't counted as income
  c.acc = newAccounts(c.bank);
  const p = game.planCtx(c);
  for (let i = 0; i < 200 && !c.ctenders.some((t) => !t.major); i++) genCouncil(seedRand(100 + i), c as never, p, 1.4);
  for (let i = 0; i < 400 && !c.ctenders.some((t) => t.major); i++) genMajor(seedRand(900 + i), c as never, p, 1.5, false);
  return c;
}
