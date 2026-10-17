// Each head contractor's project manager remembers how you treat them: finish on time and they come back,
// let them down and they don't. Standing runs −10 to +10 and drifts a point back toward neutral every 8 weeks.

import { HEAD_CONTRACTORS } from './market';

export const CLIENT_PM: Record<string, string> = { 'Border Civil': 'Trev Baxter', 'Hartley Bros': 'Lou Hartley', 'Macintyre Plant': 'Jules Moreno', 'Dry Creek Civil': 'Sandy Pike' };

export type Tier = 'pref' | 'good' | 'ok' | 'wary' | 'out';

export function relOf(rel: Record<string, number> | undefined, c: string): number {
  return (rel || {})[c] || 0;
}

export function relTier(rel: Record<string, number> | undefined, c: string): Tier {
  const v = relOf(rel, c);
  return v >= 6 ? 'pref' : v >= 3 ? 'good' : v > -3 ? 'ok' : v > -6 ? 'wary' : 'out';
}

/** Moves a head contractor's opinion of you. Returns the new tier if it changed, so screens can say so. */
export function relAdd(st: { rel?: Record<string, number> }, c: string, d: number): Tier | null {
  if (!(HEAD_CONTRACTORS as readonly string[]).includes(c) || !d) return null;
  st.rel = st.rel || {};
  const was = relTier(st.rel, c);
  st.rel[c] = Math.max(-10, Math.min(10, relOf(st.rel, c) + d));
  const now = relTier(st.rel, c);
  return was !== now ? now : null;
}

/** Memories fade: every 8 weeks each standing drifts a point back toward neutral. */
export function relWeek(st: { rel?: Record<string, number>; week: number }): void {
  if (!st.rel || st.week % 8) return;
  for (const c of Object.keys(st.rel)) {
    const v = st.rel[c]!;
    st.rel[c] = v > 0 ? v - 1 : v < 0 ? v + 1 : 0;
  }
}

/** Points your standing adds to a subbie tender. */
export function relPts(rel: Record<string, number> | undefined, c: string): number {
  const v = relOf(rel, c);
  return v >= 6 ? 3 : v >= 3 ? 1 : v <= -6 ? -4 : v <= -3 ? -2 : 0;
}
