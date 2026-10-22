// New machinery from the dealer (the real game, Scott 22 Oct): order any machine new at list price, delivered in
// 4 to 10 weeks with a two-year warranty, on finance if the bank agrees, with an old machine traded in against it.
// It's how an outfit turns its fleet over, and developers' jobs want late-model gear (bulk.ts, devStd).

import type { Machine, MachineType } from './machines';
import { TYPES, value } from './machines';
import { MOODS, type Mood } from './market';

const round = (n: number, to: number) => Math.round(n / to) * to;

/** A machine on order: what, when it lands, what was paid, and on what terms. */
export interface Order {
  id: string;
  type: MachineType;
  /** The week it's delivered. */
  w: number;
  price: number;
  /** Borrowed against it (finance). */
  lent: number;
  /** Traded in: the machine's name and year, and what the dealer allowed. */
  trade?: { type: MachineType; year: number; credit: number };
}

/** Weeks from order to delivery; the warranty on a new machine. */
export const DELIVERY_MIN = 4, DELIVERY_MAX = 10;
export const NEW_WARRANTY_WEEKS = 104;
/** What a dealer allows on a trade-in, against its open-market value. */
export const TRADE_SHARE = 0.85;
/** The deposit on finance. */
export const NEW_DEPOSIT = 0.2;

/** A new machine's list price: the maker's price, moved by the market (dear in a boom, deals in a bust). */
export function newPrice(type: MachineType, mood: Mood): number {
  return round(TYPES[type].newV * MOODS[mood].pm, 1000);
}

/** What the dealer gives for a trade-in. */
export function tradeCredit(m: Pick<Machine, 'type' | 'year' | 'cond' | 'gps' | 'multi'> & { rt?: boolean; laser?: boolean }, week: number): number {
  return round(value(m, week) * TRADE_SHARE, 500);
}

/** Will the bank lend against a new machine? Ready to subcontract, nothing missed, within 80% of the price and your limit. */
export function canFinanceNew(price: number, credit: number, loan: { bal: number; missed: number }, cap: number, won: boolean): boolean {
  const lent = (price - credit) * (1 - NEW_DEPOSIT);
  return won && loan.missed === 0 && lent > 0 && loan.bal + lent <= cap + 0.65 * price;
}

/** What the dealer sells: the road gear and loader, and the bulk gear once you have the Bulk and Ag pack. */
export function dealerTypes(bulk: boolean): MachineType[] {
  const road: MachineType[] = ['grader', 'roller', 'cart', 'truck', 'loader'];
  const big: MachineType[] = ['d6', 'd8', 'd9', 'd10', 'excavator', 'moxy', 'moxycart', 'padfoot', 'c815', 'c825', 'pull', 's623', 's627', 's631', 's637', 's651', 's657'];
  return bulk ? road.concat(big) : road;
}
