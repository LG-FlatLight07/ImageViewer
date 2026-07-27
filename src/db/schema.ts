import { Directory } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

const SCHEMA_VERSION = 9;

type Migration = string | ((db: SQLiteDatabase) => Promise<void>);

const MIGRATIONS: Record<number, Migration> = {
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
  5: `
    CREATE TABLE IF NOT EXISTS feedback_messages (
      id TEXT PRIMARY KEY NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `,
  6: `
    CREATE TABLE IF NOT EXISTS download_history (
      folder_id TEXT PRIMARY KEY NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      page_url TEXT NOT NULL,
      page_title TEXT NOT NULL,
      first_image_uri TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_download_history_page_url ON download_history(page_url);
  `,
  7: `
    -- Ranking's data must be able to outlive the local folder it came from
    -- (deleting a downloaded folder shouldn't erase its ranking contribution)
    -- and, longer-term, move to a server shared across all app users — so it
    -- is its own append-only table with no foreign key to folders at all,
    -- rather than being derived from folders/download_history at query time.
    CREATE TABLE IF NOT EXISTS ranking_stats (
      id TEXT PRIMARY KEY NOT NULL,
      page_url TEXT NOT NULL,
      page_title TEXT NOT NULL,
      thumbnail_uri TEXT,
      image_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ranking_stats_page_url ON ranking_stats(page_url);
    CREATE INDEX IF NOT EXISTS idx_ranking_stats_created_at ON ranking_stats(created_at);

    -- One-time backfill so existing downloads don't vanish from the ranking
    -- just because this table didn't exist yet when they were downloaded.
    INSERT INTO ranking_stats (id, page_url, page_title, thumbnail_uri, image_count, created_at)
    SELECT lower(hex(randomblob(16))),
           COALESCE(dh.page_url, f.source_url),
           COALESCE(dh.page_title, f.name),
           dh.first_image_uri,
           f.image_count,
           f.created_at
    FROM folders f
    LEFT JOIN download_history dh ON dh.folder_id = f.id
    WHERE COALESCE(dh.page_url, f.source_url) IS NOT NULL
      AND COALESCE(dh.page_url, f.source_url) != '';
  `,
  8: `
    -- The global (all-users) ranking now lives on the server and only ever
    -- gives us a URL — never an image, since we deliberately don't upload
    -- thumbnails anywhere (cost + copyright risk). Each device instead
    -- resolves its own thumbnail by briefly loading the page in a hidden
    -- WebView and reusing the same first-image detection as the download
    -- flow, then caches the result here so it only has to do that once.
    CREATE TABLE IF NOT EXISTS ranking_thumbnail_cache (
      url_key TEXT PRIMARY KEY NOT NULL,
      image_url TEXT,
      cached_at INTEGER NOT NULL
    );
  `,
  9: async (db) => {
    // `PRAGMA foreign_keys` was never enabled before this migration (see
    // migrateDbIfNeeded below), so every `ON DELETE CASCADE` above was
    // silently a no-op: deleting a folder never actually removed its
    // subfolders, their folder_tags, or their download_history rows —
    // they lingered as orphans that still matched name/tag search. This is
    // a one-time cleanup of whatever that bug already left behind: find
    // every folder whose ancestor chain is broken (points, directly or
    // transitively, at a parent_id that no longer exists), delete its
    // on-disk files (if any — DB rows can't be queried for this once the
    // rows themselves are gone), then remove the rows and prune any tag
    // left with zero folders.
    const orphans = await db.getAllAsync<{ id: string; dir_path: string | null }>(`
      WITH RECURSIVE orphans(id) AS (
        SELECT id FROM folders WHERE parent_id IS NOT NULL
          AND parent_id NOT IN (SELECT id FROM folders)
        UNION
        SELECT f.id FROM folders f JOIN orphans o ON f.parent_id = o.id
      )
      SELECT f.id, f.dir_path FROM folders f JOIN orphans o ON o.id = f.id
    `);
    for (const orphan of orphans) {
      if (!orphan.dir_path) {
        continue;
      }
      try {
        const directory = new Directory(orphan.dir_path);
        if (directory.exists) {
          directory.delete();
        }
      } catch {
        // best-effort cleanup, matching deleteFolderFiles()'s own handling
      }
    }
    if (orphans.length > 0) {
      const placeholders = orphans.map(() => '?').join(',');
      const ids = orphans.map((orphan) => orphan.id);
      await db.runAsync(`DELETE FROM folder_tags WHERE folder_id IN (${placeholders})`, ids);
      await db.runAsync(`DELETE FROM download_history WHERE folder_id IN (${placeholders})`, ids);
      await db.runAsync(`DELETE FROM folders WHERE id IN (${placeholders})`, ids);
    }
    await db.runAsync('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM folder_tags)');
  },
};

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  // `foreign_keys` is a per-connection setting SQLite never persists to the
  // database file, so it must be re-enabled on every app launch — without
  // it, every `ON DELETE CASCADE` above (folders.parent_id, folder_tags,
  // download_history) is silently ignored.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  while (currentVersion < SCHEMA_VERSION) {
    const nextVersion = currentVersion + 1;
    const migration = MIGRATIONS[nextVersion];
    if (typeof migration === 'function') {
      await migration(db);
    } else {
      await db.execAsync(migration);
    }
    await db.execAsync(`PRAGMA user_version = ${nextVersion}`);
    currentVersion = nextVersion;
  }
}
