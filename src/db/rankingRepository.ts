import type { SQLiteDatabase } from 'expo-sqlite';

export type RankingPeriod = 'day' | 'week' | 'all';

export type RankingEntry = {
  sourceUrl: string;
  /** The folder name that was auto-generated at download time (most recent download for this URL). */
  displayName: string;
  /** dirPath of the most recent download, used to resolve a first-image thumbnail. */
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
 * Groups by page identity (host + path), not the literal URL string, so
 * visits that only differ by tracking query params, a hash fragment, or a
 * trailing slash still count as the same download target instead of
 * fragmenting the ranking into near-duplicate entries.
 */
function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.hostname}${path}`.toLowerCase();
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
};

type RankingGroup = {
  sourceUrl: string;
  displayName: string;
  dirPath: string | null;
  totalImages: number;
  downloadCount: number;
  lastDownloadedAt: number;
};

/**
 * Ranking is computed from this device's own `folders` table only — the app
 * has no backend today. Grouping happens in JS (rather than SQL GROUP BY)
 * because the group key is a normalized URL, not the raw column value; once
 * a shared backend exists, the same normalization can run there against
 * synced records without changing this function's contract.
 */
export async function getDownloadRanking(
  db: SQLiteDatabase,
  period: RankingPeriod,
): Promise<RankingEntry[]> {
  const cutoff = periodCutoff(period);
  const rows = await db.getAllAsync<FolderRow>(
    `SELECT source_url, image_count, created_at, name, dir_path
     FROM folders
     WHERE source_url IS NOT NULL
       AND source_url != ''
       AND (? IS NULL OR created_at >= ?)`,
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
      existing.dirPath = row.dir_path;
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.totalImages - a.totalImages)
    .slice(0, RANKING_LIMIT);
}
