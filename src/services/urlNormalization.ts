/**
 * Groups by host + path + query, not the literal URL string, so visits that
 * only differ by a hash fragment or a trailing slash still count as the same
 * download target. The query string is deliberately KEPT (not stripped): a
 * lot of real pages carry their identity in it (?id=, ?page=, ...), and
 * dropping it previously merged genuinely different pages into one entry —
 * which read as "the ranking's URL is wrong" once the most-recent download
 * silently overwrote the displayed URL for the whole merged group.
 *
 * This MUST stay identical between every writer (downloadService.ts, when
 * reporting a download to the global ranking) and reader (rankingRepository)
 * — it's the grouping key shared with the server, not just a local detail.
 */
export function normalizeUrlKey(url: string): string {
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
