import React, { useCallback } from 'react';

import { SinglePageImageScanner } from './SinglePageImageScanner';

export type ThumbnailScanItem = {
  urlKey: string;
  sourceUrl: string;
};

/**
 * Resolves a ranking entry's thumbnail without ever sending an image to a
 * server, via SinglePageImageScanner. The caller is responsible for caching
 * the result and for only ever passing one un-cached `item` at a time (see
 * RankingScreen.tsx) — scanning many pages at once would be slow and heavy
 * on data/battery.
 */
export function RankingThumbnailScanner({
  item,
  onResolved,
}: {
  item: ThumbnailScanItem | null;
  onResolved: (urlKey: string, imageUrl: string | null) => void;
}) {
  const handleResolved = useCallback(
    (imageUrl: string | null) => {
      if (item) {
        onResolved(item.urlKey, imageUrl);
      }
    },
    [item, onResolved],
  );

  return (
    <SinglePageImageScanner
      scanKey={item?.urlKey ?? ''}
      url={item?.sourceUrl ?? null}
      onResolved={handleResolved}
    />
  );
}
