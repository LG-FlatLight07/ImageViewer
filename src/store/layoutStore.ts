import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Position = { x: number; y: number };

type LayoutState = {
  editMode: boolean;
  positions: Record<string, Position>;
  setEditMode: (editMode: boolean) => void;
  setPosition: (key: string, position: Position) => void;
  resetAll: () => void;
};

export function layoutKey(screenId: string, controlId: string): string {
  return `${screenId}.${controlId}`;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      editMode: false,
      positions: {},
      setEditMode: (editMode) => set({ editMode }),
      setPosition: (key, position) =>
        set((state) => ({ positions: { ...state.positions, [key]: position } })),
      resetAll: () => set({ positions: {} }),
    }),
    {
      name: 'layout-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ positions: state.positions }),
    },
  ),
);
