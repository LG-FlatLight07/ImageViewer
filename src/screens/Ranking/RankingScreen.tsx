import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import {
  getDownloadRanking,
  type RankingEntry,
  type RankingPeriod,
} from '../../db/rankingRepository';
import { listFolderImageUris } from '../../db/folderImages';
import { useBrowserStore } from '../../store/browserStore';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import { useAppTheme } from '../../theme/theme';

const PERIOD_OPTIONS: { key: RankingPeriod; label: string }[] = [
  { key: 'day', label: '日別' },
  { key: 'week', label: '週間' },
  { key: 'all', label: '全期間' },
];

const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 500;

export function RankingScreen() {
  const db = useSQLiteContext();
  const rootNavigation = useRootNavigation();
  const setBrowserUrl = useBrowserStore((state) => state.setUrl);
  const { colors } = useAppTheme();
  const [period, setPeriod] = useState<RankingPeriod>('day');
  const [entries, setEntries] = useState<RankingEntry[]>([]);

  const reload = useCallback(async () => {
    setEntries(await getDownloadRanking(db, period));
  }, [db, period]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const openUrl = (url: string) => {
    setBrowserUrl(url);
    rootNavigation.navigate('MainTabs', { screen: 'Browser' } as never);
  };

  const periodIndex = PERIOD_OPTIONS.findIndex((option) => option.key === period);

  const switchPeriod = useCallback(
    (delta: number) => {
      const nextIndex = Math.min(PERIOD_OPTIONS.length - 1, Math.max(0, periodIndex + delta));
      if (nextIndex !== periodIndex) {
        setPeriod(PERIOD_OPTIONS[nextIndex].key);
      }
    },
    [periodIndex],
  );

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (event.translationX < -SWIPE_DISTANCE || event.velocityX < -SWIPE_VELOCITY) {
        runOnJS(switchPeriod)(1);
      } else if (event.translationX > SWIPE_DISTANCE || event.velocityX > SWIPE_VELOCITY) {
        runOnJS(switchPeriod)(-1);
      }
    });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>ランキング</Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
          この端末でのダウンロード統計です
        </Text>
      </View>

      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.periodButton,
              { backgroundColor: colors.surface },
              period === option.key && { backgroundColor: colors.primary },
            ]}
            onPress={() => setPeriod(option.key)}
          >
            <Text
              style={[
                styles.periodButtonText,
                { color: colors.secondaryText },
                period === option.key && styles.periodButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <GestureDetector gesture={swipeGesture}>
        <FlatList
          data={entries}
          keyExtractor={(item) => item.sourceUrl}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <RankingRow entry={item} rank={index + 1} onPress={() => openUrl(item.sourceUrl)} />
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
              この期間のダウンロード実績はありません
            </Text>
          }
        />
      </GestureDetector>
    </SafeAreaView>
  );
}

function RankingRow({
  entry,
  rank,
  onPress,
}: {
  entry: RankingEntry;
  rank: number;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listFolderImageUris({ dirPath: entry.dirPath }).then((uris) => {
      if (!cancelled) {
        setThumbnailUri(uris[0] ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entry.dirPath]);

  return (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={onPress}>
      <Text style={[styles.rank, { color: colors.secondaryText }]}>{rank}</Text>
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
          <Ionicons name="image-outline" size={20} color={colors.secondaryText} />
        </View>
      )}
      <View style={styles.rowTextGroup}>
        <Text style={[styles.hostname, { color: colors.text }]} numberOfLines={1}>
          {entry.displayName}
        </Text>
        <Text style={[styles.url, { color: colors.secondaryText }]} numberOfLines={1}>
          {entry.sourceUrl}
        </Text>
      </View>
      <Text style={[styles.count, { color: colors.primary }]}>{entry.totalImages}枚</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  periodButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: {
    width: 28,
    fontSize: 15,
    fontWeight: '700',
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextGroup: {
    flex: 1,
    marginRight: 8,
  },
  hostname: {
    fontSize: 14,
    fontWeight: '600',
  },
  url: {
    fontSize: 11,
    marginTop: 2,
  },
  count: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
  },
});
