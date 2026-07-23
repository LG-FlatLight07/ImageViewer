import { useEffect } from 'react';
import { useIAP } from 'expo-iap';

import { useMonetizationStore } from '../store/monetizationStore';

/** Replace with the real product ID once it's created in Play Console (see README). */
export const PREMIUM_PRODUCT_ID =
  process.env.EXPO_PUBLIC_PREMIUM_PRODUCT_ID ?? 'com.lgflatlight07.imageviewer.premium';

type PurchaseBridge = {
  requestPurchase: () => Promise<unknown>;
  restorePurchases: () => Promise<unknown>;
};

// expo-iap only exposes its API through the useIAP() hook, but the "購入する"
// button lives in SettingsScreen while the connection needs to be mounted
// exactly once near the app root (see usePurchaseSync below) — this module
// -level bridge lets SettingsScreen call into that single connection without
// mounting a second, duplicate useIAP() listener.
let bridge: PurchaseBridge | null = null;

export async function requestPremiumPurchase(): Promise<void> {
  if (!bridge) {
    throw new Error('課金機能が利用できません');
  }
  await bridge.requestPurchase();
}

export async function restorePremiumPurchases(): Promise<void> {
  if (!bridge) {
    throw new Error('課金機能が利用できません');
  }
  await bridge.restorePurchases();
}

/**
 * Mounted once near the app root (see PurchaseSync.tsx). Bridges expo-iap's
 * hook-only API to the plain functions above, and applies purchase/restore
 * results to the monetization store so download/tag/ranking gating reacts
 * immediately without every screen needing its own useIAP() connection.
 *
 * Native-only — see purchaseService.web.ts for the web build, which Metro
 * picks automatically via the platform-specific filename so this file's
 * expo-iap import (no web support at all) is never bundled for web.
 */
export function usePurchaseSync(): void {
  const setPurchasedPremium = useMonetizationStore((state) => state.setPurchasedPremium);

  const { connected, availablePurchases, requestPurchase, getAvailablePurchases } = useIAP({
    onPurchaseSuccess: (purchase) => {
      if (purchase.productId === PREMIUM_PRODUCT_ID) {
        setPurchasedPremium(true);
      }
    },
    onPurchaseError: (error) => {
      console.warn('[purchaseService] purchase failed', error);
    },
  });

  useEffect(() => {
    if (!connected) {
      return;
    }
    getAvailablePurchases().catch((err) => {
      console.warn('[purchaseService] failed to check existing purchases', err);
    });
  }, [connected, getAvailablePurchases]);

  useEffect(() => {
    if (availablePurchases.some((purchase) => purchase.productId === PREMIUM_PRODUCT_ID)) {
      setPurchasedPremium(true);
    }
  }, [availablePurchases, setPurchasedPremium]);

  useEffect(() => {
    bridge = {
      requestPurchase: () =>
        requestPurchase({
          request: { google: { skus: [PREMIUM_PRODUCT_ID] } },
          type: 'in-app',
        }),
      restorePurchases: () => getAvailablePurchases(),
    };
    return () => {
      bridge = null;
    };
  }, [requestPurchase, getAvailablePurchases]);
}
