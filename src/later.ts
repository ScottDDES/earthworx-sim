// Hard calls that come back (the real game). A card's choice can leave something waiting: a crew member who walks
// after an injury was hushed up, an unfair dismissal claim, a grazier's dam (or his grudge), a tax audit on a cash job,
// a tender tip that gets out, a wall signed off untested that fails. Each lands weeks later, in the diary, not on the card.
// Also here: an injured worker's weeks off (workers' compensation picks up most of the wage after four), and the
// card four weeks in that asks what to do about them.

import type { Career } from './game';
import { note } from './diary';
import { relAdd } from './relations';
import { TOWNS } from './towns';
import { int, pick, type Rand } from './rng';
import { COMP_AFTER, NAMES, ROLES, SKILLS, type Person } from './staff';
import { RTW_ADVISORY } from './advisory';

const round = (n: number, to: number) => Math.round(n / to) * to;

export interface Later {
  /** The week it lands. */
  w: number;
  k: 'quit' | 'ufd' | 'rzDam' | 'audit' | 'tipOut' | 'signFail';
  [x: string]: unknown;
}

/** Something to come back in so many weeks. */
export function later(c: Career, k: Later['k'], wks: number, d: Record<string, unknown> = {}): void {
  (c.later ??= []).push({ w: c.week + wks, k, ...d });
}

/** An unfair dismissal claim: about 13 weeks' wages in compensation, plus the lawyers. */
export const UFD_WEEKS = 13;
export const UFD_LEGAL = 8000;
/** The odds a worker let go while off injured makes the claim. */
export const UFD_ODDS = 0.6;
/** A hushed-up serious incident that comes out: double the fine (at least $60k), insurance up 40%, track record −5, six months off council work. */
const HIDDEN_FINE = 60000;

/** What hiding a serious incident costs when it comes out. */
export function hiddenOut(c: Career): number {
  c.bank -= HIDDEN_FINE;
  c.ins += 0.4;
  c.rep = Math.max(0, c.rep - 5);
  c.blocked[TOWNS[c.town].council] = c.week + 26;
  return HIDDEN_FINE;
}

/** Monday: whatever's due lands. */
export function laterWeek(rand: Rand, c: Career): void {
  const due = (c.later ?? []).filter((x) => x.w <= c.week);
  if (!due.length) return;
  c.later = c.later!.filter((x) => x.w > c.week);
  for (const x of due) {
    switch (x.k) {
      case 'quit': {
        // a named person (sent home without pay), or whoever's had enough (after an injury was hushed up)
        const p = x.who ? c.staff.find((y) => y.id === x.who) : pick(rand, c.staff.filter((y) => y.off === 0 && !y.jobId && y.id !== x.not).concat(c.staff.filter((y) => y.off === 0 && y.id !== x.not)));
        if (!p) break;
        if (p.jobId) {
          const j = c.jobs.find((jj) => jj.who === p.id);
          if (j) j.who = null;
          p.jobId = null;
        }
        c.staff = c.staff.filter((y) => y !== p);
        c.whs.cult = Math.max(0, c.whs.cult - 5);
        note(c, { k: 'quitOver', name: p.name, why: x.why, hurt: x.hurt ?? null });
        break;
      }
      case 'ufd': {
        const cost = round((x.wage as number) * UFD_WEEKS + UFD_LEGAL, 100);
        c.bank -= cost;
        c.rep = Math.max(0, c.rep - 2);
        c.whs.cult = Math.max(0, c.whs.cult - 10);
        note(c, { k: 'ufdClaim', name: x.name, cost });
        if (x.hid && !(c.whs as { hidOut?: boolean }).hidOut) {
          (c.whs as { hidOut?: boolean }).hidOut = true;
          note(c, { k: 'hiddenOut', name: x.name, fine: hiddenOut(c) });
        }
        break;
      }
      case 'rzDam': {
        // the grazier's dam: his price on the table, and it's yours at anything reasonable
        const S = c.bulk;
        const e = S?.rzDam;
        if (!S || !e) break;
        S.enq.push({ ...e, week: c.week });
        S.promise = { farm: e.farm, until: c.week + 26 };
        delete S.rzDam;
        note(c, { k: 'rzDamRang', farm: e.farm, place: e.place, permit: !!x.permit });
        break;
      }
      case 'audit': {
        const amt = x.amt as number;
        c.bank -= amt;
        c.rep = Math.max(0, c.rep - 2);
        note(c, { k: 'cashAudit', farm: x.farm, amt });
        break;
      }
      case 'tipOut': {
        const hc = x.hc as string;
        c.blocked[hc] = c.week + 26;
        relAdd(c as never, hc, -6);
        c.rep = Math.max(0, c.rep - 3);
        note(c, { k: 'tipOut', hc, rival: x.rival });
        break;
      }
      case 'signFail': {
        const cost = x.cost as number;
        c.bank -= cost;
        c.rep = Math.max(0, c.rep - 4);
        note(c, { k: 'signFail', farm: x.farm, place: x.place, cost });
        break;
      }
    }
  }
}

// ---------- hurt at work ----------

/** Someone's hurt at work and off: workers' compensation follows if it was reported. */
export function injure(p: Person, reported: boolean, hidden = false): void {
  p.inj = { wk: 0, rep: reported, ...(hidden ? { hid: true } : {}) };
}

/** A week goes by for the injured (before anyone's weeks off count down). Four weeks into a long one, a card asks what to do. */
export function injuryWeek(c: Career): void {
  for (const p of c.staff) {
    if ((p.unpaid ?? 0) > 0) p.unpaid!--;
    if (!p.inj) continue;
    if (p.off <= 0) {
      delete p.inj;
      continue;
    }
    p.inj.wk++;
    if (p.inj.wk === COMP_AFTER && p.off >= 6 && !p.inj.asked) {
      p.inj.asked = true;
      c.queue.push({ k: 'injured', id: p.id });
    }
  }
}

/** Keep them on: light duties when the doctor says, a return-to-work plan. Back in about 6 weeks. */
export function injuredKeep(c: Career, p: Person): void {
  p.off = Math.min(p.off, 6);
  c.whs.cult = Math.min(100, c.whs.cult + 8);
}

/** DDES Advisory runs the return to work with the insurer and the doctor: back two weeks sooner. */
export function injuredAdvisory(c: Career, p: Person): number {
  c.bank -= RTW_ADVISORY;
  p.off = Math.min(p.off, 4);
  c.whs.cult = Math.min(100, c.whs.cult + 8);
  return RTW_ADVISORY;
}

/** Let an injured worker go: a week's pay, and odds they make an unfair dismissal claim. Returns whether they will. */
export function letGoInjured(rand: Rand, c: Career, p: Person): boolean {
  c.bank -= p.wage;
  c.staff = c.staff.filter((x) => x !== p);
  c.whs.cult = Math.max(0, c.whs.cult - 6);
  const claim = rand() < UFD_ODDS;
  if (claim) later(c, 'ufd', int(rand, 8, 16), { name: p.name, wage: p.wage, hid: !!p.inj?.hid });
  return claim;
}

/** The good operator from the next town who's looking for work (the card offers them; they're on the labour board this week). */
export function nextTownOperator(rand: Rand, c: Career, p: Person): void {
  const taken = c.staff.map((x) => x.name).concat(c.cands.map((x) => x.name), [p.name]);
  const name = pick(rand, NAMES.filter((n) => !taken.includes(n)).concat([]));
  if (!name) return;
  c.cands.unshift({ id: 'nt' + c.week + p.id, name, role: p.role, skill: 'solid', ask: round(ROLES[p.role].wage * SKILLS.solid.pay, 50) });
}
