import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import { WebView } from 'react-native-webview';
import { enhancedImageHtml } from '../services/enhancedImageHtml';

/** Mounted only for the active low-resolution page; the original stays underneath. */
export function EnhancedGalleryImage({ uri }: { uri: string }) {
  const [document, setDocument] = useState<{ uri: string; html: string }>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const file = new File(uri);
        if (!file.exists || file.size > 8 * 1024 * 1024) return;
        const base64 = await file.base64();
        const mime = file.type || (/\.png$/i.test(uri) ? 'image/png' : 'image/jpeg');
        const html = enhancedImageHtml(base64, mime);
        if (!cancelled) setDocument({ uri, html });
      } catch {
        // A failed enhancement keeps the original native image visible.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [uri]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      {document?.uri === uri && !failed && (
        <WebView
          source={{ html: document.html }}
          style={styles.web}
          originWhitelist={['about:blank']}
          onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
          javaScriptEnabled={false}
          domStorageEnabled={false}
          allowFileAccess={false}
          scrollEnabled={false}
          onError={() => setFailed(true)}
          onRenderProcessGone={() => setFailed(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ web: { flex: 1, backgroundColor: '#000' } });
