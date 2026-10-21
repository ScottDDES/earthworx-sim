// Rewarded ads (the real game on phones). The app sets adsOn when it has an ad ready to show; it shows the ad
// first and only then makes the move. Never in a season, so leaderboard scores replay the same for everyone.
// Three rewards: a free mechanic on a breakdown, a weekly cash top-up, and a late invoice paid now.

import { compat } from './compat';
import { book, type Accounts } from './ledger';
import type { Machine } from './machines';
import type { Receivable } from './hire';

/** The weekly top-up. */
export const AD_TOPUP = 3000;

interface AdState {
  week: number;
  bank: number;
  acc: Accounts;
  season?: unknown;
  /** The app can show a rewarded ad right now. */
  adsOn?: boolean;
  /** The week the top-up was last taken. */
  adWk?: number;
}

/** Ad rewards are on offer: the real game, not a season, and the app has an ad to show. */
export const adOK = (c: Pick<AdState, 'season' | 'adsOn'>) => !compat.prototype && !c.season && !!c.adsOn;

/** The weekly top-up is there to take. */
export const adTopUpReady = (c: AdState) => adOK(c) && c.adWk !== c.week;

export function adTopUp(c: AdState): boolean {
  if (!adTopUpReady(c)) return false;
  c.bank += AD_TOPUP;
  book(c.acc, 'collections', AD_TOPUP);
  c.adWk = c.week;
  return true;
}

/** A breakdown: the mobile mechanic comes out and fixes it on the spot, on us. */
export function adFix(m: Machine): void {
  m.down = 0;
}

/** A late payer: the money lands now. */
export function adPay(b: { bank: number; acc: Accounts; recv: Receivable[] }, x: Receivable): void {
  b.bank += x.amt;
  book(b.acc, 'collections', x.amt);
  b.recv = b.recv.filter((y) => y.id !== x.id);
}
