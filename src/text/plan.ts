// Words for a plan: what's holding it up, from the engine's codes. The prototype's sentences, word for word.

import { FLOAT_DAYS, FLOAT_MOVE, truckM3, waterNeed, type Bott, type CouncilTender, type Issue } from '../planning';

const money = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-AU');
const crewL = (i: number) => String.fromCharCode(65 + i);

/** Crew colours on the map and the timeline. */
import { rw } from './real';

export const CREW_COL = ['#2F6FD0', '#D9480F', '#2B8A3E', '#9C36B5', '#C2255C', '#0C8599'];

export function issueText(x: Issue, t: CouncilTender): string {
  return rw(issueText0(x, t));
}
function issueText0(x: Issue, t: CouncilTender): string {
  switch (x.k) {
    case 'unassigned': return x.n + ' road' + (x.n > 1 ? 's are' : ' is') + ' not given to any crew yet. The council won\'t score a program that leaves roads out.';
    case 'water': return t.roads[x.road]!.name + ' (Crew ' + crewL(x.crew) + '): water. ' + x.carts + ' cart' + (x.carts > 1 ? 's' : '') + ' on a ' + x.waterKm + ' km water run keep the crew at ' + Math.round(x.wf * 100) + '%. +' + x.lost.toFixed(1) + ' days. Add a cart to Crew ' + crewL(x.crew) + '.';
    case 'gravel': return t.roads[x.road]!.name + ' (Crew ' + crewL(x.crew) + '): gravel. ' + x.trucks + ' truck' + (x.trucks > 1 ? 's' : '') + ' on a ' + x.haul + ' km haul bring ' + Math.round(x.supply) + ' of ' + Math.round(x.need) + ' m³ a day. +' + x.lost.toFixed(1) + ' days. Add trucks to Crew ' + crewL(x.crew) + ', or give this road to a crew with more.';
    case 'trucksIdle': return t.roads[x.road]!.name + ' (Crew ' + crewL(x.crew) + '): trucks waiting. A ' + x.haul + ' km haul only needs about ' + x.needTrucks + ' of Crew ' + crewL(x.crew) + '\'s ' + x.trucks + ' trucks.';
    case 'floats': return 'Crew ' + crewL(x.crew) + ' floats ' + x.floats + ' times (' + x.floats * FLOAT_DAYS + ' days, ' + money(x.floats * FLOAT_MOVE) + '). Tidy its order or hand far roads to another crew.';
    case 'spread': return 'Crews finish ' + x.weeks + ' weeks apart. The job isn\'t done until the last one is: move roads from the slowest crew to the quickest.';
  }
}

export function bottText(b: Bott, t: CouncilTender): string {
  return rw(bottText0(b, t));
}
function bottText0(b: Bott, t: CouncilTender): string {
  switch (b.k) {
    case 'roller': return 'The roller is the bottleneck. ' + b.graders + ' graders but only ' + b.rollers + ' roller per crew, so the second grader waits. One roller per grader.';
    case 'water': return 'Water is the bottleneck. ' + (b.mul > 1 ? 'Two graders' : 'A grader') + ' at full pace needs ' + waterNeed(b.mul) + ' water carts; ' + b.carts + ' per crew' + (b.long ? ' on a ' + b.waterKm + ' km water run' : '') + ' has the crews at ' + Math.round(b.wf * 100) + '%.';
    case 'gravel': return 'Gravel is the bottleneck. ' + b.trucks + ' truck' + (b.trucks > 1 ? 's' : '') + ' per crew bring in ' + Math.round(b.supply) + ' m³ a day; the crew could place ' + Math.round(b.need) + '.';
    case 'idle': return b.why === 'trucks'
      ? 'Too many trucks. They could bring ' + Math.round(b.supply!) + ' m³ a day, but the crew only places ' + Math.round(b.need!) + '. You\'re paying for trucks to sit in the queue.'
      : 'Too many rollers. ' + b.rollers + ' rollers for ' + b.graders + ' grader per crew: one sits idle. A second grader would put it to work.';
    case 'issue': return issueText(b.issue, t);
    case 'ok': return t.major && t.pl.prog ? 'Every crew is keeping up: water, gravel and floats are under control.' : 'Water, rollers and gravel are keeping up with the graders.';
  }
}

export { truckM3 };
