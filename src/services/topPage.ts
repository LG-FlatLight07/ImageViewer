import { SEARCH_ENGINES, type SearchEngineKey } from '../store/settingsStore';

/**
 * Sentinel "URL" for the app's built-in top page. Never sent to a real
 * server — screens recognize it by exact string match and swap the
 * WebView's `source` prop from `{ uri }` to `{ html: buildTopPageHtml(...) }`
 * instead of navigating to it.
 */
export const TOP_PAGE_URL = 'imageviewer://home';

const QUERY_PLACEHOLDER = '__QUERY__';

export function buildTopPageHtml(searchEngine: SearchEngineKey): string {
  const engine = SEARCH_ENGINES.find((e) => e.key === searchEngine) ?? SEARCH_ENGINES[0];
  const searchUrlTemplate = engine.searchUrl(QUERY_PLACEHOLDER);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>新しいタブ</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f5f6fa;
    color: #1c1c1e;
  }
  @media (prefers-color-scheme: dark) {
    html, body { background: #101014; color: #f2f2f2; }
    .search-box { background: #1d1d22 !important; border-color: #34343c !important; }
    .search-input { color: #f2f2f2 !important; }
  }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .wrap { width: 100%; max-width: 420px; text-align: center; }
  .icon { font-size: 40px; margin-bottom: 12px; }
  h1 { font-size: 21px; margin: 0 0 6px; font-weight: 700; }
  p.sub { font-size: 14px; opacity: 0.6; margin: 0 0 28px; }
  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #fff;
    border: 1px solid #e2e2e6;
    border-radius: 999px;
    padding: 6px 6px 6px 18px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  }
  .search-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 15px;
    background: transparent;
    padding: 10px 0;
  }
  button {
    border: none;
    background: #3b82f6;
    color: #fff;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="icon">🔍</div>
    <h1>検索を始める</h1>
    <p class="sub">気になるキーワードを入力してWebを検索しましょう</p>
    <form id="search-form" class="search-box">
      <input
        id="q"
        class="search-input"
        type="text"
        inputmode="search"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        placeholder="検索キーワードを入力"
        autofocus
      />
      <button type="submit" aria-label="検索">➜</button>
    </form>
  </div>
  <script>
    document.getElementById('search-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = document.getElementById('q').value.trim();
      if (!q) { return; }
      window.location.href = ${JSON.stringify(searchUrlTemplate)}.replace(
        ${JSON.stringify(QUERY_PLACEHOLDER)},
        encodeURIComponent(q),
      );
    });
  </script>
</body>
</html>`;
}
