// What the player has bought: the Bulk and Ag pack, and no ads. Bought through the App Store (or Google Play)
// with @capgo/native-purchases; what's owned is kept on the phone and checked with the store each time the app
// opens, so it works offline and comes back after a reinstall (Restore purchases).
// Beta builds (TestFlight, the web version) get the pack free. The web version sells nothing.

import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases';
import { BETA } from './channel';

/** The store's product IDs. Create these in App Store Connect as non-consumable in-app purchases. */
export const PRODUCTS = { bulk: 'biz.ddes.earthmoving.bulkag', noads: 'biz.ddes.earthmoving.noads' } as const;
export type ProductKey = keyof typeof PRODUCTS;

const KEY = 'ewx-owned';
const NATIVE = Capacitor.isNativePlatform();

interface ShopState {
  owned: Record<ProductKey, boolean>;
  /** Store prices in the player's currency, once the store has answered. */
  price: Partial<Record<ProductKey, string>>;
  /** A purchase or restore is under way. */
  busy: boolean;
  /** What went wrong last, in words for the player. */
  err: string;
}

function readOwned(): Record<ProductKey, boolean> {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { bulk: !!o.bulk, noads: !!o.noads };
  } catch {
    return { bulk: false, noads: false };
  }
}

let state: ShopState = { owned: readOwned(), price: {}, busy: false, err: '' };
const subs = new Set<() => void>();
function set(p: Partial<ShopState>): void {
  state = { ...state, ...p };
  if (p.owned) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state.owned));
    } catch {
      // kept for this session only
    }
  }
  subs.forEach((f) => f());
}

/** The pack is playable: bought, or a beta build. */
export const hasBulk = () => BETA || state.owned.bulk;
/** Banners are off: bought "no ads". */
export const noAds = () => state.owned.noads;
/** This build can sell things (a phone, store build). */
export const canBuy = () => NATIVE && !BETA;

const valid = (t: Transaction) => (Capacitor.getPlatform() === 'android' ? t.purchaseState === '1' || t.purchaseState === undefined : true);

/** Ask the store what's owned and what things cost. Quiet if the store can't be reached. */
export async function refreshShop(): Promise<void> {
  if (!NATIVE) return;
  try {
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP, onlyCurrentEntitlements: true });
    const ids = new Set(purchases.filter(valid).map((t) => t.productIdentifier));
    set({ owned: { bulk: ids.has(PRODUCTS.bulk), noads: ids.has(PRODUCTS.noads) } });
  } catch {
    // offline or the store's busy: keep what we knew
  }
  if (!canBuy()) return;
  try {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: Object.values(PRODUCTS), productType: PURCHASE_TYPE.INAPP });
    const price: Partial<Record<ProductKey, string>> = {};
    for (const k of Object.keys(PRODUCTS) as ProductKey[]) {
      const p = products.find((x) => x.identifier === PRODUCTS[k]);
      if (p) price[k] = p.priceString;
    }
    set({ price });
  } catch {
    // prices show once the store answers
  }
}

const cancelled = (e: unknown) => /cancel/i.test(String((e as { message?: string })?.message ?? e));

/** Buy one. True once it's owned. */
export async function buy(k: ProductKey): Promise<boolean> {
  if (!canBuy() || state.busy) return false;
  set({ busy: true, err: '' });
  try {
    const t = await NativePurchases.purchaseProduct({ productIdentifier: PRODUCTS[k], productType: PURCHASE_TYPE.INAPP });
    if (t.productIdentifier === PRODUCTS[k]) set({ owned: { ...state.owned, [k]: true } });
    return state.owned[k];
  } catch (e) {
    set({ err: cancelled(e) ? '' : 'The store couldn\'t finish that. Nothing was charged. Try again in a minute.' });
    return false;
  } finally {
    set({ busy: false });
  }
}

/** Bring back purchases on a new phone or after a reinstall. */
export async function restore(): Promise<void> {
  if (!NATIVE || state.busy) return;
  set({ busy: true, err: '' });
  try {
    await NativePurchases.restorePurchases();
    await refreshShop();
    if (!state.owned.bulk && !state.owned.noads) set({ err: 'Nothing to restore on this Apple ID.' });
  } catch {
    set({ err: 'Couldn\'t reach the store. Check your connection and try again.' });
  } finally {
    set({ busy: false });
  }
}

/** The shop, for screens: redraws when anything changes. */
export function useShop(): ShopState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}

/** Listen for changes outside React (the ads module). */
export function onShop(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}
