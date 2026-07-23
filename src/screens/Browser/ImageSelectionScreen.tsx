import React, { useMemo, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';

import type { RootStackParamList } from '../../navigation/types';
import type { DetectedImage } from '../../services/imageGrouping';
import { downloadImagesToNewFolder } from '../../services/downloadService';
import { submitFeedbackMessage } from '../../db/feedbackRepository';
import { useSettingsStore } from '../../store/settingsStore';
import { useDownloadStore } from '../../store/downloadStore';
import {
  canStartDownload,
  hasUnlimitedDownloadsToday,
  useMonetizationStore,
} from '../../store/monetizationStore';
import { useAppTheme } from '../../theme/theme';

const DOWNLOAD_FAILURE_MESSAGE = 'ダウンロードに失敗しました';
const DOWNLOAD_LIMIT_MESSAGE =
  '本日の無料ダウンロード回数を使い切りました。ギャラリー画面の「広告を見て本日は無制限に」ボタンから広告を視聴するか、設定画面から買い切り版を購入すると無制限になります。';

/**
 * The user only ever sees the generic DOWNLOAD_FAILURE_MESSAGE — the actual
 * cause (exception detail, or a 0/N success count) is filed as a developer
 * message instead, reusing the existing local feedback queue so it's ready
 * to sync once a server exists (see feedbackRepository.ts).
 */
async function reportDownloadFailure(
  db: SQLiteDatabase,
  context: {
    pageTitle: string;
    sourceUrl: string;
    total: number;
    successCount?: number;
    error?: unknown;
  },
): Promise<void> {
  const lines = [
    '【自動送信】画像ダウンロード失敗レポート',
    `ページタイトル: ${context.pageTitle}`,
    `URL: ${context.sourceUrl}`,
    context.successCount !== undefined
      ? `成功数: ${context.successCount}/${context.total}枚`
      : `対象枚数: ${context.total}枚`,
  ];
  if (context.error !== undefined) {
    const detail =
      context.error instanceof Error
        ? (context.error.stack ?? context.error.message)
        : String(context.error);
    lines.push(`エラー内容: ${detail}`);
  }
  try {
    await submitFeedbackMessage(db, lines.join('\n'));
  } catch (reportErr) {
    console.error('[ImageSelectionScreen] failed to report download failure', reportErr);
  }
}

const THUMB_SIZE = 100;

export function ImageSelectionScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ImageSelection'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const folderNameExclusions = useSettingsStore((state) => state.folderNameExclusions);
  const autoSelectSequentialImages = useSettingsStore((state) => state.autoSelectSequentialImages);
  const { pageTitle, sourceUrl, primaryGroup, otherImages } = route.params;

  const allImages = useMemo<DetectedImage[]>(
    () => [...(primaryGroup?.images ?? []), ...otherImages],
    [primaryGroup, otherImages],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      new Set(
        autoSelectSequentialImages ? (primaryGroup?.images.map((image) => image.id) ?? []) : [],
      ),
  );

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

  // Guards against duplicate folders/ranking entries from a rapid double-tap
  // firing this handler more than once before the screen unmounts.
  const submittingRef = useRef(false);

  const handleDownload = () => {
    if (submittingRef.current) {
      return;
    }
    const targets = allImages.filter((image) => selectedIds.has(image.id));
    if (targets.length === 0) {
      return;
    }
    const monetizationState = useMonetizationStore.getState();
    if (!canStartDownload(monetizationState)) {
      Alert.alert('ダウンロード回数の上限です', DOWNLOAD_LIMIT_MESSAGE);
      return;
    }
    if (!hasUnlimitedDownloadsToday(monetizationState)) {
      monetizationState.consumeDownloadUse();
    }
    submittingRef.current = true;
    useDownloadStore.getState().start(targets.length);
    navigation.goBack();
    downloadImagesToNewFolder(db, {
      folderName: pageTitle,
      sourceUrl,
      imageUrls: targets.map((image) => image.src),
      folderNameExclusions,
      onProgress: (completed, total) =>
        useDownloadStore.getState().updateProgress(completed, total),
    })
      .then((result) => {
        if (result.successCount === 0) {
          reportDownloadFailure(db, {
            pageTitle,
            sourceUrl,
            total: targets.length,
            successCount: result.successCount,
          });
          useDownloadStore.getState().finish(DOWNLOAD_FAILURE_MESSAGE);
          return;
        }
        useDownloadStore.getState().finish(`ダウンロード完了: ${result.successCount}枚`);
      })
      .catch((err) => {
        reportDownloadFailure(db, { pageTitle, sourceUrl, total: targets.length, error: err });
        useDownloadStore.getState().finish(DOWNLOAD_FAILURE_MESSAGE);
      });
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="close">
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {pageTitle || sourceUrl}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.actionsRow}>
        <Text style={[styles.selectionCount, { color: colors.secondaryText }]}>
          {selectedIds.size} / {allImages.length} 選択中
        </Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={selectAll}
            style={[styles.actionButton, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.actionButtonText, { color: colors.text }]}>すべて選択</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clearAll}
            style={[styles.actionButton, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.actionButtonText, { color: colors.text }]}>選択解除</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {primaryGroup && primaryGroup.images.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
              検出された連番画像 ({primaryGroup.images.length}件)
            </Text>
            <View style={styles.grid}>{primaryGroup.images.map(renderThumbnail)}</View>
          </>
        )}
        {otherImages.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>
              その他の画像 ({otherImages.length}件)
            </Text>
            <View style={styles.grid}>{otherImages.map(renderThumbnail)}</View>
          </>
        )}
        {allImages.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
            広告を除いた保存候補の画像が見つかりませんでした
          </Text>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.downloadButton,
            { backgroundColor: colors.primary },
            selectedIds.size === 0 && styles.downloadButtonDisabled,
          ]}
          onPress={handleDownload}
          disabled={selectedIds.size === 0}
        >
          <Text style={styles.downloadButtonText}>選択した画像をダウンロード</Text>
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
});
