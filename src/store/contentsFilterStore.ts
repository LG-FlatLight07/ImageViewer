import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ContentsFilterState = {
  filters: string[];
  defaultFilter: string;
  save: (filter: string) => void;
  remove: (filter: string) => void;
  setDefault: (filter: string) => void;
};

export const useContentsFilterStore = create<ContentsFilterState>()(
  persist(
    (set) => ({
      filters: [],
      defaultFilter: '',
      save: (input) =>
        set((state) => {
          const filter = input.trim();
          return !filter || state.filters.includes(filter)
            ? state
            : { filters: [...state.filters, filter] };
        }),
      remove: (filter) =>
        set((state) => ({
          filters: state.filters.filter((item) => item !== filter),
          defaultFilter: state.defaultFilter === filter ? '' : state.defaultFilter,
        })),
      setDefault: (input) =>
        set((state) => {
          const filter = input.trim();
          return {
            defaultFilter: filter,
            filters:
              filter && !state.filters.includes(filter)
                ? [...state.filters, filter]
                : state.filters,
          };
        }),
    }),
    { name: 'contents-filter-store', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
