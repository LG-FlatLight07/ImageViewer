/// <reference types="node" />
import { runInNewContext } from 'vm';
import { JSDOM } from 'jsdom';
import { parseReaderSnapshot, READER_SNAPSHOT_FUNCTION, usesStrictReader } from '../readerSnapshot';
import { parseNetworkImageMessage } from '../networkImages';

const page = 'https://komiflo.com/#!/comics/123/read/page/1';
const png = 'data:image/png;base64,iVBORw0KGgoAAA==';
function snapshot(html: string, blocked = false, url = page) {
  const dom = new JSDOM(html, { url });
  const { window } = dom;
  for (const node of window.document.querySelectorAll('img,canvas')) {
    Object.defineProperties(node, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 2200 },
      complete: { value: true },
    });
    node.getBoundingClientRect = () => ({ width: 300, height: 400 }) as DOMRect;
    if (node.tagName === 'CANVAS') {
      (node as unknown as HTMLCanvasElement).toDataURL = () => {
        if (blocked) throw new Error('SecurityError');
        return png;
      };
    }
  }
  return runInNewContext(`(${READER_SNAPSHOT_FUNCTION})()`, {
    URL,
    Set,
    Array,
    Number,
    location: window.location,
    document: window.document,
    window: { getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }) },
  });
}

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
  expect(message?.reader).toEqual({ images: [], blocked: 1, skipped: 0 });
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
