import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import type { Bookmark } from './types';

type BookmarkRow = {
  id: string;
  url: string;
  title: string;
  created_at: number;
};

function mapRow(row: BookmarkRow): Bookmark {
  return { id: row.id, url: row.url, title: row.title, createdAt: row.created_at };
}

export async function isBookmarked(db: SQLiteDatabase, url: string): Promise<boolean> {
  const row = await db.getFirstAsync<BookmarkRow>('SELECT * FROM bookmarks WHERE url = ?', url);
  return row !== null;
}

export async function addBookmark(
  db: SQLiteDatabase,
  bookmark: { url: string; title: string },
): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO bookmarks (id, url, title, created_at) VALUES (?, ?, ?, ?)',
    Crypto.randomUUID(),
    bookmark.url,
    bookmark.title,
    Date.now(),
  );
}

export async function removeBookmarkByUrl(db: SQLiteDatabase, url: string): Promise<void> {
  await db.runAsync('DELETE FROM bookmarks WHERE url = ?', url);
}

export async function removeBookmark(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM bookmarks WHERE id = ?', id);
}

export async function renameBookmark(db: SQLiteDatabase, id: string, title: string): Promise<void> {
  await db.runAsync('UPDATE bookmarks SET title = ? WHERE id = ?', title, id);
}

export async function listBookmarks(
  db: SQLiteDatabase,
  options: { searchQuery?: string } = {},
): Promise<Bookmark[]> {
  const search = options.searchQuery?.trim() ?? '';
  const pattern = `%${search}%`;
  const rows = await db.getAllAsync<BookmarkRow>(
    `SELECT * FROM bookmarks
     WHERE ? = '' OR title LIKE ? OR url LIKE ?
     ORDER BY created_at DESC`,
    search,
    pattern,
    pattern,
  );
  return rows.map(mapRow);
}
