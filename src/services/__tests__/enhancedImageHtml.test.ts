import { JSDOM } from 'jsdom';
import { enhancedImageHtml } from '../enhancedImageHtml';

it('embeds only local image bytes and a brightness-preserving mild sharpening filter', () => {
  const dom = new JSDOM(enhancedImageHtml('AAAA', 'image/png'));
  const doc = dom.window.document;
  expect(doc.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  const kernel = doc
    .querySelector('feConvolveMatrix')!
    .getAttribute('kernelMatrix')!
    .split(' ')
    .map(Number);
  expect(kernel.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  expect(doc.querySelector('script')).toBeNull();
  expect(doc.querySelector('meta[http-equiv]')?.getAttribute('content')).toContain(
    "default-src 'none'",
  );
});

it('rejects HTML injection and unsupported data types', () => {
  expect(() => enhancedImageHtml('"><script>alert(1)</script>', 'image/png')).toThrow();
  expect(() => enhancedImageHtml('AAAA', 'image/svg+xml')).toThrow();
});
