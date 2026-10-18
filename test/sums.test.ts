// The sums against Scott's spreadsheet ("Sums for earthmovers"): every answer on it, from the same inputs.

import { describe, expect, it } from 'vitest';
import { bankSection, checkHeight, damMeasured, damVolume, designGrade, gradePct, laserSetup, levelAfter, naturalRl } from '../src/sums';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('sums for earthmovers, as the spreadsheet has them', () => {
  it('laser grade: 0.76 m fall over 725 m', () => near(gradePct(0.76, 725), 0.10482758620689654));

  it('laser grade from design: RL 69.3 to 69.68, chainage 2590 to 4440', () => {
    const g = designGrade(69.3, 69.68, 2590, 4440);
    near(g.distance, 1850);
    near(g.fall, 0.38);
    near(g.grade, 0.020540540540541063);
  });

  it('laser setup from the dumpy: bench mark 0, design −1.5, edge to receiver 4.2, staff 4.36', () => {
    const s = laserSetup(0, -1.5, 4.2, 4.36);
    near(s.aboveDumpy, 2.7);
    near(s.lift, -1.66);
  });

  it('bank peg out: design RL 2, 5 m wide, 3:1 back, 5:1 front, staff 2.93 off a laser at 1.45', () => {
    const ns = naturalRl(0 + 1.45, 2.93);
    near(ns, -1.48);
    const b = bankSection(2, ns, 5, 3, 5);
    near(b.fill, 3.48);
    near(b.toeBack, 12.94);
    near(b.toeFront, 19.9);
    near(b.backPerM, 18.165600000000005);
    near(b.centrePerM, 17.4);
    near(b.frontPerM, 30.276000000000007);
    near(b.perM * 100, 6584.160000000002);
  });

  it('laser grade over a distance: RL 70, 910 m at −0.036%', () => {
    const l = levelAfter(70, 910, -0.036);
    near(l.change, -0.3276);
    near(l.finish, 69.6724);
  });

  it('check a height: dumpy 71.97, staff 4.3 at the dumpy and 2.95 at the work, design 73.35', () => {
    const h = checkHeight(71.97, 4.3, 2.95, 73.35);
    near(h.instrument, 76.27);
    near(h.work, 73.32);
    near(h.diff, -0.03);
  });

  it('dam volumes, design: 110 × 52 top, 6 deep, 3:1 sides, 4:1 ends', () => {
    const d = damVolume({ topLength: 110, topWidth: 52, depth: 6, sideBatter: 3, endBatter: 4 });
    near(d.floorLength, 62);
    near(d.floorWidth, 16);
    near(d.centre, 5952);
    near(d.sides, 6696);
    near(d.ends, 2304);
    near(d.corners, 3456);
    near(d.total, 18408);
  });

  it('dam volumes, measured existing: 110 × 52 top, 60 × 16 floor, 6.5 deep', () => {
    const d = damMeasured(110, 52, 6.5, 60, 16);
    near(d.sideBatter, 2.769230769230769);
    near(d.endBatter, 3.8461538461538463);
    near(d.centre, 6240);
    near(d.sides, 7020);
    near(d.ends, 2600);
    near(d.corners, 3900);
    near(d.total, 19760);
  });

  it('a dam dug with no batters is just a box', () => {
    near(damVolume({ topLength: 10, topWidth: 5, depth: 2, sideBatter: 0, endBatter: 0 }).total, 100);
  });
});
