import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import type { HistoryEntry } from './types';

type HistoryRow = {
  id: string;
  url: string;
  title: string;
  visited_at: number;
};

function mapRow(row: HistoryRow): HistoryEntry {
  return { id: row.id, url: row.url, title: row.title, visitedAt: row.visited_at };
}

export async function addHistoryEntry(
  db: SQLiteDatabase,
  entry: { url: string; title: string },
): Promise<void> {
  const last = await db.getFirstAsync<HistoryRow>(
    'SELECT * FROM history ORDER BY visited_at DESC LIMIT 1',
  );
  if (last && last.url === entry.url) {
    return;
  }
  await db.runAsync(
    'INSERT INTO history (id, url, title, visited_at) VALUES (?, ?, ?, ?)',
    Crypto.randomUUID(),
    entry.url,
    entry.title,
    Date.now(),
  );
}

export async function listHistory(
  db: SQLiteDatabase,
  options: { searchQuery?: string } = {},
): Promise<HistoryEntry[]> {
  const search = options.searchQuery?.trim() ?? '';
  const pattern = `%${search}%`;
  const rows = await db.getAllAsync<HistoryRow>(
    `SELECT * FROM history
     WHERE ? = '' OR title LIKE ? OR url LIKE ?
     ORDER BY visited_at DESC
     LIMIT 300`,
    search,
    pattern,
    pattern,
  );
  return rows.map(mapRow);
}

export async function deleteHistoryEntry(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM history WHERE id = ?', id);
}

export async function clearHistory(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM history');
}
