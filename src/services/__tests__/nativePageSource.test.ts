import { fetchNativePageSource } from '../nativePageSource';

const url = 'https://reader.example/book/1';
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

it('gets source HTML through native fetch without copying page credentials', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({
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
