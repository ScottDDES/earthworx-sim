// Checking docket lines in the unit tests: the engine's events in words against the prototype's lines.
// Job names are checked in the whole-career test; here each prototype job's title is swapped for the engine's name for it.

import { expect } from 'vitest';
import { eventText } from '../src/text/docket';
import { jobTitle } from '../src/text/work';

export function sameLines(c: any, events: unknown[], protoLines: string[], jobs: { pj: any; bj: any }[] = []): void {
  const r: any = { events, jobs: Object.fromEntries(jobs.map((x) => [x.bj.id, x.bj])) };
  const mine = events.map((e) => eventText(c, r, e)).filter((t) => t != null);
  const named = jobs.filter((x) => x.pj.title).sort((a, b) => b.pj.title.length - a.pj.title.length);
  const theirs = protoLines.map((t) => { for (const { pj, bj } of named) t = t.split(pj.title).join(jobTitle(bj)); return t; });
  expect(mine).toEqual(theirs);
}

/** Pair each prototype job with the engine's copy. */
export function jobPairs(S: any, b: any): { pj: any; bj: any }[] {
  return S.jobs.map((pj: any) => ({ pj, bj: b.jobs.find((x: any) => x.id === pj.id) })).filter((x: any) => x.bj);
}
