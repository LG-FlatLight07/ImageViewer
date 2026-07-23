/**
 * Web build of rewardedAdService — react-native-google-mobile-ads has no web
 * support at all (its own dependency chain imports React Native internals
 * that don't exist on react-native-web), so this file must never import it.
 * Metro picks this file over rewardedAdService.ts automatically for web
 * builds based on the `.web.ts` filename.
 */
export const REWARDED_AD_UNIT_ID = 'unsupported-on-web';

export function useRewardedDownloadAd(): { isLoaded: boolean; showAd: () => Promise<boolean> } {
  return { isLoaded: false, showAd: async () => false };
}
