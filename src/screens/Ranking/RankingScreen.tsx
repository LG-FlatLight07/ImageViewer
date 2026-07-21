import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  LayoutAnimation,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

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

  const changePeriod = useCallback((next: RankingPeriod) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPeriod(next);
  }, []);

  const switchPeriod = useCallback(
    (delta: number) => {
      const nextIndex = Math.min(PERIOD_OPTIONS.length - 1, Math.max(0, periodIndex + delta));
      if (nextIndex !== periodIndex) {
        changePeriod(PERIOD_OPTIONS[nextIndex].key);
      }
    },
    [periodIndex, changePeriod],
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
            onPress={() => changePeriod(option.key)}
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
        <MarqueeText
          text={entry.displayName}
          textStyle={[styles.hostname, { color: colors.text }]}
        />
        <Text style={[styles.url, { color: colors.secondaryText }]} numberOfLines={1}>
          {entry.sourceUrl}
        </Text>
      </View>
      <Text style={[styles.count, { color: colors.primary }]}>{entry.totalImages}枚</Text>
    </TouchableOpacity>
  );
}

const MARQUEE_PAUSE_MS = 1200;
const MARQUEE_PX_PER_SEC = 40;

/** Scrolls its text horizontally in a loop only when it's too wide to fit, pausing briefly at each end. */
function MarqueeText({ text, textStyle }: { text: string; textStyle?: object }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useSharedValue(0);
  const overflowing = containerWidth > 0 && textWidth > containerWidth;

  useEffect(() => {
    if (!overflowing) {
      translateX.value = 0;
      return;
    }
    const distance = textWidth - containerWidth + 12;
    const scrollDuration = (distance / MARQUEE_PX_PER_SEC) * 1000;
    translateX.value = 0;
    translateX.value = withRepeat(
      withSequence(
        withDelay(MARQUEE_PAUSE_MS, withTiming(-distance, { duration: scrollDuration })),
        withDelay(MARQUEE_PAUSE_MS, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
  }, [overflowing, textWidth, containerWidth, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={styles.marqueeClip}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <Animated.Text
        style={[textStyle, styles.marqueeText, animatedStyle]}
        numberOfLines={1}
        onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
      >
        {text}
      </Animated.Text>
    </View>
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
  marqueeClip: {
    overflow: 'hidden',
  },
  marqueeText: {
    alignSelf: 'flex-start',
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
