import mobileAds from 'react-native-google-mobile-ads';

/**
 * Native-only — see adsInit.web.ts for the web build, which Metro picks
 * automatically via the platform-specific filename so this file's
 * react-native-google-mobile-ads import (no web support at all) is never
 * bundled for web.
 */
export async function initializeAds(): Promise<void> {
  await mobileAds().initialize();
}
