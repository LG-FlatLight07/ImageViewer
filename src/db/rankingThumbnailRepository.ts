import type { SQLiteDatabase } from 'expo-sqlite';

type ThumbnailCacheRow = {
  url_key: string;
  image_url: string | null;
};

/**
 * Returns a map covering every key in `urlKeys` that has already been
 * resolved (successfully or not — a cached `null` means "scanned, no image
 * found" and is intentionally not retried every time). Keys absent from the
 * returned map have never been scanned and should be queued.
 */
export async function getCachedThumbnails(
  db: SQLiteDatabase,
  urlKeys: string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (urlKeys.length === 0) {
    return result;
  }
  const placeholders = urlKeys.map(() => '?').join(',');
  const rows = await db.getAllAsync<ThumbnailCacheRow>(
    `SELECT url_key, image_url FROM ranking_thumbnail_cache WHERE url_key IN (${placeholders})`,
    urlKeys,
  );
  for (const row of rows) {
    result.set(row.url_key, row.image_url);
  }
  return result;
}

export async function setCachedThumbnail(
  db: SQLiteDatabase,
  urlKey: string,
  imageUrl: string | null,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO ranking_thumbnail_cache (url_key, image_url, cached_at)
     VALUES (?, ?, ?)
     ON CONFLICT(url_key) DO UPDATE SET
       image_url = excluded.image_url,
       cached_at = excluded.cached_at`,
    urlKey,
    imageUrl,
    Date.now(),
  );
}
