import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { useBrowserStore } from '../../store/browserStore';
import { useDownloadStore } from '../../store/downloadStore';
import { useRootNavigation } from '../../navigation/useRootNavigation';
import { useAppTheme } from '../../theme/theme';

const PERIOD_OPTIONS: { key: RankingPeriod; label: string }[] = [
  { key: 'day', label: '日別' },
  { key: 'week', label: '週間' },
  { key: 'all', label: '全期間' },
];

const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 500;
const SLIDE_DISTANCE = 28;
const SLIDE_DURATION = 220;

export function RankingScreen() {
  const db = useSQLiteContext();
  const rootNavigation = useRootNavigation();
  const openTab = useBrowserStore((state) => state.openTab);
  const downloadActive = useDownloadStore((state) => state.active);
  const { colors } = useAppTheme();
  const [period, setPeriod] = useState<RankingPeriod>('day');
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const slideX = useSharedValue(0);
  const slideOpacity = useSharedValue(1);

  const reload = useCallback(async () => {
    setEntries(await getDownloadRanking(db, period));
  }, [db, period]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // A download can finish while the user is already sitting on this screen
  // (e.g. they switched tabs mid-download), in which case useFocusEffect
  // never re-fires — catch that transition explicitly so the new entry
  // doesn't require leaving and re-entering the screen to show up.
  const wasDownloadActiveRef = useRef(false);
  useEffect(() => {
    if (wasDownloadActiveRef.current && !downloadActive) {
      reload();
    }
    wasDownloadActiveRef.current = downloadActive;
  }, [downloadActive, reload]);

  const openUrl = (url: string) => {
    openTab(url);
    rootNavigation.navigate('MainTabs', { screen: 'Browser' } as never);
  };

  const periodIndex = PERIOD_OPTIONS.findIndex((option) => option.key === period);

  const changePeriod = useCallback(
    (next: RankingPeriod, direction: number) => {
      if (next === period) {
        return;
      }
      slideX.value = direction * SLIDE_DISTANCE;
      slideOpacity.value = 0;
      slideX.value = withTiming(0, { duration: SLIDE_DURATION });
      slideOpacity.value = withTiming(1, { duration: SLIDE_DURATION });
      setPeriod(next);
    },
    // slideX/slideOpacity (useSharedValue refs) are intentionally omitted:
    // they're referentially stable across renders, and including them trips
    // a lint rule that then flags every .value mutation on them anywhere in
    // the file as invalid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period],
  );

  const switchPeriod = useCallback(
    (delta: number) => {
      const nextIndex = Math.min(PERIOD_OPTIONS.length - 1, Math.max(0, periodIndex + delta));
      if (nextIndex !== periodIndex) {
        changePeriod(PERIOD_OPTIONS[nextIndex].key, delta);
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

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
    opacity: slideOpacity.value,
  }));

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
        {PERIOD_OPTIONS.map((option, index) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.periodButton,
              { backgroundColor: colors.surface },
              period === option.key && { backgroundColor: colors.primary },
            ]}
            onPress={() => changePeriod(option.key, index > periodIndex ? 1 : -1)}
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
        <Animated.View style={[styles.flex, slideStyle]}>
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
        </Animated.View>
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
  const thumbnailUri = entry.thumbnailUri;

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
      {/* alignSelf: 'flex-start' keeps this View hugging the text's natural
          (unwrapped) width instead of stretching to the clip container's
          width, so onLayout reports the true content width to compare
          against containerWidth. */}
      <Animated.View
        style={[styles.marqueeInner, animatedStyle]}
        onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
      >
        <Text style={textStyle} numberOfLines={1}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
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
    width: '100%',
    overflow: 'hidden',
  },
  marqueeInner: {
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
