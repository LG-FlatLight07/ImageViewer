import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Anchor, Arrangement } from '../components/layout/anchors';
import { DEFAULT_ANCHOR, DEFAULT_ARRANGEMENT } from '../components/layout/anchors';

export type ScreenLayout = {
  anchor: Anchor;
  arrangement: Arrangement;
};

export const DEFAULT_LAYOUT: ScreenLayout = {
  anchor: DEFAULT_ANCHOR,
  arrangement: DEFAULT_ARRANGEMENT,
};

type LayoutState = {
  editMode: boolean;
  layouts: Record<string, ScreenLayout>;
  setEditMode: (editMode: boolean) => void;
  setAnchor: (screenId: string, anchor: Anchor) => void;
  setArrangement: (screenId: string, arrangement: Arrangement) => void;
  resetAll: () => void;
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      editMode: false,
      layouts: {},
      setEditMode: (editMode) => set({ editMode }),
      setAnchor: (screenId, anchor) =>
        set((state) => ({
          layouts: {
            ...state.layouts,
            [screenId]: { ...(state.layouts[screenId] ?? DEFAULT_LAYOUT), anchor },
          },
        })),
      setArrangement: (screenId, arrangement) =>
        set((state) => ({
          layouts: {
            ...state.layouts,
            [screenId]: { ...(state.layouts[screenId] ?? DEFAULT_LAYOUT), arrangement },
          },
        })),
      resetAll: () => set({ layouts: {} }),
    }),
    {
      name: 'layout-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ layouts: state.layouts }),
      // Bumped because the previous version persisted a single Anchor per screen
      // under the `anchors` key; that shape is incompatible with the current
      // {anchor, arrangement} model, so old data is discarded rather than migrated.
      version: 2,
      migrate: () => ({ layouts: {} }),
    },
  ),
);

export type { Anchor, Arrangement };
