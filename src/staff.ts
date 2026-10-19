// People. Permanent staff are paid every week, working or not; casuals from labour hire
// are paid only on the days they work. You (the owner) can drive a grader, roller or water cart.

import { isRoad, type MachineType, type RoadType } from './machines';
import { pick, type Rand } from './rng';

export type Role = 'grader' | 'roller' | 'cart' | 'truck' | 'super' | 'ops' | 'fitter' | 'wsm';

export interface RoleSpec {
  name: string;
  /** Weekly wage for a solid hand. */
  wage: number;
  /** Labour-hire day rate for a casual in this seat (0 if you can't get one). */
  casual: number;
  /** Machines they can drive. */
  drives: readonly MachineType[];
  note: string;
}

export const ROLES: Record<Role, RoleSpec> = {
  grader: { name: 'Grader operator', wage: 2100, casual: 600, drives: ['grader', 'roller', 'cart'], note: 'Runs a grader, roller or water cart.' },
  roller: { name: 'Roller operator', wage: 1600, casual: 460, drives: ['roller'], note: 'Roller only.' },
  cart:   { name: 'Water cart driver', wage: 1500, casual: 440, drives: ['cart'], note: 'Water cart only.' },
  truck:  { name: 'Truck driver', wage: 1700, casual: 480, drives: ['truck', 'cart'], note: 'Side tipper or water cart. HR licence.' },
  super:  { name: 'Site supervisor', wage: 2700, casual: 0, drives: [], note: 'Runs a council contract for you, so you can have more than one going.' },
  ops:    { name: 'Operations manager', wage: 3000, casual: 0, drives: [], note: 'Lets you run more than two contracts at once, and can run one themselves like a site supervisor. Puts your own gear onto contracts in place of hire-ins without asking.' },
  fitter: { name: 'Fitter', wage: 1600, casual: 0, drives: [], note: 'Works in your workshop and looks after up to 6 machines: services them when due for a quarter of the dealer price, fixes patched-up jobs on idle gear, and cuts breakdowns.' },
  wsm:    { name: 'Workshop manager', wage: 3200, casual: 0, drives: [], note: 'Runs the workshop and does a fitter\'s work too: every service and repair, and tells you when gear is due to be turned over. Past 12 machines, a fleet without one breaks down a quarter more often.' },
};

export type Skill = 'green' | 'solid' | 'gun';

export interface SkillSpec {
  name: string;
  /** Wage relative to a solid hand. */
  pay: number;
  /** Wear on the gear they drive, relative to a solid hand. */
  wear: number;
  /** Chance they take a lower offer when you haggle. */
  yes: number;
  note: string;
}

export const SKILLS: Record<Skill, SkillSpec> = {
  green: { name: 'Green', pay: 0.85, wear: 1.3, yes: 0.8, note: 'Cheap, and harder on the gear.' },
  solid: { name: 'Solid', pay: 1, wear: 1, yes: 0.55, note: 'Does the job.' },
  gun:   { name: 'Gun', pay: 1.15, wear: 0.8, yes: 0.3, note: 'Dear, and easy on the gear.' },
};

export const NAMES = ['Dave', 'Shane', 'Kylie', 'Mick', 'Tash', 'Robbo', 'Jono', 'Bec', 'Wazza', 'Mel', 'Hayden', 'Shaz', 'Trent', 'Jess', 'Cooper', 'Leanne'] as const;

export interface Person {
  id: string;
  name: string;
  role: Role;
  skill: Skill;
  wage: number;
  /** Weeks off work (hurt, or on leave). 0 = working. */
  off: number;
  /** The job they're on, if any. */
  jobId: string | null;
  /** Managers only: which kind. */
  trait?: string;
  /** Week they last had a quiet word with you. */
  yarn?: number;
}

export interface Candidate {
  id: string;
  name: string;
  role: Role;
  skill: Skill;
  ask: number;
  /** Keen for the work: asks 15% less and is easier to haggle with. */
  keen?: boolean;
}

const round = (n: number, to: number) => Math.round(n / to) * to;

export interface LabourMarket {
  /** Names already on your books, so nobody turns up twice. */
  taken: readonly string[];
  /** Site supervisors only apply once you've had your own contract. */
  ownContract: boolean;
  /** Fitters only apply once you have a workshop. */
  workshop: boolean;
}

/** This week's three people on the labour board. */
export function genCandidates(rand: Rand, mkt: LabourMarket, nextId: () => string): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < 3; i++) {
    const pool: Role[] = ['grader', 'grader', 'roller', 'cart', 'cart', 'truck'];
    if (mkt.ownContract) pool.push('super', 'super');
    if (mkt.workshop) pool.push('fitter', 'fitter');
    const role = pick(rand, pool);
    const skill = pick(rand, ['green', 'solid', 'solid', 'gun'] as const);
    const name = pick(rand, NAMES.filter((n) => !mkt.taken.includes(n) && !out.some((c) => c.name === n)));
    const c: Candidate = { id: nextId(), name, role, skill, ask: round(ROLES[role].wage * SKILLS[skill].pay * (0.95 + rand() * 0.1), 50) };
    if (rand() < 0.15) {
      c.keen = true;
      c.ask = round(c.ask * 0.85, 50);
    }
    out.push(c);
  }
  return out;
}

/** Haggling offers 12% under their ask. */
export function haggleOffer(c: Candidate): number {
  return round(c.ask * 0.88, 50);
}

export type HaggleResult = { took: true; wage: number } | { took: false; wentTo: string };

/** Offer less. They take it, or walk off to a rival. */
export function haggle(rand: Rand, c: Candidate, rivalNames: readonly string[]): HaggleResult {
  if (rand() < Math.min(0.95, SKILLS[c.skill].yes * (c.keen ? 1.2 : 1))) return { took: true, wage: haggleOffer(c) };
  return { took: false, wentTo: pick(rand, rivalNames.length ? rivalNames : ['a rival']) };
}

export function hire(c: Candidate, wage: number, id: string): Person {
  return { id, name: c.name, role: c.role, skill: c.skill, wage, off: 0, jobId: null };
}

/** The weekly wage bill. */
export function wages(staff: readonly Person[]): number {
  return staff.reduce((a, p) => a + p.wage, 0);
}

export function working(p: Person): boolean {
  return p.off === 0;
}

/** Someone free who can drive this machine. */
export function freeStaff(staff: readonly Person[], type: MachineType): Person | undefined {
  return staff.find((p) => !p.jobId && p.off === 0 && ROLES[p.role].drives.includes(type));
}

/** A week goes by: anyone off is a week closer to coming back. */
export function staffWeek(staff: Person[]): void {
  for (const p of staff) if (p.off > 0) p.off--;
}

export type Seats = Record<'grader' | 'roller' | 'cart' | 'truck', number>;

export interface CrewFill {
  /** Seats nobody on the books could fill: casuals take those. */
  left: Seats;
  /** Who got a seat. */
  used: string[];
  /** Day rate for casuals on the grader, roller and cart seats. */
  casualDay: number;
  /** Day rate for casual truck drivers (paid only on sheeting days). */
  truckCasualDay: number;
  casuals: number;
}

/**
 * Fills a crew's seats: specialists first (a roller operator can only go on the roller),
 * then the all-rounders on whatever's left. The rest are casuals from labour hire.
 * The owner goes in as { id: 'you', role: 'grader' }.
 */
export function fillRoles(need: Partial<Seats>, people: readonly { id: string; role: Role }[]): CrewFill {
  const left: Seats = { grader: need.grader || 0, roller: need.roller || 0, cart: need.cart || 0, truck: need.truck || 0 };
  const used: string[] = [];
  const order = people.slice().sort((a, b) => ROLES[a.role].drives.length - ROLES[b.role].drives.length);
  for (const p of order) {
    const seat = ROLES[p.role].drives.find((k): k is RoadType => isRoad(k) && left[k] > 0);
    if (seat) {
      left[seat]--;
      used.push(p.id);
    }
  }
  return {
    left, used,
    casualDay: left.grader * ROLES.grader.casual + left.roller * ROLES.roller.casual + left.cart * ROLES.cart.casual,
    truckCasualDay: left.truck * ROLES.truck.casual,
    casuals: left.grader + left.roller + left.cart + left.truck,
  };
}
