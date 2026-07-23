/**
 * Web build of purchaseService — expo-iap has no web support at all, so this
 * file must never import it. Metro picks this file over purchaseService.ts
 * automatically for web builds based on the `.web.ts` filename.
 */
export const PREMIUM_PRODUCT_ID =
  process.env.EXPO_PUBLIC_PREMIUM_PRODUCT_ID ?? 'com.lgflatlight07.imageviewer.premium';

export async function requestPremiumPurchase(): Promise<void> {
  throw new Error('課金機能はWeb版では利用できません');
}

export async function restorePremiumPurchases(): Promise<void> {
  throw new Error('課金機能はWeb版では利用できません');
}

export function usePurchaseSync(): void {
  // No native billing module on web — nothing to connect.
}
