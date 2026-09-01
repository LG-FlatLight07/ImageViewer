import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import { IMAGE_SCAN_SCRIPT, parseImageScanMessage } from '../services/imageExtraction';
import { detectImageGroups } from '../services/imageGrouping';

const SCAN_TIMEOUT_MS = 12000;

/**
 * Briefly loads one URL in an invisible WebView, reuses the exact same
 * first-image detection as the real download flow (IMAGE_SCAN_SCRIPT +
 * detectImageGroups), and reports back just that page's primary image URL —
 * never the image itself, and nothing is sent anywhere. Shared by
 * RankingThumbnailScanner (resolving one ranking entry's thumbnail) and
 * SequentialPageScanner (walking a numbered-URL page sequence).
 *
 * Renders nothing when `url` is null — the caller is responsible for only
 * ever passing one un-resolved URL at a time; scanning many pages
 * concurrently would be heavy on data/battery and easy to mistake for
 * something closer to site scraping than a single lookup.
 */
export function SinglePageImageScanner({
  scanKey,
  url,
  onResolved,
}: {
  /** Remounts the WebView for a new scan — pass something that changes with `url` (e.g. url itself). */
  scanKey: string;
  url: string | null;
  onResolved: (imageUrl: string | null) => void;
}) {
  const webViewRef = useRef<WebView>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    settledRef.current = false;
    if (!url) {
      return;
    }
    const timer = setTimeout(() => {
      if (!settledRef.current) {
        settledRef.current = true;
        onResolved(null);
      }
    }, SCAN_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // Intentionally keyed on scanKey (a proxy for url) rather than url itself
    // plus onResolved: including onResolved would re-arm this timer on every
    // render where the caller passes a fresh inline function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanKey]);

  if (!url) {
    return null;
  }

  const settle = (imageUrl: string | null) => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    onResolved(imageUrl);
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
        key={scanKey}
        ref={webViewRef}
        source={{ uri: url }}
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
