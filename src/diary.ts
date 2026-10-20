// The site diary and the district news: what happened and when, as codes and the data to word them.
// The words are in text/diary.ts. A job or machine can be gone by the time the diary is read, so an
// entry keeps what it needs to name them.

import type { Job } from './hire';
import type { Machine } from './machines';

/** Enough of a job to name it after it's gone. */
export type JobRef = Pick<Job, 'kind' | 'type' | 'client' | 'place' | 'nm'> & { major?: boolean; prestige?: boolean };
/** Enough of a machine to name it after it's gone. */
export type MRef = Pick<Machine, 'type' | 'year'> & { multi?: boolean; rt?: boolean };

export const jobRef = (j: JobRef): JobRef => ({ kind: j.kind, type: j.type, client: j.client, place: j.place, nm: j.nm, major: j.major, prestige: j.prestige });
export const mRef = (m: MRef): MRef => (m.multi ? { type: m.type, year: m.year, multi: true } : m.rt ? { type: m.type, year: m.year, rt: true } : { type: m.type, year: m.year });

/** One thing that happened. k says what; the rest is what the words need. */
export type DiaryEvent = { k: string; [x: string]: unknown };

export interface DiaryEntry {
  w: number;
  e: DiaryEvent;
}

export interface DiaryHolder {
  week: number;
  log?: DiaryEntry[];
  news?: DiaryEntry[];
}

/** Into the site diary (the last 40). */
export function note(st: { week: number }, e: DiaryEvent): void {
  const L = ((st as DiaryHolder).log ??= []);
  L.unshift({ w: st.week, e });
  if (L.length > 40) L.length = 40;
}

/** Into the district news (the last 12). */
export function news(st: { week: number }, e: DiaryEvent): void {
  const L = ((st as DiaryHolder).news ??= []);
  L.unshift({ w: st.week, e });
  if (L.length > 12) L.length = 12;
}

/** Both: the diary and the news, worded the same. */
export function noteNews(st: { week: number }, e: DiaryEvent): void {
  note(st, e);
  news(st, e);
}
