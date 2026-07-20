import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { FolderWithTags } from '../db/types';
import { listFolderImageUris } from '../db/folderImages';
import { useAppTheme } from '../theme/theme';

type FolderRowProps = {
  folder: FolderWithTags;
  onPress: () => void;
  onOpenMenu: () => void;
};

export function FolderRow({ folder, onPress, onOpenMenu }: FolderRowProps) {
  const { colors } = useAppTheme();
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listFolderImageUris(folder).then((uris) => {
      if (!cancelled) {
        setThumbnailUri(uris[0] ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folder]);

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {thumbnailUri ? (
        <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />
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
});
