import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type URLBarProps = {
  value: string;
  loading: boolean;
  bookmarked: boolean;
  onChangeValue: (value: string) => void;
  onSubmit: () => void;
  onReload: () => void;
  onToggleBookmark: () => void;
  onOpenBookmarks: () => void;
  onOpenHistory: () => void;
};

export function URLBar({
  value,
  loading,
  bookmarked,
  onChangeValue,
  onSubmit,
  onReload,
  onToggleBookmark,
  onOpenBookmarks,
  onOpenHistory,
}: URLBarProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onToggleBookmark}
        accessibilityLabel="toggle-bookmark"
      >
        <Ionicons name={bookmarked ? 'star' : 'star-outline'} size={20} color="#f6c453" />
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeValue}
        onSubmitEditing={onSubmit}
        placeholder="URLまたは検索ワードを入力"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        selectTextOnFocus
      />
      <TouchableOpacity style={styles.iconButton} onPress={onReload} accessibilityLabel="reload">
        <Ionicons name={loading ? 'close' : 'refresh'} size={20} color="#333" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onOpenBookmarks}
        accessibilityLabel="open-bookmarks"
      >
        <Ionicons name="list-outline" size={20} color="#333" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onOpenHistory}
        accessibilityLabel="open-history"
      >
        <Ionicons name="time-outline" size={20} color="#333" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f1f1f1',
  },
  input: {
    flex: 1,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  iconButton: {
    marginLeft: 6,
    padding: 6,
  },
});
