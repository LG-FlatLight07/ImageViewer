import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLayoutStore } from '../../store/layoutStore';

export function SettingsScreen() {
  const editMode = useLayoutStore((state) => state.editMode);
  const setEditMode = useLayoutStore((state) => state.setEditMode);
  const resetAll = useLayoutStore((state) => state.resetAll);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.sectionTitle}>画面レイアウト</Text>
      <View style={styles.row}>
        <View style={styles.rowTextGroup}>
          <Text style={styles.rowLabel}>レイアウト編集モード</Text>
          <Text style={styles.rowDescription}>
            各画面のボタンやバーをドラッグして好きな位置に配置できます
          </Text>
        </View>
        <Switch value={editMode} onValueChange={setEditMode} />
      </View>
      <TouchableOpacity style={styles.resetButton} onPress={resetAll}>
        <Text style={styles.resetButtonText}>レイアウトをリセット</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  resetButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f1f1f1',
  },
  resetButtonText: {
    color: '#c0392b',
    fontWeight: '600',
  },
});
