/// <reference types="node" />
import { runInNewContext } from 'vm';
import { TextDecoder, TextEncoder } from 'util';
import {
  contentImageUrl,
  NETWORK_IMAGE_SCRIPT,
  networkImageSnapshotScript,
  NetworkImageCollection,
  parseNetworkImageMessage,
} from '../networkImages';

const page = 'https://reader.example/book/1';
const first = 'https://cdn.example/contents/abcdef?exp=123&sig=a%2Fb+z&x=1&x=2';
const second = 'https://cdn.example/contents/987654';

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
    addEventListener: jest.fn(),
  };
  const sandbox = { ...context, window: context };
  const run = (script: string) => runInNewContext(script, sandbox);
  run(NETWORK_IMAGE_SCRIPT);
  const snapshot = () => {
    run(networkImageSnapshotScript('test'));
    return parseNetworkImageMessage(messages[messages.length - 1])!;
  };
  return {
    run,
    snapshot,
    context,
    XHR,
    fetch,
    observe: (resources: object[]) => observer({ getEntries: () => resources }),
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
    collection.merge('tab', message('https://reader.example/book/2', second, 3)).map((i) => i.src),
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
