import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import type { GalleryStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import type { FolderSortKey, FolderWithTags } from '../../db/types';
import { createFolder, listFolders, setFolderTags } from '../../db/foldersRepository';
import { FolderRow } from '../../components/FolderRow';
import { ActionMenuModal } from '../../components/ActionMenuModal';
import { PromptModal } from '../../components/PromptModal';
import { TagEditorModal } from '../../components/TagEditorModal';
import { DraggableLayoutArea } from '../../components/layout/DraggableLayoutArea';
import { ControlGroup } from '../../components/layout/ControlGroup';
import { useAppTheme } from '../../theme/theme';

const SCREEN_ID = 'gallery.folderList';

const SORT_OPTIONS: { key: FolderSortKey; label: string }[] = [
  { key: 'name', label: '名前順' },
  { key: 'createdAt', label: 'ダウンロード日時順' },
  { key: 'tagName', label: 'タグ名順' },
];

export function FolderListScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NativeStackNavigationProp<GalleryStackParamList>>();
  const rootNavigation = useRootNavigation();
  const { colors } = useAppTheme();

  const [sortKey, setSortKey] = useState<FolderSortKey>('createdAt');
  const [searchQuery, setSearchQuery] = useState('');
  const [folders, setFolders] = useState<FolderWithTags[]>([]);
  const [menuFolder, setMenuFolder] = useState<FolderWithTags | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [taggingFolder, setTaggingFolder] = useState<FolderWithTags | null>(null);

  const reload = useCallback(async () => {
    const result = await listFolders(db, { parentId: null, sortKey, searchQuery });
    setFolders(result);
  }, [db, sortKey, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View style={styles.searchBarWrapper}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={16} color={colors.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="フォルダ名・タグ名で検索"
            placeholderTextColor={colors.secondaryText}
          />
        </View>
      </View>

      <DraggableLayoutArea>
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={folders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FolderRow
              folder={item}
              onPress={() => navigation.navigate('FolderDetail', { folderId: item.id })}
              onOpenMenu={() => setMenuFolder(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
              フォルダがありません
            </Text>
          }
        />

        <ControlGroup screenId={SCREEN_ID}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortButton,
                { backgroundColor: colors.surface },
                sortKey === option.key && { backgroundColor: colors.primary },
              ]}
              onPress={() => setSortKey(option.key)}
              accessibilityLabel={`sort-${option.key}`}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  { color: colors.secondaryText },
                  sortKey === option.key && styles.sortButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.newFolderButton, { backgroundColor: colors.primary }]}
            onPress={() => setCreatingFolder(true)}
            accessibilityLabel="create-folder"
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newFolderButtonText}>新規フォルダ</Text>
          </TouchableOpacity>
        </ControlGroup>
      </DraggableLayoutArea>

      <ActionMenuModal
        visible={menuFolder !== null}
        onClose={() => setMenuFolder(null)}
        actions={[
          { label: 'タグを編集', onPress: () => setTaggingFolder(menuFolder) },
          {
            label: '別のフォルダへ移動',
            onPress: () => {
              if (menuFolder) {
                rootNavigation.navigate('FolderPicker', { movingFolderId: menuFolder.id });
              }
            },
          },
        ]}
      />

      <PromptModal
        visible={creatingFolder}
        title="新規フォルダ"
        placeholder="フォルダ名"
        submitLabel="作成"
        onCancel={() => setCreatingFolder(false)}
        onSubmit={async (name) => {
          const trimmed = name.trim();
          setCreatingFolder(false);
          if (trimmed) {
            await createFolder(db, { name: trimmed, parentId: null, dirPath: null });
            reload();
          }
        }}
      />

      <TagEditorModal
        visible={taggingFolder !== null}
        folderName={taggingFolder?.name ?? ''}
        initialTags={taggingFolder?.tags.map((t) => t.name) ?? []}
        onCancel={() => setTaggingFolder(null)}
        onSubmit={async (tags) => {
          if (taggingFolder) {
            await setFolderTags(db, taggingFolder.id, tags);
          }
          setTaggingFolder(null);
          reload();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchBarWrapper: {
    zIndex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    backgroundColor: '#f1f1f1',
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 14,
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f1f1',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#555',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  newFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#4c8bf5',
  },
  newFolderButtonText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
  },
});
