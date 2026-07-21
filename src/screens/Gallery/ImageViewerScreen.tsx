import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { GalleryStackParamList } from '../../navigation/types';
import { getFolder, listFolders } from '../../db/foldersRepository';
import { listFolderImageUris } from '../../db/folderImages';
import { useSettingsStore } from '../../store/settingsStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GAP = 2;
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 800;

type PageItem = { uri: string; folderId: string; width: number; height: number };

/** width/height are 0 if the size couldn't be read; callers fall back to a full-screen slot in that case. */
function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 }),
    );
  });
}

async function buildPages(items: { uri: string; folderId: string }[]): Promise<PageItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const { width, height } = await getImageSize(item.uri);
      return { ...item, width, height };
    }),
  );
}

export function ImageViewerScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NativeStackNavigationProp<GalleryStackParamList>>();
  const route = useRoute<RouteProp<GalleryStackParamList, 'ImageViewer'>>();
  const { folderId, startIndex } = route.params;
  const direction = useSettingsStore((state) => state.imageViewerDirection);

  const [pages, setPages] = useState<PageItem[]>([]);

  const load = useCallback(async () => {
    const folder = await getFolder(db, folderId);
    const currentImages = await listFolderImageUris(folder);
    const currentItems = currentImages.map((uri) => ({ uri, folderId }));

    if (!folder) {
      setPages(await buildPages(currentItems));
      return;
    }

    const siblings = await listFolders(db, { parentId: folder.parentId, sortKey: 'name' });
    const ownIndex = siblings.findIndex((sibling) => sibling.id === folderId);
    const nextFolder = ownIndex >= 0 ? siblings[ownIndex + 1] : undefined;

    if (!nextFolder) {
      setPages(await buildPages(currentItems));
      return;
    }

    const nextImages = await listFolderImageUris(nextFolder);
    const nextItems = nextImages.map((uri) => ({ uri, folderId: nextFolder.id }));
    setPages(await buildPages([...currentItems, ...nextItems]));
  }, [db, folderId]);

  useEffect(() => {
    // Initial data load for this screen instance; load() internally calls setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const closeViewer = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // A perpendicular swipe (relative to the paging direction) dismisses back
  // to the gallery root rather than the folder's image list, since it reads
  // as "leave the viewer entirely" rather than "go back one screen".
  const dismissToGallery = useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

  if (pages.length === 0) {
    return <View style={styles.container} />;
  }

  return (
    <ImageViewerContent
      pages={pages}
      startIndex={startIndex}
      isHorizontal={direction === 'horizontal'}
      onClose={closeViewer}
      onDismiss={dismissToGallery}
    />
  );
}

/**
 * Only mounts once `pages` (with real image dimensions already resolved) is
 * non-empty, so the initial scroll-position shared values below are correct
 * from their very first render — no need to "correct" them later via an
 * effect, which would require mutating a shared value from inside a
 * useEffect (not allowed by the reanimated/react-hooks lint rule).
 */
function ImageViewerContent({
  pages,
  startIndex,
  isHorizontal,
  onClose,
  onDismiss,
}: {
  pages: PageItem[];
  startIndex: number;
  isHorizontal: boolean;
  onClose: () => void;
  onDismiss: () => void;
}) {
  const pageSize = isHorizontal ? SCREEN_WIDTH : SCREEN_HEIGHT;

  // Horizontal paging keeps a uniform pageSize per page (unchanged). Vertical
  // paging instead sizes each slot to that image's own contain-fit height,
  // so a wide image doesn't leave big empty letterboxing in the scroll
  // direction — which is what made the gap between images look inconsistent
  // and caused jitter as those blank regions scrolled past.
  const pageHeights = useMemo(
    () =>
      pages.map((page) =>
        page.width > 0 && page.height > 0
          ? Math.min(SCREEN_HEIGHT, SCREEN_WIDTH * (page.height / page.width))
          : SCREEN_HEIGHT,
      ),
    [pages],
  );
  const pageOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < pageHeights.length; i += 1) {
      offsets.push(acc);
      acc += pageHeights[i] + GAP;
    }
    return offsets;
  }, [pageHeights]);
  const verticalTrackHeight =
    pageOffsets.length > 0
      ? pageOffsets[pageOffsets.length - 1] + pageHeights[pageHeights.length - 1]
      : 0;

  const clampedStartIndex = Math.max(0, Math.min(pages.length - 1, startIndex));
  const initialMain = isHorizontal
    ? -clampedStartIndex * pageSize
    : -(pageOffsets[clampedStartIndex] ?? 0);

  const translateMain = useSharedValue(initialMain);
  const translateCross = useSharedValue(0);
  const startMain = useSharedValue(initialMain);
  const [currentIndex, setCurrentIndex] = useState(clampedStartIndex);

  const setIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  useAnimatedReaction(
    () => {
      if (isHorizontal) {
        return Math.round(-translateMain.value / pageSize);
      }
      const pos = -translateMain.value;
      let found = 0;
      for (let i = 0; i < pageOffsets.length; i += 1) {
        if (pageOffsets[i] <= pos + 1) {
          found = i;
        }
      }
      return found;
    },
    (value, previous) => {
      if (value !== previous) {
        const clamped = Math.max(0, Math.min(pages.length - 1, value));
        runOnJS(setIndex)(clamped);
      }
    },
    [pages.length, pageSize, isHorizontal, pageOffsets],
  );

  const pan = Gesture.Pan()
    .onStart(() => {
      startMain.value = translateMain.value;
    })
    .onUpdate((event) => {
      const mainDelta = isHorizontal ? event.translationX : event.translationY;
      const crossDelta = isHorizontal ? event.translationY : event.translationX;
      translateMain.value = startMain.value + mainDelta;
      translateCross.value = crossDelta;
    })
    .onEnd((event) => {
      const crossVelocity = isHorizontal ? event.velocityY : event.velocityX;
      if (
        Math.abs(translateCross.value) > DISMISS_DISTANCE ||
        Math.abs(crossVelocity) > DISMISS_VELOCITY
      ) {
        const sign = translateCross.value >= 0 ? 1 : -1;
        translateCross.value = withTiming(sign * pageSize, { duration: 200 }, (finished) => {
          if (finished) {
            runOnJS(onDismiss)();
          }
        });
        return;
      }
      translateCross.value = withSpring(0, { damping: 20 });

      // Free-scroll: let the fling decay naturally instead of snapping to a page.
      const mainVelocity = isHorizontal ? event.velocityX : event.velocityY;
      const minTranslate = isHorizontal
        ? -(Math.max(pages.length - 1, 0) * pageSize)
        : -(pageOffsets.length > 0 ? pageOffsets[pageOffsets.length - 1] : 0);
      translateMain.value = withDecay({
        velocity: mainVelocity,
        clamp: [minTranslate, 0],
      });
    });

  const trackAnimatedStyle = useAnimatedStyle(() => ({
    transform: isHorizontal
      ? [{ translateX: translateMain.value }, { translateY: translateCross.value }]
      : [{ translateX: translateCross.value }, { translateY: translateMain.value }],
  }));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            isHorizontal
              ? { width: pageSize * Math.max(pages.length, 1), height: SCREEN_HEIGHT }
              : { width: SCREEN_WIDTH, height: Math.max(verticalTrackHeight, SCREEN_HEIGHT) },
            styles.track,
            trackAnimatedStyle,
          ]}
        >
          {pages.map((page, index) => (
            <View
              key={`${page.folderId}-${page.uri}`}
              style={[
                styles.page,
                isHorizontal
                  ? { left: index * pageSize, top: 0 }
                  : {
                      top: pageOffsets[index] ?? 0,
                      left: 0,
                      height: pageHeights[index] ?? SCREEN_HEIGHT,
                    },
              ]}
            >
              <Image
                source={{ uri: page.uri }}
                style={
                  isHorizontal
                    ? { width: pageSize - GAP, height: SCREEN_HEIGHT }
                    : { width: SCREEN_WIDTH, height: pageHeights[index] ?? SCREEN_HEIGHT }
                }
                resizeMode="contain"
              />
            </View>
          ))}
        </Animated.View>
      </GestureDetector>

      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} accessibilityLabel="close" hitSlop={8}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.counter}>
          {currentIndex + 1} / {pages.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  track: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  page: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  counter: {
    color: '#fff',
    fontSize: 14,
  },
});
