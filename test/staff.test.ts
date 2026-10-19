// Staff, managers and workshop cover against the prototype.

import { describe, expect, it } from 'vitest';
import {
  MGR, NAMES, ROLES, SKILLS, YARDS, YARD_ORDER, bigNoWsm, costIdx, fillRoles, fitCov, fitPer, fitters,
  freeStaff, genCandidates, genMgrApplicants, haggle, hire, int, mgrUnlocked, pick, seedRand, staffWeek,
  wages, workshopCtx, type Difficulty, type MachineType, type Person, type Role, type Trait, type YardId,
} from '../src';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const BULK_ROLES = ['dozer', 'scraper', 'plant'];
const ROLE_IDS = (Object.keys(ROLES) as Role[]).filter((r) => !BULK_ROLES.includes(r));
const TRAITS = Object.keys(MGR) as Trait[];
const LOAN_FOR: Record<Difficulty, number> = { easy: 350000, normal: 180000, hard: 80000, hc: 80000 };

function protoCareer(o: Record<string, unknown>): any {
  return { week: 1, town: 'gdi', fleet: [], staff: [], yard: 'home', jobs: [], queue: [], log: [], bank: 1e6, recv: [], seq: 0, loanStart: 180000, hardcore: false, tix: {}, stats: {}, coach: { off: true }, ...o };
}

/** The prototype's id maker, so both sides number things the same. */
const idsFrom = (S: { seq: number }) => () => 'i' + (S.seq = (S.seq || 0) + 1);

/** A random crew on the books, with or without managers, some off work. */
function randomStaff(R: () => number): Person[] {
  const n = int(R, 0, 9), out: Person[] = [];
  for (let i = 0; i < n; i++) {
    const role = pick(R, ['grader', 'roller', 'cart', 'truck', 'super', 'fitter', 'fitter'] as Role[]);
    out.push({ id: 'p' + i, name: NAMES[i]!, role, skill: 'solid', wage: int(R, 14, 30) * 100, off: R() < 0.15 ? int(R, 1, 3) : 0, jobId: R() < 0.3 ? 'j1' : null });
  }
  for (const role of ['ops', 'wsm'] as const) if (R() < 0.4) {
    const t = pick(R, TRAITS.filter((k) => MGR[k].role === role));
    out.push({ id: role, name: NAMES[10 + (role === 'ops' ? 0 : 1)]!, role, skill: 'solid', wage: 3000, off: R() < 0.1 ? 2 : 0, jobId: null, trait: t });
  }
  return out;
}

describe('tables', () => {
  it('roles, skills, names and managers are the same', () => {
    // the road trades are the prototype's; dozer, scraper and plant operators are the Bulk and Ag pack's own
    expect(Object.fromEntries(Object.entries(ROLES).filter(([k]) => !BULK_ROLES.includes(k)))).toEqual(P.ROLES);
    expect(SKILLS).toEqual(P.SKILLS);
    expect([...NAMES]).toEqual(P.NAMES);
    expect(MGR).toEqual(P.MGR);
  });
});

describe('the labour board', () => {
  it('the same three people apply, asking the same wages', () => {
    const R = seedRand(21);
    for (let i = 0; i < 2000; i++) {
      const staff = randomStaff(R), yard: YardId = pick(R, YARD_ORDER), won2 = R() < 0.5, seq = int(R, 0, 500), seed = int(R, 1, 1e9);
      const S = protoCareer({ staff: JSON.parse(JSON.stringify(staff)), yard, won2, seq });
      P.setS(S);
      P.withRNG(P.seedRand(seed), () => P.genCands());
      const mine = genCandidates(seedRand(seed), { taken: staff.map((p) => p.name), ownContract: won2, workshop: YARDS[yard].svc < 1 }, idsFrom({ seq }));
      expect(mine).toEqual(S.cands);
    }
  });

  it('haggling: same answer, same wage, and the same rival when they walk', () => {
    const R = seedRand(22);
    let took = 0, walked = 0;
    const rivals = [{ name: 'Weir River Plant' }, { name: 'Bluegum Earthworks' }, { name: 'Redgum Grading' }];
    for (let i = 0; i < 1500; i++) {
      const seq = int(R, 0, 100), S = protoCareer({ seq, rivals });
      P.setS(S);
      P.withRNG(P.seedRand(int(R, 1, 1e9)), () => P.genCands());
      const c = S.cands[int(R, 0, 2)], seed = int(R, 1, 1e9), copy = { ...c };
      P.withRNG(P.seedRand(seed), () => P.hireCand(c.id, true));
      const res = haggle(seedRand(seed), copy, rivals.map((x) => x.name));
      if (res.took) {
        took++;
        const p = S.staff[0];
        expect(p.wage).toBe(res.wage);
        expect({ ...hire(copy, res.wage, p.id) }).toEqual(p);
      } else {
        walked++;
        expect(S.staff.length).toBe(0);
        expect(P.UI.hireMsg).toContain('took a job with ' + res.wentTo + ' instead');
      }
    }
    expect(took).toBeGreaterThan(300);
    expect(walked).toBeGreaterThan(300);
  });
});

describe('crews', () => {
  it('seats get filled the same way, specialists first, casuals for the rest', () => {
    const R = seedRand(23);
    for (let i = 0; i < 5000; i++) {
      const need = { grader: int(R, 0, 3), roller: int(R, 0, 3), cart: int(R, 0, 6), truck: int(R, 0, 4) };
      const people = Array.from({ length: int(R, 0, 10) }, (_, k) => ({ id: 'p' + k, role: pick(R, ROLE_IDS) }));
      if (R() < 0.7) people.unshift({ id: 'you', role: 'grader' });
      expect(fillRoles(need, people)).toEqual(P.fillRoles(need, people));
    }
  });

  it('free drivers, wages and weeks off match', () => {
    const R = seedRand(24);
    for (let i = 0; i < 2000; i++) {
      const staff = randomStaff(R);
      P.setS(protoCareer({ staff }));
      expect(wages(staff)).toBe(P.wages());
      for (const k of ['grader', 'roller', 'cart', 'truck'] as MachineType[]) expect(freeStaff(staff, k)?.id).toBe(P.freeStaff(k)?.id);
      const before = staff.map((p) => p.off);
      staffWeek(staff);
      staff.forEach((p, k) => expect(p.off).toBe(Math.max(0, before[k]! - 1)));
    }
  });
});

describe('managers and the workshop', () => {
  it('the same applicants for both jobs, at the same wages', () => {
    const R = seedRand(25);
    for (let i = 0; i < 1500; i++) {
      const d: Difficulty = pick(R, ['easy', 'normal', 'hard', 'hc']);
      const staff = randomStaff(R).filter((p) => !p.trait), week = int(R, 1, 400), seq = int(R, 0, 500), seed = int(R, 1, 1e9);
      const S = protoCareer({ staff: JSON.parse(JSON.stringify(staff)), week, seq, won2: true, loanStart: LOAN_FOR[d], hardcore: d === 'hc' });
      P.setS(S);
      P.withRNG(P.seedRand(seed), () => P.mgrWeek({ events: [] }));
      const rand = seedRand(seed), ids = idsFrom({ seq }), taken = staff.map((p) => p.name), ci = costIdx(week, d);
      expect(genMgrApplicants(rand, 'ops', taken, ci, ids)).toEqual(S.mgrs.ops.c);
      expect(genMgrApplicants(rand, 'wsm', taken, ci, ids)).toEqual(S.mgrs.wsm.c);
    }
  });

  it('who is unlocked, fitter cover and the big-fleet rule match', () => {
    const R = seedRand(26);
    for (let i = 0; i < 3000; i++) {
      const staff = randomStaff(R), yard: YardId = pick(R, YARD_ORDER), won2 = R() < 0.5, n = int(R, 0, 30);
      const fleet = Array.from({ length: n }, (_, k) => ({ id: 'm' + k, status: R() < 0.1 ? 'branch' : 'idle' }));
      const home = fleet.filter((m) => m.status !== 'branch').length;
      P.setS(protoCareer({ staff, yard, won2, fleet }));
      const svc = YARDS[yard].svc;
      expect(fitters(staff).map((p) => p.id)).toEqual(P.fitters().map((p: Person) => p.id));
      expect(fitPer(staff)).toBe(P.fitPer());
      expect(fitCov(staff, home, svc)).toBe(P.fitCov());
      expect(bigNoWsm(staff, home)).toBe(P.bigNoWsm());
      for (const role of ['ops', 'wsm'] as const) expect(mgrUnlocked(role, won2, svc < 1)).toBe(P.mgrUnlocked(role));
      const ctx = workshopCtx(staff, home, svc, 1, 1);
      expect(ctx.fitCov).toBe(P.fitCov());
      expect(ctx.bigNoWsm).toBe(P.bigNoWsm());
    }
  });
});
