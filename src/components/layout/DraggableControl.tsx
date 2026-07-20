/**
 * Reanimated shared values are mutable refs by design (`.value =` inside worklets
 * is the documented API), which the newer react-hooks/immutability rule can't
 * distinguish from mutating React state, so it's disabled for this file.
 */
/* eslint-disable react-hooks/immutability */
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { layoutKey, useLayoutStore, type Position } from '../../store/layoutStore';
import { useDraggableBounds } from './DraggableLayoutArea';

type DraggableControlProps = {
  screenId: string;
  controlId: string;
  defaultPosition: Position;
  children: React.ReactNode;
};

export function DraggableControl({
  screenId,
  controlId,
  defaultPosition,
  children,
}: DraggableControlProps) {
  const key = layoutKey(screenId, controlId);
  const editMode = useLayoutStore((state) => state.editMode);
  const storedPosition = useLayoutStore((state) => state.positions[key]);
  const setPosition = useLayoutStore((state) => state.setPosition);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const bounds = useDraggableBounds();

  const position = storedPosition ?? defaultPosition;
  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  const startX = useSharedValue(position.x);
  const startY = useSharedValue(position.y);

  useEffect(() => {
    translateX.value = position.x;
    translateY.value = position.y;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const commitPosition = (x: number, y: number) => {
    if (bounds.width === 0 || bounds.height === 0) {
      setPosition(key, { x, y });
      return;
    }
    const maxX = Math.max(bounds.width - size.width, 0);
    const maxY = Math.max(bounds.height - size.height, 0);
    const clampedX = Math.min(Math.max(x, 0), maxX);
    const clampedY = Math.min(Math.max(y, 0), maxY);
    translateX.value = clampedX;
    translateY.value = clampedY;
    setPosition(key, { x: clampedX, y: clampedY });
  };

  const pan = Gesture.Pan()
    .enabled(editMode)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      runOnJS(commitPosition)(translateX.value, translateY.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.container, animatedStyle]} onLayout={handleLayout}>
        <View style={editMode ? styles.editModeBorder : undefined}>{children}</View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  editModeBorder: {
    borderWidth: 2,
    borderColor: '#4c8bf5',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
});
