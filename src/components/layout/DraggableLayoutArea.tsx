import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { useLayoutStore } from '../../store/layoutStore';
import type { Rect } from './anchors';

type Bounds = { width: number; height: number };

const BoundsContext = createContext<Bounds>({ width: 0, height: 0 });

export function useDraggableBounds(): Bounds {
  return useContext(BoundsContext);
}

export type RegisteredRect = Rect & { variant: 'buttons' | 'bar' };
export type IdentifiedRect = RegisteredRect & { id: string };

type Registry = {
  register: (id: string, rect: RegisteredRect) => void;
  unregister: (id: string) => void;
  getOthers: (excludeId: string) => IdentifiedRect[];
  getRect: (id: string) => RegisteredRect | undefined;
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

const RegistryVersionContext = createContext(0);

/**
 * A number that increments every time any ControlGroup registers or
 * unregisters. A group whose own geometry hasn't changed can include this in
 * an effect's dependency array to react to a SIBLING's rect changing (e.g.
 * to re-check for a new overlap), which plain object/function identity from
 * `useControlGroupRegistry` can't signal since those stay stable references.
 */
export function useRegistryVersion(): number {
  return useContext(RegistryVersionContext);
}

export function DraggableLayoutArea({ children }: { children: React.ReactNode }) {
  const [bounds, setBounds] = useState<Bounds>({ width: 0, height: 0 });
  const [version, setVersion] = useState(0);
  const editMode = useLayoutStore((state) => state.editMode);
  const rectsRef = useRef<Map<string, RegisteredRect>>(new Map());

  const registry = useMemo<Registry>(
    () => ({
      register: (id, rect) => {
        rectsRef.current.set(id, rect);
        setVersion((v) => v + 1);
      },
      unregister: (id) => {
        rectsRef.current.delete(id);
        setVersion((v) => v + 1);
      },
      getOthers: (excludeId) =>
        Array.from(rectsRef.current.entries())
          .filter(([id]) => id !== excludeId)
          .map(([id, rect]) => ({ ...rect, id })),
      getRect: (id) => rectsRef.current.get(id),
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
        <RegistryVersionContext.Provider value={version}>
          <View style={styles.fill} onLayout={handleLayout}>
            {children}
            {editMode && <View pointerEvents="auto" style={styles.dim} />}
          </View>
        </RegistryVersionContext.Provider>
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
