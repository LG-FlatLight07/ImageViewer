import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Anchor, Arrangement } from '../components/layout/anchors';

export type ScreenLayout = {
  anchor?: Anchor;
  arrangement?: Arrangement;
  /** Set only by a genuine user drag (setAnchor), never by automatic relocation — used to break ties in the stacking system ("the more recently moved UI wins"). */
  movedAt?: number;
};

type LayoutState = {
  editMode: boolean;
  layouts: Record<string, ScreenLayout>;
  setEditMode: (editMode: boolean) => void;
  setAnchor: (screenId: string, anchor: Anchor) => void;
  /** Same as setAnchor but doesn't stamp movedAt — used by automatic overlap avoidance so it never outranks a real user drag. */
  relocateAnchor: (screenId: string, anchor: Anchor) => void;
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
            [screenId]: { ...state.layouts[screenId], anchor, movedAt: Date.now() },
          },
        })),
      relocateAnchor: (screenId, anchor) =>
        set((state) => ({
          layouts: { ...state.layouts, [screenId]: { ...state.layouts[screenId], anchor } },
        })),
      setArrangement: (screenId, arrangement) =>
        set((state) => ({
          layouts: { ...state.layouts, [screenId]: { ...state.layouts[screenId], arrangement } },
        })),
      resetAll: () => set({ layouts: {} }),
    }),
    {
      name: 'layout-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ layouts: state.layouts }),
      // Bumped because the previous version's Anchor was a named 8-point
      // literal; the new 32-point numeric perimeter index is incompatible,
      // so old data is discarded rather than migrated.
      version: 3,
      migrate: () => ({ layouts: {} }),
    },
  ),
);

export type { Anchor, Arrangement };
