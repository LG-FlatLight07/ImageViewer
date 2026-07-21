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
import {
  createFolder,
  deleteFolder,
  listAllTagNames,
  listFolders,
  renameFolder,
  setFolderTags,
} from '../../db/foldersRepository';
import { deleteFolderFiles } from '../../db/folderImages';
import { confirmDeleteFolder } from '../../utils/confirmDeleteFolder';
import { FolderRow } from '../../components/FolderRow';
import { SwipeRowCoordinatorProvider } from '../../components/SwipeRowCoordinator';
import { ActionMenuModal } from '../../components/ActionMenuModal';
import { PromptModal } from '../../components/PromptModal';
import { TagEditorModal } from '../../components/TagEditorModal';
import { DraggableLayoutArea } from '../../components/layout/DraggableLayoutArea';
import { ControlGroup } from '../../components/layout/ControlGroup';
import { EDGE_BOTTOM_ANCHOR } from '../../components/layout/anchors';
import { useBrowserStore } from '../../store/browserStore';
import { useLayoutStore } from '../../store/layoutStore';
import { useAppTheme } from '../../theme/theme';

const SEARCH_SCREEN_ID = 'gallery.folderList.search';
const SORT_SCREEN_ID = 'gallery.folderList.sort';
const MIN_LIST_PADDING_TOP = 80;
const LIST_RESERVE_GAP = 24;

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
  const openTab = useBrowserStore((state) => state.openTab);
  const { colors } = useAppTheme();
  const searchAnchor = useLayoutStore((state) => state.layouts[SEARCH_SCREEN_ID]?.anchor);
  const searchAtBottom = searchAnchor === EDGE_BOTTOM_ANCHOR;

  const [sortKey, setSortKey] = useState<FolderSortKey>('createdAt');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [folders, setFolders] = useState<FolderWithTags[]>([]);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [searchBarHeight, setSearchBarHeight] = useState(0);
  const [menuFolder, setMenuFolder] = useState<FolderWithTags | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [taggingFolder, setTaggingFolder] = useState<FolderWithTags | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<FolderWithTags | null>(null);

  const reload = useCallback(async () => {
    const result = await listFolders(db, {
      parentId: null,
      sortKey,
      searchQuery,
      tags: selectedTags,
    });
    setFolders(result);
  }, [db, sortKey, searchQuery, selectedTags]);

  useFocusEffect(
    useCallback(() => {
      reload();
      listAllTagNames(db).then(setAllTagNames);
    }, [db, reload]),
  );

  const tagSuggestions = allTagNames
    .filter((name) => !selectedTags.includes(name))
    .filter((name) => name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .slice(0, 20);

  const addTagFilter = (name: string) => {
    setSelectedTags((prev) => (prev.includes(name) ? prev : [...prev, name]));
  };

  const removeTagFilter = (name: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag !== name));
  };

  const handleDelete = (folder: FolderWithTags) => {
    confirmDeleteFolder(folder.name, async () => {
      await deleteFolderFiles(folder);
      await deleteFolder(db, folder.id);
      reload();
    });
  };

  const handleJumpToSource = (folder: FolderWithTags) => {
    if (!folder.sourceUrl) {
      return;
    }
    openTab(folder.sourceUrl);
    rootNavigation.navigate('MainTabs', { screen: 'Browser' } as never);
  };

  const currentSortLabel = SORT_OPTIONS.find((option) => option.key === sortKey)?.label ?? '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      <DraggableLayoutArea>
        <SwipeRowCoordinatorProvider>
          <FlatList
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              searchAtBottom
                ? {
                    paddingTop: 12,
                    paddingBottom: Math.max(searchBarHeight + LIST_RESERVE_GAP, 24),
                  }
                : {
                    paddingTop: Math.max(searchBarHeight + LIST_RESERVE_GAP, MIN_LIST_PADDING_TOP),
                  },
            ]}
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
        </SwipeRowCoordinatorProvider>

        <ControlGroup
          screenId={SEARCH_SCREEN_ID}
          variant="bar"
          defaultAnchor="top"
          edgesOnly
          onMeasured={(size) => setSearchBarHeight(size.height)}
        >
          <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
            <Ionicons name="search" size={16} color={colors.secondaryText} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="フォルダ名・タグ名で検索"
              placeholderTextColor={colors.secondaryText}
            />
            <TouchableOpacity
              style={[styles.newFolderIconButton, { backgroundColor: colors.primary }]}
              onPress={() => setCreatingFolder(true)}
              accessibilityLabel="create-folder"
              hitSlop={4}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {selectedTags.length > 0 && (
            <View style={styles.selectedTagRow}>
              {selectedTags.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.selectedTagChip, { backgroundColor: colors.primary }]}
                  onPress={() => removeTagFilter(name)}
                  accessibilityLabel={`remove-tag-filter-${name}`}
                >
                  <Text style={styles.selectedTagText}>{name}</Text>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {tagSuggestions.length > 0 && (
            <View style={[styles.tagSuggestionRow, { backgroundColor: colors.surface }]}>
              {tagSuggestions.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.tagSuggestionChip, { backgroundColor: colors.background }]}
                  onPress={() => addTagFilter(name)}
                >
                  <Ionicons name="pricetag-outline" size={12} color={colors.secondaryText} />
                  <Text style={[styles.tagSuggestionText, { color: colors.text }]}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ControlGroup>

        <ControlGroup screenId={SORT_SCREEN_ID} defaultAnchor="bottomLeft">
          <TouchableOpacity
            style={[styles.sortButton, { backgroundColor: colors.surface }]}
            onPress={() => setSortMenuVisible(true)}
            accessibilityLabel="open-sort-menu"
          >
            <Ionicons name="swap-vertical" size={14} color={colors.text} />
            <Text style={[styles.sortButtonText, { color: colors.text }]}>{currentSortLabel}</Text>
          </TouchableOpacity>
        </ControlGroup>
      </DraggableLayoutArea>

      <ActionMenuModal
        visible={sortMenuVisible}
        onClose={() => setSortMenuVisible(false)}
        actions={SORT_OPTIONS.map((option) => ({
          label: option.key === sortKey ? `✓ ${option.label}` : option.label,
          onPress: () => setSortKey(option.key),
        }))}
      />

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
  newFolderIconButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  selectedTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  selectedTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  selectedTagText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f1f1',
  },
  sortButtonText: {
    fontSize: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
  },
});
