export type ReaderCaptureRegion = { x: number; y: number; width: number; height: number };

/** Normalized visual-viewport coordinates, not CSS or React Native points. */
export function parseCaptureRegions(value: unknown): ReaderCaptureRegion[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 4)
    .filter(
      (r): r is ReaderCaptureRegion =>
        r &&
        [r.x, r.y, r.width, r.height].every(Number.isFinite) &&
        r.x >= 0 &&
        r.y >= 0 &&
        r.width > 0 &&
        r.height > 0 &&
        r.x + r.width <= 1.000001 &&
        r.y + r.height <= 1.000001,
    )
    .map(({ x, y, width, height }) => ({ x, y, width, height }));
}

export function captureCrop(region: ReaderCaptureRegion, width: number, height: number) {
  if (
    !parseCaptureRegions([region]).length ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1
  )
    throw new Error('INVALID_CAPTURE_BOUNDS');
  // Round inward: do not include pixels outside the main reader element.
  const originX = Math.ceil(region.x * width);
  const originY = Math.ceil(region.y * height);
  const right = Math.min(width, Math.floor((region.x + region.width) * width));
  const bottom = Math.min(height, Math.floor((region.y + region.height) * height));
  if (right - originX < 17 || bottom - originY < 17) throw new Error('CAPTURE_TOO_SMALL');
  return { originX, originY, width: right - originX, height: bottom - originY };
}
