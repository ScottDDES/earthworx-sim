// Sums for earthmovers: the working-out behind bulk and ag quotes, from Scott's own spreadsheet ("Sums for
// earthmovers"). Levels are reduced levels (RL) in metres, grades are percent, batters are horizontal per 1 vertical
// (3 means 3:1). Numbers only; the words for any of it live in src/text/.

/** Grade as a percent from a fall over a distance (0.76 m over 725 m is 0.105%). */
export function gradePct(fall: number, distance: number): number {
  return distance ? (fall / distance) * 100 : 0;
}

/** Laser grade between two design levels at two chainages. */
export function designGrade(rlStart: number, rlFinish: number, chStart: number, chFinish: number): { distance: number; fall: number; grade: number } {
  const distance = chFinish - chStart, fall = rlFinish - rlStart;
  return { distance, fall, grade: gradePct(fall, distance) };
}

/** The level reached after running a grade (percent) over a distance from a start level. */
export function levelAfter(rlStart: number, distance: number, grade: number): { change: number; finish: number } {
  const change = (distance * grade) / 100;
  return { change, finish: rlStart + change };
}

/**
 * Setting the laser from the dumpy. The receiver sits `edgeToReceiver` above the cutting edge, so for a design level
 * the laser must sit (design RL − bench mark) + edgeToReceiver above the bench mark. Read the staff on the laser and
 * the difference is how far to lift (+) or drop (−) it.
 */
export function laserSetup(benchMark: number, designRl: number, edgeToReceiver: number, staff: number): { aboveDumpy: number; lift: number } {
  const aboveDumpy = designRl - benchMark + edgeToReceiver;
  return { aboveDumpy, lift: aboveDumpy - staff };
}

/** Check a height: dumpy RL plus the staff at the dumpy is the instrument level; less the staff at the work is the work's RL. */
export function checkHeight(dumpyRl: number, staffAtDumpy: number, staffAtWork: number, designRl: number): { instrument: number; work: number; diff: number } {
  const instrument = dumpyRl + staffAtDumpy, work = instrument - staffAtWork;
  return { instrument, work, diff: work - designRl };
}

/**
 * A bank (a ring tank wall, a levee, a road on fill) in cross-section, for pegging out and for volume.
 * crest: width across the top. fill: design RL less natural surface. Batters back and front.
 */
export function bankSection(designRl: number, naturalRl: number, crest: number, backBatter: number, frontBatter: number): {
  fill: number; toeBack: number; toeFront: number; backPerM: number; centrePerM: number; frontPerM: number; perM: number;
} {
  const fill = designRl - naturalRl, half = crest / 2;
  const backPerM = 0.5 * backBatter * fill * fill, centrePerM = crest * fill, frontPerM = 0.5 * frontBatter * fill * fill;
  return { fill, toeBack: half + backBatter * fill, toeFront: half + frontBatter * fill, backPerM, centrePerM, frontPerM, perM: backPerM + centrePerM + frontPerM };
}

/** Natural surface RL at the centre line from a staff reading off a known instrument level. */
export function naturalRl(instrumentRl: number, staff: number): number {
  return instrumentRl - staff;
}

/**
 * A dug dam (a turkey nest's pit, a tank, a pond) from its top size, depth and batters: the flat floor, the four
 * sloping sides, and the four corner pyramids. sideBatter is on the long sides, endBatter on the ends.
 */
export interface DamPit {
  topLength: number;
  topWidth: number;
  depth: number;
  sideBatter: number;
  endBatter: number;
}

export function damVolume(d: DamPit): { floorLength: number; floorWidth: number; centre: number; sides: number; ends: number; corners: number; total: number } {
  const { topLength: A, topWidth: B, depth: C, sideBatter: E, endBatter: D } = d;
  const floorLength = A - 2 * D * C, floorWidth = B - 2 * E * C;
  const centre = floorLength * floorWidth * C;
  const sides = E * C * C * floorLength; // two sides, each half of batter × depth²
  const ends = D * C * C * floorWidth;
  const corners = (4 / 3) * D * E * C * C * C;
  return { floorLength, floorWidth, centre, sides, ends, corners, total: centre + sides + ends + corners };
}

/** An existing dam measured top and floor: works back to its batters, then the volume the same way. */
export function damMeasured(topLength: number, topWidth: number, depth: number, floorLength: number, floorWidth: number): ReturnType<typeof damVolume> & { sideBatter: number; endBatter: number } {
  const sideBatter = (topWidth - floorWidth) / (2 * depth), endBatter = (topLength - floorLength) / (2 * depth);
  return { ...damVolume({ topLength, topWidth, depth, sideBatter, endBatter }), sideBatter, endBatter };
}
