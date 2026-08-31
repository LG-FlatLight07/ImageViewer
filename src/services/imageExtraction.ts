export type RawImageCandidate = {
  src: string;
  width: number;
  height: number;
  isLikelyAd: boolean;
};

export type ImageScanResult = {
  type: 'IMAGE_SCAN_RESULT';
  pageTitle: string;
  images: RawImageCandidate[];
};

/**
 * Injected into the WebView's main frame only (default injectedJavaScript behavior),
 * so images inside cross-origin ad iframes (or any other-origin iframe) are
 * never reachable here — same-origin iframes containing the real gallery
 * content are a known remaining gap, but injecting into arbitrary sub-frames
 * isn't something react-native-webview's injectedJavaScript supports.
 */
export const IMAGE_SCAN_SCRIPT = `
(function () {
  var AD_KEYWORD_RE = /\\b(ads?|advert(isement)?|sponsor(ed)?|promo(tion)?|banner)\\b/i;
  function hasAdAncestor(el) {
    var node = el;
    var depth = 0;
    while (node && depth < 6) {
      var identifier = (node.className ? String(node.className) : '') + ' ' + (node.id || '');
      if (AD_KEYWORD_RE.test(identifier)) {
        return true;
      }
      node = node.parentElement;
      depth += 1;
    }
    return false;
  }

  // Covers the common lazy-load libraries/conventions seen across gallery
  // and manga sites beyond just lazysizes' data-src — data-original and
  // data-lazy-src predate it, the rest are other libraries/custom viewers.
  // data-srcset holds a full srcset list rather than one bare URL, so it's
  // parsed for its first candidate rather than used as-is.
  var LAZY_ATTRS = [
    'data-src', 'data-original', 'data-lazy-src', 'data-lazy', 'data-echo',
    'data-actualsrc', 'data-cfsrc', 'data-url', 'data-img', 'data-bg', 'data-srcset',
  ];
  function resolveUrl(raw) {
    // A lazy-load attribute commonly holds a page-relative or
    // protocol-relative path rather than an absolute URL — unlike the .src
    // DOM property, getAttribute() never resolves them. An unresolved
    // relative URL survives all the way to the native downloader and fails
    // there (it's not a fetchable absolute URL), which is a cause of
    // download failures on lazy-loaded gallery sites.
    try {
      return new URL(raw, document.baseURI).href;
    } catch (e) {
      return null;
    }
  }
  function resolveLazyUrl(el) {
    for (var i = 0; i < LAZY_ATTRS.length; i++) {
      var raw = el.getAttribute(LAZY_ATTRS[i]);
      if (!raw) {
        continue;
      }
      var candidate = LAZY_ATTRS[i] === 'data-srcset' ? raw.split(',')[0].trim().split(/\\s+/)[0] : raw;
      if (!candidate || candidate.indexOf('data:') === 0) {
        continue;
      }
      var resolved = resolveUrl(candidate);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }
  function resolveImgSrc(img) {
    var lazy = resolveLazyUrl(img);
    if (lazy) {
      return lazy;
    }
    // currentSrc is the browser's own resolution of a responsive
    // (srcset/sizes or <picture>) image — more reliable than .src, which
    // for a <picture><source>-driven <img> can be empty even once loaded.
    return img.currentSrc || img.src || '';
  }
  function extractCssUrl(value) {
    var match = value && value.match(/url\\((['"]?)(.*?)\\1\\)/);
    if (!match || !match[2] || match[2].indexOf('data:') === 0) {
      return null;
    }
    return resolveUrl(match[2]);
  }

  var results = [];
  var seenSrc = Object.create(null);
  function addCandidate(src, width, height, isLikelyAd) {
    if (!src || src.indexOf('data:') === 0 || seenSrc[src]) {
      return;
    }
    seenSrc[src] = true;
    results.push({ src: src, width: width, height: height, isLikelyAd: isLikelyAd });
  }

  var imgNodes = Array.prototype.slice.call(document.images);
  for (var i = 0; i < imgNodes.length; i++) {
    var img = imgNodes[i];
    addCandidate(
      resolveImgSrc(img),
      img.naturalWidth || img.width || 0,
      img.naturalHeight || img.height || 0,
      hasAdAncestor(img)
    );
  }

  // Some sites (especially manga/gallery "page" viewers) render the actual
  // page image as a CSS background-image on a div rather than an <img>
  // element — invisible to document.images entirely. This candidate
  // selector is deliberately narrow (not "every element on the page") so
  // this stays cheap: only elements that already look like a lazy-loaded
  // or background-image element are checked, and only those fall back to
  // the more expensive getComputedStyle() once inline style and lazy-load
  // attributes don't already answer it. The element's own rendered box
  // size stands in for naturalWidth/naturalHeight, which don't exist for a
  // CSS background.
  var bgNodes = document.querySelectorAll(
    '[style*="background"], [class*="lazy" i], [data-src], [data-bg], [data-original]'
  );
  for (var j = 0; j < bgNodes.length; j++) {
    var el = bgNodes[j];
    var bgUrl = resolveLazyUrl(el) || extractCssUrl(el.style.backgroundImage);
    if (!bgUrl && typeof getComputedStyle === 'function') {
      bgUrl = extractCssUrl(getComputedStyle(el).backgroundImage);
    }
    if (!bgUrl) {
      continue;
    }
    var rect = el.getBoundingClientRect();
    addCandidate(bgUrl, Math.round(rect.width), Math.round(rect.height), hasAdAncestor(el));
  }

  window.ReactNativeWebView.postMessage(
    JSON.stringify({ type: 'IMAGE_SCAN_RESULT', pageTitle: document.title, images: results })
  );
  true;
})();
`;

export function parseImageScanMessage(data: string): ImageScanResult | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed && parsed.type === 'IMAGE_SCAN_RESULT') {
      return parsed as ImageScanResult;
    }
  } catch {
    // ignore malformed / unrelated messages from the WebView
  }
  return null;
}
