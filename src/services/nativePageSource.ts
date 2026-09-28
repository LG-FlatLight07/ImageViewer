/** Fetch outside the page context, so page fetch hooks and Service Workers cannot replace HTML. */
export async function fetchNativePageSource(
  url: string,
): Promise<{ html: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const expected = new URL(url);
    if (!/^https?:$/.test(expected.protocol)) return { html: '', error: 'UNSUPPORTED' };
    const response = await fetch(url, {
      headers: { Accept: 'text/html', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
      credentials: 'omit',
    });
    if (!response.ok) return { html: '', error: `HTTP_${response.status}` };
    const actual = new URL(response.url || url);
    expected.hash = '';
    actual.hash = '';
    if (actual.href !== expected.href) return { html: '', error: 'REDIRECT' };
    if (!/html/i.test(response.headers.get('content-type') || ''))
      return { html: '', error: 'NOT_HTML' };
    if (Number(response.headers.get('content-length')) > 8 * 1024 * 1024)
      return { html: '', error: 'TOO_LARGE' };
    const html = await response.text();
    if (html.length > 8 * 1024 * 1024) return { html: '', error: 'TOO_LARGE' };
    return { html };
  } catch {
    return { html: '', error: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timer);
  }
}
