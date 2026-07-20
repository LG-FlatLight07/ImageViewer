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
  setSearchEngine: (engine: SearchEngineKey) => void;
  setThemePreference: (preference: ThemePreference) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      searchEngine: 'google',
      themePreference: 'system',
      setSearchEngine: (searchEngine) => set({ searchEngine }),
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
