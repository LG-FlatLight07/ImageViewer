/**
 * Web build of adsInit — react-native-google-mobile-ads has no web support
 * at all, so this file must never import it.
 */
export async function initializeAds(): Promise<void> {
  // No native ads module on web — nothing to initialize.
}
