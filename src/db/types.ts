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
  /** Recorded once at download time (see downloadHistoryRepository.ts) — null for folders created without a download (e.g. manually, or pre-migration). */
  firstImageUri: string | null;
};

export type FolderWithTags = Folder & {
  tags: Tag[];
};

export type FolderSortKey = 'name' | 'createdAt' | 'tagName' | 'viewCount';
export type FolderSortDirection = 'asc' | 'desc';

/** The direction each sort key reads most naturally in when first selected. */
export const DEFAULT_SORT_DIRECTIONS: Record<FolderSortKey, FolderSortDirection> = {
  name: 'asc',
  createdAt: 'desc',
  tagName: 'asc',
  viewCount: 'desc',
};

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
