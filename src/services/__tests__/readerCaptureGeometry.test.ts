import { captureCrop, parseCaptureRegions } from '../readerCaptureGeometry';

it('uses native screenshot pixels, preserving high DPI without upscaling', () => {
  expect(captureCrop({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, 1080, 1920)).toEqual({
    originX: 108,
    originY: 192,
    width: 864,
    height: 1536,
  });
});

it('rounds inward to keep browser margins out of the PNG', () => {
  expect(captureCrop({ x: 0.1001, y: 0.1001, width: 0.7998, height: 0.7998 }, 1000, 1000)).toEqual({
    originX: 101,
    originY: 101,
    width: 798,
    height: 798,
  });
});

it('rejects invalid, offscreen and tiny capture regions', () => {
  expect(
    parseCaptureRegions([
      { x: -0.1, y: 0, width: 1, height: 1 },
      { x: 0, y: 0, width: 2, height: 1 },
      { x: 0, y: 0, width: NaN, height: 1 },
    ]),
  ).toEqual([]);
  expect(() => captureCrop({ x: 0, y: 0, width: 0.01, height: 0.01 }, 1000, 1000)).toThrow(
    'CAPTURE_TOO_SMALL',
  );
});
