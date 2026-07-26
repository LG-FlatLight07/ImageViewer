import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurTargetView, BlurView } from 'expo-blur';
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
import { getCachedThumbnails, setCachedThumbnail } from '../../db/rankingThumbnailRepository';
import {
  RankingThumbnailScanner,
  type ThumbnailScanItem,
} from '../../components/RankingThumbnailScanner';
import { useBrowserStore } from '../../store/browserStore';
import { useDownloadStore } from '../../store/downloadStore';
import { FREE_RANKING_VISIBLE, useMonetizationStore } from '../../store/monetizationStore';
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
  const purchasedPremium = useMonetizationStore((state) => state.purchasedPremium);
  const { colors } = useAppTheme();
  const [period, setPeriod] = useState<RankingPeriod>('day');
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({});
  const [scanQueue, setScanQueue] = useState<ThumbnailScanItem[]>([]);
  const slideX = useSharedValue(0);
  const slideOpacity = useSharedValue(1);

  const reload = useCallback(async () => {
    try {
      const result = await getDownloadRanking(period);
      setEntries(result);
      setLoadError(false);
    } catch (err) {
      console.warn('[RankingScreen] failed to load global ranking', err);
      setEntries([]);
      setLoadError(true);
    }
  }, [period]);

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

  // Locked (unpurchased, rank > FREE_RANKING_VISIBLE) rows never show a real
  // thumbnail at all — resolving one would mean loading a page the user
  // isn't allowed to see clearly yet, for no benefit, so they're excluded
  // from scanning entirely.
  const visibleCount = purchasedPremium ? entries.length : FREE_RANKING_VISIBLE;
  const unlockedEntries = entries.slice(0, visibleCount);

  // Thumbnails are never stored on the server (see RankingThumbnailScanner) —
  // each device resolves and caches its own copy locally. Whenever the
  // entry list changes, look up which url_keys are already cached and queue
  // the rest for background scanning, one page at a time.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const urlKeys = unlockedEntries.map((entry) => entry.urlKey);
      const cached = await getCachedThumbnails(db, urlKeys);
      if (cancelled) {
        return;
      }
      setThumbnails((prev) => {
        const next = { ...prev };
        for (const [urlKey, imageUrl] of cached) {
          next[urlKey] = imageUrl;
        }
        return next;
      });
      setScanQueue(
        unlockedEntries
          .filter((entry) => !cached.has(entry.urlKey))
          .map((entry) => ({ urlKey: entry.urlKey, sourceUrl: entry.sourceUrl })),
      );
    })();
    return () => {
      cancelled = true;
    };
    // unlockedEntries is derived fresh each render from entries/purchasedPremium — depend on those instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, purchasedPremium, db]);

  const handleThumbnailResolved = useCallback(
    (urlKey: string, imageUrl: string | null) => {
      setCachedThumbnail(db, urlKey, imageUrl);
      setThumbnails((prev) => ({ ...prev, [urlKey]: imageUrl }));
      setScanQueue((prev) => prev.filter((item) => item.urlKey !== urlKey));
    },
    [db],
  );

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
          アプリ利用者全員でのダウンロード統計です
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
            keyExtractor={(item) => item.urlKey}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const locked = index >= visibleCount;
              return (
                <RankingRow
                  entry={item}
                  rank={index + 1}
                  thumbnailUri={thumbnails[item.urlKey] ?? null}
                  locked={locked}
                  onPress={locked ? undefined : () => openUrl(item.sourceUrl)}
                />
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
                {loadError
                  ? '読み込めませんでした。ネットワーク接続を確認してください'
                  : 'この期間のダウンロード実績はありません'}
              </Text>
            }
          />
        </Animated.View>
      </GestureDetector>

      {!purchasedPremium && entries.length > visibleCount && (
        <View style={styles.premiumCtaWrapper} pointerEvents="box-none">
          <View style={[styles.premiumCtaCard, { backgroundColor: colors.card }]}>
            <Ionicons name="lock-open-outline" size={20} color={colors.primary} />
            <Text style={[styles.premiumCtaText, { color: colors.text }]}>
              Premium機能を解禁で、ランキング上位50位まで見られます
            </Text>
            <TouchableOpacity
              style={[styles.premiumCtaButton, { backgroundColor: colors.primary }]}
              onPress={() => rootNavigation.navigate('MainTabs', { screen: 'Settings' } as never)}
              accessibilityLabel="go-to-premium-settings"
            >
              <Text style={styles.premiumCtaButtonText}>Premium機能を見る</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <RankingThumbnailScanner item={scanQueue[0] ?? null} onResolved={handleThumbnailResolved} />
    </SafeAreaView>
  );
}

function RankingRow({
  entry,
  rank,
  thumbnailUri,
  locked,
  onPress,
}: {
  entry: RankingEntry;
  rank: number;
  thumbnailUri: string | null;
  locked: boolean;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const blurTargetRef = useRef<View>(null);

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={locked}
    >
      <Text style={[styles.rank, { color: colors.secondaryText }]}>{rank}</Text>
      <View style={styles.blurRegion}>
        {/* dimezisBlurView only actually blurs the content inside a
            BlurTargetView it's pointed at via `blurTarget` — without it, it
            silently degrades to a plain translucent overlay (looks like a
            dark box, nothing blurred). */}
        <BlurTargetView ref={blurTargetRef} style={styles.blurTargetContent}>
          <View style={styles.thumbnail}>
            {thumbnailUri && !locked ? (
              <Image source={{ uri: thumbnailUri }} style={styles.thumbnailImage} />
            ) : (
              <View
                style={[
                  styles.thumbnailImage,
                  styles.thumbnailPlaceholder,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Ionicons
                  name={locked ? 'lock-closed' : 'image-outline'}
                  size={20}
                  color={colors.secondaryText}
                />
              </View>
            )}
          </View>
          <View style={styles.rowTextGroup}>
            <MarqueeText
              text={entry.displayName}
              textStyle={[styles.hostname, { color: colors.text }]}
            />
            <Text style={[styles.url, { color: colors.secondaryText }]} numberOfLines={1}>
              {entry.sourceUrl}
            </Text>
          </View>
        </BlurTargetView>
        {locked && (
          <BlurView
            blurTarget={blurTargetRef}
            intensity={100}
            tint="dark"
            blurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
      </View>
      <View style={styles.countGroup}>
        <Text style={[styles.count, { color: colors.primary }]}>{entry.downloadCount}回</Text>
        <Text style={[styles.countSub, { color: colors.secondaryText }]}>
          {entry.totalImages}枚
        </Text>
      </View>
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
  blurRegion: {
    flex: 1,
    position: 'relative',
    marginRight: 8,
    overflow: 'hidden',
    borderRadius: 8,
  },
  blurTargetContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextGroup: {
    flex: 1,
    overflow: 'hidden',
  },
  hostname: {
    fontSize: 14,
    fontWeight: '600',
  },
  url: {
    fontSize: 11,
    marginTop: 2,
  },
  countGroup: {
    alignItems: 'flex-end',
  },
  count: {
    fontSize: 14,
    fontWeight: '700',
  },
  countSub: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 60,
  },
  premiumCtaWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: 'center',
  },
  premiumCtaCard: {
    width: '100%',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  premiumCtaText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  premiumCtaButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  premiumCtaButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
