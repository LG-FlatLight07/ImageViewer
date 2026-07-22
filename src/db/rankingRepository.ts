import type { SQLiteDatabase } from 'expo-sqlite';

export type RankingPeriod = 'day' | 'week' | 'all';

export type RankingEntry = {
  sourceUrl: string;
  /** The page title recorded at download time (most recent download for this URL). */
  displayName: string;
  /** First-image thumbnail cached at download time, when available. */
  thumbnailUri: string | null;
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

type StatsRow = {
  page_url: string;
  page_title: string;
  thumbnail_uri: string | null;
  image_count: number;
  created_at: number;
};

type RankingGroup = {
  sourceUrl: string;
  displayName: string;
  thumbnailUri: string | null;
  totalImages: number;
  downloadCount: number;
  lastDownloadedAt: number;
};

/**
 * Ranking is sourced entirely from `ranking_stats` — an append-only ledger of
 * every completed download, independent of the `folders` table (deleting a
 * folder must not erase its ranking contribution) and, longer-term, meant to
 * be swappable for a real backend shared across all app users without this
 * function's contract changing. Grouping happens in JS (rather than SQL
 * GROUP BY) because the group key is a normalized URL, not the raw column
 * value.
 */
export async function getDownloadRanking(
  db: SQLiteDatabase,
  period: RankingPeriod,
): Promise<RankingEntry[]> {
  const cutoff = periodCutoff(period);
  const rows = await db.getAllAsync<StatsRow>(
    `SELECT page_url, page_title, thumbnail_uri, image_count, created_at
     FROM ranking_stats
     WHERE (? IS NULL OR created_at >= ?)`,
    cutoff,
    cutoff,
  );

  const groups = new Map<string, RankingGroup>();
  for (const row of rows) {
    const key = normalizeUrlKey(row.page_url);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        sourceUrl: row.page_url,
        displayName: row.page_title,
        thumbnailUri: row.thumbnail_uri,
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
      existing.sourceUrl = row.page_url;
      existing.displayName = row.page_title;
      existing.thumbnailUri = row.thumbnail_uri;
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.downloadCount - a.downloadCount)
    .slice(0, RANKING_LIMIT);
}
