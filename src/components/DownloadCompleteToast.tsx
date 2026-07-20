import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDownloadStore } from '../store/downloadStore';

const AUTO_DISMISS_MS = 3000;

export function DownloadCompleteToast() {
  const toast = useDownloadStore((state) => state.toast);
  const dismissToast = useDownloadStore((state) => state.dismissToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(dismissToast, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) {
    return null;
  }

  return (
    <View style={[styles.overlay, { top: insets.top + 8 }]} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.text}>{toast}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    backgroundColor: 'rgba(20, 20, 20, 0.92)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    maxWidth: '90%',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});
