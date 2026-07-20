import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Anchor } from '../components/layout/anchors';
import { DEFAULT_ANCHOR } from '../components/layout/anchors';

type LayoutState = {
  editMode: boolean;
  anchors: Record<string, Anchor>;
  setEditMode: (editMode: boolean) => void;
  setAnchor: (screenId: string, anchor: Anchor) => void;
  resetAll: () => void;
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      editMode: false,
      anchors: {},
      setEditMode: (editMode) => set({ editMode }),
      setAnchor: (screenId, anchor) =>
        set((state) => ({ anchors: { ...state.anchors, [screenId]: anchor } })),
      resetAll: () => set({ anchors: {} }),
    }),
    {
      name: 'layout-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ anchors: state.anchors }),
      // Bumped because the previous version persisted per-control {x,y} positions
      // under the `positions` key; that shape is incompatible with the current
      // one-anchor-per-screen model, so old data is discarded rather than migrated.
      version: 1,
      migrate: (persisted, version) => {
        if (version < 1) {
          return { anchors: {} };
        }
        return persisted as { anchors: Record<string, Anchor> };
      },
    },
  ),
);

export { DEFAULT_ANCHOR };
export type { Anchor };
