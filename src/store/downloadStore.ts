import { create } from 'zustand';

type DownloadState = {
  active: boolean;
  completed: number;
  total: number;
  toast: string | null;
  start: (total: number) => void;
  updateProgress: (completed: number, total: number) => void;
  finish: (message: string) => void;
  dismissToast: () => void;
};

export const useDownloadStore = create<DownloadState>((set) => ({
  active: false,
  completed: 0,
  total: 0,
  toast: null,
  start: (total) => set({ active: true, completed: 0, total }),
  updateProgress: (completed, total) => set({ completed, total }),
  finish: (message) => set({ active: false, toast: message }),
  dismissToast: () => set({ toast: null }),
}));
