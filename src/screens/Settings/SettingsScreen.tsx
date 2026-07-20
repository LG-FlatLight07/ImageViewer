import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { DraggableLayoutArea } from '../../components/layout/DraggableLayoutArea';
import { ControlGroup } from '../../components/layout/ControlGroup';
import { useLayoutStore } from '../../store/layoutStore';
import { SEARCH_ENGINES, useSettingsStore, type ThemePreference } from '../../store/settingsStore';
import { useAppTheme } from '../../theme/theme';

const SCREEN_ID = 'settings';

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
  const folderNameExclusions = useSettingsStore((state) => state.folderNameExclusions);
  const addFolderNameExclusion = useSettingsStore((state) => state.addFolderNameExclusion);
  const removeFolderNameExclusion = useSettingsStore((state) => state.removeFolderNameExclusion);
  const [exclusionInput, setExclusionInput] = useState('');

  const commitExclusion = () => {
    if (exclusionInput.trim()) {
      addFolderNameExclusion(exclusionInput);
      setExclusionInput('');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <DraggableLayoutArea>
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
            フォルダ名の除外文字列
          </Text>
          <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
            画像を保存するフォルダ名をページタイトルから自動生成する際に、ここに登録した文字列を取り除きます。
          </Text>
          {folderNameExclusions.length > 0 && (
            <View style={styles.exclusionChipRow}>
              {folderNameExclusions.map((entry) => (
                <View
                  key={entry}
                  style={[styles.exclusionChip, { backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.exclusionChipText, { color: colors.text }]}>{entry}</Text>
                  <TouchableOpacity
                    onPress={() => removeFolderNameExclusion(entry)}
                    accessibilityLabel={`remove-exclusion-${entry}`}
                  >
                    <Ionicons name="close-circle" size={16} color={colors.secondaryText} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <View style={styles.exclusionInputRow}>
            <TextInput
              style={[styles.exclusionInput, { borderColor: colors.border, color: colors.text }]}
              value={exclusionInput}
              onChangeText={setExclusionInput}
              onSubmitEditing={commitExclusion}
              placeholder="除外する文字列を入力"
              placeholderTextColor={colors.secondaryText}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.exclusionAddButton, { backgroundColor: colors.primary }]}
              onPress={commitExclusion}
              accessibilityLabel="add-exclusion"
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.secondaryText, marginTop: 24 }]}>
            画面レイアウト
          </Text>
          <Text style={[styles.rowDescription, { color: colors.secondaryText }]}>
            各画面の操作ボタンをまとめてドラッグし、8方向のいずれかに配置できます。切り替えとリセットは右下のボタン群から行えます。
          </Text>
          <View style={styles.spacerForFloatingGroup} />
        </ScrollView>

        <ControlGroup screenId={SCREEN_ID}>
          <View style={styles.switchButton}>
            <Text style={[styles.switchButtonLabel, { color: colors.text }]}>編集モード</Text>
            <Switch
              value={editMode}
              onValueChange={setEditMode}
              accessibilityLabel="toggle-layout-edit-mode"
            />
          </View>
          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: colors.surface }]}
            onPress={resetAll}
            accessibilityLabel="reset-layout"
          >
            <Text style={styles.resetButtonText}>レイアウトをリセット</Text>
          </TouchableOpacity>
        </ControlGroup>
      </DraggableLayoutArea>
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
  rowDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  exclusionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  exclusionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  exclusionChipText: {
    fontSize: 12,
  },
  exclusionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  exclusionInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  exclusionAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacerForFloatingGroup: {
    height: 80,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    gap: 6,
  },
  switchButtonLabel: {
    fontSize: 13,
  },
  resetButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f1f1f1',
  },
  resetButtonText: {
    color: '#c0392b',
    fontWeight: '600',
    fontSize: 12,
  },
});
