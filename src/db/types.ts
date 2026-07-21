export type Tag = {
  id: string;
  name: string;
};

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  dirPath: string | null;
  sourceUrl: string | null;
  createdAt: number;
  viewCount: number;
  imageCount: number;
};

export type FolderWithTags = Folder & {
  tags: Tag[];
};

export type FolderSortKey = 'name' | 'createdAt' | 'tagName' | 'viewCount';

export type HistoryEntry = {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
};

export type Bookmark = {
  id: string;
  url: string;
  title: string;
  createdAt: number;
};
