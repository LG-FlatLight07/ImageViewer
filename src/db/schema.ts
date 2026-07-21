import type { SQLiteDatabase } from 'expo-sqlite';

const SCHEMA_VERSION = 4;

const MIGRATIONS: Record<number, string> = {
  1: `
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      dir_path TEXT,
      source_url TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS folder_tags (
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (folder_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
    CREATE INDEX IF NOT EXISTS idx_folder_tags_folder_id ON folder_tags(folder_id);
    CREATE INDEX IF NOT EXISTS idx_folder_tags_tag_id ON folder_tags(tag_id);
  `,
  2: `
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      visited_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY NOT NULL,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_history_visited_at ON history(visited_at);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
  `,
  3: `
    ALTER TABLE folders ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
  `,
  4: `
    ALTER TABLE folders ADD COLUMN image_count INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_folders_source_url ON folders(source_url);
  `,
};

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  while (currentVersion < SCHEMA_VERSION) {
    const nextVersion = currentVersion + 1;
    await db.execAsync(MIGRATIONS[nextVersion]);
    await db.execAsync(`PRAGMA user_version = ${nextVersion}`);
    currentVersion = nextVersion;
  }
}
