import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import { IMAGE_SCAN_SCRIPT, parseImageScanMessage } from '../services/imageExtraction';
import { detectImageGroups } from '../services/imageGrouping';

const SCAN_TIMEOUT_MS = 12000;

export type ThumbnailScanItem = {
  urlKey: string;
  sourceUrl: string;
};

/**
 * Resolves a ranking entry's thumbnail without ever sending an image to a
 * server: it briefly loads the entry's page in an invisible WebView, reuses
 * the exact same first-image detection as the real download flow
 * (IMAGE_SCAN_SCRIPT + detectImageGroups), and reports back just the image's
 * URL. The caller is responsible for caching the result and for only ever
 * passing one un-cached `item` at a time (see RankingScreen.tsx) — scanning
 * many pages at once would be slow and heavy on data/battery.
 */
export function RankingThumbnailScanner({
  item,
  onResolved,
}: {
  item: ThumbnailScanItem | null;
  onResolved: (urlKey: string, imageUrl: string | null) => void;
}) {
  const webViewRef = useRef<WebView>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    settledRef.current = false;
    if (!item) {
      return;
    }
    const timer = setTimeout(() => {
      if (!settledRef.current) {
        settledRef.current = true;
        onResolved(item.urlKey, null);
      }
    }, SCAN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [item, onResolved]);

  if (!item) {
    return null;
  }

  const settle = (imageUrl: string | null) => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    onResolved(item.urlKey, imageUrl);
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    const result = parseImageScanMessage(event.nativeEvent.data);
    if (!result) {
      return;
    }
    const { primaryGroup, otherImages } = detectImageGroups(result.images);
    settle(primaryGroup?.images[0]?.src ?? otherImages[0]?.src ?? null);
  };

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        key={item.urlKey}
        ref={webViewRef}
        source={{ uri: item.sourceUrl }}
        onLoadEnd={() => webViewRef.current?.injectJavaScript(IMAGE_SCAN_SCRIPT)}
        onMessage={handleMessage}
        onError={() => settle(null)}
        onHttpError={() => settle(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
