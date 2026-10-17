// Checks the site diary and the district news in the unit parity tests: the engine's copy of a state starts
// with an empty diary, both sides act, and what the engine wrote must read the same as the lines the prototype
// added, no more and no fewer.

import { diaryText } from '../src/text/diary';
import type { Proto } from './prototype';

export interface DiaryMark {
  log: unknown;
  news: unknown;
}

/** Before acting: empty the engine's diary and news, and remember where the prototype's began. */
export function diaryMark(P: Proto, b: any): DiaryMark {
  b.log = [];
  b.news = [];
  const S = P.getS();
  return { log: (S.log || [])[0], news: (S.news || [])[0] };
}

/** After acting: the engine's new lines match the prototype's. Returns the kinds written. */
export function diarySame(P: Proto, b: any, mark: DiaryMark): string[] {
  const S = P.getS(), kinds: string[] = [];
  for (const k of ['log', 'news'] as const) {
    const mine = (b[k] || []) as { w: number; e: { k: string } }[], theirs = (S[k] || []) as { w: number; t: string }[];
    const a = mine.map((x) => 'wk ' + x.w + ': ' + diaryText(b, x.e)), z = theirs.slice(0, mine.length).map((x) => 'wk ' + x.w + ': ' + x.t);
    if (a.join('\n') !== z.join('\n')) throw new Error(`${k} differs\n  engine: ${a.join(' // ')}\n  proto:  ${z.join(' // ')}`);
    // the prototype wrote nothing more: its next line is the one that was first before
    if ((theirs[mine.length] ?? undefined) !== mark[k]) throw new Error(`${k}: the prototype wrote more than the engine: ${theirs[mine.length]?.t}`);
    for (const x of mine) kinds.push(x.e.k);
  }
  return kinds;
}
