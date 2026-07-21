import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useLayoutStore } from '../../store/layoutStore';
import { useAppTheme } from '../../theme/theme';
import { useControlGroupRegistry, useDraggableBounds } from './DraggableLayoutArea';
import {
  anchorsByDistance,
  DEFAULT_ARRANGEMENT,
  getAnchorOrigin,
  rectsOverlap,
  resolveSemanticAnchor,
  type Anchor,
  type SemanticAnchor,
} from './anchors';

const MARGIN = 12;
const MAX_HORIZONTAL_WIDTH = 220;

type Size = { width: number; height: number };

type ControlGroupProps = {
  screenId: string;
  children: React.ReactNode;
  /**
   * 'buttons' (default) is a compact pill that can be arranged as a row or a
   * column. 'bar' is a full-width strip (address bar, tab bar) that only
   * supports repositioning, since a single bar has nothing to rearrange.
   */
  variant?: 'buttons' | 'bar';
  /** Compass position used the first time this screenId has no saved layout yet. */
  defaultAnchor?: SemanticAnchor;
  /** Fires whenever this group's rendered size changes (e.g. so a screen can reserve scroll-content space for it). */
  onMeasured?: (size: Size) => void;
};

export function ControlGroup({
  screenId,
  children,
  variant = 'buttons',
  defaultAnchor = 'bottomRight',
  onMeasured,
}: ControlGroupProps) {
  const { colors } = useAppTheme();
  const editMode = useLayoutStore((state) => state.editMode);
  const storedLayout = useLayoutStore((state) => state.layouts[screenId]);
  const setAnchor = useLayoutStore((state) => state.setAnchor);
  const setArrangement = useLayoutStore((state) => state.setArrangement);
  const bounds = useDraggableBounds();
  const registry = useControlGroupRegistry();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);

  const isBar = variant === 'bar';
  const barWidth = bounds.width > 0 ? Math.max(bounds.width - MARGIN * 2, 0) : size.width;
  const effectiveSize = isBar ? { width: barWidth, height: size.height } : size;
  const arrangement = storedLayout?.arrangement ?? DEFAULT_ARRANGEMENT;
  const anchor =
    storedLayout?.anchor ?? resolveSemanticAnchor(defaultAnchor, bounds, effectiveSize, MARGIN);

  const origin = getAnchorOrigin(anchor, bounds, effectiveSize, MARGIN);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
    onMeasured?.({ width, height });
  };

  useEffect(() => {
    if (bounds.width === 0 || effectiveSize.width === 0) {
      return;
    }
    registry.register(screenId, {
      x: origin.x,
      y: origin.y,
      width: effectiveSize.width,
      height: effectiveSize.height,
    });
    return () => registry.unregister(screenId);
  }, [
    registry,
    screenId,
    origin.x,
    origin.y,
    effectiveSize.width,
    effectiveSize.height,
    bounds.width,
  ]);

  const commitDrop = (dx: number, dy: number) => {
    setDragging(false);
    translateX.value = 0;
    translateY.value = 0;
    if (bounds.width === 0 || bounds.height === 0 || effectiveSize.width === 0) {
      return;
    }
    const target = {
      x: origin.x + effectiveSize.width / 2 + dx,
      y: origin.y + effectiveSize.height / 2 + dy,
    };
    const candidates = anchorsByDistance(target, bounds, effectiveSize, MARGIN);
    const others = registry.getOthers(screenId);
    const nonOverlapping = candidates.find((candidate) => {
      const candidateOrigin = getAnchorOrigin(candidate, bounds, effectiveSize, MARGIN);
      const rect = {
        x: candidateOrigin.x,
        y: candidateOrigin.y,
        width: effectiveSize.width,
        height: effectiveSize.height,
      };
      return !others.some((other) => rectsOverlap(rect, other));
    });
    setAnchor(screenId, nonOverlapping ?? candidates[0]);
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
          style={[
            styles.container,
            { top: origin.y, left: origin.x },
            isBar && { width: barWidth },
            animatedStyle,
          ]}
          onLayout={handleLayout}
        >
          <View
            pointerEvents={editMode ? 'none' : 'auto'}
            style={[
              isBar ? styles.groupBar : styles.group,
              !isBar && { backgroundColor: colors.card },
              !isBar &&
                (arrangement === 'vertical' ? styles.groupVertical : styles.groupHorizontal),
              editMode && [styles.groupEditing, { borderColor: colors.primary }],
            ]}
          >
            {children}
          </View>
          {editMode && !isBar && (
            <TouchableOpacity
              style={[styles.arrangeButton, { backgroundColor: colors.primary }]}
              onPress={() =>
                setArrangement(screenId, arrangement === 'horizontal' ? 'vertical' : 'horizontal')
              }
              accessibilityLabel="toggle-arrangement"
              hitSlop={6}
            >
              <Ionicons
                name={arrangement === 'horizontal' ? 'swap-horizontal' : 'swap-vertical'}
                size={14}
                color="#fff"
              />
            </TouchableOpacity>
          )}
        </Animated.View>
      </GestureDetector>
      {editMode && dragging && bounds.width > 0 && effectiveSize.width > 0 && (
        <View style={styles.anchorTargetsLayer} pointerEvents="none">
          <AnchorTargets
            bounds={bounds}
            size={effectiveSize}
            current={anchor}
            activeColor={colors.primary}
          />
        </View>
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
      {Array.from({ length: 32 }, (_, index) => {
        const target = getAnchorOrigin(index, bounds, size, MARGIN);
        return (
          <View
            key={index}
            style={[
              styles.targetDot,
              {
                left: target.x + size.width / 2 - 5,
                top: target.y + size.height / 2 - 5,
              },
              index === current && { backgroundColor: activeColor },
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
    // Must stay above DraggableLayoutArea's dim overlay (zIndex 500) so the
    // group remains visible and draggable while the background is dimmed.
    zIndex: 600,
    elevation: 600,
  },
  anchorTargetsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 600,
    elevation: 600,
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
  groupBar: {
    width: '100%',
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
  arrangeButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 5,
  },
  targetDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(76,139,245,0.35)',
  },
});
