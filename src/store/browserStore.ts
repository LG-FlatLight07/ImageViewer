import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { TOP_PAGE_URL } from '../services/topPage';

export type BrowserTab = {
  id: string;
  /** The URI passed to WebView's `source` prop — only changes on an explicit navigation (address bar submit, home url, jump-to-source). Not updated by in-page link clicks. */
  url: string;
  /** Address bar text — also the user's live edit buffer while typing, so it must NOT be treated as "the current page's URL". */
  inputValue: string;
  /** The actual page currently displayed, kept in sync from every `onNavigationStateChange` (including in-page/SPA navigation). This is the correct source for history/bookmarks/downloads. */
  currentUrl: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
};

let tabIdCounter = 0;

function createTab(url: string = TOP_PAGE_URL): BrowserTab {
  tabIdCounter += 1;
  return {
    id: `tab-${Date.now()}-${tabIdCounter}`,
    url,
    inputValue: url === TOP_PAGE_URL ? '' : url,
    currentUrl: url,
    title: '',
    canGoBack: false,
    canGoForward: false,
    loading: false,
  };
}

function updateTab(tabs: BrowserTab[], id: string, patch: Partial<BrowserTab>): BrowserTab[] {
  return tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab));
}

type BrowserState = {
  tabs: BrowserTab[];
  activeTabId: string;
  /** URL of whichever tab was last active, kept up to date continuously so the "前回のタブ" startup option can restore it after a full app restart (never the built-in top page). */
  lastActiveUrl: string | null;
  /** True once `applyStartupPage` has run (or been skipped as unnecessary) for this app launch. */
  startupPageApplied: boolean;
  openTab: (url?: string) => void;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  setUrl: (url: string) => void;
  setInputValue: (value: string) => void;
  setNavigationState: (state: {
    canGoBack: boolean;
    canGoForward: boolean;
    title: string;
    currentUrl: string;
  }) => void;
  setLoading: (loading: boolean) => void;
  recordLastActiveUrl: (url: string) => void;
  /**
   * The very first tab is created at module load time, before the
   * persisted settings (search engine / startup page mode) and this
   * store's own persisted `lastActiveUrl` have finished rehydrating, so it
   * always starts on the built-in top page. Call this once both have
   * rehydrated to swap the still-untouched initial tab over to the
   * configured startup page; it's a no-op once the user has navigated
   * anywhere.
   */
  applyStartupPage: (url: string) => void;
};

const initialTab = createTab();

export const useBrowserStore = create<BrowserState>()(
  persist(
    (set) => ({
      tabs: [initialTab],
      activeTabId: initialTab.id,
      lastActiveUrl: null,
      startupPageApplied: false,

      openTab: (url = TOP_PAGE_URL) => {
        const tab = createTab(url);
        set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
      },

      closeTab: (id) => {
        set((state) => {
          const remaining = state.tabs.filter((tab) => tab.id !== id);
          if (remaining.length === 0) {
            const fresh = createTab();
            return { tabs: [fresh], activeTabId: fresh.id };
          }
          if (state.activeTabId !== id) {
            return { tabs: remaining };
          }
          const closedIndex = state.tabs.findIndex((tab) => tab.id === id);
          const nextActive = remaining[Math.max(0, closedIndex - 1)] ?? remaining[0];
          return { tabs: remaining, activeTabId: nextActive.id };
        });
      },

      setActiveTabId: (activeTabId) => set({ activeTabId }),

      setUrl: (url) =>
        set((state) => ({
          tabs: updateTab(state.tabs, state.activeTabId, { url, inputValue: url, currentUrl: url }),
        })),

      setInputValue: (inputValue) =>
        set((state) => ({
          tabs: updateTab(state.tabs, state.activeTabId, { inputValue }),
        })),

      setNavigationState: ({ canGoBack, canGoForward, title, currentUrl }) =>
        set((state) => ({
          tabs: updateTab(state.tabs, state.activeTabId, {
            canGoBack,
            canGoForward,
            title,
            currentUrl,
          }),
        })),

      setLoading: (loading) =>
        set((state) => ({
          tabs: updateTab(state.tabs, state.activeTabId, { loading }),
        })),

      recordLastActiveUrl: (url) => set({ lastActiveUrl: url }),

      applyStartupPage: (url) =>
        set((state) => {
          if (state.startupPageApplied) {
            return state;
          }
          const isPristine =
            state.tabs.length === 1 &&
            state.tabs[0].url === TOP_PAGE_URL &&
            state.tabs[0].inputValue === '';
          if (!isPristine || url === TOP_PAGE_URL) {
            return { ...state, startupPageApplied: true };
          }
          return {
            startupPageApplied: true,
            tabs: updateTab(state.tabs, state.activeTabId, {
              url,
              inputValue: url,
              currentUrl: url,
            }),
          };
        }),
    }),
    {
      name: 'browser-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lastActiveUrl: state.lastActiveUrl }),
    },
  ),
);

export function useActiveBrowserTab(): BrowserTab {
  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
}
