import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import type { Folder, FolderSortKey, FolderWithTags, Tag } from './types';

type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  dir_path: string | null;
  source_url: string | null;
  created_at: number;
};

type TagRow = {
  id: string;
  name: string;
};

function mapFolderRow(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    dirPath: row.dir_path,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
  };
}

async function attachTags(db: SQLiteDatabase, folders: Folder[]): Promise<FolderWithTags[]> {
  if (folders.length === 0) {
    return [];
  }
  const placeholders = folders.map(() => '?').join(',');
  const rows = await db.getAllAsync<TagRow & { folder_id: string }>(
    `SELECT ft.folder_id as folder_id, t.id as id, t.name as name
     FROM folder_tags ft
     JOIN tags t ON t.id = ft.tag_id
     WHERE ft.folder_id IN (${placeholders})
     ORDER BY t.name COLLATE NOCASE ASC`,
    folders.map((f) => f.id),
  );
  const tagsByFolderId = new Map<string, Tag[]>();
  for (const row of rows) {
    const list = tagsByFolderId.get(row.folder_id) ?? [];
    list.push({ id: row.id, name: row.name });
    tagsByFolderId.set(row.folder_id, list);
  }
  return folders.map((folder) => ({ ...folder, tags: tagsByFolderId.get(folder.id) ?? [] }));
}

export async function createFolder(
  db: SQLiteDatabase,
  input: {
    name: string;
    parentId: string | null;
    dirPath: string | null;
    sourceUrl?: string | null;
  },
): Promise<Folder> {
  const id = Crypto.randomUUID();
  const createdAt = Date.now();
  await db.runAsync(
    'INSERT INTO folders (id, name, parent_id, dir_path, source_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    input.name,
    input.parentId,
    input.dirPath,
    input.sourceUrl ?? null,
    createdAt,
  );
  return {
    id,
    name: input.name,
    parentId: input.parentId,
    dirPath: input.dirPath,
    sourceUrl: input.sourceUrl ?? null,
    createdAt,
  };
}

export async function listFolders(
  db: SQLiteDatabase,
  options: { parentId: string | null; sortKey: FolderSortKey; searchQuery?: string },
): Promise<FolderWithTags[]> {
  const search = options.searchQuery?.trim() ?? '';
  const searchPattern = `%${search}%`;

  let orderByClause: string;
  let selectExtra = '';
  let joinExtra = '';
  if (options.sortKey === 'tagName') {
    selectExtra =
      ', (SELECT MIN(t.name) FROM folder_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.folder_id = f.id) as min_tag_name';
    orderByClause =
      'ORDER BY (min_tag_name IS NULL) ASC, min_tag_name COLLATE NOCASE ASC, f.name COLLATE NOCASE ASC';
  } else if (options.sortKey === 'createdAt') {
    orderByClause = 'ORDER BY f.created_at DESC';
  } else {
    orderByClause = 'ORDER BY f.name COLLATE NOCASE ASC';
  }

  const rows = await db.getAllAsync<FolderRow>(
    `SELECT f.* ${selectExtra}
     FROM folders f ${joinExtra}
     WHERE f.parent_id IS ?
       AND (? = '' OR f.name LIKE ? OR EXISTS (
         SELECT 1 FROM folder_tags ft2 JOIN tags t2 ON t2.id = ft2.tag_id
         WHERE ft2.folder_id = f.id AND t2.name LIKE ?
       ))
     ${orderByClause}`,
    options.parentId,
    search,
    searchPattern,
    searchPattern,
  );

  return attachTags(db, rows.map(mapFolderRow));
}

export async function getFolder(db: SQLiteDatabase, id: string): Promise<FolderWithTags | null> {
  const row = await db.getFirstAsync<FolderRow>('SELECT * FROM folders WHERE id = ?', id);
  if (!row) {
    return null;
  }
  const [withTags] = await attachTags(db, [mapFolderRow(row)]);
  return withTags;
}

export async function getFolderAncestors(db: SQLiteDatabase, id: string): Promise<Folder[]> {
  const ancestors: Folder[] = [];
  let currentId: string | null = id;
  while (currentId) {
    const row: FolderRow | null = await db.getFirstAsync<FolderRow>(
      'SELECT * FROM folders WHERE id = ?',
      currentId,
    );
    if (!row) {
      break;
    }
    const folder = mapFolderRow(row);
    ancestors.unshift(folder);
    currentId = folder.parentId;
  }
  return ancestors;
}

export async function setFolderTags(
  db: SQLiteDatabase,
  folderId: string,
  tagNames: string[],
): Promise<void> {
  const normalized = Array.from(
    new Set(tagNames.map((name) => name.trim()).filter((name) => name.length > 0)),
  );

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM folder_tags WHERE folder_id = ?', folderId);
    for (const name of normalized) {
      let tag = await db.getFirstAsync<TagRow>('SELECT * FROM tags WHERE name = ?', name);
      if (!tag) {
        const tagId = Crypto.randomUUID();
        await db.runAsync('INSERT INTO tags (id, name) VALUES (?, ?)', tagId, name);
        tag = { id: tagId, name };
      }
      await db.runAsync(
        'INSERT OR IGNORE INTO folder_tags (folder_id, tag_id) VALUES (?, ?)',
        folderId,
        tag.id,
      );
    }
  });
}

export async function moveFolder(
  db: SQLiteDatabase,
  folderId: string,
  newParentId: string | null,
): Promise<void> {
  await db.runAsync('UPDATE folders SET parent_id = ? WHERE id = ?', newParentId, folderId);
}

export async function getFolderName(db: SQLiteDatabase, id: string | null): Promise<string> {
  if (id === null) {
    return 'すべてのフォルダ';
  }
  const row = await db.getFirstAsync<FolderRow>('SELECT * FROM folders WHERE id = ?', id);
  return row ? row.name : 'すべてのフォルダ';
}

export async function listAllTagNames(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<TagRow>('SELECT * FROM tags ORDER BY name COLLATE NOCASE ASC');
  return rows.map((r) => r.name);
}
