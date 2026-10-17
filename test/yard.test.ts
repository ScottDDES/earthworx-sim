// The Yard's own moves against the prototype, on careers it played: hiring off the labour board (and haggling),
// letting someone go, fixing a patched part properly, fitting GPS, stepping the safety system up, and toolbox talks.

import { describe, expect, it } from 'vitest';
import { GPS_COST, int, pick, seedRand, game } from '../src';
import { accFromProto, nmFromTitle, snapshots } from './bot';
import { diaryMark, diarySame } from './diaryCheck';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const SNAPS = snapshots(P, 40, 411, seedRand);

function pair(S0: any) {
  const S = clone(S0);
  S.jobs.forEach(nmFromTitle);
  const b = clone(S);
  b.acc = accFromProto(S.acc);
  return { S, b };
}

describe('the yard', () => {
  it('hiring, haggling, letting go, fixing properly, GPS and safety do the same, and say the same in the diary', () => {
    const R = seedRand(412), seen: Record<string, number> = {}, said = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const { S, b } = pair(pick(R, SNAPS));
      const kind = pick(R, ['hire', 'haggle', 'letGo', 'fix', 'gps', 'safety', 'talks'] as const);
      if (kind === 'fix') {
        const k = int(R, 0, S.fleet.length - 1);
        if (!S.fleet.length) continue;
        S.fleet[k].band = { part: 'Hydraulic pump', fix: int(R, 2, 60) * 100, w: S.week - 3 };
        b.fleet[k].band = clone(S.fleet[k].band);
        if (R() < 0.3) { S.fleet[k].down = b.fleet[k].down = 1; }
      }
      if (kind === 'gps' && R() < 0.6) { S.bank = b.bank = GPS_COST + int(R, -20, 200) * 1000; }
      if (kind === 'safety') { S.bank = b.bank = int(R, 0, 40) * 1000; }
      P.setS(S);
      const mk = diaryMark(P, b), seed = int(R, 1, 1e9);
      let did: unknown = false;
      if (kind === 'hire' || kind === 'haggle') {
        if (!S.cands?.length) continue;
        const id = pick(R, S.cands as { id: string }[]).id;
        P.withRNG(P.seedRand(seed), () => P.hireCand(id, kind === 'haggle'));
        b.rngA = seed | 0;
        did = game.hireCand(b, id, kind === 'haggle');
      } else if (kind === 'letGo') {
        if (!S.staff?.length) continue;
        const id = pick(R, S.staff as { id: string }[]).id;
        P.fireStaff(id);
        did = game.letGo(b, id);
      } else if (kind === 'fix') {
        const id = S.fleet.find((m: any) => m.band)!.id;
        P.fixBand(id);
        did = game.fixProperly(b, id);
      } else if (kind === 'gps') {
        const g = S.fleet.find((m: any) => m.type === 'grader');
        if (!g) continue;
        P.fitGps(g.id);
        did = game.fitGps(b, g.id);
      } else if (kind === 'safety') {
        P.upgradeWhs();
        did = game.upgradeSafety(b);
      } else {
        // the prototype's button: on or off, once you're ready to subcontract (or to turn them off)
        if (S.won || S.whs.talks) S.whs.talks = !S.whs.talks;
        game.toggleTalks(b);
        did = true;
      }
      expect(b.bank).toBe(S.bank);
      expect(b.staff).toEqual(S.staff);
      expect(b.cands).toEqual(S.cands);
      expect(b.fleet).toEqual(S.fleet);
      expect(b.whs).toEqual(S.whs);
      expect(b.tix ?? {}).toEqual(S.tix ?? {});
      expect(b.acc.workshop).toBe(S.acc.ws);
      expect(b.acc.capital).toBe(S.acc.cap);
      for (const k of diarySame(P, b, mk)) said.add(k);
      if (did) seen[kind] = (seen[kind] || 0) + 1;
    }
    for (const k of ['hire', 'haggle', 'letGo', 'fix', 'gps', 'safety', 'talks']) expect(seen[k] ?? 0, k).toBeGreaterThan(30);
    expect([...said].sort()).toEqual(['fixedProperly', 'gps', 'hired', 'knockedBack', 'letGo', 'ticket', 'tookOverThe', 'whsSetUp']);
  });
});
