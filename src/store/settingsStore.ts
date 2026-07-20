import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SearchEngineKey = 'google' | 'bing' | 'yahoo' | 'duckduckgo';
export type ThemePreference = 'system' | 'light' | 'dark';

export const SEARCH_ENGINES: {
  key: SearchEngineKey;
  label: string;
  searchUrl: (query: string) => string;
}[] = [
  { key: 'google', label: 'Google', searchUrl: (q) => `https://www.google.com/search?q=${q}` },
  { key: 'bing', label: 'Bing', searchUrl: (q) => `https://www.bing.com/search?q=${q}` },
  { key: 'yahoo', label: 'Yahoo!', searchUrl: (q) => `https://search.yahoo.co.jp/search?p=${q}` },
  { key: 'duckduckgo', label: 'DuckDuckGo', searchUrl: (q) => `https://duckduckgo.com/?q=${q}` },
];

type SettingsState = {
  searchEngine: SearchEngineKey;
  themePreference: ThemePreference;
  folderNameExclusions: string[];
  setSearchEngine: (engine: SearchEngineKey) => void;
  setThemePreference: (preference: ThemePreference) => void;
  addFolderNameExclusion: (text: string) => void;
  removeFolderNameExclusion: (text: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      searchEngine: 'google',
      themePreference: 'system',
      folderNameExclusions: [],
      setSearchEngine: (searchEngine) => set({ searchEngine }),
      setThemePreference: (themePreference) => set({ themePreference }),
      addFolderNameExclusion: (text) =>
        set((state) => {
          const trimmed = text.trim();
          if (!trimmed || state.folderNameExclusions.includes(trimmed)) {
            return state;
          }
          return { folderNameExclusions: [...state.folderNameExclusions, trimmed] };
        }),
      removeFolderNameExclusion: (text) =>
        set((state) => ({
          folderNameExclusions: state.folderNameExclusions.filter((entry) => entry !== text),
        })),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
