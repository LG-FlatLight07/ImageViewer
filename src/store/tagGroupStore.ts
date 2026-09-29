import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as Crypto from 'expo-crypto';

export type TagGroup = { id: string; name: string; tags: string[] };
type State = {
  groups: TagGroup[];
  save: (id: string | null, name: string, tags: string[]) => string | null;
  remove: (id: string) => void;
};
export const useTagGroupStore = create<State>()(
  persist(
    (set, get) => ({
      groups: [],
      save: (id, input, tags) => {
        const name = input.trim();
        if (
          !name ||
          ['すべて', '未分類'].includes(name) ||
          get().groups.some((g) => g.id !== id && g.name === name)
        )
          return null;
        const key = id ?? Crypto.randomUUID();
        const members = [...new Set(tags)];
        set((state) => ({
          groups: [
            ...state.groups.map((g) =>
              g.id === key
                ? { id: key, name, tags: members }
                : { ...g, tags: g.tags.filter((t) => !members.includes(t)) },
            ),
            ...(id ? [] : [{ id: key, name, tags: members }]),
          ],
        }));
        return key;
      },
      remove: (id) => set((state) => ({ groups: state.groups.filter((g) => g.id !== id) })),
    }),
    { name: 'gallery-tag-groups', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
