import { create } from 'zustand';

export const DEFAULT_URL = 'https://www.google.com';

export type BrowserTab = {
  id: string;
  url: string;
  inputValue: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  privateMode: boolean;
};

let tabIdCounter = 0;

function createTab(url: string = DEFAULT_URL, privateMode = false): BrowserTab {
  tabIdCounter += 1;
  return {
    id: `tab-${Date.now()}-${tabIdCounter}`,
    url,
    inputValue: url,
    title: '',
    canGoBack: false,
    canGoForward: false,
    loading: false,
    privateMode,
  };
}

function updateTab(tabs: BrowserTab[], id: string, patch: Partial<BrowserTab>): BrowserTab[] {
  return tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab));
}

type BrowserState = {
  tabs: BrowserTab[];
  activeTabId: string;
  openTab: (url?: string, privateMode?: boolean) => void;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  setUrl: (url: string) => void;
  setInputValue: (value: string) => void;
  setNavigationState: (state: { canGoBack: boolean; canGoForward: boolean; title: string }) => void;
  setLoading: (loading: boolean) => void;
  setPrivateMode: (privateMode: boolean) => void;
};

const initialTab = createTab();

export const useBrowserStore = create<BrowserState>((set) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  openTab: (url = DEFAULT_URL, privateMode = false) => {
    const tab = createTab(url, privateMode);
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
      tabs: updateTab(state.tabs, state.activeTabId, { url, inputValue: url }),
    })),

  setInputValue: (inputValue) =>
    set((state) => ({
      tabs: updateTab(state.tabs, state.activeTabId, { inputValue }),
    })),

  setNavigationState: ({ canGoBack, canGoForward, title }) =>
    set((state) => ({
      tabs: updateTab(state.tabs, state.activeTabId, { canGoBack, canGoForward, title }),
    })),

  setLoading: (loading) =>
    set((state) => ({
      tabs: updateTab(state.tabs, state.activeTabId, { loading }),
    })),

  setPrivateMode: (privateMode) =>
    set((state) => ({
      tabs: updateTab(state.tabs, state.activeTabId, { privateMode }),
    })),
}));

export function useActiveBrowserTab(): BrowserTab {
  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
}
