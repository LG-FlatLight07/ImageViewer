/// <reference types="node" />
import { runInNewContext } from 'vm';
import { JSDOM } from 'jsdom';
import {
  parseReaderSnapshot,
  READER_SNAPSHOT_FUNCTION,
  usesStrictReader,
  readerFailureMessage,
} from '../readerSnapshot';
import { parseNetworkImageMessage } from '../networkImages';

const page = 'https://komiflo.com/#!/comics/123/read/page/1';
const png = 'data:image/png;base64,iVBORw0KGgoAAA==';
function snapshot(
  html: string,
  blocked: boolean | string = false,
  url = page,
  visible?: 'reader' | 'overlay' | 'parent' | 'transparent-ui' | 'opaque-ui',
) {
  const dom = new JSDOM(html, { url });
  const { window } = dom;
  for (const node of window.document.querySelectorAll('img,canvas')) {
    Object.defineProperties(node, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 2200 },
      complete: { value: true },
    });
    node.getBoundingClientRect = () =>
      ({ width: 300, height: 400, left: 50, top: 100, right: 350, bottom: 500 }) as DOMRect;
    if (node.tagName === 'CANVAS') {
      (node as unknown as HTMLCanvasElement).toDataURL = () => {
        if (blocked === 'empty') return undefined as unknown as string;
        if (blocked) {
          const error = new Error('Canvas export failed');
          error.name = typeof blocked === 'string' ? blocked : 'SecurityError';
          throw error;
        }
        return png;
      };
    }
  }
  const overlay = window.document.createElement('div');
  overlay.className = 'layer';
  overlay.setAttribute('data-name', 'UI');
  window.document.body.appendChild(overlay);
  const canvas = window.document.querySelector('canvas')!;
  if (visible) {
    window.document.elementFromPoint = () =>
      visible === 'reader' ? canvas : visible === 'parent' ? canvas.parentElement : overlay;
    if (visible === 'transparent-ui' || visible === 'opaque-ui')
      window.document.elementsFromPoint = () => [overlay, canvas];
  }
  return runInNewContext(`(${READER_SNAPSHOT_FUNCTION})()`, {
    URL,
    Set,
    Array,
    Number,
    location: window.location,
    document: window.document,
    window: {
      innerWidth: 400,
      innerHeight: 800,
      getComputedStyle: (node: Element) => ({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        backgroundColor:
          node === overlay && visible !== 'transparent-ui' ? 'rgb(0, 0, 0)' : 'rgba(0, 0, 0, 0)',
        backgroundImage: 'none',
        boxShadow: 'none',
        filter: 'none',
        content: 'none',
      }),
    },
  });
}

it('offers a native crop when PNG export is disabled, without collecting recommendations', () => {
  const result = parseReaderSnapshot(
    snapshot(
      '<div class="layer" data-name="PageView"><canvas width="1359" height="1920"></canvas><div><img src="https://cdn.example/contents/recommend.jpg"></div></div>',
      'empty',
      page,
      'reader',
    ),
  );
  expect(result.images).toEqual([]);
  expect(result.captureRegions).toEqual([{ x: 0.125, y: 0.125, width: 0.75, height: 0.5 }]);
});

it.each(['parent', 'transparent-ui'] as const)(
  'captures visible content when taps hit %s instead of the canvas',
  (visible) => {
    const result = parseReaderSnapshot(
      snapshot(
        '<div class="layer" data-name="PageView"><canvas width="1359" height="1920"></canvas></div>',
        'empty',
        page,
        visible,
      ),
    );
    expect(result.captureRegions).toEqual([{ x: 0.125, y: 0.125, width: 0.75, height: 0.5 }]);
  },
);

it('rejects an opaque UI layer even if the reader is underneath', () => {
  const result = parseReaderSnapshot(
    snapshot(
      '<div class="layer" data-name="PageView"><canvas width="1359" height="1920"></canvas></div>',
      'empty',
      page,
      'opaque-ui',
    ),
  );
  expect(result.captureRegions ?? []).toEqual([]);
  expect(result.captureUnavailable).toContain('別の要素');
});

it('requires review when an overlay prevents automatic visibility confirmation', () => {
  const result = parseReaderSnapshot(
    snapshot(
      '<div class="layer" data-name="PageView"><canvas width="1359" height="1920"></canvas></div>',
      'empty',
      page,
      'overlay',
    ),
  );
  expect(result.captureRegions ?? []).toEqual([]);
  expect(result.reviewCaptureRegions).toEqual([{ x: 0.125, y: 0.125, width: 0.75, height: 0.5 }]);
});

it('never proposes review crops for nested recommendations or unrelated canvases', () => {
  const result = parseReaderSnapshot(
    snapshot(
      '<canvas width="1359" height="1920"></canvas><div class="layer" data-name="PageView"><div><canvas width="1359" height="1920"></canvas></div></div>',
      'empty',
      page,
      'overlay',
    ),
  );
  expect(result.reviewCaptureRegions ?? []).toEqual([]);
});

it('rejects review crop coordinates outside the viewport', () => {
  expect(
    parseReaderSnapshot({
      reviewCaptureRegions: [
        { x: -0.1, y: 0, width: 1, height: 1 },
        { x: 0, y: 0, width: 2, height: 1 },
      ],
    }).reviewCaptureRegions,
  ).toEqual([]);
});

it('excludes same-CDN recommended images, top-page images, and thumbnail variants', () => {
  const result = snapshot(`<img src="https://cdn.example/contents/top.jpg">
    <div class="layer" data-name="PageView">
      <img src="https://cdn.example/contents/main.jpg?exp=2&sig=a%2Fb+z">
      <img src="https://cdn.example/resized/396_desktop_medium_2x/contents/thumb.jpg">
      <img src="https://cdn.example/scrambled/contents/raw.jpg">
      <div><img src="https://cdn.example/contents/recommendation.jpg"></div>
    </div>`);
  expect(result.images.map((item: { src: string }) => item.src)).toEqual([
    'https://cdn.example/contents/main.jpg?exp=2&sig=a%2Fb+z',
  ]);
  expect(result.skipped).toBe(2);
});

it('exports only the reader canvas at its backing resolution', () => {
  const result = snapshot(`<canvas width="2000" height="3000"></canvas>
    <div class="layer" data-name="PageView"><canvas width="1600" height="2200"></canvas>
    <div><canvas width="300" height="400"></canvas></div></div>`);
  expect(result.images).toEqual([{ src: png, width: 1600, height: 2200 }]);
  expect(parseReaderSnapshot(result).images[0].width).toBe(1600);
});

it('reports a tainted canvas without falling back to network thumbnails', () => {
  const result = snapshot(
    '<div class="layer" data-name="PageView"><canvas width="1600" height="2200"></canvas></div>',
    true,
  );
  const message = parseNetworkImageMessage(
    JSON.stringify({
      type: 'NETWORK_IMAGES',
      pageUrl: page,
      pageTitle: 'Title',
      requestId: 'save',
      reader: result,
      images: [{ src: 'https://cdn.example/contents/thumb.jpg', source: 'image', observedAt: 1 }],
    }),
  );
  expect(message?.reader).toMatchObject({
    images: [],
    blocked: 1,
    skipped: 0,
    failures: [{ name: 'SecurityError', message: 'Canvas export failed' }],
  });
  expect(readerFailureMessage(message!.reader!)).toContain('セキュリティ制限');
});

it('preserves other export failures without calling them a security restriction', () => {
  const result = parseReaderSnapshot(
    snapshot(
      '<div class="layer" data-name="PageView"><canvas width="1600" height="2200"></canvas></div>',
      'TypeError',
    ),
  );
  expect(readerFailureMessage(result)).toContain('TypeError: Canvas export failed');
  expect(readerFailureMessage(result)).not.toContain('セキュリティ制限');
});

it('fails closed on home pages, changed DOM and missing reader data', () => {
  expect(snapshot('<div></div>').images).toEqual([]);
  expect(
    snapshot(
      '<div class="layer" data-name="PageView"><img src="https://cdn.example/main.jpg"></div>',
      false,
      'https://komiflo.com/',
    ).images,
  ).toEqual([]);
  expect(parseReaderSnapshot(undefined).images).toEqual([]);
  expect(usesStrictReader('https://komiflo.com.evil.example/')).toBe(false);
});

it('rejects unexpected bridge sources and huge image dimensions', () => {
  const images = [
    'file:///private/file.png',
    'data:text/html;base64,AAAA',
    'https://cdn.example/resized/396/contents/a.jpg',
  ].map((src) => ({ src, width: 1600, height: 2200 }));
  images.push({ src: png, width: 100000, height: 100000 });
  expect(parseReaderSnapshot({ images }).images).toEqual([]);
});
