import type { SQLiteDatabase } from 'expo-sqlite';

export type RankingPeriod = 'day' | 'week' | 'all';

export type RankingEntry = {
  sourceUrl: string;
  hostname: string;
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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

type RankingRow = {
  source_url: string;
  total_images: number;
  download_count: number;
  last_downloaded_at: number;
};

/**
 * Ranking is computed from this device's own `folders` table only — the app
 * has no backend today. The query is already a plain aggregate over
 * (source_url, image_count, created_at), so once a shared backend exists,
 * the same shape of query can run there against synced records without
 * changing this function's contract.
 */
export async function getDownloadRanking(
  db: SQLiteDatabase,
  period: RankingPeriod,
): Promise<RankingEntry[]> {
  const cutoff = periodCutoff(period);
  const rows = await db.getAllAsync<RankingRow>(
    `SELECT source_url,
            SUM(image_count) as total_images,
            COUNT(*) as download_count,
            MAX(created_at) as last_downloaded_at
     FROM folders
     WHERE source_url IS NOT NULL
       AND source_url != ''
       AND (? IS NULL OR created_at >= ?)
     GROUP BY source_url
     ORDER BY total_images DESC
     LIMIT ?`,
    cutoff,
    cutoff,
    RANKING_LIMIT,
  );

  return rows.map((row) => ({
    sourceUrl: row.source_url,
    hostname: hostnameOf(row.source_url),
    totalImages: row.total_images,
    downloadCount: row.download_count,
    lastDownloadedAt: row.last_downloaded_at,
  }));
}
