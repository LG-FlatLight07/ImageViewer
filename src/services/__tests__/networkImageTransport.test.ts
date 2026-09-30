/// <reference types="node" />
import { runInNewContext } from 'vm';
import { NetworkImageTransport, IMAGE_MESSAGE_TRANSPORT_FUNCTION } from '../networkImageTransport';
import { parseNetworkImageMessage } from '../networkImages';

function send(message: object) {
  const parts: string[] = [];
  runInNewContext(`(${IMAGE_MESSAGE_TRANSPORT_FUNCTION})(message)`, {
    message,
    window: { ReactNativeWebView: { postMessage: (part: string) => parts.push(part) } },
  });
  return parts;
}

it('roundtrips a multi-megabyte PNG through small WebView messages without changing it', () => {
  const src = 'data:image/png;base64,iVBORw0KGgo' + 'A'.repeat(3 * 1024 * 1024);
  const message = {
    type: 'NETWORK_IMAGES',
    requestId: 'save',
    pageUrl: 'https://komiflo.com/comics/123/read/page/1',
    pageTitle: '作品名',
    images: [],
    reader: { images: [{ src, width: 1600, height: 2200 }] },
  };
  const parts = send(message);
  expect(parts.length).toBeGreaterThan(60);
  expect(parts.every((part) => part.length < 50000)).toBe(true);
  const transport = new NetworkImageTransport();
  let result: string | null = null;
  for (const part of parts) result = transport.receive(part, 'save');
  expect(JSON.parse(result!)).toEqual(message);
  expect(parseNetworkImageMessage(result!)?.reader?.images[0].src).toBe(src);
});

it('ignores expired requests and reports missing or out of order fragments', () => {
  const parts = send({ requestId: 'save', type: 'NETWORK_IMAGES', data: 'A'.repeat(100000) });
  const transport = new NetworkImageTransport();
  expect(transport.receive(parts[0], 'other')).toBeNull();
  expect(() => transport.receive(parts[1], 'save')).toThrow('INCOMPLETE_TRANSFER');
  expect(transport.receive(parts[0], 'save')).toBeNull();
  transport.clear();
  expect(() => transport.receive(parts[1], 'save')).toThrow('INCOMPLETE_TRANSFER');
});
