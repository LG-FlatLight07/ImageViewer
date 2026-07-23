import { usePurchaseSync } from '../services/purchaseService';

/**
 * Mounted once near the app root (see App.tsx). On web this resolves to
 * purchaseService.web.ts's no-op usePurchaseSync via Metro's platform-file
 * resolution, so it's safe to render unconditionally on every platform.
 */
export function PurchaseSync() {
  usePurchaseSync();
  return null;
}
