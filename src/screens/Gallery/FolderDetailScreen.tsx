import React, { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import type { GalleryStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import type { FolderWithTags } from '../../db/types';
import {
  createFolder,
  deleteFolder,
  getFolder,
  getFolderAndDescendants,
  incrementFolderViewCount,
  listFolders,
  renameFolder,
  setFolderTags,
} from '../../db/foldersRepository';
import { deleteFolderFiles, deleteImageFiles, listFolderImageUris } from '../../db/folderImages';
import { confirmDelete, confirmDeleteFolder } from '../../utils/confirmDeleteFolder';
import { FolderRow } from '../../components/FolderRow';
import { SwipeRowCoordinatorProvider } from '../../components/SwipeRowCoordinator';
import { ActionMenuModal } from '../../components/ActionMenuModal';
import { PromptModal } from '../../components/PromptModal';
import { TagEditorModal } from '../../components/TagEditorModal';
import { DraggableLayoutArea } from '../../components/layout/DraggableLayoutArea';
import { ControlGroup } from '../../components/layout/ControlGroup';
import { clampToEdgeAnchor, EDGE_BOTTOM_ANCHOR } from '../../components/layout/anchors';
import { useBrowserStore } from '../../store/browserStore';
import { useLayoutStore } from '../../store/layoutStore';
import { useAppTheme } from '../../theme/theme';

const IMAGE_COLUMNS = 3;
// Ordered so the header wins the default top-slot tie-break (see ControlGroup's
// stackPeerId doc) before either has ever been dragged by the user.
const HEADER_SCREEN_ID = 'gallery.folderDetail.1-header';
const ACTIONS_SCREEN_ID = 'gallery.folderDetail.2-actions';
const RESERVED_GAP = 16;

type ListItem =
  { type: 'subfolder'; folder: FolderWithTags } | { type: 'image'; uri: string; index: number };

function edgeOf(anchor: number | undefined): 'top' | 'bottom' {
  return anchor !== undefined && clampToEdgeAnchor(anchor) === EDGE_BOTTOM_ANCHOR
    ? 'bottom'
    : 'top';
}

export function FolderDetailScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NativeStackNavigationProp<GalleryStackParamList>>();
  const rootNavigation = useRootNavigation();
  const route = useRoute<RouteProp<GalleryStackParamList, 'FolderDetail'>>();
  const { folderId } = route.params;
  const { colors } = useAppTheme();
  const openTab = useBrowserStore((state) => state.openTab);
  const headerAnchor = useLayoutStore((state) => state.layouts[HEADER_SCREEN_ID]?.anchor);
  const actionsAnchor = useLayoutStore((state) => state.layouts[ACTIONS_SCREEN_ID]?.anchor);

  const [folder, setFolder] = useState<FolderWithTags | null>(null);
  const [subfolders, setSubfolders] = useState<FolderWithTags[]>([]);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [menuFolder, setMenuFolder] = useState<FolderWithTags | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [taggingTarget, setTaggingTarget] = useState<FolderWithTags | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<FolderWithTags | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [headerHeight, setHeaderHeight] = useState(0);
  const [actionsHeight, setActionsHeight] = useState(0);

  const reload = useCallback(async () => {
    const current = await getFolder(db, folderId);
    setFolder(current);

    const children = await listFolders(db, { parentId: folderId, sortKey: 'name' });
    setSubfolders(children);
    setImageUris(await listFolderImageUris(current));
  }, [db, folderId]);

  useFocusEffect(
    useCallback(() => {
      incrementFolderViewCount(db, folderId);
      reload();
    }, [db, folderId, reload]),
  );

  const handleDeleteSubfolder = (target: FolderWithTags) => {
    confirmDeleteFolder(target.name, async () => {
      const descendants = await getFolderAndDescendants(db, target.id);
      for (const descendant of descendants) {
        await deleteFolderFiles(descendant);
      }
      await deleteFolder(db, target.id);
      reload();
    });
  };

  const handleJumpToSource = (target: FolderWithTags) => {
    if (!target.sourceUrl) {
      return;
    }
    openTab(target.sourceUrl);
    rootNavigation.navigate('MainTabs', { screen: 'Browser' } as never);
  };

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedUris(new Set());
  };

  const toggleImageSelected = (uri: string) => {
    setSelectedUris((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const handleDeleteSelectedImages = () => {
    const targets = Array.from(selectedUris);
    if (targets.length === 0) {
      return;
    }
    confirmDelete({
      title: '選択した画像を削除しますか?',
      message: `${targets.length}枚の画像を削除します。この操作は元に戻せません。`,
      onConfirm: async () => {
        await deleteImageFiles(targets);
        setSelectionMode(false);
        setSelectedUris(new Set());
        reload();
      },
    });
  };

  const items: ListItem[] = [
    ...subfolders.map((f) => ({ type: 'subfolder' as const, folder: f })),
    ...imageUris.map((uri, index) => ({ type: 'image' as const, uri, index })),
  ];

  const headerEdge = edgeOf(headerAnchor);
  const actionsEdge = edgeOf(actionsAnchor);
  const topReserved =
    (headerEdge === 'top' ? headerHeight + RESERVED_GAP : 0) +
    (actionsEdge === 'top' ? actionsHeight + RESERVED_GAP : 0);
  const bottomReserved =
    (headerEdge === 'bottom' ? headerHeight + RESERVED_GAP : 0) +
    (actionsEdge === 'bottom' ? actionsHeight + RESERVED_GAP : 0);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <DraggableLayoutArea>
        <View style={[styles.content, { paddingTop: topReserved, paddingBottom: bottomReserved }]}>
          {folder?.tags && folder.tags.length > 0 && (
            <View style={styles.tagRow}>
              {folder.tags.map((tag) => (
                <View key={tag.id} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag.name}</Text>
                </View>
              ))}
            </View>
          )}

          <SwipeRowCoordinatorProvider>
            <FlatList
              style={styles.list}
              data={items}
              key={IMAGE_COLUMNS}
              numColumns={IMAGE_COLUMNS}
              keyExtractor={(item) =>
                item.type === 'subfolder' ? `f-${item.folder.id}` : `i-${item.uri}`
              }
              renderItem={({ item }) => {
                if (item.type === 'subfolder') {
                  return (
                    <View style={styles.fullWidthRow}>
                      <FolderRow
                        folder={item.folder}
                        onPress={() =>
                          navigation.push('FolderDetail', { folderId: item.folder.id })
                        }
                        onOpenMenu={() => setMenuFolder(item.folder)}
                        onDelete={() => handleDeleteSubfolder(item.folder)}
                        onJumpToSource={
                          item.folder.sourceUrl ? () => handleJumpToSource(item.folder) : undefined
                        }
                      />
                    </View>
                  );
                }
                const selected = selectedUris.has(item.uri);
                return (
                  <TouchableOpacity
                    style={[styles.imageCell, { backgroundColor: colors.surface }]}
                    onPress={() =>
                      selectionMode
                        ? toggleImageSelected(item.uri)
                        : navigation.navigate('ImageViewer', { folderId, startIndex: item.index })
                    }
                  >
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.imageThumb}
                      resizeMode="cover"
                    />
                    {selectionMode && (
                      <View style={[styles.selectBadge, selected && styles.selectBadgeSelected]}>
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={selected ? '#4c8bf5' : '#fff'}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={[
                styles.listContent,
                selectionMode && styles.listContentWithFooter,
              ]}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
                  このフォルダは空です
                </Text>
              }
            />
          </SwipeRowCoordinatorProvider>
        </View>

        <ControlGroup
          screenId={HEADER_SCREEN_ID}
          variant="bar"
          defaultAnchor="top"
          edgesOnly
          stackPeerId={ACTIONS_SCREEN_ID}
          onMeasured={(size) => setHeaderHeight(size.height)}
        >
          <View style={[styles.headerBar, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityLabel="back-to-folder-list"
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {folder?.name ?? ''}
            </Text>
          </View>
        </ControlGroup>

        <ControlGroup
          screenId={ACTIONS_SCREEN_ID}
          variant="bar"
          defaultAnchor="top"
          edgesOnly
          stackPeerId={HEADER_SCREEN_ID}
          onMeasured={(size) => setActionsHeight(size.height)}
        >
          <View style={[styles.toolbar, { backgroundColor: colors.card }]}>
            <TouchableOpacity style={styles.toolbarButton} onPress={() => setTaggingTarget(folder)}>
              <Ionicons name="pricetag-outline" size={16} color="#4c8bf5" />
              <Text style={styles.toolbarButtonText}>タグを編集</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() =>
                folder && rootNavigation.navigate('FolderPicker', { movingFolderId: folder.id })
              }
            >
              <Ionicons name="folder-open-outline" size={16} color="#4c8bf5" />
              <Text style={styles.toolbarButtonText}>このフォルダを移動</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarButton} onPress={() => setCreatingFolder(true)}>
              <Ionicons name="add" size={16} color="#4c8bf5" />
              <Text style={styles.toolbarButtonText}>新規フォルダ</Text>
            </TouchableOpacity>
            {imageUris.length > 0 && (
              <TouchableOpacity style={styles.toolbarButton} onPress={toggleSelectionMode}>
                <Ionicons
                  name={selectionMode ? 'checkmark-done-outline' : 'checkbox-outline'}
                  size={16}
                  color="#4c8bf5"
                />
                <Text style={styles.toolbarButtonText}>
                  {selectionMode ? '選択を終了' : '画像を選択'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ControlGroup>
      </DraggableLayoutArea>

      {selectionMode && (
        <View
          style={[
            styles.selectionFooter,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <Text style={[styles.selectionCount, { color: colors.text }]}>
            {selectedUris.size}枚選択中
          </Text>
          <TouchableOpacity
            style={[
              styles.selectionDeleteButton,
              { backgroundColor: colors.danger },
              selectedUris.size === 0 && styles.selectionDeleteButtonDisabled,
            ]}
            onPress={handleDeleteSelectedImages}
            disabled={selectedUris.size === 0}
          >
            <Text style={styles.selectionDeleteButtonText}>削除</Text>
          </TouchableOpacity>
        </View>
      )}

      <ActionMenuModal
        visible={menuFolder !== null}
        onClose={() => setMenuFolder(null)}
        actions={[
          {
            label: 'タグを編集',
            onPress: () => setTaggingTarget(menuFolder),
          },
          {
            label: '名前を変更',
            onPress: () => setRenamingFolder(menuFolder),
          },
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
            await createFolder(db, { name: trimmed, parentId: folderId, dirPath: null });
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
        visible={taggingTarget !== null}
        folderName={taggingTarget?.name ?? ''}
        initialTags={taggingTarget?.tags.map((t) => t.name) ?? []}
        onCancel={() => setTaggingTarget(null)}
        onSubmit={async (tags) => {
          if (taggingTarget) {
            await setFolderTags(db, taggingTarget.id, tags);
          }
          setTaggingTarget(null);
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
  content: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  toolbarButtonText: {
    fontSize: 12,
    color: '#4c8bf5',
    marginLeft: 4,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    marginBottom: 10,
  },
  tagChip: {
    backgroundColor: '#eef3ff',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tagText: {
    fontSize: 11,
    color: '#3a5fc4',
  },
  listContent: {
    paddingBottom: 24,
  },
  listContentWithFooter: {
    paddingBottom: 80,
  },
  fullWidthRow: {
    width: '100%',
  },
  imageCell: {
    flex: 1 / IMAGE_COLUMNS,
    aspectRatio: 1,
    margin: 1,
    backgroundColor: '#eee',
  },
  imageThumb: {
    width: '100%',
    height: '100%',
  },
  selectBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
  },
  selectBadgeSelected: {
    backgroundColor: '#fff',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
  },
  selectionFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selectionCount: {
    fontSize: 14,
  },
  selectionDeleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  selectionDeleteButtonDisabled: {
    opacity: 0.4,
  },
  selectionDeleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
