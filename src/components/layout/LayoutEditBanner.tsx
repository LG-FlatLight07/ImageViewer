import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayoutStore } from '../../store/layoutStore';

export function LayoutEditBanner() {
  const editMode = useLayoutStore((state) => state.editMode);
  const setEditMode = useLayoutStore((state) => state.setEditMode);
  const resetAll = useLayoutStore((state) => state.resetAll);
  const insets = useSafeAreaInsets();

  if (!editMode) {
    return null;
  }

  const confirmReset = () => {
    Alert.alert('レイアウトをリセットしますか?', undefined, [
      { text: 'いいえ', style: 'cancel' },
      { text: 'はい', style: 'destructive', onPress: resetAll },
    ]);
  };

  return (
    <View style={[styles.overlay, { top: insets.top + 6 }]} pointerEvents="box-none">
      <View style={styles.banner}>
        {/* pointerEvents=none so a drag started on top of the label reaches the UI underneath. */}
        <Text style={styles.text} pointerEvents="none">
          レイアウト編集中
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={confirmReset}>
            <Text style={styles.buttonText}>リセット</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.doneButton]}
            onPress={() => setEditMode(false)}
          >
            <Text style={[styles.buttonText, styles.doneButtonText]}>完了</Text>
          </TouchableOpacity>
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
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 8,
    maxWidth: '92%',
  },
  text: {
    color: '#fff',
    fontSize: 11,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  button: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginLeft: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#4c8bf5',
  },
  doneButtonText: {
    color: '#fff',
  },
});
