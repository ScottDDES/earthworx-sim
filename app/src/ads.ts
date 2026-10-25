// Google AdMob on phones: a rewarded ad the player chooses to watch (a free mechanic, a late invoice paid,
// a weekly top-up) and a banner on the Market and Office tabs, gone once they buy "no ads".
// Order on first open: Google's consent form where the law asks for one, then Apple's tracking question, then ads.
// Beta builds always use Google's test ads. A store build with no real ad IDs yet shows no ads at all.

import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, BannerAdPluginEvents, BannerAdPosition, BannerAdSize, RewardAdPluginEvents } from '@capacitor-community/admob';
import { BETA } from './channel';
import { noAds, onShop } from './shop';

const IOS = Capacitor.getPlatform() === 'ios';
const NATIVE = Capacitor.isNativePlatform();

// Google's demo units: always serve test ads, safe to tap.
const TEST = IOS
  ? { reward: 'ca-app-pub-3940256099942544/1712485313', banner: 'ca-app-pub-3940256099942544/2934735716' }
  : { reward: 'ca-app-pub-3940256099942544/5224354917', banner: 'ca-app-pub-3940256099942544/6300978111' };
// The real units from the AdMob account (not secret: they ship inside the app). Empty until they're made.
const LIVE = IOS ? { reward: '', banner: '' } : { reward: '', banner: '' };
const IDS = BETA ? TEST : LIVE;
const ON = NATIVE && !!IDS.reward;

interface AdState {
  /** A rewarded ad is loaded and ready to show. */
  ready: boolean;
  /** One is playing. */
  showing: boolean;
}
let state: AdState = { ready: false, showing: false };
const subs = new Set<() => void>();
const set = (p: Partial<AdState>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};

let started = false;
let canAsk = false;

/** Once, when the app opens. */
export async function startAds(): Promise<void> {
  if (!ON || started) return;
  started = true;
  try {
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) info = await AdMob.showConsentForm();
    if (!info.canRequestAds) return;
    if (IOS) {
      const t = await AdMob.trackingAuthorizationStatus();
      if (t.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
    }
    await AdMob.initialize();
    canAsk = true;
    await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (s) => onBannerSize(s.height));
    onShop(() => { if (noAds()) hideBanner(); });
    loadReward();
  } catch {
    // no ads this session; the game plays the same without them
  }
}

let loading = false;
async function loadReward(): Promise<void> {
  if (!canAsk || loading || state.ready) return;
  loading = true;
  try {
    await AdMob.prepareRewardVideoAd({ adId: IDS.reward, isTesting: BETA });
    set({ ready: true });
  } catch {
    // try again in a minute (no fill, or offline)
    setTimeout(loadReward, 60000);
  } finally {
    loading = false;
  }
}

/**
 * Show the rewarded ad. True only if the player earned the reward. Closing it early answers false: the plugin
 * never answers then, so the ad closing (or failing to show) settles it.
 */
export async function watchReward(): Promise<boolean> {
  if (!state.ready || state.showing) return false;
  set({ ready: false, showing: true });
  const hs: { remove: () => Promise<void> }[] = [];
  try {
    return await new Promise<boolean>((res) => {
      let done = false;
      const fin = (v: boolean) => { if (!done) { done = true; res(v); } };
      Promise.all([
        AdMob.addListener(RewardAdPluginEvents.Dismissed, () => fin(false)),
        AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => fin(false)),
      ]).then((h) => {
        hs.push(...h);
        AdMob.showRewardVideoAd().then((r) => fin(!!r && (r.amount ?? 1) > 0), () => fin(false));
      }, () => fin(false));
    });
  } finally {
    for (const h of hs) void h.remove();
    set({ showing: false });
    loadReward();
  }
}

// ---------- the banner ----------

let bannerUp = false;
/** What the screens last asked for; the banner catches up to it one call at a time. */
let want = false, busy = false;
/**
 * Lift the dock above the banner by its real height. Whatever the game wanted, if the banner is on screen the dock
 * sits above it, so it can never cover the tabs.
 */
function setInset(h: number): void {
  const root = document.documentElement, on = h > 0;
  root.style.setProperty('--ad-h', (on ? h : 0) + 'px');
  root.classList.toggle('ad-on', on);
}
/** The banner turned up (or changed size). If it isn't wanted any more (it finished loading after a hide), take it down. */
function onBannerSize(h: number): void {
  setInset(h);
  if (h > 0 && !want) void takeDown();
}
async function takeDown(): Promise<void> {
  try {
    await AdMob.removeBanner();
  } catch {
    // nothing up
  }
  bannerUp = false;
  if (!want) setInset(0);
}

/**
 * Show or hide the banner: the screens say when (menu tabs, no card open). The plugin's calls are slow and the ad
 * loads after the show call returns, so the calls run one at a time until the banner matches the last ask, and a
 * banner that arrives after it was no longer wanted is taken down as it appears (onBannerSize).
 */
export async function showBanner(on: boolean): Promise<void> {
  if (!canAsk || !IDS.banner) return;
  want = on && !noAds();
  if (busy) return;
  busy = true;
  try {
    while (bannerUp !== want) {
      const go = want;
      try {
        if (go) {
          await AdMob.showBanner({ adId: IDS.banner, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER, margin: 0, isTesting: BETA });
          bannerUp = true;
        } else await takeDown();
      } catch {
        bannerUp = false;
        if (go) break;
      }
    }
  } finally {
    busy = false;
  }
}
function hideBanner(): void {
  void showBanner(false);
}

/** Change the ad choices Google showed on first open (a button in the Career tab where the law asks for one). */
export async function adPrivacyOptions(): Promise<void> {
  try {
    await AdMob.showPrivacyOptionsForm();
  } catch {
    // not needed where the player lives
  }
}

/** Ads can be shown in this build. */
export const adsAvailable = () => ON;

/** For screens: whether a rewarded ad is ready. */
export function useAds(): AdState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}
