import { parseImageScanMessage } from '../imageExtraction';

describe('parseImageScanMessage', () => {
  it('parses a valid scan result payload', () => {
    const payload = JSON.stringify({
      type: 'IMAGE_SCAN_RESULT',
      pageTitle: 'Example Page',
      images: [{ src: 'https://example.com/a.jpg', width: 400, height: 600, isLikelyAd: false }],
    });

    const result = parseImageScanMessage(payload);
    expect(result).not.toBeNull();
    expect(result?.pageTitle).toBe('Example Page');
    expect(result?.images).toHaveLength(1);
  });

  it('returns null for malformed JSON', () => {
    expect(parseImageScanMessage('not json')).toBeNull();
  });

  it('returns null for unrelated message payloads', () => {
    expect(parseImageScanMessage(JSON.stringify({ type: 'SOME_OTHER_MESSAGE' }))).toBeNull();
  });
});
