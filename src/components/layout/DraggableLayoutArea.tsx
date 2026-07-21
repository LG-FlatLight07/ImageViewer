import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { useLayoutStore } from '../../store/layoutStore';
import type { Rect } from './anchors';

type Bounds = { width: number; height: number };

const BoundsContext = createContext<Bounds>({ width: 0, height: 0 });

export function useDraggableBounds(): Bounds {
  return useContext(BoundsContext);
}

type Registry = {
  register: (id: string, rect: Rect) => void;
  unregister: (id: string) => void;
  getOthers: (excludeId: string) => Rect[];
};

const RegistryContext = createContext<Registry | null>(null);

/** Lets sibling ControlGroups within the same DraggableLayoutArea see each other's current rects, to avoid docking on top of one another. */
export function useControlGroupRegistry(): Registry {
  const registry = useContext(RegistryContext);
  if (!registry) {
    throw new Error('useControlGroupRegistry must be used within a DraggableLayoutArea');
  }
  return registry;
}

export function DraggableLayoutArea({ children }: { children: React.ReactNode }) {
  const [bounds, setBounds] = useState<Bounds>({ width: 0, height: 0 });
  const editMode = useLayoutStore((state) => state.editMode);
  const rectsRef = useRef<Map<string, Rect>>(new Map());

  const registry = useMemo<Registry>(
    () => ({
      register: (id, rect) => {
        rectsRef.current.set(id, rect);
      },
      unregister: (id) => {
        rectsRef.current.delete(id);
      },
      getOthers: (excludeId) =>
        Array.from(rectsRef.current.entries())
          .filter(([id]) => id !== excludeId)
          .map(([, rect]) => rect),
    }),
    [],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBounds({ width, height });
  };

  return (
    <BoundsContext.Provider value={bounds}>
      <RegistryContext.Provider value={registry}>
        <View style={styles.fill} onLayout={handleLayout}>
          {children}
          {editMode && <View pointerEvents="auto" style={styles.dim} />}
        </View>
      </RegistryContext.Provider>
    </BoundsContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    // Must sit above plain screen content (WebView/FlatList) but below every
    // ControlGroup (see ControlGroup's container zIndex) — otherwise, since
    // this view is appended after `children` in the tree, it would paint on
    // top of the ControlGroups too and swallow their drag gesture.
    zIndex: 500,
    elevation: 500,
  },
});
