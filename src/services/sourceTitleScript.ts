// Literal browser source: Hermes cannot serialize a function body with toString().
export const SOURCE_TITLE_FUNCTION = String.raw`function (html) {
  function titleFrom(fragment) {
    var doc = new DOMParser().parseFromString(fragment, 'text/html');
    var metas = doc.querySelectorAll('meta[property="og:title"]');
    for (var i = 0; i < metas.length; i++) {
      var title = (metas[i].getAttribute('content') || '').trim();
      if (title) return title;
    }
    return '';
  }
  // Prefer the metadata block following Amplitude initialization, even when a
  // generic site-level og:title occurs earlier. The analytics key is irrelevant.
  var anchor = /amplitude\s*\.\s*getInstance\s*\([^)]*\)\s*\.\s*init\s*\([\s\S]*?<\/script\s*>/i.exec(html);
  if (anchor) {
    var following = html.slice(anchor.index + anchor[0].length);
    var nextScript = following.search(/<script\b/i);
    var block = nextScript < 0 ? following : following.slice(0, nextScript);
    var preferred = titleFrom(block);
    if (preferred) return preferred;
  }
  return titleFrom(html);
}`;
