import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getDownloadRanking,
  type RankingEntry,
  type RankingPeriod,
} from '../../db/rankingRepository';
import { useBrowserStore } from '../../store/browserStore';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import { useAppTheme } from '../../theme/theme';

const PERIOD_OPTIONS: { key: RankingPeriod; label: string }[] = [
  { key: 'day', label: '日別' },
  { key: 'week', label: '週間' },
  { key: 'all', label: '全期間' },
];

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

      <FlatList
        data={entries}
        keyExtractor={(item) => item.sourceUrl}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => openUrl(item.sourceUrl)}
          >
            <Text style={[styles.rank, { color: colors.secondaryText }]}>{index + 1}</Text>
            <View style={styles.rowTextGroup}>
              <Text style={[styles.hostname, { color: colors.text }]} numberOfLines={1}>
                {item.hostname}
              </Text>
              <Text style={[styles.url, { color: colors.secondaryText }]} numberOfLines={1}>
                {item.sourceUrl}
              </Text>
            </View>
            <Text style={[styles.count, { color: colors.primary }]}>{item.totalImages}枚</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
            この期間のダウンロード実績はありません
          </Text>
        }
      />
    </SafeAreaView>
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
