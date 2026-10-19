// The game runs in weeks. Week 1 is the first week of April 2027, and a month is 4.345 weeks.
// (The rain is real rain from a past year, also starting 1 April: see weather.ts.)
// Days in a week are 0 to 6, Monday first; crews work days 0 to 4.

export const BASE_YEAR = 2027;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const WEEKS_PER_MONTH = 4.345;
const START_MONTH = 3; // April

/** Month of the year for a week, 0 = January. */
export function monthIdx(week: number): number {
  return (Math.floor((week - 1) / WEEKS_PER_MONTH) + START_MONTH) % 12;
}

/** Calendar year a week falls in. */
export function yearOf(week: number): number {
  return BASE_YEAR + Math.floor((Math.floor((week - 1) / WEEKS_PER_MONTH) + START_MONTH) / 12);
}

/** The Christmas shutdown: the two weeks from about 20 December (day 263 counting from 1 April). */
export function shutWeek(week: number): boolean {
  const d = ((week - 1) * 7) % 365.25;
  return d >= 262 && d < 276;
}

/** Days since the career began, for looking up that day's rain. */
export function dayOffset(week: number, day: number): number {
  return (week - 1) * 7 + day;
}
