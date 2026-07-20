import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDownloadStore } from '../store/downloadStore';
import { useAppTheme } from '../theme/theme';

export function DownloadProgressBar() {
  const active = useDownloadStore((state) => state.active);
  const completed = useDownloadStore((state) => state.completed);
  const total = useDownloadStore((state) => state.total);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  if (!active) {
    return null;
  }

  const fraction = total > 0 ? Math.min(completed / total, 1) : 0;

  return (
    <View style={[styles.overlay, { paddingBottom: insets.bottom + 8 }]} pointerEvents="none">
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.text }]}>
          画像を保存中... {completed} / {total}
        </Text>
        <View style={[styles.track, { backgroundColor: colors.surface }]}>
          <View
            style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: colors.primary }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  label: {
    fontSize: 12,
    marginBottom: 6,
  },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
