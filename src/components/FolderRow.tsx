import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import type { FolderWithTags } from '../db/types';
import { listFolderImageUris } from '../db/folderImages';
import { useAppTheme } from '../theme/theme';
import { useSwipeRowCoordinator } from './SwipeRowCoordinator';

const AUTO_CLOSE_MS = 4000;

type FolderRowProps = {
  folder: FolderWithTags;
  onPress: () => void;
  onOpenMenu: () => void;
  onDelete: () => void;
  /** Omitted (no source URL, or a parent/container folder) disables the left-swipe jump action. */
  onJumpToSource?: () => void;
};

export function FolderRow({
  folder,
  onPress,
  onOpenMenu,
  onDelete,
  onJumpToSource,
}: FolderRowProps) {
  const { colors } = useAppTheme();
  // `firstImageUri` is recorded once at download time (see
  // downloadHistoryRepository.ts) and is available for the vast majority of
  // folders — used directly, synchronously, during render. Only folders
  // with no recorded download (manually created, or from before this field
  // existed) fall back to listFolderImageUris() below, which synchronously
  // lists every file in the folder just to read off the first one; with
  // many rows mounting at once (opening the gallery, or a tag search
  // re-rendering the list) that per-row directory scan was blocking the JS
  // thread and freezing the UI, so it's now the exception rather than the
  // rule.
  const [scannedThumbnailUri, setScannedThumbnailUri] = useState<string | null>(null);
  const thumbnailUri = folder.firstImageUri ?? scannedThumbnailUri;
  const swipeableRef = useRef<Swipeable>(null);
  const coordinator = useSwipeRowCoordinator();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (folder.firstImageUri !== null) {
      return;
    }
    let cancelled = false;
    listFolderImageUris(folder).then((uris) => {
      if (!cancelled) {
        setScannedThumbnailUri(uris[0] ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folder]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  const handleSwipeableWillOpen = () => {
    const close = () => swipeableRef.current?.close();
    coordinator?.notifyOpen(folder.id, close);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(close, AUTO_CLOSE_MS);
  };

  const handleJumpPress = () => {
    swipeableRef.current?.close();
    onJumpToSource?.();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      onSwipeableWillOpen={handleSwipeableWillOpen}
      renderLeftActions={() => (
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={onDelete}
          accessibilityLabel="delete-folder"
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.actionText}>削除</Text>
        </TouchableOpacity>
      )}
      renderRightActions={
        onJumpToSource
          ? () => (
              <TouchableOpacity
                style={styles.jumpAction}
                onPress={handleJumpPress}
                accessibilityLabel="jump-to-source"
              >
                <Ionicons name="open-outline" size={20} color="#fff" />
                <Text style={styles.actionText}>URLへ</Text>
              </TouchableOpacity>
            )
          : undefined
      }
    >
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.thumbnail}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={[
              styles.thumbnail,
              styles.thumbnailPlaceholder,
              { backgroundColor: colors.surface },
            ]}
          >
            <Ionicons name="folder" size={24} color="#f6c453" />
          </View>
        )}
        <View style={styles.textGroup}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {folder.name}
          </Text>
          {folder.tags.length > 0 && (
            <View style={styles.tagRow}>
              {folder.tags.map((tag) => (
                <View key={tag.id} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.secondaryText} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  tagChip: {
    backgroundColor: '#eef3ff',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tagText: {
    fontSize: 11,
    color: '#3a5fc4',
  },
  menuButton: {
    padding: 6,
  },
  deleteAction: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0453f',
  },
  jumpAction: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4c8bf5',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
