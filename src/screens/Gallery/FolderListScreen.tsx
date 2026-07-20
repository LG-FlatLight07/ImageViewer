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
import { DraggableControl } from '../../components/layout/DraggableControl';

const SORT_OPTIONS: { key: FolderSortKey; label: string }[] = [
  { key: 'name', label: '名前順' },
  { key: 'createdAt', label: 'ダウンロード日時順' },
  { key: 'tagName', label: 'タグ名順' },
];

export function FolderListScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NativeStackNavigationProp<GalleryStackParamList>>();
  const rootNavigation = useRootNavigation();

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <DraggableLayoutArea>
        <DraggableControl
          screenId="gallery.folderList"
          controlId="searchBar"
          defaultPosition={{ x: 12, y: 8 }}
        >
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#888" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="フォルダ名・タグ名で検索"
            />
          </View>
        </DraggableControl>

        <DraggableControl
          screenId="gallery.folderList"
          controlId="sortRow"
          defaultPosition={{ x: 12, y: 56 }}
        >
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[styles.sortButton, sortKey === option.key && styles.sortButtonActive]}
                onPress={() => setSortKey(option.key)}
              >
                <Text
                  style={[
                    styles.sortButtonText,
                    sortKey === option.key && styles.sortButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </DraggableControl>

        <DraggableControl
          screenId="gallery.folderList"
          controlId="newFolderButton"
          defaultPosition={{ x: 300, y: 8 }}
        >
          <TouchableOpacity style={styles.newFolderButton} onPress={() => setCreatingFolder(true)}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </DraggableControl>

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
          ListEmptyComponent={<Text style={styles.emptyText}>フォルダがありません</Text>}
        />
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 260,
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
  sortRow: {
    flexDirection: 'row',
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f1f1',
    marginRight: 6,
  },
  sortButtonActive: {
    backgroundColor: '#4c8bf5',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#555',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  newFolderButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4c8bf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 104,
    paddingBottom: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
  },
});
