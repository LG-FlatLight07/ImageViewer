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
    <View style={[styles.overlay, { top: insets.top + 8 }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.text}>
          レイアウト編集中: ドラッグで端にドッキング、右上の切替ボタンで並び方を変更できます
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
    backgroundColor: 'rgba(20, 20, 20, 0.92)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    maxWidth: '92%',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 6,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
  },
  button: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#4c8bf5',
  },
  doneButtonText: {
    color: '#fff',
  },
});
