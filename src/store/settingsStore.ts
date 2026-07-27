import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SearchEngineKey = 'google' | 'bing' | 'yahoo' | 'duckduckgo';
export type ThemePreference = 'system' | 'light' | 'dark';
export type ImageViewerDirection = 'horizontal' | 'vertical';
/** Which page opens on app launch: the built-in top page, the tab that was active when the app was last closed, or a fixed URL. */
export type StartupPageMode = 'topPage' | 'lastTab' | 'custom';

export const SEARCH_ENGINES: {
  key: SearchEngineKey;
  label: string;
  homeUrl: string;
  searchUrl: (query: string) => string;
}[] = [
  {
    key: 'google',
    label: 'Google',
    homeUrl: 'https://www.google.com',
    searchUrl: (q) => `https://www.google.com/search?q=${q}`,
  },
  {
    key: 'bing',
    label: 'Bing',
    homeUrl: 'https://www.bing.com',
    searchUrl: (q) => `https://www.bing.com/search?q=${q}`,
  },
  {
    key: 'yahoo',
    label: 'Yahoo!',
    homeUrl: 'https://www.yahoo.co.jp',
    searchUrl: (q) => `https://search.yahoo.co.jp/search?p=${q}`,
  },
  {
    key: 'duckduckgo',
    label: 'DuckDuckGo',
    homeUrl: 'https://duckduckgo.com',
    searchUrl: (q) => `https://duckduckgo.com/?q=${q}`,
  },
];

type SettingsState = {
  searchEngine: SearchEngineKey;
  themePreference: ThemePreference;
  folderNameExclusions: string[];
  disableHistory: boolean;
  imageViewerDirection: ImageViewerDirection;
  adBlockEnabled: boolean;
  autoSelectSequentialImages: boolean;
  skipDeleteConfirmation: boolean;
  startupPageMode: StartupPageMode;
  /** Only used when startupPageMode === 'custom'. */
  startupPageUrl: string;
  setSearchEngine: (engine: SearchEngineKey) => void;
  setThemePreference: (preference: ThemePreference) => void;
  addFolderNameExclusion: (text: string) => void;
  removeFolderNameExclusion: (text: string) => void;
  setDisableHistory: (disableHistory: boolean) => void;
  setImageViewerDirection: (direction: ImageViewerDirection) => void;
  setAdBlockEnabled: (enabled: boolean) => void;
  setAutoSelectSequentialImages: (enabled: boolean) => void;
  setSkipDeleteConfirmation: (skip: boolean) => void;
  setStartupPageMode: (mode: StartupPageMode) => void;
  setStartupPageUrl: (url: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      searchEngine: 'google',
      themePreference: 'system',
      folderNameExclusions: [],
      disableHistory: false,
      imageViewerDirection: 'horizontal',
      adBlockEnabled: false,
      autoSelectSequentialImages: true,
      skipDeleteConfirmation: false,
      startupPageMode: 'topPage',
      startupPageUrl: '',
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
      setDisableHistory: (disableHistory) => set({ disableHistory }),
      setImageViewerDirection: (imageViewerDirection) => set({ imageViewerDirection }),
      setAdBlockEnabled: (adBlockEnabled) => set({ adBlockEnabled }),
      setAutoSelectSequentialImages: (autoSelectSequentialImages) =>
        set({ autoSelectSequentialImages }),
      setSkipDeleteConfirmation: (skipDeleteConfirmation) => set({ skipDeleteConfirmation }),
      setStartupPageMode: (startupPageMode) => set({ startupPageMode }),
      setStartupPageUrl: (startupPageUrl) => set({ startupPageUrl }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
