import React, { useCallback, useEffect, useState } from 'react';
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

type PageItem = { uri: string; folderId: string };

export function ImageViewerScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<NativeStackNavigationProp<GalleryStackParamList>>();
  const route = useRoute<RouteProp<GalleryStackParamList, 'ImageViewer'>>();
  const { folderId, startIndex } = route.params;
  const direction = useSettingsStore((state) => state.imageViewerDirection);

  const [pages, setPages] = useState<PageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  const load = useCallback(async () => {
    const folder = await getFolder(db, folderId);
    const currentImages = await listFolderImageUris(folder);
    const currentPages = currentImages.map((uri) => ({ uri, folderId }));

    if (!folder) {
      setPages(currentPages);
      return;
    }

    const siblings = await listFolders(db, { parentId: folder.parentId, sortKey: 'name' });
    const ownIndex = siblings.findIndex((sibling) => sibling.id === folderId);
    const nextFolder = ownIndex >= 0 ? siblings[ownIndex + 1] : undefined;

    if (!nextFolder) {
      setPages(currentPages);
      return;
    }

    const nextImages = await listFolderImageUris(nextFolder);
    setPages([...currentPages, ...nextImages.map((uri) => ({ uri, folderId: nextFolder.id }))]);
  }, [db, folderId]);

  useEffect(() => {
    // Initial data load for this screen instance; load() internally calls setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const isHorizontal = direction === 'horizontal';
  const pageSize = isHorizontal ? SCREEN_WIDTH : SCREEN_HEIGHT;

  const translateMain = useSharedValue(-startIndex * pageSize);
  const translateCross = useSharedValue(0);
  const startMain = useSharedValue(-startIndex * pageSize);

  const closeViewer = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const setIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  useAnimatedReaction(
    () => Math.round(-translateMain.value / pageSize),
    (value, previous) => {
      if (value !== previous && pages.length > 0) {
        const clamped = Math.max(0, Math.min(pages.length - 1, value));
        runOnJS(setIndex)(clamped);
      }
    },
    [pages.length, pageSize],
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
            runOnJS(closeViewer)();
          }
        });
        return;
      }
      translateCross.value = withSpring(0, { damping: 20 });

      // Free-scroll: let the fling decay naturally instead of snapping to a page.
      const mainVelocity = isHorizontal ? event.velocityX : event.velocityY;
      const minTranslate = -(Math.max(pages.length - 1, 0) * pageSize);
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
              : { width: SCREEN_WIDTH, height: pageSize * Math.max(pages.length, 1) },
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
                  : { top: index * pageSize, left: 0 },
              ]}
            >
              <Image
                source={{ uri: page.uri }}
                style={
                  isHorizontal
                    ? { width: pageSize - GAP, height: SCREEN_HEIGHT }
                    : { width: SCREEN_WIDTH, height: pageSize - GAP }
                }
                resizeMode="contain"
              />
            </View>
          ))}
        </Animated.View>
      </GestureDetector>

      <View style={styles.header}>
        <TouchableOpacity onPress={closeViewer} accessibilityLabel="close" hitSlop={8}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.counter}>
          {pages.length > 0 ? currentIndex + 1 : 0} / {pages.length}
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
