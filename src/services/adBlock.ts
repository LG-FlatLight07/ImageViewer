/**
 * Cosmetic ad hiding + popup suppression injected into the WebView. There's
 * no way to do true network-level request blocking from injected page JS
 * (that would need a native module or a proxy), so this only hides elements
 * that look like ads and stops window.open()-based popups — a reasonable
 * scope for a WebView-based in-app browser.
 */
export const AD_BLOCK_SCRIPT = `
(function () {
  if (window.__adBlockInstalled) { true; return; }
  window.__adBlockInstalled = true;

  window.open = function () { return null; };

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
