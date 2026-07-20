import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  incrementFolderViewCount,
  listFolders,
  renameFolder,
  setFolderTags,
} from '../../db/foldersRepository';
import { deleteFolderFiles, listFolderImageUris } from '../../db/folderImages';
import { FolderRow } from '../../components/FolderRow';
import { ActionMenuModal } from '../../components/ActionMenuModal';
import { PromptModal } from '../../components/PromptModal';
import { TagEditorModal } from '../../components/TagEditorModal';
import { useBrowserStore } from '../../store/browserStore';
import { useAppTheme } from '../../theme/theme';

const IMAGE_COLUMNS = 3;

type ListItem =
  { type: 'subfolder'; folder: FolderWithTags } | { type: 'image'; uri: string; index: number };

export function FolderDetailScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NativeStackNavigationProp<GalleryStackParamList>>();
  const rootNavigation = useRootNavigation();
  const route = useRoute<RouteProp<GalleryStackParamList, 'FolderDetail'>>();
  const { folderId } = route.params;
  const { colors } = useAppTheme();
  const setBrowserUrl = useBrowserStore((state) => state.setUrl);

  const [folder, setFolder] = useState<FolderWithTags | null>(null);
  const [subfolders, setSubfolders] = useState<FolderWithTags[]>([]);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [menuFolder, setMenuFolder] = useState<FolderWithTags | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [taggingTarget, setTaggingTarget] = useState<FolderWithTags | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<FolderWithTags | null>(null);

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
    Alert.alert(
      'フォルダを削除しますか?',
      `「${target.name}」を削除します。この操作は元に戻せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await deleteFolderFiles(target);
            await deleteFolder(db, target.id);
            reload();
          },
        },
      ],
    );
  };

  const handleJumpToSource = (target: FolderWithTags) => {
    if (!target.sourceUrl) {
      return;
    }
    setBrowserUrl(target.sourceUrl);
    rootNavigation.navigate('MainTabs', { screen: 'Browser' } as never);
  };

  useLayoutEffect(() => {
    navigation.setOptions({ title: folder?.name ?? '' });
  }, [navigation, folder?.name]);

  const items: ListItem[] = [
    ...subfolders.map((f) => ({ type: 'subfolder' as const, folder: f })),
    ...imageUris.map((uri, index) => ({ type: 'image' as const, uri, index })),
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
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
      </View>

      {folder?.tags && folder.tags.length > 0 && (
        <View style={styles.tagRow}>
          {folder.tags.map((tag) => (
            <View key={tag.id} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag.name}</Text>
            </View>
          ))}
        </View>
      )}

      <FlatList
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
                  onPress={() => navigation.push('FolderDetail', { folderId: item.folder.id })}
                  onOpenMenu={() => setMenuFolder(item.folder)}
                  onDelete={() => handleDeleteSubfolder(item.folder)}
                  onJumpToSource={
                    item.folder.sourceUrl ? () => handleJumpToSource(item.folder) : undefined
                  }
                />
              </View>
            );
          }
          return (
            <TouchableOpacity
              style={[styles.imageCell, { backgroundColor: colors.surface }]}
              onPress={() =>
                navigation.navigate('ImageViewer', { folderId, startIndex: item.index })
              }
            >
              <Image source={{ uri: item.uri }} style={styles.imageThumb} resizeMode="cover" />
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
            このフォルダは空です
          </Text>
        }
      />

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
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
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
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
  },
});
