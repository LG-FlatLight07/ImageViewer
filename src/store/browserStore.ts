import { create } from 'zustand';

export const DEFAULT_URL = 'https://www.google.com';

type BrowserState = {
  url: string;
  inputValue: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  setUrl: (url: string) => void;
  setInputValue: (value: string) => void;
  setNavigationState: (state: { canGoBack: boolean; canGoForward: boolean; title: string }) => void;
  setLoading: (loading: boolean) => void;
};

export const useBrowserStore = create<BrowserState>((set) => ({
  url: DEFAULT_URL,
  inputValue: DEFAULT_URL,
  title: '',
  canGoBack: false,
  canGoForward: false,
  loading: false,
  setUrl: (url) => set({ url, inputValue: url }),
  setInputValue: (inputValue) => set({ inputValue }),
  setNavigationState: ({ canGoBack, canGoForward, title }) =>
    set({ canGoBack, canGoForward, title }),
  setLoading: (loading) => set({ loading }),
}));
