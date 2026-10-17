// The map's words: what each road state is called and what a tapped road says about itself.

import type { MapRoad, RoadState } from '../map';

export const MAP_TXT: Record<RoadState, string> = { dmg: 'Flood damaged', work: 'Your crews on it', done: 'Fixed by you', rw: 'A rival\'s crews on it', rd: 'Fixed by someone else', ok: 'Sound' };

/** The legend's order. */
export const MAP_KEYS: RoadState[] = ['done', 'work', 'dmg', 'rw', 'rd', 'ok'];

/** A tapped road: its length and area, then what's happening on it. jobTitle names the job your crews are on, if any. */
export function roadNote(x: MapRoad, jobTitle: string | null): string {
  const st = x.st;
  return x.L + ' km' + (x.area ? ' · ' + x.area + ' area' : '') + '. ' +
    (st === 'done' ? 'Your crews finished it in week ' + x.w + '.'
      : st === 'work' && jobTitle ? 'Part of ' + jobTitle + '.'
      : st === 'rw' ? x.by + ' won it. Done by about week ' + x.until + '.'
      : st === 'rd' ? (x.by ? x.by + ' fixed it' : 'Fixed') + (x.w ? ' in week ' + x.w : '') + '.'
      : st === 'dmg' ? 'Waiting on flood recovery funding and a contractor. Watch the tenders.'
      : 'Came through the floods sound.');
}
