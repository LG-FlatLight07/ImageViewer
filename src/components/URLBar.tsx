import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../theme/theme';

type URLBarProps = {
  value: string;
  loading: boolean;
  bookmarked: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onChangeValue: (value: string) => void;
  onSubmit: () => void;
  onReload: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onSaveImages: () => void;
  onToggleBookmark: () => void;
  onOpenBookmarks: () => void;
  onOpenHistory: () => void;
  /** Only offered when the current page's URL looks like one of a numbered sequence (see pageSequence.ts) — omitted otherwise. */
  onSequentialSave?: () => void;
};

export function URLBar({
  value,
  loading,
  bookmarked,
  canGoBack,
  canGoForward,
  onChangeValue,
  onSubmit,
  onReload,
  onGoBack,
  onGoForward,
  onSaveImages,
  onToggleBookmark,
  onOpenBookmarks,
  onOpenHistory,
  onSequentialSave,
}: URLBarProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <TouchableOpacity
        style={styles.iconButton}
        disabled={!canGoBack}
        onPress={onGoBack}
        accessibilityLabel="go-back"
        hitSlop={4}
      >
        <Ionicons name="arrow-back" size={18} color={canGoBack ? colors.text : colors.border} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconButton}
        disabled={!canGoForward}
        onPress={onGoForward}
        accessibilityLabel="go-forward"
        hitSlop={4}
      >
        <Ionicons
          name="arrow-forward"
          size={18}
          color={canGoForward ? colors.text : colors.border}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onToggleBookmark}
        accessibilityLabel="toggle-bookmark"
        hitSlop={4}
      >
        <Ionicons name={bookmarked ? 'star' : 'star-outline'} size={18} color="#f6c453" />
      </TouchableOpacity>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
        value={value}
        onChangeText={onChangeValue}
        onSubmitEditing={onSubmit}
        placeholder="URLまたは検索ワードを入力"
        placeholderTextColor={colors.secondaryText}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        selectTextOnFocus
      />
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onReload}
        accessibilityLabel="reload"
        hitSlop={4}
      >
        <Ionicons name={loading ? 'close' : 'refresh'} size={18} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onSaveImages}
        accessibilityLabel="save-images"
        hitSlop={4}
      >
        <Ionicons name="download-outline" size={18} color={colors.text} />
      </TouchableOpacity>
      {onSequentialSave && (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onSequentialSave}
          accessibilityLabel="save-sequential-images"
          hitSlop={4}
        >
          <Ionicons name="layers-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onOpenBookmarks}
        accessibilityLabel="open-bookmarks"
        hitSlop={4}
      >
        <Ionicons name="list-outline" size={18} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onOpenHistory}
        accessibilityLabel="open-history"
        hitSlop={4}
      >
        <Ionicons name="time-outline" size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 24,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  input: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    fontSize: 14,
  },
  iconButton: {
    padding: 4,
  },
});
