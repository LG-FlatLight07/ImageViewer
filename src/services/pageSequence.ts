/**
 * Detects the "one full page load = one image" site structure (as opposed
 * to imageGrouping.ts's pattern, which groups multiple <img> src URLs found
 * on a single already-loaded page). Here the number lives in the *page*
 * URL itself — e.g. a stock-photo site's .../photo/1167141 — and each
 * numbered URL has to be visited separately to reveal that page's image.
 * See SequentialPageScanner.tsx for the part that actually visits them.
 */
export type PageSequenceInfo = {
  prefix: string;
  suffix: string;
  number: number;
  /** Original digit width (e.g. 3 for "007") — reproduced when building sibling URLs so a zero-padded scheme round-trips correctly. */
  digits: number;
};

export function extractPageSequenceInfo(url: string): PageSequenceInfo | null {
  const match = url.match(/(\d+)(?!.*\d)/);
  if (!match || match.index === undefined) {
    return null;
  }
  const numberStr = match[1];
  return {
    prefix: url.slice(0, match.index),
    suffix: url.slice(match.index + numberStr.length),
    number: parseInt(numberStr, 10),
    digits: numberStr.length,
  };
}

export function buildPageSequenceUrl(info: PageSequenceInfo, number: number): string {
  const raw = String(number);
  const numberStr = raw.length < info.digits ? raw.padStart(info.digits, '0') : raw;
  return `${info.prefix}${numberStr}${info.suffix}`;
}
