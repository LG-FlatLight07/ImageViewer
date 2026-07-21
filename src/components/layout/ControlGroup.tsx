import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useLayoutStore } from '../../store/layoutStore';
import { useAppTheme } from '../../theme/theme';
import {
  useControlGroupRegistry,
  useDraggableBounds,
  useRegistryVersion,
} from './DraggableLayoutArea';
import {
  anchorsByDistance,
  clampToEdgeAnchor,
  DEFAULT_ARRANGEMENT,
  EDGE_BOTTOM_ANCHOR,
  EDGE_TOP_ANCHOR,
  getAnchorOrigin,
  rectsOverlap,
  resolveSemanticAnchor,
  type Anchor,
  type SemanticAnchor,
} from './anchors';

/** Edge inset for a full-width 'bar' group. */
export const BAR_MARGIN = 12;
/** Edge inset for a compact 'buttons' group — smaller so it hugs the screen corner. */
const BUTTONS_MARGIN = 6;
const STACK_GAP = 6;
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
  /**
   * Restricts a 'bar' variant to only the extreme top or extreme bottom edge
   * (no intermediate positions). Meaningless for 'buttons' groups.
   */
  edgesOnly?: boolean;
  /**
   * screenId of one other `edgesOnly` group to coordinate with: when both
   * resolve to the same edge, the less-recently-moved one stacks flush
   * against the other instead of overlapping it. Requires edgesOnly.
   */
  stackPeerId?: string;
  /** Fires whenever this group's rendered size changes (e.g. so a screen can reserve scroll-content space for it). */
  onMeasured?: (size: Size) => void;
};

export function ControlGroup({
  screenId,
  children,
  variant = 'buttons',
  defaultAnchor = 'bottomRight',
  edgesOnly = false,
  stackPeerId,
  onMeasured,
}: ControlGroupProps) {
  const { colors } = useAppTheme();
  const editMode = useLayoutStore((state) => state.editMode);
  const storedLayout = useLayoutStore((state) => state.layouts[screenId]);
  const peerLayout = useLayoutStore((state) =>
    stackPeerId ? state.layouts[stackPeerId] : undefined,
  );
  const setAnchor = useLayoutStore((state) => state.setAnchor);
  const relocateAnchor = useLayoutStore((state) => state.relocateAnchor);
  const setArrangement = useLayoutStore((state) => state.setArrangement);
  const bounds = useDraggableBounds();
  const registry = useControlGroupRegistry();
  const registryVersion = useRegistryVersion();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);

  const isBar = variant === 'bar';
  const EDGE_MARGIN = isBar ? BAR_MARGIN : BUTTONS_MARGIN;
  const barWidth = bounds.width > 0 ? Math.max(bounds.width - EDGE_MARGIN * 2, 0) : size.width;
  const effectiveSize = isBar ? { width: barWidth, height: size.height } : size;
  const effectiveWidth = effectiveSize.width;
  const effectiveHeight = effectiveSize.height;
  const arrangement = storedLayout?.arrangement ?? DEFAULT_ARRANGEMENT;
  const rawAnchor =
    storedLayout?.anchor ??
    resolveSemanticAnchor(defaultAnchor, bounds, effectiveSize, EDGE_MARGIN);
  const anchor = edgesOnly ? clampToEdgeAnchor(rawAnchor) : rawAnchor;

  const origin = getAnchorOrigin(anchor, bounds, effectiveSize, EDGE_MARGIN);

  // If a stacking peer is configured and both of us resolve to the same
  // edge, the less-recently-moved group (older/undefined movedAt) stacks
  // flush against the other rather than sitting on top of it.
  let renderOrigin = origin;
  if (stackPeerId && edgesOnly) {
    const peerRect = registry.getRect(stackPeerId);
    const peerEdge = clampToEdgeAnchor(peerLayout?.anchor ?? EDGE_TOP_ANCHOR);
    const myMovedAt = storedLayout?.movedAt;
    const peerMovedAt = peerLayout?.movedAt;
    const iAmPrimary =
      myMovedAt !== undefined || peerMovedAt !== undefined
        ? (myMovedAt ?? 0) >= (peerMovedAt ?? 0)
        : screenId < stackPeerId;
    if (peerRect && peerEdge === anchor && !iAmPrimary) {
      renderOrigin =
        anchor === EDGE_TOP_ANCHOR
          ? { x: origin.x, y: peerRect.y + peerRect.height + STACK_GAP }
          : { x: origin.x, y: peerRect.y - STACK_GAP - effectiveSize.height };
    }
  }

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lastMeasuredRef = useRef<Size>({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    const height = Math.round(event.nativeEvent.layout.height);
    if (lastMeasuredRef.current.width === width && lastMeasuredRef.current.height === height) {
      return;
    }
    lastMeasuredRef.current = { width, height };
    setSize({ width, height });
    onMeasured?.({ width, height });
  };

  useEffect(() => {
    if (bounds.width === 0 || effectiveSize.width === 0) {
      return;
    }
    registry.register(screenId, {
      x: renderOrigin.x,
      y: renderOrigin.y,
      width: effectiveSize.width,
      height: effectiveSize.height,
      variant,
    });
    return () => registry.unregister(screenId);
  }, [
    registry,
    screenId,
    variant,
    renderOrigin.x,
    renderOrigin.y,
    effectiveSize.width,
    effectiveSize.height,
    bounds.width,
  ]);

  // If this (non-bar, non-stacking) group ends up overlapping a bar-variant
  // sibling — most commonly because the bar grew after we were placed, e.g.
  // tag suggestions expanding a search bar — relocate ourselves to the
  // nearest free anchor. Bars stay put (their position is deliberately
  // edge-locked); buttons groups are the ones expected to step out of the
  // way. `registryVersion` is unused directly but its presence in the
  // dependency array is what makes this re-check whenever ANY sibling's
  // registration changes, not just this group's own geometry. Groups using
  // `stackPeerId` coordinate via the stacking logic above instead.
  const lastAvoidKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      variant !== 'buttons' ||
      stackPeerId ||
      dragging ||
      bounds.width === 0 ||
      effectiveWidth === 0
    ) {
      return;
    }
    const size = { width: effectiveWidth, height: effectiveHeight };
    const rect = { x: origin.x, y: origin.y, ...size };
    const barOverlaps = registry
      .getOthers(screenId)
      .filter((other) => other.variant === 'bar' && rectsOverlap(rect, other));
    if (barOverlaps.length === 0) {
      lastAvoidKeyRef.current = null;
      return;
    }
    const key = `${anchor}:${barOverlaps.map((o) => `${o.x},${o.y},${o.width},${o.height}`).join('|')}`;
    if (lastAvoidKeyRef.current === key) {
      return;
    }
    lastAvoidKeyRef.current = key;
    const center = { x: origin.x + size.width / 2, y: origin.y + size.height / 2 };
    const others = registry.getOthers(screenId);
    const free = anchorsByDistance(center, bounds, size, EDGE_MARGIN)
      .filter((candidate) => candidate !== anchor)
      .find((candidate) => {
        const candidateOrigin = getAnchorOrigin(candidate, bounds, size, EDGE_MARGIN);
        const rect2 = { x: candidateOrigin.x, y: candidateOrigin.y, ...size };
        return !others.some((other) => rectsOverlap(rect2, other));
      });
    if (free !== undefined) {
      relocateAnchor(screenId, free);
    }
  }, [
    variant,
    stackPeerId,
    dragging,
    bounds,
    origin.x,
    origin.y,
    effectiveWidth,
    effectiveHeight,
    anchor,
    registry,
    registryVersion,
    screenId,
    relocateAnchor,
    EDGE_MARGIN,
  ]);

  const commitDrop = (dx: number, dy: number) => {
    setDragging(false);
    translateX.value = 0;
    translateY.value = 0;
    if (bounds.width === 0 || bounds.height === 0 || effectiveSize.width === 0) {
      return;
    }
    const target = {
      x: renderOrigin.x + effectiveSize.width / 2 + dx,
      y: renderOrigin.y + effectiveSize.height / 2 + dy,
    };
    const allCandidates = anchorsByDistance(target, bounds, effectiveSize, EDGE_MARGIN);
    const candidates = edgesOnly
      ? allCandidates.filter((a) => a === EDGE_TOP_ANCHOR || a === EDGE_BOTTOM_ANCHOR)
      : allCandidates;
    const others = registry.getOthers(screenId);
    const nonOverlapping = candidates.find((candidate) => {
      const candidateOrigin = getAnchorOrigin(candidate, bounds, effectiveSize, EDGE_MARGIN);
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
            { top: renderOrigin.y, left: renderOrigin.x },
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
            margin={EDGE_MARGIN}
            allowed={edgesOnly ? [EDGE_TOP_ANCHOR, EDGE_BOTTOM_ANCHOR] : undefined}
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
  margin,
  allowed,
}: {
  bounds: Size;
  size: Size;
  current: Anchor;
  activeColor: string;
  margin: number;
  allowed?: Anchor[];
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 32 }, (_, index) => index)
        .filter((index) => !allowed || allowed.includes(index))
        .map((index) => {
          const target = getAnchorOrigin(index, bounds, size, margin);
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
