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

// ---- Production: how long the spread takes. Not on the spreadsheet; the usual earthmoving rules of thumb. ----
// Volumes are bank m³ (in the ground) unless named otherwise. Times are minutes, speeds km/h, haul distances metres.

/** A scraper's round trip: load, haul out loaded, spread and turn, come back empty. */
export function scraperCycle(c: { load: number; haul: number; loadedKmh: number; emptyKmh: number; spreadTurn: number }): number {
  const leg = (kmh: number) => (kmh > 0 ? (c.haul / 1000 / kmh) * 60 : 0);
  return c.load + leg(c.loadedKmh) + c.spreadTurn + leg(c.emptyKmh);
}

/** Bank m³ an hour from one scraper. eff is the working fraction of the hour (a 50-minute hour is 50/60). */
export function scraperRate(cycleMin: number, bankPerLoad: number, eff = 50 / 60): number {
  return cycleMin > 0 ? (60 / cycleMin) * eff * bankPerLoad : 0;
}

/** A push dozer's cycle per scraper it loads: the usual rule is 1.4 times the load time plus a quarter minute to get back. */
export function pusherCycle(loadMin: number): number {
  return 1.4 * loadMin + 0.25;
}

/** How many scrapers one push dozer keeps busy without them queueing. */
export function scrapersPerPusher(scraperCycleMin: number, loadMin: number): number {
  return scraperCycleMin / pusherCycle(loadMin);
}

/** A pushed spread: the scrapers' output, capped by how many loads the push dozers can give them. */
export function pushedSpread(scrapers: number, pushers: number, cycleMin: number, loadMin: number, bankPerLoad: number, eff = 50 / 60): number {
  const fromScrapers = scrapers * scraperRate(cycleMin, bankPerLoad, eff);
  const fromPushers = pushers * (60 / pusherCycle(loadMin)) * eff * bankPerLoad;
  return Math.min(fromScrapers, fromPushers);
}

/** Compacted m³ an hour from a compactor: width × speed × lift ÷ passes. */
export function compactorRate(widthM: number, kmh: number, liftM: number, passes: number, eff = 50 / 60): number {
  return passes > 0 ? (widthM * kmh * 1000 * liftM * eff) / passes : 0;
}

/** Bank m³ that ends up as one compacted m³. Clay in a wall takes up less room than it did in the ground. */
export function cutForFill(compactedM3: number, shrink: number): number {
  return compactedM3 / (1 - shrink);
}

/** Litres of water to lift compacted fill by addPct moisture (dry density in t/m³). */
export function waterNeeded(compactedM3: number, addPct: number, dryDensity = 1.7): number {
  return compactedM3 * dryDensity * (addPct / 100) * 1000;
}

/** Litres an hour a water cart lays down: one tank per fill-drive-spray-return trip. */
export function waterCartRate(tankL: number, tripMin: number, eff = 50 / 60): number {
  return tripMin > 0 ? (tankL * 60 * eff) / tripMin : 0;
}

/**
 * Days on the job for a dirt job. Each part of the spread gives what it can do in bank m³ an hour; the slowest part
 * sets the pace. Returns the days and which part held it up.
 */
export function daysOnJob(bankM3: number, hoursPerDay: number, rates: Record<string, number>): { perHour: number; days: number; slowest: string } {
  let slowest = '', perHour = Infinity;
  for (const [k, r] of Object.entries(rates)) if (r < perHour) { perHour = r; slowest = k; }
  return { perHour, days: perHour > 0 && hoursPerDay > 0 ? bankM3 / (perHour * hoursPerDay) : Infinity, slowest };
}
