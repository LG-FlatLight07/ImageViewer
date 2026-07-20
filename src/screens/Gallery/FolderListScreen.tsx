import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import type { GalleryStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import type { FolderSortKey, FolderWithTags } from '../../db/types';
import {
  createFolder,
  deleteFolder,
  listAllTagNames,
  listFolders,
  renameFolder,
  setFolderTags,
} from '../../db/foldersRepository';
import { deleteFolderFiles } from '../../db/folderImages';
import { FolderRow } from '../../components/FolderRow';
import { ActionMenuModal } from '../../components/ActionMenuModal';
import { PromptModal } from '../../components/PromptModal';
import { TagEditorModal } from '../../components/TagEditorModal';
import { DraggableLayoutArea } from '../../components/layout/DraggableLayoutArea';
import { ControlGroup } from '../../components/layout/ControlGroup';
import { useBrowserStore } from '../../store/browserStore';
import { useAppTheme } from '../../theme/theme';

const SEARCH_SCREEN_ID = 'gallery.folderList.search';
const SORT_SCREEN_ID = 'gallery.folderList.sort';
const NEW_FOLDER_SCREEN_ID = 'gallery.folderList.newFolder';

const SORT_OPTIONS: { key: FolderSortKey; label: string }[] = [
  { key: 'name', label: '名前順' },
  { key: 'createdAt', label: 'ダウンロード日時順' },
  { key: 'tagName', label: 'タグ名順' },
  { key: 'viewCount', label: '閲覧回数順' },
];

export function FolderListScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NativeStackNavigationProp<GalleryStackParamList>>();
  const rootNavigation = useRootNavigation();
  const setBrowserUrl = useBrowserStore((state) => state.setUrl);
  const { colors } = useAppTheme();

  const [sortKey, setSortKey] = useState<FolderSortKey>('createdAt');
  const [searchQuery, setSearchQuery] = useState('');
  const [folders, setFolders] = useState<FolderWithTags[]>([]);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [menuFolder, setMenuFolder] = useState<FolderWithTags | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [taggingFolder, setTaggingFolder] = useState<FolderWithTags | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<FolderWithTags | null>(null);

  const reload = useCallback(async () => {
    const result = await listFolders(db, { parentId: null, sortKey, searchQuery });
    setFolders(result);
  }, [db, sortKey, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  useEffect(() => {
    listAllTagNames(db).then(setAllTagNames);
  }, [db]);

  const tagSuggestions = allTagNames
    .filter((name) => name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .slice(0, 20);

  const handleDelete = (folder: FolderWithTags) => {
    Alert.alert(
      'フォルダを削除しますか?',
      `「${folder.name}」を削除します。この操作は元に戻せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await deleteFolderFiles(folder);
            await deleteFolder(db, folder.id);
            reload();
          },
        },
      ],
    );
  };

  const handleJumpToSource = (folder: FolderWithTags) => {
    if (!folder.sourceUrl) {
      return;
    }
    setBrowserUrl(folder.sourceUrl);
    rootNavigation.navigate('MainTabs', { screen: 'Browser' } as never);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
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
              onDelete={() => handleDelete(item)}
              onJumpToSource={item.sourceUrl ? () => handleJumpToSource(item) : undefined}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
              フォルダがありません
            </Text>
          }
        />

        <ControlGroup screenId={SEARCH_SCREEN_ID} variant="bar" defaultAnchor="top">
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
          {tagSuggestions.length > 0 && (
            <View style={[styles.tagSuggestionRow, { backgroundColor: colors.surface }]}>
              {tagSuggestions.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.tagSuggestionChip, { backgroundColor: colors.background }]}
                  onPress={() => setSearchQuery(name)}
                >
                  <Ionicons name="pricetag-outline" size={12} color={colors.secondaryText} />
                  <Text style={[styles.tagSuggestionText, { color: colors.text }]}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ControlGroup>

        <ControlGroup screenId={SORT_SCREEN_ID} defaultAnchor="bottomLeft">
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
        </ControlGroup>

        <ControlGroup screenId={NEW_FOLDER_SCREEN_ID} defaultAnchor="bottomRight">
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
          { label: '名前を変更', onPress: () => setRenamingFolder(menuFolder) },
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

      <PromptModal
        visible={renamingFolder !== null}
        title="名前を変更"
        placeholder="フォルダ名"
        initialValue={renamingFolder?.name ?? ''}
        submitLabel="変更"
        onCancel={() => setRenamingFolder(null)}
        onSubmit={async (name) => {
          const trimmed = name.trim();
          const target = renamingFolder;
          setRenamingFolder(null);
          if (target && trimmed) {
            await renameFolder(db, target.id, trimmed);
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
          listAllTagNames(db).then(setAllTagNames);
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
  tagSuggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    padding: 6,
    borderRadius: 10,
  },
  tagSuggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 3,
  },
  tagSuggestionText: {
    fontSize: 11,
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
    // Clears the default top-anchored, floating search bar (it's draggable
    // now, so it no longer reserves layout space of its own).
    paddingTop: 64,
    paddingBottom: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
  },
});
