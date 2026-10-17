// The words the screens build from engine data match the prototype's, word for word.

import { describe, expect, it } from 'vitest';
import { seedRand } from '../src';
import { councilTitle, offerCatch, offerDetail, offerPay, offerTitle, subTenderTitle } from '../src/text/work';
import { snapshots } from './bot';
import { loadPrototype } from './prototype';

const P = loadPrototype();
const SNAPS = snapshots(P, 30, 511, seedRand);

describe('work words', () => {
  it('offers: title, detail, the catch and the pay', () => {
    let n = 0;
    for (const S of SNAPS) for (const o of S.offers || []) {
      expect(offerTitle(o)).toBe(o.title);
      expect(offerDetail(o)).toBe(o.detail);
      expect(offerCatch(o)).toBe(o.catch);
      expect(offerPay(o)).toBe(o.pay);
      n++;
    }
    expect(n).toBeGreaterThan(200);
  });

  it('tenders: subbie and council titles', () => {
    let n = 0;
    for (const S of SNAPS) {
      for (const t of S.tenders || []) { expect(subTenderTitle(t)).toBe(t.title); n++; }
      for (const t of S.ctenders || []) { expect(councilTitle(t)).toBe(t.title); n++; }
    }
    expect(n).toBeGreaterThan(20);
  });
});
