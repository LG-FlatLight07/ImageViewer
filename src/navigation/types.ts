import type { DetectedImageGroup, DetectedImage } from '../services/imageGrouping';

export type RootStackParamList = {
  MainTabs: undefined;
  ImageSelection: {
    pageTitle: string;
    sourceUrl: string;
    primaryGroup: DetectedImageGroup | null;
    otherImages: DetectedImage[];
  };
  FolderPicker: { movingFolderId: string };
  AppGuide: undefined;
};

export type MainTabParamList = {
  Browser: undefined;
  Gallery: undefined;
  Ranking: undefined;
  Settings: undefined;
};

export type BrowserStackParamList = {
  BrowserHome: undefined;
  History: undefined;
  Bookmarks: undefined;
};

export type GalleryStackParamList = {
  FolderList: undefined;
  FolderDetail: { folderId: string };
  ImageViewer: { folderId: string; startIndex: number };
};
