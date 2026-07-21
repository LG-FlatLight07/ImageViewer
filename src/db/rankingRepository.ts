import type { SQLiteDatabase } from 'expo-sqlite';

export type RankingPeriod = 'day' | 'week' | 'all';

export type RankingEntry = {
  sourceUrl: string;
  /** The page title recorded at download time (most recent download for this URL). */
  displayName: string;
  /** First-image thumbnail cached at download time, when available. */
  thumbnailUri: string | null;
  /** dirPath of the most recent download — fallback thumbnail source for pre-migration folders with no cached thumbnailUri. */
  dirPath: string | null;
  totalImages: number;
  downloadCount: number;
  lastDownloadedAt: number;
};

const RANKING_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function periodCutoff(period: RankingPeriod): number | null {
  if (period === 'day') {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay.getTime();
  }
  if (period === 'week') {
    return Date.now() - WEEK_MS;
  }
  return null;
}

/**
 * Groups by host + path + query, not the literal URL string, so visits that
 * only differ by a hash fragment or a trailing slash still count as the same
 * download target. The query string is deliberately KEPT (not stripped): a
 * lot of real pages carry their identity in it (?id=, ?page=, ...), and
 * dropping it previously merged genuinely different pages into one entry —
 * which read as "the ranking's URL is wrong" once the most-recent download
 * silently overwrote the displayed URL for the whole merged group.
 */
function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.hostname}${path}${parsed.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

type FolderRow = {
  source_url: string;
  image_count: number;
  created_at: number;
  name: string;
  dir_path: string | null;
  thumbnail_uri: string | null;
};

type RankingGroup = {
  sourceUrl: string;
  displayName: string;
  thumbnailUri: string | null;
  dirPath: string | null;
  totalImages: number;
  downloadCount: number;
  lastDownloadedAt: number;
};

/**
 * Ranking is computed from this device's own data only — the app has no
 * backend today. `download_history` is the authoritative source for the URL
 * and title actually used to download each folder's images (recorded once,
 * atomically, right after the download completes); `folders.source_url`/
 * `folders.name` are a COALESCE fallback for folders downloaded before this
 * table existed. Grouping happens in JS (rather than SQL GROUP BY) because
 * the group key is a normalized URL, not the raw column value.
 */
export async function getDownloadRanking(
  db: SQLiteDatabase,
  period: RankingPeriod,
): Promise<RankingEntry[]> {
  const cutoff = periodCutoff(period);
  const rows = await db.getAllAsync<FolderRow>(
    `SELECT COALESCE(dh.page_url, f.source_url) as source_url,
            f.image_count,
            f.created_at,
            COALESCE(dh.page_title, f.name) as name,
            f.dir_path,
            dh.first_image_uri as thumbnail_uri
     FROM folders f
     LEFT JOIN download_history dh ON dh.folder_id = f.id
     WHERE COALESCE(dh.page_url, f.source_url) IS NOT NULL
       AND COALESCE(dh.page_url, f.source_url) != ''
       AND (? IS NULL OR f.created_at >= ?)`,
    cutoff,
    cutoff,
  );

  const groups = new Map<string, RankingGroup>();
  for (const row of rows) {
    const key = normalizeUrlKey(row.source_url);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        sourceUrl: row.source_url,
        displayName: row.name,
        thumbnailUri: row.thumbnail_uri,
        dirPath: row.dir_path,
        totalImages: row.image_count,
        downloadCount: 1,
        lastDownloadedAt: row.created_at,
      });
      continue;
    }
    existing.totalImages += row.image_count;
    existing.downloadCount += 1;
    if (row.created_at >= existing.lastDownloadedAt) {
      existing.lastDownloadedAt = row.created_at;
      existing.sourceUrl = row.source_url;
      existing.displayName = row.name;
      existing.thumbnailUri = row.thumbnail_uri;
      existing.dirPath = row.dir_path;
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.totalImages - a.totalImages)
    .slice(0, RANKING_LIMIT);
}
