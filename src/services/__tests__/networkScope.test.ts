import { runInNewContext } from 'vm';
import { networkScope, NETWORK_SCOPE_FUNCTION } from '../networkScope';

it('preserves same-work pages and separates homepage, detail page and other works', () => {
  const a = networkScope('https://komiflo.com/#!/comics/35347/read/page/1');
  expect(networkScope('https://komiflo.com/comics/35347/read/page/2')).toBe(a);
  for (const url of [
    'https://komiflo.com/',
    'https://komiflo.com/#!/comics/34999/read/page/1',
    'https://komiflo.com/comics/35347',
  ])
    expect(networkScope(url)).not.toBe(a);
});

it.each([
  'https://komiflo.com/#!/comics/35347/read/page/3',
  'https://komiflo.com/comics/35347/read/page/1',
  'https://reader.example/book/1?page=2',
  'https://reader.example/book/1/page/2',
  'https://reader.example/?id=1&page=2',
])('uses identical scope keys in native and injected code: %s', (url) => {
  expect(runInNewContext(`(${NETWORK_SCOPE_FUNCTION})(url)`, { URL, URLSearchParams, url })).toBe(
    networkScope(url),
  );
});
