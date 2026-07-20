export type Anchor =
  'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export const ALL_ANCHORS: Anchor[] = [
  'topLeft',
  'top',
  'topRight',
  'left',
  'right',
  'bottomLeft',
  'bottom',
  'bottomRight',
];

export const DEFAULT_ANCHOR: Anchor = 'bottomRight';

export type Arrangement = 'horizontal' | 'vertical';

export const DEFAULT_ARRANGEMENT: Arrangement = 'horizontal';

type Size = { width: number; height: number };
export type Point = { x: number; y: number };

/**
 * Top-left origin (in the containing area's coordinate space) where a group of
 * the given size should sit when snapped to `anchor`, keeping `margin` clear
 * of the surrounding edges.
 */
export function getAnchorOrigin(anchor: Anchor, bounds: Size, size: Size, margin: number): Point {
  const minX = margin;
  const minY = margin;
  const maxX = Math.max(bounds.width - size.width - margin, margin);
  const maxY = Math.max(bounds.height - size.height - margin, margin);
  const centerX = Math.max((bounds.width - size.width) / 2, margin);
  const centerY = Math.max((bounds.height - size.height) / 2, margin);

  switch (anchor) {
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
