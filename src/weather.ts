// Real rain. Each career replays a real run of seasons for its town, starting 1 April of a year
// picked at random from 1995 to 2023, and wraps around at the end of the record.

import { dayOffset } from './calendar';
import { RAIN, RAIN_ALPHABET, RAIN_FROM } from './data/rain';
import type { Rand } from './rng';
import { TOWNS, type TownId } from './towns';

/** What the weather needs to know about a career. Both save with it. */
export interface WeatherCtx {
  town: TownId;
  /** Day in the rain record that week 1, day 0 lands on. */
  wxStart: number;
}

const DAY_MS = 864e5;

/** Picks where in the record a new career starts: 1 April of a random year. */
export function pickStart(rand: Rand): number {
  const y = 1995 + Math.floor(rand() * 29);
  return Math.round((Date.UTC(y, 3, 1) - RAIN_FROM) / DAY_MS);
}

function recordIdx(town: TownId, wxStart: number, off: number): number {
  const n = RAIN[town].length;
  return (((wxStart + off) % n) + n) % n;
}

function mmAt(town: TownId, idx: number): number {
  return RAIN_ALPHABET.indexOf(RAIN[town].charAt(idx));
}

/** Rain in mm that falls on a day of the career (off = days since week 1, day 0). */
export function rainMm(ctx: WeatherCtx, off: number): number {
  return mmAt(ctx.town, recordIdx(ctx.town, ctx.wxStart, off));
}

/** The real date the day's rain comes from. */
export function recordDate(ctx: WeatherCtx, off: number): Date {
  return new Date(RAIN_FROM + recordIdx(ctx.town, ctx.wxStart, off) * DAY_MS);
}

/** True when the ground's still too wet from a big fall in the last two days. */
export function groundWet(ctx: WeatherCtx, off: number): boolean {
  const R = TOWNS[ctx.town].stop;
  return rainMm(ctx, off - 1) >= R[1] || rainMm(ctx, off - 2) >= R[2];
}

/** A crew is rained off with enough rain on the day, or when the ground's still wet. */
export function wetDay(ctx: WeatherCtx, week: number, day: number): boolean {
  const off = dayOffset(week, day);
  return rainMm(ctx, off) >= TOWNS[ctx.town].stop[0] || groundWet(ctx, off);
}

export interface Forecast {
  /** Chance of rain, %, to the nearest 5. */
  pc: number;
  /** What will actually fall. The player never sees this ahead of time. */
  mm: number;
  /** What the forecast says will fall. */
  fmm: number;
  /** Today only: the ground's still wet from earlier rain. */
  wetGround: boolean;
}

// A fixed wobble per day of the record, so a forecast reads the same every time it's looked at.
function wobble(ctx: WeatherCtx, i: number): number {
  const x = Math.sin(i * 12.9898 + ctx.wxStart * 0.0137) * 43758.5453;
  return x - Math.floor(x);
}

/** The forecast: right most of the time, the way a 7-day forecast is, and vaguer further out. */
export function forecast(ctx: WeatherCtx, week: number, day: number): Forecast {
  const off = dayOffset(week, day);
  const idx = recordIdx(ctx.town, ctx.wxStart, off);
  const mm = rainMm(ctx, off);
  const h = wobble(ctx, idx);

  let pc = mm >= 10 ? 70 + h * 25 : mm >= 4 ? 45 + h * 35 : mm >= 1 ? 15 + h * 35 : h * 25;
  if (day >= 3) pc = pc * 0.7 + 15;

  const h2 = wobble(ctx, idx + 7777);
  const fmm =
    mm >= 4 ? Math.round(mm * (0.6 + h2 * 0.9))
    : mm >= 1 ? Math.round(mm * (1 + h2 * 1.5))
    : h2 < 0.012 ? Math.round(5 + h2 * 300) // now and then it forecasts rain that never comes
    : 0;

  return { pc: Math.round(pc / 5) * 5, mm, fmm, wetGround: groundWet(ctx, off) && day === 0 };
}

/** Chance of a rain day this month, from the town's averages. */
export function rainChance(town: TownId, month: number): number {
  return (TOWNS[town].rainDays[month] ?? 0) / 30;
}

const meanCache: Partial<Record<TownId, number>> = {};
/** Average yearly rainfall in the record, mm. */
export function meanYearMm(town: TownId): number {
  const cached = meanCache[town];
  if (cached !== undefined) return cached;
  const s = RAIN[town];
  let tot = 0;
  for (let i = 0; i < s.length; i++) tot += RAIN_ALPHABET.indexOf(s.charAt(i));
  return (meanCache[town] = tot / (s.length / 365.25));
}
