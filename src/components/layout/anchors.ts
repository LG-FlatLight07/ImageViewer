/**
 * A UI group's position is a point walked clockwise around the draggable
 * area's inner perimeter (starting top-left, along the top edge), split into
 * ANCHOR_COUNT equal arc-length steps. Docking is exact by construction:
 * every point sits flush against one of the four edges (offset by `margin`),
 * never floating free in the middle.
 */
export type Anchor = number;

export const ANCHOR_COUNT = 32;

/**
 * The only two anchors a `edgesOnly` bar (full-width, docked flush to the
 * top or bottom edge) is allowed to use. Valid because a full-width bar's
 * `availableW` is always ~0, so every anchor already collapses onto the
 * single vertical line at x=margin — these two indices are simply its
 * extreme top and extreme bottom points on that line.
 */
export const EDGE_TOP_ANCHOR: Anchor = 0;
export const EDGE_BOTTOM_ANCHOR: Anchor = ANCHOR_COUNT / 2;

export type SemanticAnchor =
  'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export type Arrangement = 'horizontal' | 'vertical';

export const DEFAULT_ARRANGEMENT: Arrangement = 'horizontal';

type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Rect = Point & Size;

function normalizeIndex(index: number): number {
  return ((Math.round(index) % ANCHOR_COUNT) + ANCHOR_COUNT) % ANCHOR_COUNT;
}

/**
 * Top-left origin (in the containing area's coordinate space) where a group
 * of the given size should sit when docked to `anchor`, keeping `margin`
 * clear of the surrounding edges.
 */
export function getAnchorOrigin(anchor: Anchor, bounds: Size, size: Size, margin: number): Point {
  const availableW = Math.max(bounds.width - size.width - margin * 2, 0);
  const availableH = Math.max(bounds.height - size.height - margin * 2, 0);
  const perimeter = 2 * (availableW + availableH);
  if (perimeter <= 0) {
    return { x: margin, y: margin };
  }

  let t = (normalizeIndex(anchor) / ANCHOR_COUNT) * perimeter;
  if (t < availableW) {
    return { x: margin + t, y: margin };
  }
  t -= availableW;
  if (t < availableH) {
    return { x: margin + availableW, y: margin + t };
  }
  t -= availableH;
  if (t < availableW) {
    return { x: margin + availableW - t, y: margin + availableH };
  }
  t -= availableW;
  return { x: margin, y: margin + availableH - t };
}

function semanticTarget(name: SemanticAnchor, bounds: Size, size: Size, margin: number): Point {
  const minX = margin;
  const minY = margin;
  const maxX = Math.max(bounds.width - size.width - margin, margin);
  const maxY = Math.max(bounds.height - size.height - margin, margin);
  const centerX = Math.max((bounds.width - size.width) / 2, margin);
  const centerY = Math.max((bounds.height - size.height) / 2, margin);

  switch (name) {
    case 'topLeft':
      return { x: minX, y: minY };
    case 'top':
      return { x: centerX, y: minY };
    case 'topRight':
      return { x: maxX, y: minY };
    case 'left':
      return { x: minX, y: centerY };
    case 'right':
      return { x: maxX, y: centerY };
    case 'bottomLeft':
      return { x: minX, y: maxY };
    case 'bottom':
      return { x: centerX, y: maxY };
    case 'bottomRight':
      return { x: maxX, y: maxY };
  }
}

/** All 32 anchors, ordered by ascending distance from `target`. */
export function anchorsByDistance(
  target: Point,
  bounds: Size,
  size: Size,
  margin: number,
): Anchor[] {
  const withDistance = Array.from({ length: ANCHOR_COUNT }, (_, index) => {
    const candidate = getAnchorOrigin(index, bounds, size, margin);
    return { index, distance: Math.hypot(candidate.x - target.x, candidate.y - target.y) };
  });
  withDistance.sort((a, b) => a.distance - b.distance);
  return withDistance.map((entry) => entry.index);
}

export function nearestAnchor(target: Point, bounds: Size, size: Size, margin: number): Anchor {
  return anchorsByDistance(target, bounds, size, margin)[0] ?? 0;
}

/** Resolves a friendly compass name to the nearest of the 32 dock points. */
export function resolveSemanticAnchor(
  name: SemanticAnchor,
  bounds: Size,
  size: Size,
  margin: number,
): Anchor {
  return nearestAnchor(semanticTarget(name, bounds, size, margin), bounds, size, margin);
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function circularDistance(a: Anchor, b: Anchor): number {
  const diff = Math.abs(normalizeIndex(a) - normalizeIndex(b));
  return Math.min(diff, ANCHOR_COUNT - diff);
}

/** Snaps any anchor to whichever of the two edge anchors is circularly nearest. */
export function clampToEdgeAnchor(anchor: Anchor): Anchor {
  return circularDistance(anchor, EDGE_TOP_ANCHOR) <= circularDistance(anchor, EDGE_BOTTOM_ANCHOR)
    ? EDGE_TOP_ANCHOR
    : EDGE_BOTTOM_ANCHOR;
}
