// Words for the market: where an auction lot came from, its guide, how the hammer fell, and why finance
// isn't on offer. The prototype's wording.

import type { AuctionLot, HammerResult, LotSource } from '../market';

const f = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-AU');
const fk = (n: number) => (n >= 1e6 ? '$' + Math.round(n / 1e4) / 100 + 'M' : n >= 1000 ? '$' + Math.round(n / 1000) + 'k' : f(n));

export function lotFrom(s: LotSource): string {
  if (s.k === 'clearance') return s.name + ' clearance sale';
  return { council: 'Ex-council clearance', dispersal: 'Contractor dispersal', repo: 'Finance repossession' }[s.k];
}

export function lotGuide(l: Pick<AuctionLot, 'guideLo' | 'guideHi'>): string {
  return fk(l.guideLo) + '–' + fk(l.guideHi);
}

export function hammerText(r: HammerResult): string {
  if (r.k === 'lost') return 'Sold to another bidder for ' + f(r.price) + '.';
  if (r.k === 'cantSettle') return 'You couldn\'t settle ' + f(r.total) + '. The lot went to the underbidder and the auction house fined you ' + f(r.fine) + '.';
  return 'Yours for ' + f(r.price) + ' plus fee: ' + f(r.total) + '.';
}
