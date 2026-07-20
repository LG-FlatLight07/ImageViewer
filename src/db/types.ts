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
};

export type FolderWithTags = Folder & {
  tags: Tag[];
};

export type FolderSortKey = 'name' | 'createdAt' | 'tagName';
