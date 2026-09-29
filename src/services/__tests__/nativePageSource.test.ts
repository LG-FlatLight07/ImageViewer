import { fetchNativePageSource, sourceHtmlUrl } from '../nativePageSource';

const url = 'https://reader.example/book/1';
const originalFetch = global.fetch;

it('resolves the Komiflo hashbang reader route to its source HTML path', async () => {
  const source = 'https://komiflo.com/comics/35347/read/page/1';
  const reader = 'https://komiflo.com/#!/comics/35347/read/page/1';
  expect(sourceHtmlUrl(reader)).toBe(source);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    url: source,
    headers: { get: () => 'text/html' },
    text: async () => '<meta property="og:title" content="作品名">',
  });
  expect((await fetchNativePageSource(reader)).html).toContain('作品名');
  expect(global.fetch).toHaveBeenCalledWith(source, expect.anything());
});

it.each([
  'https://komiflo.com/comics/35347/read/page/1',
  'https://komiflo.com/#!/login',
  'https://other.example/#!/comics/35347/read/page/1',
  'https://komiflo.com/#!/comics/35347/read/page/1/../../login',
])('does not reinterpret unrelated paths or sites: %s', (url) => {
  expect(sourceHtmlUrl(url)).toBe(url);
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

it('gets source HTML through native fetch without copying page credentials', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    url,
    headers: { get: () => 'text/html' },
    text: async () => '<meta property="og:title" content="Book">',
  });
  expect((await fetchNativePageSource(url)).html).toContain('content="Book"');
  expect(global.fetch).toHaveBeenCalledWith(url, expect.objectContaining({ credentials: 'omit' }));
});

it('rejects redirected login HTML', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, url: 'https://reader.example/login' });
  expect(await fetchNativePageSource(url)).toEqual({ html: '', error: 'REDIRECT' });
});

it('reports network errors', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  expect(await fetchNativePageSource(url)).toEqual({ html: '', error: 'NETWORK_ERROR' });
});
