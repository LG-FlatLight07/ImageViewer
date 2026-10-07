import type { DetectedImage } from './imageGrouping';
import { parseCaptureRegions, type ReaderCaptureRegion } from './readerCaptureGeometry';

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
  failures?: { name: string; message: string }[];
  captureRegions?: ReaderCaptureRegion[];
  reviewCaptureRegions?: ReaderCaptureRegion[];
  captureUnavailable?: string;
};

export function readerFailureMessage(reader: ReaderSnapshot): string {
  const failures = reader.failures ?? [];
  const security = failures.some((failure) => failure.name === 'SecurityError');
  const explanation = security
    ? 'Canvasの読み出しがブラウザーのセキュリティ制限（SecurityError）で拒否されました。現在のCanvas保存方式では取得できません。'
    : '本編のCanvasを検出しましたが、PNGへの書き出しに失敗しました。';
  const details = failures.map((failure) => `${failure.name}: ${failure.message}`).join('\n');
  return `${explanation}${details ? `\n\n詳細:\n${details}` : ''}${reader.captureUnavailable ? `\n\n画面キャプチャの判定: ${reader.captureUnavailable}` : ''}\n\nおすすめ・サムネイルでの代用は行いません。`;
}

/** Separate from network candidates: never fall back to CDN-wide thumbnail matches. */
export function parseReaderSnapshot(value: unknown): ReaderSnapshot {
  const result: ReaderSnapshot = { images: [], blocked: 0, skipped: 0 };
  if (!value || typeof value !== 'object') return result;
  const raw = value as Record<string, unknown>;
  if (raw.captureRegions) result.captureRegions = parseCaptureRegions(raw.captureRegions);
  if (raw.reviewCaptureRegions)
    result.reviewCaptureRegions = parseCaptureRegions(raw.reviewCaptureRegions);
  if (typeof raw.captureUnavailable === 'string')
    result.captureUnavailable = raw.captureUnavailable.slice(0, 160);
  result.blocked = Number.isSafeInteger(raw.blocked) ? Math.max(0, Number(raw.blocked)) : 0;
  result.skipped = Number.isSafeInteger(raw.skipped) ? Math.max(0, Number(raw.skipped)) : 0;
  if (Array.isArray(raw.failures)) {
    result.failures = raw.failures.slice(0, 3).map((failure) => ({
      name: typeof failure?.name === 'string' ? failure.name.slice(0, 60) : 'Error',
      message:
        typeof failure?.message === 'string'
          ? failure.message
              .slice(0, 240)
              .replace(/https?:\/\/[^\s"'<>]+/g, '[URL]')
              .replace(/[\x00-\x1f]/g, ' ')
          : '詳細なし',
    }));
  }
  if (!Array.isArray(raw.images)) return result;
  let size = 0;
  const seen = new Set<string>();
  for (const item of raw.images.slice(0, 20)) {
    if (!item || typeof item.src !== 'string' || seen.has(item.src)) continue;
    if (!Number.isInteger(item.width) || !Number.isInteger(item.height)) continue;
    if (item.width < 17 || item.height < 17 || item.width * item.height > 32_000_000) continue;
    // Check the bound before inspecting data; never feed multi-megabyte PNGs to
    // the URL parser or an unbounded regexp on the native JS engine.
    if (size + item.src.length > MAX_READER_PAYLOAD) break;
    const png =
      item.src.startsWith('data:image/png;base64,iVBORw0KGgo') &&
      !/[^A-Za-z0-9+/=]/.test(item.src.slice('data:image/png;base64,'.length));
    let remote = false;
    try {
      if (!png && /^https?:\/\//.test(item.src)) {
        const url = new URL(item.src);
        remote = /^https?:$/.test(url.protocol) && !/\/(?:resized|scrambled)\//i.test(url.pathname);
      }
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
  function failed(name, message, node, box) {
    result.blocked++;
    if (!result.failures) result.failures = [];
    if (result.failures.length < 3) result.failures.push({name: String(name).slice(0, 60), message: String(message).slice(0, 240)});
    // Describe visible pixels for a native view capture; never replace page APIs.
    var viewport = window.visualViewport;
    var vw = viewport ? viewport.width : window.innerWidth;
    var vh = viewport ? viewport.height : window.innerHeight;
    var ox = viewport ? viewport.offsetLeft : 0, oy = viewport ? viewport.offsetTop : 0;
    var left = Math.max(0, box.left - ox), top = Math.max(0, box.top - oy);
    var right = Math.min(vw, box.right - ox), bottom = Math.min(vh, box.bottom - oy);
    if (!(vw > 0 && vh > 0 && right - left > 16 && bottom - top > 16)) { result.captureUnavailable = '本編の表示範囲が画面外、または小さすぎます。'; return; }
    // Hit testing cannot prove that an overlapping element paints visible pixels.
    // Keep only the validated main-canvas crop for explicit preview/selection.
    if (!result.reviewCaptureRegions) result.reviewCaptureRegions = [];
    if (result.reviewCaptureRegions.length < 4) result.reviewCaptureRegions.push({x:left/vw,y:top/vh,width:(right-left)/vw,height:(bottom-top)/vh});
    if (typeof document.elementFromPoint !== 'function') { result.captureUnavailable = '表示位置の確認機能を利用できません。'; return; }
    // Reject reader controls/recommendations overlaid on the proposed crop.
    var points = [[left+1,top+1],[right-1,top+1],[left+1,bottom-1],[right-1,bottom-1],[(left+right)/2,(top+bottom)/2]];
    function transparentReaderLayer(hit) {
      if (!hit || !hit.matches || !hit.matches('.layer[data-name="UI"]')) return false;
      var css = window.getComputedStyle(hit);
      var transparent = css.backgroundColor === 'transparent' || css.backgroundColor === 'rgba(0, 0, 0, 0)';
      if (!transparent || css.backgroundImage !== 'none' || css.boxShadow !== 'none' || css.filter !== 'none') return false;
      // Decorative pseudo-elements can cover the page even when the layer itself is clear.
      return ['::before','::after'].every(function(pseudo) {
        var c = window.getComputedStyle(hit, pseudo).content;
        return c === 'none' || c === 'normal';
      });
    }
    function unobscured(p) {
      var x = p[0]+ox, y = p[1]+oy;
      var hits = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x,y) : [document.elementFromPoint(x,y)];
      for (var i = 0; i < hits.length; i++) {
        var hit = hits[i];
        // pointer-events:none on a visible canvas sends taps to its containing layer.
        if (hit === node || (hit && hit.contains(node))) return true;
        if (transparentReaderLayer(hit)) continue;
        result.captureUnavailable = '本編に別の要素が重なっています (' + (hit ? hit.tagName + (hit.getAttribute('data-name') ? ':' + hit.getAttribute('data-name').slice(0,40) : '') : '画面外') + ')。サイトのメニューを閉じてください。';
        return false;
      }
      result.captureUnavailable = '本編の表示位置を確認できませんでした。';
      return false;
    }
    if (!points.every(unobscured)) return;
    if (!result.captureRegions) result.captureRegions = [];
    if (result.captureRegions.length < 4) result.captureRegions.push({x:left/vw,y:top/vh,width:(right-left)/vw,height:(bottom-top)/vh});
  }
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
      catch (error) { failed(error && error.name || 'Error', error && error.message || 'Canvas export failed', node, box); return; }
      if (typeof src !== 'string' || src.indexOf('data:image/png;base64,') !== 0) {
        failed('InvalidCanvasResult', 'Canvas did not return PNG data (' + width + ' x ' + height + ' px)', node, box); return;
      }
    }
    if (seen.has(src)) return;
    if (size + src.length > 12582912) { result.skipped++; return; }
    size += src.length; seen.add(src);
    result.images.push({ src: src, width: width, height: height });
  });
  return result;
}`;
