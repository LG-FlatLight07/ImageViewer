import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Free-tier download attempts allowed per calendar day before a rewarded ad or purchase is required. */
export const FREE_DAILY_DOWNLOADS = 3;
/** Total distinct tags (across the whole app, not per folder) allowed before purchasing. */
export const FREE_TAG_LIMIT = 5;
/** Ranking rows shown in full (thumbnail + title, tappable) before purchasing. */
export const FREE_RANKING_VISIBLE = 3;
/** Ranking rows shown at all (blurred beyond FREE_RANKING_VISIBLE) once purchased. */
export const PREMIUM_RANKING_VISIBLE = 50;

/** Local calendar date (not UTC) — the daily reset should follow the device's own day boundary. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type MonetizationState = {
  /** Non-consumable "unlock everything" purchase. */
  purchasedPremium: boolean;
  /** Calendar date (todayKey()) the download counter below applies to; stale once the date rolls over. */
  dailyDownloadDate: string | null;
  dailyDownloadUsed: number;
  /** Calendar date the user last watched a rewarded ad to unlock unlimited downloads for that day. */
  rewardedAdDate: string | null;
  setPurchasedPremium: (value: boolean) => void;
  grantRewardedAdToday: () => void;
  consumeDownloadUse: () => void;
};

export const useMonetizationStore = create<MonetizationState>()(
  persist(
    (set) => ({
      purchasedPremium: false,
      dailyDownloadDate: null,
      dailyDownloadUsed: 0,
      rewardedAdDate: null,
      setPurchasedPremium: (purchasedPremium) => set({ purchasedPremium }),
      grantRewardedAdToday: () => set({ rewardedAdDate: todayKey() }),
      consumeDownloadUse: () =>
        set((state) => {
          const today = todayKey();
          if (state.dailyDownloadDate !== today) {
            return { dailyDownloadDate: today, dailyDownloadUsed: 1 };
          }
          return { dailyDownloadUsed: state.dailyDownloadUsed + 1 };
        }),
    }),
    {
      name: 'monetization-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

type Entitlement = Pick<
  MonetizationState,
  'purchasedPremium' | 'rewardedAdDate' | 'dailyDownloadDate' | 'dailyDownloadUsed'
>;

/** A purchase or today's rewarded ad both remove the daily download cap entirely. */
export function hasUnlimitedDownloadsToday(state: Entitlement): boolean {
  return state.purchasedPremium || state.rewardedAdDate === todayKey();
}

export function getUsedDownloadsToday(state: Entitlement): number {
  return state.dailyDownloadDate === todayKey() ? state.dailyDownloadUsed : 0;
}

export function getRemainingFreeDownloads(state: Entitlement): number {
  return Math.max(FREE_DAILY_DOWNLOADS - getUsedDownloadsToday(state), 0);
}

export function canStartDownload(state: Entitlement): boolean {
  return hasUnlimitedDownloadsToday(state) || getUsedDownloadsToday(state) < FREE_DAILY_DOWNLOADS;
}

export function canCreateNewTag(purchasedPremium: boolean, existingTagCount: number): boolean {
  return purchasedPremium || existingTagCount < FREE_TAG_LIMIT;
}

export function rankingVisibleCount(purchasedPremium: boolean): number {
  return purchasedPremium ? PREMIUM_RANKING_VISIBLE : FREE_RANKING_VISIBLE;
}
