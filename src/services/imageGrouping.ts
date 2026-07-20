import type { RawImageCandidate } from './imageExtraction';

export type DetectedImage = {
  id: string;
  src: string;
  width: number;
  height: number;
  sequenceNumber: number | null;
};

export type DetectedImageGroup = {
  groupKey: string;
  images: DetectedImage[];
};

export type ImageDetectionResult = {
  primaryGroup: DetectedImageGroup | null;
  otherImages: DetectedImage[];
};

const MIN_DIMENSION = 150;

const AD_DOMAIN_SUBSTRINGS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.',
  'amazon-adsystem.com',
  'taboola.com',
  'outbrain.com',
  'criteo.com',
  'moatads.com',
  'adnxs.com',
  'adsafeprotected.com',
  'pubmatic.com',
  'rubiconproject.com',
];

function isAdUrl(src: string): boolean {
  const lower = src.toLowerCase();
  return AD_DOMAIN_SUBSTRINGS.some((domain) => lower.includes(domain));
}

function extractSequenceInfo(url: string): { groupKey: string; sequenceNumber: number } | null {
  const match = url.match(/(\d+)(?!.*\d)/);
  if (!match || match.index === undefined) {
    return null;
  }
  const numberStr = match[1];
  const groupKey =
    url.slice(0, match.index) +
    '#'.repeat(numberStr.length) +
    url.slice(match.index + numberStr.length);
  return { groupKey, sequenceNumber: parseInt(numberStr, 10) };
}

export function detectImageGroups(candidates: RawImageCandidate[]): ImageDetectionResult {
  const filtered = candidates.filter(
    (c) =>
      !c.isLikelyAd && !isAdUrl(c.src) && c.width >= MIN_DIMENSION && c.height >= MIN_DIMENSION,
  );

  const groupsByKey = new Map<string, DetectedImage[]>();
  const ungrouped: DetectedImage[] = [];

  filtered.forEach((candidate, index) => {
    const sequence = extractSequenceInfo(candidate.src);
    const image: DetectedImage = {
      id: `${index}-${candidate.src}`,
      src: candidate.src,
      width: candidate.width,
      height: candidate.height,
      sequenceNumber: sequence?.sequenceNumber ?? null,
    };
    if (sequence) {
      const list = groupsByKey.get(sequence.groupKey) ?? [];
      list.push(image);
      groupsByKey.set(sequence.groupKey, list);
    } else {
      ungrouped.push(image);
    }
  });

  let primaryGroup: DetectedImageGroup | null = null;
  const otherImages: DetectedImage[] = [...ungrouped];

  const sortedGroups = Array.from(groupsByKey.entries()).sort((a, b) => b[1].length - a[1].length);

  sortedGroups.forEach(([groupKey, images], index) => {
    const sorted = [...images].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
    if (index === 0 && sorted.length >= 2) {
      primaryGroup = { groupKey, images: sorted };
    } else {
      otherImages.push(...sorted);
    }
  });

  return { primaryGroup, otherImages };
}
