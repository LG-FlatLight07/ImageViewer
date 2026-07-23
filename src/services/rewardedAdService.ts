import { useCallback, useEffect, useRef } from 'react';
import { TestIds, useRewardedAd } from 'react-native-google-mobile-ads';

/**
 * Falls back to Google's official sample ad unit (always serves a working
 * test ad, never real inventory) until a real AdMob account/ad unit exists —
 * see README's "Android(Google Play)への公開手順" for where to get a real one.
 */
export const REWARDED_AD_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID ?? TestIds.REWARDED;

type RewardedAdHandle = { isLoaded: boolean; showAd: () => Promise<boolean> };

/**
 * Thin wrapper around react-native-google-mobile-ads' rewarded-ad hook: loads
 * an ad on mount (and again after each close, so one is always ready), and
 * exposes a single `showAd` that resolves `true` only once the user actually
 * earns the reward (closing early / an error both resolve `false`).
 *
 * Native-only — see rewardedAdService.web.ts for the web build, which Metro
 * picks automatically via the platform-specific filename so this file's
 * react-native-google-mobile-ads import (no web support at all, not even a
 * no-op) is never bundled for web.
 */
export function useRewardedDownloadAd(): RewardedAdHandle {
  const { isLoaded, isClosed, isEarnedReward, load, show } = useRewardedAd(REWARDED_AD_UNIT_ID);
  const pendingResolveRef = useRef<((earned: boolean) => void) | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isClosed || !pendingResolveRef.current) {
      return;
    }
    const resolve = pendingResolveRef.current;
    pendingResolveRef.current = null;
    resolve(isEarnedReward ?? false);
    load();
  }, [isClosed, isEarnedReward, load]);

  const showAd = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      if (!isLoaded) {
        resolve(false);
        return;
      }
      pendingResolveRef.current = resolve;
      show();
    });
  }, [isLoaded, show]);

  return { isLoaded, showAd };
}
