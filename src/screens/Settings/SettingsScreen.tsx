import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLayoutStore } from '../../store/layoutStore';
import { SEARCH_ENGINES, useSettingsStore, type ThemePreference } from '../../store/settingsStore';
import { useAppTheme } from '../../theme/theme';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'システムに従う' },
  { key: 'light', label: 'ライト' },
  { key: 'dark', label: 'ダーク' },
];

export function SettingsScreen() {
  const { colors } = useAppTheme();
  const editMode = useLayoutStore((state) => state.editMode);
  const setEditMode = useLayoutStore((state) => state.setEditMode);
  const resetAll = useLayoutStore((state) => state.resetAll);
  const searchEngine = useSettingsStore((state) => state.searchEngine);
  const setSearchEngine = useSettingsStore((state) => state.setSearchEngine);
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>検索エンジン</Text>
        <View style={styles.optionRow}>
          {SEARCH_ENGINES.map((engine) => (
            <TouchableOpacity
              key={engine.key}
              style={[
                styles.optionButton,
                { backgroundColor: colors.surface },
                searchEngine === engine.key && { backgroundColor: colors.primary },
              ]}
              onPress={() => setSearchEngine(engine.key)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  { color: colors.secondaryText },
                  searchEngine === engine.key && styles.optionButtonTextActive,
                ]}
              >
                {engine.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          テーマ
        </Text>
        <View style={styles.optionRow}>
          {THEME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.optionButton,
                { backgroundColor: colors.surface },
                themePreference === option.key && { backgroundColor: colors.primary },
              ]}
              onPress={() => setThemePreference(option.key)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  { color: colors.secondaryText },
                  themePreference === option.key && styles.optionButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
          画面レイアウト
        </Text>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>レイアウト編集モード</Text>
            <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
              各画面のボタンやバーをドラッグして好きな位置に配置できます
            </Text>
          </View>
          <Switch value={editMode} onValueChange={setEditMode} />
        </View>
        <TouchableOpacity
          style={[styles.resetButton, { backgroundColor: colors.surface }]}
          onPress={resetAll}
        >
          <Text style={styles.resetButtonText}>レイアウトをリセット</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  optionButtonText: {
    fontSize: 13,
  },
  optionButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    marginTop: 2,
  },
  resetButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#c0392b',
    fontWeight: '600',
  },
});
