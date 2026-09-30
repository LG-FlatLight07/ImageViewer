/// <reference types="node" />
import { runInNewContext } from 'vm';
import { TextDecoder, TextEncoder } from 'util';
import { JSDOM } from 'jsdom';
import {
  contentImageUrl,
  NETWORK_IMAGE_SCRIPT,
  networkImageSnapshotScript,
  networkImageSourceRetryScript,
  NetworkImageCollection,
  parseNetworkImageMessage,
  snapshotFailureDetails,
} from '../networkImages';

const page = 'https://reader.example/book/1';
const first = 'https://cdn.example/contents/abcdef?exp=123&sig=a%2Fb+z&x=1&x=2';
const second = 'https://cdn.example/contents/987654';

it('takes a strict reader snapshot even when unrelated Resource Timing is unavailable', () => {
  const h = harness();
  Object.assign(h.sandbox, { DOMParser: new JSDOM('').window.DOMParser });
  const url = 'https://komiflo.com/#!/comics/123/read/page/1';
  h.context.location.href = url;
  h.context.performance.getEntriesByType = () => {
    throw new Error('Timing unavailable');
  };
  h.run(networkImageSourceRetryScript('reader', url, ''));
  const result = parseNetworkImageMessage(h.messages[h.messages.length - 1]);
  expect(result?.requestId).toBe('reader');
  expect(result?.reader?.images).toEqual([]);
  expect(result?.images).toEqual([]);
});

it('shows bounded diagnostics without signed URLs', () => {
  expect(
    snapshotFailureDetails({
      code: 'SNAPSHOT_FAILED',
      stage: 'READER',
      errorName: 'TypeError',
      detail: 'Unable to read https://cdn.example/img?sig=secret',
    }),
  ).toBe('SNAPSHOT_FAILED\n失敗箇所: 本編表示領域の取得\nTypeError: Unable to read [URL]');
});

it('reports a reader snapshot exception on the native-title retry path', async () => {
  const h = harness();
  Object.assign(h.sandbox, { DOMParser: new JSDOM('').window.DOMParser });
  const url = 'https://komiflo.com/#!/comics/123/read/page/1';
  h.context.location.href = url;
  h.context.document.querySelectorAll.mockImplementation(() => {
    throw new Error('Reader DOM failure');
  });
  h.run(networkImageSourceRetryScript('retry-failed', url, ''));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(JSON.parse(h.messages[h.messages.length - 1])).toEqual({
    type: 'NETWORK_IMAGES_ERROR',
    requestId: 'retry-failed',
    code: 'SNAPSHOT_FAILED',
    stage: 'READER',
    errorName: 'Error',
    detail: 'Reader DOM failure',
  });
});

it('returns an error response when DOM scanning throws instead of silently timing out', async () => {
  const h = harness();
  h.context.document.querySelector.mockImplementation(() => {
    throw new Error('DOM failure');
  });
  h.run(networkImageSnapshotScript('failed-save'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(JSON.parse(h.messages[h.messages.length - 1])).toEqual({
    type: 'NETWORK_IMAGES_ERROR',
    requestId: 'failed-save',
    code: 'SNAPSHOT_FAILED',
    stage: 'TITLE',
    errorName: 'Error',
    detail: 'DOM failure',
  });
});

function harness(entries: object[] = []) {
  const messages: string[] = [];
  const callbacks: Record<string, (event: unknown) => void> = {};
  const fetch = jest.fn();
  class XHR {
    status = 200;
    responseType = '';
    responseText = '';
    responseURL = '';
    mime = 'application/json';
    callbacks: Record<string, () => void> = {};
    getResponseHeader() {
      return this.mime;
    }
    addEventListener(name: string, cb: () => void) {
      this.callbacks[name] = cb;
    }
    send() {}
  }
  let observer: (list: { getEntries: () => object[] }) => void = () => {};
  const context = {
    TextDecoder,
    URL,
    URLSearchParams,
    Map,
    Date,
    JSON,
    Array,
    Number,
    Object,
    String,
    performance: { now: () => 100, getEntriesByType: () => entries },
    document: {
      images: [],
      baseURI: page,
      title: 'Book',
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      addEventListener: (name: string, cb: (event: unknown) => void) => {
        callbacks[name] = cb;
      },
    },
    location: { href: page },
    setTimeout: jest.fn(() => 1),
    clearTimeout: jest.fn(),
    fetch,
    XMLHttpRequest: XHR,
    PerformanceObserver: class {
      constructor(cb: typeof observer) {
        observer = cb;
      }
      observe() {}
    },
    ReactNativeWebView: { postMessage: (message: string) => messages.push(message) },
    addEventListener: (name: string, cb: (event: unknown) => void) => {
      callbacks[name] = cb;
    },
  };
  const sandbox = { ...context, window: context };
  const run = (script: string) => runInNewContext(script, sandbox);
  run(NETWORK_IMAGE_SCRIPT);
  const snapshot = () => {
    run(`${NETWORK_IMAGE_SCRIPT}\nwindow.__myGalleryNetworkImages.snapshot('test');`);
    return parseNetworkImageMessage(messages[messages.length - 1])!;
  };
  return {
    run,
    snapshot,
    context,
    XHR,
    fetch,
    messages,
    sandbox,
    observe: (resources: object[]) => observer({ getEntries: () => resources }),
    callbacks,
  };
}

it('preserves exact signed queries and accepts hashes without numeric grouping', () => {
  expect(contentImageUrl(first, page)).toBe(first);
  expect(contentImageUrl('/contents/opaque', page)).toBe('https://reader.example/contents/opaque');
  for (const path of [
    '/attributes/a.jpg',
    '/contents/thumb/a.jpg',
    '/contents/a_banner.jpg',
    '/contents/ui/a',
    '/other/a.jpg?path=/contents/',
    '/contents/data.json',
  ]) {
    expect(contentImageUrl(path, page)).toBeNull();
  }
});

it('captures buffered image requests without DOM nodes and ignores non-image requests', () => {
  const h = harness([
    { name: first, initiatorType: 'img', startTime: 1 },
    { name: second, initiatorType: 'fetch', startTime: 2 },
    { name: 'https://cdn.example/attributes/a.jpg', initiatorType: 'img', startTime: 3 },
  ]);
  expect(h.snapshot().images.map((image) => image.src)).toEqual([first]);
  h.observe([{ name: second, contentType: 'image/webp', initiatorType: 'fetch', startTime: 4 }]);
  expect(h.snapshot().images.map((image) => image.src)).toEqual([first, second]);
});

it('collects response URLs in array order while excluding labelled thumbnails', () => {
  const h = harness();
  const xhr = new h.XHR();
  xhr.responseURL = 'https://api.example/chapter';
  xhr.responseText = JSON.stringify({
    pages: [first, second, first],
    thumbnail: '/contents/small',
  });
  xhr.send();
  xhr.callbacks.loadend();
  expect(h.snapshot().images.map((image) => image.src)).toEqual([first, second]);
});

it('recovers image fetch/XHR requests which preceded injection without exposed MIME', () => {
  const high = 'https://cdn.example/contents/page.webp?exp=123&sig=a%2Fb';
  const h = harness([
    { name: high, initiatorType: 'fetch', startTime: 1 },
    {
      name: 'https://cdn.example/contents/page2.jpg',
      initiatorType: 'xmlhttprequest',
      startTime: 2,
    },
    { name: 'https://cdn.example/attributes/icon.png', initiatorType: 'fetch', startTime: 3 },
    {
      name: 'https://cdn.example/contents/error.jpg',
      contentType: 'text/html',
      initiatorType: 'fetch',
      startTime: 4,
    },
  ]);
  expect(h.snapshot().images.map((i) => i.src)).toEqual([
    high,
    'https://cdn.example/contents/page2.jpg',
  ]);
});

it('collects binary image fetches without consuming the response body', async () => {
  const h = harness();
  const src = 'https://cdn.example/contents/page.jpg?sig=unchanged%2F';
  const response = {
    ok: true,
    url: src,
    headers: { get: () => 'application/octet-stream' },
    clone: jest.fn(),
  };
  h.fetch.mockResolvedValue(response);
  expect(await h.context.fetch(src)).toBe(response);
  for (let i = 0; i < 4; i++) await Promise.resolve();
  expect(h.snapshot().images.map((i) => i.src)).toEqual([src]);
  expect(response.clone).not.toHaveBeenCalled();
});

it('collects blob XHR image URLs with generic binary MIME', () => {
  const h = harness();
  const xhr = new h.XHR();
  xhr.responseURL = 'https://cdn.example/contents/page.png?sig=exact';
  xhr.responseType = 'blob';
  xhr.mime = 'application/octet-stream';
  xhr.send();
  xhr.callbacks.loadend();
  expect(h.snapshot().images.map((i) => i.src)).toEqual([xhr.responseURL]);
});

it('does not wrap fetch twice and returns the original page response unchanged', async () => {
  const h = harness();
  const response = { ok: true, url: first, headers: { get: () => 'image/webp' }, clone: jest.fn() };
  const promise = Promise.resolve(response);
  h.fetch.mockReturnValue(promise);
  const wrapped = h.context.fetch;
  h.run(NETWORK_IMAGE_SCRIPT);
  expect(h.context.fetch).toBe(wrapped);
  expect(h.context.fetch('/image')).toBe(promise);
  await promise;
  expect(response.clone).not.toHaveBeenCalled();
  expect(h.snapshot().images[0].src).toBe(first);
});

it('clears buffered URLs without recovering them on the next snapshot', () => {
  const h = harness([{ name: first, initiatorType: 'img', startTime: 1 }]);
  h.run('window.__myGalleryNetworkImages.clear();');
  expect(h.snapshot().images).toEqual([]);
  h.observe([{ name: second, initiatorType: 'img', startTime: 200 }]);
  expect(h.snapshot().images[0].src).toBe(second);
});

it('merges page turns, de-duplicates whole URLs, and isolates tabs and sites', () => {
  const collection = new NetworkImageCollection();
  const message = (pageUrl: string, src: string, at: number) => ({
    type: 'NETWORK_IMAGES' as const,
    pageUrl,
    pageTitle: 'Book',
    images: [{ src, observedAt: at, source: 'image' as const }],
  });
  collection.merge('tab', message(page, first, 1));
  collection.merge('tab', message(page, first, 2));
  expect(
    collection
      .merge('tab', message('https://reader.example/book/1?page=2', second, 3))
      .map((i) => i.src),
  ).toEqual([first, second]);
  expect(collection.merge('other-tab', message(page, second, 1))).toHaveLength(1);
  expect(collection.merge('tab', message('https://other.example', second, 1))).toHaveLength(1);
  collection.clear('tab');
  expect(collection.merge('tab', { ...message(page, first, 1), images: [] })).toHaveLength(0);
});

it('validates messages before accepting bridge data', () => {
  expect(parseNetworkImageMessage('not json')).toBeNull();
  expect(parseNetworkImageMessage('{"type":"NETWORK_IMAGES","images":[]}')).toBeNull();
});

it('drops homepage resources and late responses after entering a work, but keeps its page turns', async () => {
  const h = harness([{ name: first, initiatorType: 'img', startTime: 1 }]);
  let finish!: (value: unknown) => void;
  h.fetch.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  h.context.fetch('/old-request');
  h.context.performance.now = () => 200;
  h.context.location.href = 'https://reader.example/#!/comics/35347/read/page/1';
  h.callbacks.hashchange({});
  finish({ ok: true, url: first, headers: { get: () => 'image/jpeg' } });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(h.snapshot().images).toEqual([]);
  h.observe([{ name: second, initiatorType: 'img', startTime: 201 }]);
  h.context.location.href = 'https://reader.example/#!/comics/35347/read/page/2';
  h.callbacks.hashchange({});
  expect(h.snapshot().images.map((i) => i.src)).toEqual([second]);
  h.context.performance.now = () => 300;
  h.context.location.href = 'https://reader.example/#!/comics/34999/read/page/1';
  h.callbacks.hashchange({});
  expect(h.snapshot().images).toEqual([]);
});

it('separates native collections for different works on the same domain', () => {
  const collection = new NetworkImageCollection();
  const message = {
    type: 'NETWORK_IMAGES' as const,
    pageUrl: 'https://komiflo.com/',
    pageTitle: 'Site',
    images: [{ src: first, observedAt: 1, source: 'image' as const }],
  };
  collection.merge('tab', message);
  const reader = 'https://komiflo.com/#!/comics/35347/read/page/1';
  collection.navigate('tab', reader);
  expect(collection.merge('tab', { ...message, pageUrl: reader, images: [] })).toEqual([]);
  collection.merge('tab', { ...message, pageUrl: reader });
  expect(
    collection.merge('tab', {
      ...message,
      pageUrl: reader.replace('/page/1', '/page/2'),
      images: [],
    }),
  ).toHaveLength(1);
  expect(
    collection.merge('tab', { ...message, pageUrl: reader.replace('35347', '34999'), images: [] }),
  ).toEqual([]);
});

it('uses the Open Graph title for network download naming', () => {
  const h = harness();
  h.context.document.querySelector.mockReturnValue({ getAttribute: () => ' HOGEHOGE & Book ' });
  expect(h.snapshot().pageTitle).toBe('HOGEHOGE & Book');
  expect(h.context.document.querySelector).toHaveBeenCalledWith('meta[property="og:title"]');
});

it('falls back to the document title when the meta title is absent or blank', () => {
  const h = harness();
  expect(h.snapshot().pageTitle).toBe('Book');
  h.context.document.querySelector.mockReturnValue({ getAttribute: () => '  ' });
  expect(h.snapshot().pageTitle).toBe('Book');
});

it('reads the updated meta title after an in-page navigation', () => {
  const h = harness();
  h.context.document.querySelector.mockReturnValue({ getAttribute: () => 'Chapter 1' });
  expect(h.snapshot().pageTitle).toBe('Chapter 1');
  h.context.document.querySelector.mockReturnValue({ getAttribute: () => 'Chapter 2' });
  expect(h.snapshot().pageTitle).toBe('Chapter 2');
});

function sourceHarness() {
  const h = harness();
  h.context.document.querySelector.mockReturnValue({ getAttribute: () => 'Stale DOM title' });
  const parser = new new JSDOM('').window.DOMParser();
  const parse = jest.fn((html: string) => parser.parseFromString(html, 'text/html'));
  Object.assign(h.sandbox, {
    DOMParser: class {
      parseFromString = parse;
    },
  });
  h.fetch.mockResolvedValue({
    ok: true,
    url: page,
    headers: {
      get: (name: string) => (name === 'content-type' ? 'text/html; charset=utf-8' : null),
    },
    text: async () => '<meta property="og:title" content="HOGEHOGE &amp; Story">',
  });
  async function snapshotSource() {
    h.run(networkImageSnapshotScript('source'));
    for (let i = 0; i < 20; i++) await Promise.resolve();
    return h.messages
      .map(parseNetworkImageMessage)
      .find((message) => message?.requestId === 'source');
  }
  return { ...h, parse, snapshotSource };
}

it('uses native source HTML after page HTML has no metadata, without mixing later navigation', () => {
  const h = sourceHarness();
  const script = networkImageSourceRetryScript(
    'native',
    page,
    '<script>amplitude.getInstance().init("key");</script><meta property="og:title" content="Native &amp; title">',
  );
  h.run(script);
  const result = parseNetworkImageMessage(h.messages[h.messages.length - 1]);
  expect(result?.pageTitle).toBe('Native & title');
  expect(result?.titleFromSource).toBe(true);
  expect(result?.titleSourceError).toBeUndefined();
  const count = h.messages.length;
  h.context.location.href = 'https://reader.example/book/2';
  h.run(script);
  expect(h.messages).toHaveLength(count);
});

it('prefers the current URL source metadata over stale SPA DOM metadata', async () => {
  const h = sourceHarness();
  expect((await h.snapshotSource())?.pageTitle).toBe('HOGEHOGE & Story');
  expect(h.fetch).toHaveBeenCalledWith(
    page,
    expect.objectContaining({ credentials: 'include', cache: 'no-cache' }),
  );
  expect(h.parse).toHaveBeenCalledWith(
    '<meta property="og:title" content="HOGEHOGE &amp; Story">',
    'text/html',
  );
});

it('selects the exact metadata block following amplitude instead of an earlier site title', async () => {
  const h = sourceHarness();
  h.fetch.mockResolvedValue({
    ok: true,
    url: page,
    headers: { get: () => 'text/html' },
    text: async () =>
      '<meta property="og:title" content="サイト名"><script>amplitude.getInstance().init("any-key");</script><meta name="twitter:card" content="summary" /><meta property="og:title" content="HOGEHOGE &amp; &#20316;&#21697;" /><script>window.site = true;</script>',
  });
  const result = await h.snapshotSource();
  expect(result?.pageTitle).toBe('HOGEHOGE & 作品');
  expect(result?.titleFromSource).toBe(true);
});

it('falls back when source lookup fails rather than blocking image selection', async () => {
  const h = sourceHarness();
  h.fetch.mockRejectedValue(new Error('offline'));
  const result = await h.snapshotSource();
  expect(result?.pageTitle).toBe('Stale DOM title');
  expect(result?.titleFromSource).toBe(false);
  expect(result?.titleSourceError).toBe('NETWORK_ERROR');
});

it.each([
  ['HTTP_403', false, 403, 'text/html', '0', ''],
  ['NOT_HTML', true, 200, 'application/json', '0', '{}'],
  ['NOT_FOUND', true, 200, 'text/html', '0', '<meta property="og:title" content=" ">'],
  ['TOO_LARGE', true, 200, 'text/html', '9000000', ''],
])(
  'reports source failure %s without losing the fallback title',
  async (code, ok, status, mime, length, html) => {
    const h = sourceHarness();
    h.fetch.mockResolvedValue({
      ok,
      status,
      url: page,
      headers: { get: (name: string) => (name === 'content-type' ? mime : length) },
      text: async () => html,
    });
    const result = await h.snapshotSource();
    expect(result?.pageTitle).toBe('Stale DOM title');
    expect(result?.titleFromSource).toBe(false);
    expect(result?.titleSourceError).toBe(code);
  },
);

it('reports a stalled source request as a timeout', async () => {
  const h = sourceHarness();
  h.fetch.mockReturnValue(new Promise(() => {}));
  h.run(
    'setTimeout = function (fn, ms) { if (ms === 10000) Promise.resolve().then(fn); return 1; };',
  );
  const result = await h.snapshotSource();
  expect(result?.titleSourceError).toBe('TIMEOUT');
  expect(result?.titleFromSource).toBe(false);
});

it('does not use the title of a redirected login page', async () => {
  const h = sourceHarness();
  h.fetch.mockResolvedValue({
    ok: true,
    url: 'https://reader.example/login',
    headers: { get: () => 'text/html' },
    text: async () => 'Login',
  });
  const result = await h.snapshotSource();
  expect(result?.pageTitle).toBe('Stale DOM title');
  expect(result?.titleSourceError).toBe('REDIRECT');
  expect(h.parse).not.toHaveBeenCalled();
});

it('discards a source result if the displayed page has changed meanwhile', async () => {
  const h = sourceHarness();
  h.fetch.mockImplementation(async () => {
    h.context.location.href = 'https://reader.example/book/2';
    return { ok: false };
  });
  expect(await h.snapshotSource()).toBeUndefined();
});

it('reads a cloned fetch JSON response without consuming the original body', async () => {
  const h = harness();
  const bytes = new TextEncoder().encode(JSON.stringify({ pages: [first, second] }));
  const reader = {
    read: jest
      .fn()
      .mockResolvedValueOnce({ value: bytes, done: false })
      .mockResolvedValue({ done: true }),
    releaseLock: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
  };
  const response = {
    ok: true,
    url: 'https://api.example/pages',
    headers: { get: (key: string) => (key === 'content-type' ? 'application/json' : null) },
    clone: jest.fn(() => ({ body: { getReader: () => reader } })),
    text: jest.fn(),
    json: jest.fn(),
  };
  h.fetch.mockResolvedValue(response);
  await h.context.fetch('/pages');
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(h.snapshot().images.map((image) => image.src)).toEqual([first, second]);
  expect(response.text).not.toHaveBeenCalled();
  expect(response.json).not.toHaveBeenCalled();
  expect(reader.releaseLock).toHaveBeenCalled();
});

it('removes images identified as thumbnails after an early request notification', () => {
  const collection = new NetworkImageCollection();
  const message = {
    type: 'NETWORK_IMAGES' as const,
    pageUrl: page,
    pageTitle: 'Book',
    images: [{ src: first, observedAt: 1, source: 'image' as const }],
  };
  collection.merge('tab', message);
  expect(collection.merge('tab', { ...message, excluded: [first] })).toEqual([]);
});

it('clears the old site even when the new site has no image messages', () => {
  const collection = new NetworkImageCollection();
  const message = {
    type: 'NETWORK_IMAGES' as const,
    pageUrl: page,
    pageTitle: 'Book',
    images: [{ src: first, observedAt: 1, source: 'image' as const }],
  };
  collection.merge('tab', message);
  collection.navigate('tab', 'https://different.example/');
  expect(collection.merge('tab', { ...message, images: [] })).toEqual([]);
});
