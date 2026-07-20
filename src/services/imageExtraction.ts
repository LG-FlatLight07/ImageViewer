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
 * so images inside cross-origin ad iframes are never reachable here.
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
  function resolveSrc(img) {
    return (
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-lazy-src') ||
      img.src ||
      ''
    );
  }
  var nodes = Array.prototype.slice.call(document.images);
  var results = [];
  for (var i = 0; i < nodes.length; i++) {
    var img = nodes[i];
    var src = resolveSrc(img);
    if (!src || src.indexOf('data:') === 0) {
      continue;
    }
    results.push({
      src: src,
      width: img.naturalWidth || img.width || 0,
      height: img.naturalHeight || img.height || 0,
      isLikelyAd: hasAdAncestor(img),
    });
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
