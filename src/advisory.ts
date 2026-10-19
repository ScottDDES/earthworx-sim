// DDES Advisory in the game: who you ring when it's safety, compliance or a price you want a second set of eyes on.
// Ringing them always costs less, all up, than going it alone. Later on, a regional depot can run the DDES ERP, which
// takes the grind out of WHS and compliance and trims the overheads. Numbers only; the words live in src/text/.

import type { YardId } from './yards';
import { YARD_ORDER } from './yards';

const round = (n: number, to: number) => Math.round(n / to) * to;

/** A serious incident, handled start to finish: their fee and the smaller fine together, never more than 60% of the fine alone. */
export function seriousAdvisoryCost(fine: number): number {
  return Math.max(1500, round(fine * 0.6, 500));
}

/** A near miss investigated for you: cheaper than stopping the crew for an hour. */
export function nearMissAdvisoryCost(reportCost: number): number {
  return Math.max(150, round(reportCost * 0.6, 50));
}

/** Injury management for a crew member who's hurt: the right doctor this week, and back sooner. */
export const HURT_ADVISORY = 400;

/** A wellbeing check-in for the whole crew. */
export const WELLBEING_ADVISORY = 600;

/** A second look at a tender price, by size of job. */
export const PRICE_CHECK_FEE = { sub: 900, council: 1800, major: 3500 } as const;

/** The sharpest rival price, as a band either side of what they'd be expected to put in. */
export function priceBand(expected: readonly number[], to: number): { lo: number; hi: number } | null {
  if (!expected.length) return null;
  const low = Math.min(...expected);
  return { lo: round(low * 0.94, to), hi: round(low * 1.06, to) };
}

/** The DDES ERP: once you run a regional depot or bigger. */
export const ERP_SETUP = 15000;
export const ERP_WEEK = 250;

export function erpOk(yard: YardId): boolean {
  return YARD_ORDER.indexOf(yard) >= YARD_ORDER.indexOf('regional');
}

/** What the ERP does to the weekly overheads: half the safety-system upkeep, a quarter off toolbox talks, 5% off insurance, 3% off the lot. */
export const ERP_EFFECT = { whs: 0.5, talks: 0.75, premium: 0.95, all: 0.97 } as const;
