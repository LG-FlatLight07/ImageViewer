import type { SQLiteDatabase } from 'expo-sqlite';

export type DownloadHistoryEntry = {
  folderId: string;
  pageUrl: string;
  pageTitle: string;
  firstImageUri: string | null;
  createdAt: number;
};

type DownloadHistoryRow = {
  folder_id: string;
  page_url: string;
  page_title: string;
  first_image_uri: string | null;
  created_at: number;
};

function mapRow(row: DownloadHistoryRow): DownloadHistoryEntry {
  return {
    folderId: row.folder_id,
    pageUrl: row.page_url,
    pageTitle: row.page_title,
    firstImageUri: row.first_image_uri,
    createdAt: row.created_at,
  };
}

/**
 * Records the authoritative download-time facts for a folder: the exact page
 * URL and (pre-exclusion-word) title that were used to download its images,
 * plus the first image for use as a thumbnail. This is the single writer for
 * this data, called once per download, so Ranking and folder-row URL-jump
 * can both read through it instead of re-deriving these values elsewhere.
 */
export async function recordDownloadHistory(
  db: SQLiteDatabase,
  entry: { folderId: string; pageUrl: string; pageTitle: string; firstImageUri: string | null },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO download_history (folder_id, page_url, page_title, first_image_uri, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(folder_id) DO UPDATE SET
       page_url = excluded.page_url,
       page_title = excluded.page_title,
       first_image_uri = excluded.first_image_uri,
       created_at = excluded.created_at`,
    entry.folderId,
    entry.pageUrl,
    entry.pageTitle,
    entry.firstImageUri,
    Date.now(),
  );
}

export async function getDownloadHistory(
  db: SQLiteDatabase,
  folderId: string,
): Promise<DownloadHistoryEntry | null> {
  const row = await db.getFirstAsync<DownloadHistoryRow>(
    'SELECT * FROM download_history WHERE folder_id = ?',
    folderId,
  );
  return row ? mapRow(row) : null;
}
