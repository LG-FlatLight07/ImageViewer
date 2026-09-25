import type { DetectedImage } from './imageGrouping';

export const MAX_NETWORK_IMAGES = 5000;

/** Never rebuild searchParams: signed query strings must remain byte-for-byte intact. */
export function contentImageUrl(raw: string, base: string): string | null {
  try {
    if (!raw || /\s/.test(raw)) return null;
    const parsed = new URL(raw, base);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    const path = decodeURIComponent(parsed.pathname).toLowerCase();
    if (!path.includes('/contents/')) return null;
    if (
      /(?:^|[/_.-])(attributes?|thumb(?:nail)?s?|banners?|icons?|logos?|ui|avatars?|buttons?|sprites?)(?:[/_.-]|$)/i.test(
        path,
      )
    )
      return null;
    if (/\.(?:json|html?|js|css|xml|woff2?|ttf|mp4|pdf)$/i.test(path)) return null;
    return /^https?:\/\//i.test(raw) ? raw : parsed.href;
  } catch {
    return null;
  }
}

export type NetworkImageRecord = { src: string; observedAt: number; source: 'image' | 'response' };
export type NetworkImageMessage = {
  type: 'NETWORK_IMAGES';
  pageUrl: string;
  pageTitle: string;
  images: NetworkImageRecord[];
  excluded?: string[];
  requestId?: string;
};

export function parseNetworkImageMessage(data: string): NetworkImageMessage | null {
  try {
    const message = JSON.parse(data);
    if (
      message?.type !== 'NETWORK_IMAGES' ||
      typeof message.pageUrl !== 'string' ||
      typeof message.pageTitle !== 'string' ||
      !Array.isArray(message.images)
    )
      return null;
    if (!/^https?:$/.test(new URL(message.pageUrl).protocol)) return null;
    const images: NetworkImageRecord[] = [];
    for (const item of message.images.slice(0, MAX_NETWORK_IMAGES)) {
      if (
        !item ||
        typeof item.src !== 'string' ||
        !Number.isFinite(item.observedAt) ||
        !['image', 'response'].includes(item.source)
      )
        continue;
      const src = contentImageUrl(item.src, message.pageUrl);
      if (src) images.push({ src, observedAt: item.observedAt, source: item.source });
    }
    return {
      type: 'NETWORK_IMAGES',
      pageUrl: message.pageUrl,
      pageTitle: message.pageTitle,
      images,
      excluded: Array.isArray(message.excluded)
        ? message.excluded
            .slice(0, MAX_NETWORK_IMAGES)
            .filter(
              (src: unknown) => typeof src === 'string' && contentImageUrl(src, message.pageUrl),
            )
        : [],
      requestId: typeof message.requestId === 'string' ? message.requestId : undefined,
    };
  } catch {
    return null;
  }
}

/** Memory-only per-tab collection. Changing site or closing the tab discards it. */
export class NetworkImageCollection {
  private tabs = new Map<string, { origin: string; images: Map<string, NetworkImageRecord> }>();

  merge(tabId: string, message: NetworkImageMessage): DetectedImage[] {
    const origin = new URL(message.pageUrl).origin;
    let tab = this.tabs.get(tabId);
    if (!tab || tab.origin !== origin) {
      tab = { origin, images: new Map() };
      this.tabs.set(tabId, tab);
    }
    const excluded = new Set(message.excluded ?? []);
    for (const src of excluded) tab.images.delete(src);
    for (const image of message.images) {
      if (excluded.has(image.src)) continue;
      const previous = tab.images.get(image.src);
      if (previous) {
        previous.observedAt = Math.min(previous.observedAt, image.observedAt);
      } else if (tab.images.size < MAX_NETWORK_IMAGES) {
        tab.images.set(image.src, { ...image });
      }
    }
    return [...tab.images.values()]
      .sort((a, b) => a.observedAt - b.observedAt)
      .map((image) => ({
        id: image.src,
        src: image.src,
        width: 0,
        height: 0,
        sequenceNumber: null,
      }));
  }

  clear(tabId: string) {
    this.tabs.delete(tabId);
  }
  navigate(tabId: string, pageUrl: string) {
    try {
      if (this.tabs.get(tabId)?.origin !== new URL(pageUrl).origin) this.clear(tabId);
    } catch {
      this.clear(tabId);
    }
  }
  retain(tabIds: string[]) {
    for (const id of this.tabs.keys()) if (!tabIds.includes(id)) this.tabs.delete(id);
  }
}

// Runs in the main frame. It never sends extra requests or consumes the page's response body.
// Resource Timing covers requests made before injection; fetch/XHR hooks provide MIME and JSON
// response candidates afterward. Opaque responses, workers and cross-origin frames remain opaque.
export const NETWORK_IMAGE_SCRIPT = `
(function () {
  if (window.__myGalleryNetworkImages) return;
  // Literal source is intentional: Hermes does not preserve Function.toString source.
  var accept = ${String.raw`function (raw, base) {
    try {
      if (!raw || /\s/.test(raw)) return null;
      var parsed = new URL(raw, base);
      if (!/^https?:$/.test(parsed.protocol)) return null;
      var path = decodeURIComponent(parsed.pathname).toLowerCase();
      if (!path.includes('/contents/')) return null;
      if (/(?:^|[/_.-])(attributes?|thumb(?:nail)?s?|banners?|icons?|logos?|ui|avatars?|buttons?|sprites?)(?:[/_.-]|$)/i.test(path)) return null;
      if (/\.(?:json|html?|js|css|xml|woff2?|ttf|mp4|pdf)$/i.test(path)) return null;
      return /^https?:\/\//i.test(raw) ? raw : parsed.href;
    } catch (_) { return null; }
  }`};
  var records = new Map();
  var dirty = new Map();
  var excluded = new Set();
  var timer = null;
  var epoch = Date.now() - performance.now();
  var cutoff = -1;
  var scanExistingImages = true;
  var maxBody = 2 * 1024 * 1024;
  function now() { return epoch + performance.now(); }
  function emit(requestId) {
    if (timer) { clearTimeout(timer); timer = null; }
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'NETWORK_IMAGES', pageUrl: location.href, pageTitle: document.title,
      images: Array.from((requestId ? records : dirty).values()), requestId: requestId
      , excluded: Array.from(excluded)
    }));
    dirty.clear();
  }
  function add(raw, base, source, at) {
    if (at < cutoff || typeof raw !== 'string') return;
    var src = accept(raw, base);
    if (!src || excluded.has(src)) return;
    var previous = records.get(src);
    if (previous && previous.observedAt <= at) return;
    if (!previous && records.size >= ${MAX_NETWORK_IMAGES}) return;
    var record = { src: src, source: source, observedAt: at };
    records.set(src, record);
    dirty.set(src, record);
    if (!timer) timer = setTimeout(emit, 150);
  }
  function resource(entry) {
    var mime = entry.contentType || '';
    var type = entry.initiatorType;
    // An image initiator or MIME is authoritative; CSS backgrounds on older engines
    // lack MIME, so accept known image extensions only for CSS entries.
    if (type === 'img' || /^image\\//i.test(mime) ||
        (type === 'css' && /\\.(?:avif|webp|png|jpe?g|gif|svg)(?:[?#]|$)/i.test(entry.name))) {
      add(entry.name, document.baseURI, 'image', epoch + entry.startTime);
    }
  }
  function scan() {
    Array.prototype.forEach.call(document.images, inspectImage);
    performance.getEntriesByType('resource').forEach(resource);
  }
  function inspectImage(img) {
    var src = accept(img.currentSrc || img.src, document.baseURI);
    if (!src) return;
    var node = img, depth = 0;
    while (node && depth++ < 5) {
      if (/(?:^|[\\s_-])(thumb(?:nail)?s?|banners?|icons?|logos?|ui|avatars?|buttons?|sprites?)(?:[\\s_-]|$)/i.test(
          String(node.className || '') + ' ' + (node.id || ''))) {
        excluded.add(src); records.delete(src); dirty.delete(src); return;
      }
      node = node.parentElement;
    }
    if (scanExistingImages && img.complete && img.naturalWidth > 0)
      add(src, document.baseURI, 'image', now());
  }
  function responseBody(text, base, at) {
    if (typeof text !== 'string' || text.length > maxBody) return;
    // JSON traversal retains array order and decodes escaped slashes/unicode correctly.
    try {
      var count = 0;
      function visit(value, depth) {
        if (++count > 20000 || depth > 30) return;
        if (typeof value === 'string') add(value, base, 'response', at);
        else if (value && typeof value === 'object') Object.keys(value).forEach(function (key) {
          // Ignore explicitly labelled thumbnail/UI fields even with opaque filenames.
          if (!/thumb|banner|icon|logo|avatar|sprite|attribute|button|^ui$/i.test(key)) visit(value[key], depth + 1);
        });
      }
      visit(JSON.parse(text), 0);
    } catch (_) {
      // Plain text/HTML: only literal URL tokens already supplied by the response.
      var matches = text.match(/(?:https?:\\/\\/|\\/\\/|\\/)[^\\s"'<>]+/g) || [];
      matches.slice(0, 5000).forEach(function (url) { add(url.replace(/&amp;/g, '&'), base, 'response', at); });
    }
  }
  async function inspectResponse(response, at) {
    if (!response || !response.ok) return;
    var mime = response.headers.get('content-type') || '';
    if (/^image\\//i.test(mime)) { add(response.url, document.baseURI, 'image', at); return; }
    if (!/json|text\\/|xml/i.test(mime) || Number(response.headers.get('content-length')) > maxBody) return;
    var clone = response.clone();
    if (!clone.body || !clone.body.getReader || typeof TextDecoder === 'undefined') return;
    var reader = clone.body.getReader();
    var decoder = new TextDecoder();
    var text = '', length = 0;
    try {
      while (true) {
        var part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > maxBody) { reader.cancel().catch(function () {}); return; }
        text += decoder.decode(part.value, { stream: true });
      }
      responseBody(text + decoder.decode(), response.url || document.baseURI, at);
    } finally { reader.releaseLock(); }
  }
  if (window.fetch) {
    var originalFetch = window.fetch;
    window.fetch = function () {
      var at = now();
      var result = originalFetch.apply(this, arguments);
      result.then(function (response) { inspectResponse(response, at).catch(function () {}); }, function () {});
      return result;
    };
  }
  if (window.XMLHttpRequest) {
    var originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      var xhr = this, at = now();
      function loaded() {
        try {
          if (xhr.status < 200 || xhr.status >= 300) return;
          var mime = xhr.getResponseHeader('content-type') || '';
          if (/^image\\//i.test(mime)) add(xhr.responseURL, document.baseURI, 'image', at);
          else if (/json|text\\/|xml/i.test(mime)) {
            if (xhr.responseType === 'json') responseBody(JSON.stringify(xhr.response), xhr.responseURL, at);
            else if (!xhr.responseType || xhr.responseType === 'text') responseBody(xhr.responseText, xhr.responseURL, at);
          }
        } catch (_) {}
      }
      xhr.addEventListener('loadend', loaded, { once: true });
      return originalSend.apply(this, arguments);
    };
  }
  try {
    new PerformanceObserver(function (list) { list.getEntries().forEach(resource); })
      .observe({ type: 'resource', buffered: true });
  } catch (_) {}
  document.addEventListener('load', function (event) {
    var img = event.target;
    if (img && img.tagName === 'IMG' && img.naturalWidth > 0) {
      inspectImage(img);
      add(img.currentSrc || img.src, document.baseURI, 'image', now());
    }
  }, true);
  window.addEventListener('pagehide', function () { emit(); });
  window.__myGalleryNetworkImages = {
    snapshot: function (id) { scan(); emit(id); },
    clear: function () { records.clear(); dirty.clear(); cutoff = now(); scanExistingImages = false; emit(); }
  };
  scan();
  emit();
})();
true;
`;

export function networkImageSnapshotScript(requestId: string): string {
  return `${NETWORK_IMAGE_SCRIPT}\nwindow.__myGalleryNetworkImages.snapshot(${JSON.stringify(requestId)}); true;`;
}
