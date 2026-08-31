/** Posted by AD_BLOCK_SCRIPT on every genuine touch/click — see onShouldStartLoadWithRequest in BrowserScreen.tsx. */
export const USER_GESTURE_MESSAGE_TYPE = 'USER_GESTURE';

export function isUserGestureMessage(data: string): boolean {
  try {
    return JSON.parse(data)?.type === USER_GESTURE_MESSAGE_TYPE;
  } catch {
    return false;
  }
}

/**
 * Cosmetic ad hiding + popup suppression injected into the WebView. There's
 * no way to do true network-level request blocking from injected page JS
 * (that would need a native module or a proxy), so this only hides elements
 * that look like ads and stops window.open()-based popups — a reasonable
 * scope for a WebView-based in-app browser.
 *
 * Redirect-style ads (no new window at all — the page just sends the
 * current tab to an ad landing page, via a delayed timer or an invisible
 * full-page tap-jacking overlay) are NOT handled here: window.open
 * blocking does nothing for a same-window navigation, and injected JS
 * can't reliably intercept navigation either (location.href's setter is
 * unforgeable in Chromium's WebView, so overriding it silently no-ops).
 * Genuine touches are reported up to onShouldStartLoadWithRequest instead,
 * which blocks the navigation at the native layer if it wasn't tied to one.
 */
export const AD_BLOCK_SCRIPT = `
(function () {
  if (window.__adBlockInstalled) { true; return; }
  window.__adBlockInstalled = true;

  window.open = function () { return null; };

  var GESTURE_REPORT_THROTTLE_MS = 200;
  var lastReportedAt = 0;
  function reportGesture() {
    var now = Date.now();
    if (now - lastReportedAt < GESTURE_REPORT_THROTTLE_MS) { return; }
    lastReportedAt = now;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: '${USER_GESTURE_MESSAGE_TYPE}' }));
  }
  // Capturing phase so this still fires even if the ad's own handler calls
  // stopPropagation() on the event before it would otherwise reach here.
  document.addEventListener('touchstart', reportGesture, true);
  document.addEventListener('mousedown', reportGesture, true);

  var AD_KEYWORD_RE = /\\b(ads?|advert(isement)?|sponsor(ed)?|promo(tion)?|banner|popup|doubleclick|googlesyndication|outbrain|taboola)\\b/i;

  function hideAdElements() {
    var candidates = document.querySelectorAll('iframe, ins, div, section, aside');
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var identifier =
        (el.className ? String(el.className) : '') +
        ' ' + (el.id || '') +
        ' ' + (el.getAttribute('src') || '');
      if (AD_KEYWORD_RE.test(identifier)) {
        el.style.setProperty('display', 'none', 'important');
      }
    }
  }

  hideAdElements();

  var pending = false;
  function scheduleHide() {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      hideAdElements();
    }, 500);
  }

  var observer = new MutationObserver(scheduleHide);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  true;
})();
`;
