import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import type { RootStackParamList } from '../../navigation/types';
import type { DetectedImage } from '../../services/imageGrouping';
import { downloadImagesToNewFolder } from '../../services/downloadService';

const THUMB_SIZE = 100;

export function ImageSelectionScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ImageSelection'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const db = useSQLiteContext();
  const { pageTitle, sourceUrl, primaryGroup, otherImages } = route.params;

  const allImages = useMemo<DetectedImage[]>(
    () => [...(primaryGroup?.images ?? []), ...otherImages],
    [primaryGroup, otherImages],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(primaryGroup?.images.map((image) => image.id) ?? []),
  );
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const toggleImage = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allImages.map((image) => image.id)));
  const clearAll = () => setSelectedIds(new Set());

  const handleDownload = async () => {
    const targets = allImages.filter((image) => selectedIds.has(image.id));
    if (targets.length === 0) {
      return;
    }
    setDownloading(true);
    setProgress({ completed: 0, total: targets.length });
    try {
      await downloadImagesToNewFolder(db, {
        folderName: pageTitle,
        sourceUrl,
        imageUrls: targets.map((image) => image.src),
        onProgress: (completed, total) => setProgress({ completed, total }),
      });
      navigation.navigate('MainTabs', { screen: 'Gallery' } as never);
    } finally {
      setDownloading(false);
    }
  };

  const renderThumbnail = (image: DetectedImage) => {
    const selected = selectedIds.has(image.id);
    return (
      <TouchableOpacity
        key={image.id}
        style={styles.thumbWrapper}
        onPress={() => toggleImage(image.id)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: image.src }} style={styles.thumbImage} resizeMode="cover" />
        <View style={[styles.checkBadge, selected && styles.checkBadgeSelected]}>
          <Ionicons
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={selected ? '#4c8bf5' : '#fff'}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="close">
          <Ionicons name="close" size={26} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {pageTitle || sourceUrl}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.actionsRow}>
        <Text style={styles.selectionCount}>
          {selectedIds.size} / {allImages.length} 選択中
        </Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={selectAll} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>すべて選択</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearAll} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>選択解除</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {primaryGroup && primaryGroup.images.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              検出された連番画像 ({primaryGroup.images.length}件)
            </Text>
            <View style={styles.grid}>{primaryGroup.images.map(renderThumbnail)}</View>
          </>
        )}
        {otherImages.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>その他の画像 ({otherImages.length}件)</Text>
            <View style={styles.grid}>{otherImages.map(renderThumbnail)}</View>
          </>
        )}
        {allImages.length === 0 && (
          <Text style={styles.emptyText}>広告を除いた保存候補の画像が見つかりませんでした</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.downloadButton, selectedIds.size === 0 && styles.downloadButtonDisabled]}
          onPress={handleDownload}
          disabled={selectedIds.size === 0 || downloading}
        >
          {downloading ? (
            <View style={styles.downloadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.downloadButtonText}>
                {progress.completed} / {progress.total} 保存中...
              </Text>
            </View>
          ) : (
            <Text style={styles.downloadButtonText}>選択した画像をダウンロード</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectionCount: {
    fontSize: 13,
    color: '#555',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f1f1',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginTop: 12,
    marginBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
  },
  checkBadgeSelected: {
    backgroundColor: '#fff',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
  },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  downloadButton: {
    backgroundColor: '#4c8bf5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  downloadButtonDisabled: {
    backgroundColor: '#a9c3f0',
  },
  downloadButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  downloadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
