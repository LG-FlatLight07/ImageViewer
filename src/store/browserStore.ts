import { create } from 'zustand';

export const DEFAULT_URL = 'https://www.google.com';

type BrowserState = {
  url: string;
  inputValue: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  setUrl: (url: string) => void;
  setInputValue: (value: string) => void;
  setNavigationState: (state: { canGoBack: boolean; canGoForward: boolean }) => void;
  setLoading: (loading: boolean) => void;
};

export const useBrowserStore = create<BrowserState>((set) => ({
  url: DEFAULT_URL,
  inputValue: DEFAULT_URL,
  canGoBack: false,
  canGoForward: false,
  loading: false,
  setUrl: (url) => set({ url, inputValue: url }),
  setInputValue: (inputValue) => set({ inputValue }),
  setNavigationState: ({ canGoBack, canGoForward }) => set({ canGoBack, canGoForward }),
  setLoading: (loading) => set({ loading }),
}));
