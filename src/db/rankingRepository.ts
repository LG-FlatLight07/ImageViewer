import { supabase } from '../services/supabaseClient';

export type RankingPeriod = 'day' | 'week' | 'all';

export type RankingEntry = {
  /** Normalized grouping key — also the local thumbnail-cache lookup key (see rankingThumbnailRepository.ts). */
  urlKey: string;
  sourceUrl: string;
  /** The page title recorded at download time (most recent contributor for this URL). */
  displayName: string;
  totalImages: number;
  downloadCount: number;
  lastDownloadedAt: number;
};

const RANKING_LIMIT = 20;

/** `ranking_daily_counts.day` is a UTC date (see the `record_download` SQL function) — filter using UTC date strings, not local time. */
function periodCutoffDate(period: RankingPeriod): string | null {
  if (period === 'all') {
    return null;
  }
  const now = new Date();
  const daysBack = period === 'day' ? 0 : 6;
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack),
  );
  return cutoff.toISOString().slice(0, 10);
}

type DailyCountRow = {
  url_key: string;
  source_url: string;
  page_title: string;
  day: string;
  download_count: number;
  image_count: number;
  updated_at: string;
};

type RankingGroup = {
  urlKey: string;
  sourceUrl: string;
  displayName: string;
  totalImages: number;
  downloadCount: number;
  lastDownloadedAt: number;
  lastDay: string;
};

/**
 * The all-users, all-devices ranking — sourced from Supabase's
 * `ranking_daily_counts` (one row per URL per UTC day, incremented via the
 * `record_download` RPC at download time; see downloadHistoryRepository.ts).
 * Rows are fetched for the period and aggregated here in JS rather than via
 * a SQL GROUP BY, because "most recent title/URL for this url_key" needs a
 * per-group max-by-day pick that's awkward to express through PostgREST.
 */
export async function getDownloadRanking(period: RankingPeriod): Promise<RankingEntry[]> {
  if (!supabase) {
    return [];
  }

  const cutoff = periodCutoffDate(period);
  let query = supabase
    .from('ranking_daily_counts')
    .select('url_key, source_url, page_title, day, download_count, image_count, updated_at');
  if (cutoff) {
    query = query.gte('day', cutoff);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const groups = new Map<string, RankingGroup>();
  for (const row of (data ?? []) as DailyCountRow[]) {
    const existing = groups.get(row.url_key);
    if (!existing) {
      groups.set(row.url_key, {
        urlKey: row.url_key,
        sourceUrl: row.source_url,
        displayName: row.page_title,
        totalImages: row.image_count,
        downloadCount: row.download_count,
        lastDownloadedAt: new Date(row.updated_at).getTime(),
        lastDay: row.day,
      });
      continue;
    }
    existing.totalImages += row.image_count;
    existing.downloadCount += row.download_count;
    if (row.day >= existing.lastDay) {
      existing.lastDay = row.day;
      existing.lastDownloadedAt = new Date(row.updated_at).getTime();
      existing.sourceUrl = row.source_url;
      existing.displayName = row.page_title;
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.downloadCount - a.downloadCount)
    .slice(0, RANKING_LIMIT)
    .map((group) => ({
      urlKey: group.urlKey,
      sourceUrl: group.sourceUrl,
      displayName: group.displayName,
      totalImages: group.totalImages,
      downloadCount: group.downloadCount,
      lastDownloadedAt: group.lastDownloadedAt,
    }));
}
