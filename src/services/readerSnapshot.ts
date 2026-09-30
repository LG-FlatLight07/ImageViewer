import type { DetectedImage } from './imageGrouping';

export const MAX_READER_PAYLOAD = 12 * 1024 * 1024;

export function usesStrictReader(pageUrl: string): boolean {
  try {
    return /^(?:www\.)?komiflo\.com$/i.test(new URL(pageUrl).hostname);
  } catch {
    return false;
  }
}

export type ReaderSnapshot = {
  images: DetectedImage[];
  blocked: number;
  skipped: number;
};

/** Separate from network candidates: never fall back to CDN-wide thumbnail matches. */
export function parseReaderSnapshot(value: unknown): ReaderSnapshot {
  const result: ReaderSnapshot = { images: [], blocked: 0, skipped: 0 };
  if (!value || typeof value !== 'object') return result;
  const raw = value as Record<string, unknown>;
  result.blocked = Number.isSafeInteger(raw.blocked) ? Math.max(0, Number(raw.blocked)) : 0;
  result.skipped = Number.isSafeInteger(raw.skipped) ? Math.max(0, Number(raw.skipped)) : 0;
  if (!Array.isArray(raw.images)) return result;
  let size = 0;
  const seen = new Set<string>();
  for (const item of raw.images.slice(0, 20)) {
    if (!item || typeof item.src !== 'string' || seen.has(item.src)) continue;
    if (!Number.isInteger(item.width) || !Number.isInteger(item.height)) continue;
    if (item.width < 17 || item.height < 17 || item.width * item.height > 32_000_000) continue;
    const png = /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(item.src);
    let remote = false;
    try {
      const url = new URL(item.src);
      remote = /^https?:$/.test(url.protocol) && !/\/(?:resized|scrambled)\//i.test(url.pathname);
    } catch {
      /* not a remote URL */
    }
    if (!png && !remote) continue;
    size += item.src.length;
    if (size > MAX_READER_PAYLOAD) break;
    seen.add(item.src);
    result.images.push({
      id: `reader-${result.images.length}`,
      src: item.src,
      width: item.width,
      height: item.height,
      sequenceNumber: null,
    });
  }
  return result;
}

// Literal source is used because Hermes does not preserve Function.toString().
// Site-specific DOM contract, observed in the public reader bundle. Fail closed
// if it changes. End-card recommendations are nested inside separate div entities.
export const READER_SNAPSHOT_FUNCTION = String.raw`function () {
  if (!/^(?:www\.)?komiflo\.com$/i.test(new URL(location.href).hostname)) return null;
  var result = { images: [], blocked: 0, skipped: 0 };
  var url = new URL(location.href);
  var route = url.hash.replace(/^#!?/, '') || url.pathname;
  if (!/^\/comics\/\d+\/read(?:\/|$)/.test(route)) return result;
  var seen = new Set(), size = 0;
  var nodes = document.querySelectorAll('.layer[data-name="PageView"] > img, .layer[data-name="PageView"] > canvas');
  Array.prototype.forEach.call(nodes, function (node) {
    if (result.images.length >= 20) { result.skipped++; return; }
    var style = window.getComputedStyle(node);
    var box = node.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.99 || box.width <= 0 || box.height <= 0) return;
    var width = node.tagName === 'IMG' ? node.naturalWidth : node.width;
    var height = node.tagName === 'IMG' ? node.naturalHeight : node.height;
    if (width < 17 || height < 17 || width * height > 32000000) { result.skipped++; return; }
    var src;
    if (node.tagName === 'IMG') {
      if (!node.complete) return;
      src = node.currentSrc || node.src;
      try {
        var parsed = new URL(src, document.baseURI);
        // Known thumbnail variants and raw scrambled images aren't finished pages.
        if (!/^https?:$/.test(parsed.protocol) || /\/(?:resized|scrambled)\//i.test(parsed.pathname)) { result.skipped++; return; }
        src = parsed.href;
      } catch (_) { return; }
    } else {
      try { src = node.toDataURL('image/png'); }
      catch (_) { result.blocked++; return; }
      if (src.indexOf('data:image/png;base64,') !== 0) { result.blocked++; return; }
    }
    if (seen.has(src)) return;
    if (size + src.length > 12582912) { result.skipped++; return; }
    size += src.length; seen.add(src);
    result.images.push({ src: src, width: width, height: height });
  });
  return result;
}`;
