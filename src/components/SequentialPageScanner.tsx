import React, { useEffect, useState } from 'react';

import { buildPageSequenceUrl, type PageSequenceInfo } from '../services/pageSequence';
import { SinglePageImageScanner } from './SinglePageImageScanner';

/**
 * Hard ceiling on how many numbered pages a single run will visit,
 * independent of whatever count the UI lets the user request — this is a
 * background crawl across many separate page loads (unlike the rest of the
 * app's "save," which only ever touches the one page already on screen), so
 * it needs its own bound against turning into an unbounded site walk.
 */
export const MAX_SEQUENTIAL_PAGES = 100;

export type SequentialPageResult = { pageUrl: string; imageSrc: string };

/**
 * Walks a run of sibling URLs built from `sequenceInfo` (same prefix/suffix,
 * incrementing number), visiting each one via SinglePageImageScanner to
 * collect that page's primary image — for sites that put one image per
 * numbered page load rather than many images on one page (see
 * pageSequence.ts). Renders nothing when `active` is false.
 */
export function SequentialPageScanner({
  active,
  sequenceInfo,
  startNumber,
  count,
  onProgress,
  onComplete,
}: {
  active: boolean;
  sequenceInfo: PageSequenceInfo;
  startNumber: number;
  count: number;
  onProgress: (done: number, total: number) => void;
  onComplete: (results: SequentialPageResult[]) => void;
}) {
  const clampedCount = Math.max(0, Math.min(count, MAX_SEQUENTIAL_PAGES));

  // A fresh run (re-activated, or pointed at a different sequence/range)
  // starts over from scratch rather than continuing stale state. Reset is
  // done synchronously during render (React's documented pattern for
  // "adjust state when a prop changes") rather than in an effect, which
  // would let a stale render slip through with the previous run's index.
  const runId = `${active ? 1 : 0}|${sequenceInfo.prefix}|${sequenceInfo.suffix}|${sequenceInfo.digits}|${startNumber}|${clampedCount}`;
  const [prevRunId, setPrevRunId] = useState(runId);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SequentialPageResult[]>([]);
  if (runId !== prevRunId) {
    setPrevRunId(runId);
    setIndex(0);
    setResults([]);
  }

  const done = index >= clampedCount;

  useEffect(() => {
    if (!active) {
      return;
    }
    if (done) {
      onComplete(results);
    } else {
      onProgress(index, clampedCount);
    }
    // onProgress/onComplete are expected to be stable callbacks from the
    // caller; only the scan's own progress actually changing should re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, clampedCount, done]);

  if (!active || clampedCount === 0 || done) {
    return null;
  }

  const pageUrl = buildPageSequenceUrl(sequenceInfo, startNumber + index);

  const handleResolved = (imageSrc: string | null) => {
    if (imageSrc) {
      setResults((prev) => [...prev, { pageUrl, imageSrc }]);
    }
    setIndex((prev) => prev + 1);
  };

  return (
    <SinglePageImageScanner scanKey={pageUrl} url={pageUrl} onResolved={handleResolved} />
  );
}
