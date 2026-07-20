import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useLayoutStore } from '../../store/layoutStore';
import { useAppTheme } from '../../theme/theme';
import { useDraggableBounds } from './DraggableLayoutArea';
import {
  ALL_ANCHORS,
  DEFAULT_ANCHOR,
  getAnchorOrigin,
  isVerticalAnchor,
  type Anchor,
} from './anchors';

const MARGIN = 12;
const MAX_HORIZONTAL_WIDTH = 220;

type Size = { width: number; height: number };

type ControlGroupProps = {
  screenId: string;
  children: React.ReactNode;
};

export function ControlGroup({ screenId, children }: ControlGroupProps) {
  const { colors } = useAppTheme();
  const editMode = useLayoutStore((state) => state.editMode);
  const anchor = useLayoutStore((state) => state.anchors[screenId]) ?? DEFAULT_ANCHOR;
  const setAnchor = useLayoutStore((state) => state.setAnchor);
  const bounds = useDraggableBounds();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);

  const origin = getAnchorOrigin(anchor, bounds, size, MARGIN);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const commitDrop = (dx: number, dy: number) => {
    setDragging(false);
    translateX.value = 0;
    translateY.value = 0;
    if (bounds.width === 0 || bounds.height === 0 || size.width === 0) {
      return;
    }
    const currentCenter = {
      x: origin.x + size.width / 2 + dx,
      y: origin.y + size.height / 2 + dy,
    };
    let nearestAnchor: Anchor = anchor;
    let nearestDistance = Infinity;
    for (const candidate of ALL_ANCHORS) {
      const candidateOrigin = getAnchorOrigin(candidate, bounds, size, MARGIN);
      const candidateCenter = {
        x: candidateOrigin.x + size.width / 2,
        y: candidateOrigin.y + size.height / 2,
      };
      const distance = Math.hypot(
        candidateCenter.x - currentCenter.x,
        candidateCenter.y - currentCenter.y,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestAnchor = candidate;
      }
    }
    setAnchor(screenId, nearestAnchor);
  };

  const pan = Gesture.Pan()
    .enabled(editMode)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      runOnJS(setDragging)(true);
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      runOnJS(commitDrop)(translateX.value, translateY.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return (
    <>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.container, { top: origin.y, left: origin.x }, animatedStyle]}
          onLayout={handleLayout}
        >
          <View
            style={[
              styles.group,
              { backgroundColor: colors.card },
              isVerticalAnchor(anchor) ? styles.groupVertical : styles.groupHorizontal,
              editMode && [styles.groupEditing, { borderColor: colors.primary }],
            ]}
          >
            {children}
          </View>
        </Animated.View>
      </GestureDetector>
      {editMode && dragging && bounds.width > 0 && size.width > 0 && (
        <AnchorTargets bounds={bounds} size={size} current={anchor} activeColor={colors.primary} />
      )}
    </>
  );
}

function AnchorTargets({
  bounds,
  size,
  current,
  activeColor,
}: {
  bounds: Size;
  size: Size;
  current: Anchor;
  activeColor: string;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ALL_ANCHORS.map((candidate) => {
        const target = getAnchorOrigin(candidate, bounds, size, MARGIN);
        return (
          <View
            key={candidate}
            style={[
              styles.targetDot,
              {
                left: target.x + size.width / 2 - 8,
                top: target.y + size.height / 2 - 8,
              },
              candidate === current && { backgroundColor: activeColor },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  group: {
    borderRadius: 16,
    padding: 6,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  groupHorizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxWidth: MAX_HORIZONTAL_WIDTH,
    justifyContent: 'center',
  },
  groupVertical: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  groupEditing: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  targetDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(76,139,245,0.35)',
  },
});
