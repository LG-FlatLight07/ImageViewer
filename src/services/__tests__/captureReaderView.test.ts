import type { View } from 'react-native';
import { captureReaderView } from '../captureReaderView';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { ImageManipulator } from 'expo-image-manipulator';
import { removePreview } from '../verifyNetworkImage';

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async () => 'file:///shot.png'),
  releaseCapture: jest.fn(),
}));
jest.mock('../verifyNetworkImage', () => ({ removePreview: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { PNG: 'png' },
}));

it('crops at native resolution, encodes PNG and releases all temporary captures', async () => {
  const source = { width: 1080, height: 1920, release: jest.fn() };
  const result = {
    release: jest.fn(),
    saveAsync: jest.fn(async () => ({
      uri: 'file:///crop.png',
      width: 864,
      height: 1536,
      base64: 'iVBORw0KGgoAAA==',
    })),
  };
  const original = { release: jest.fn(), renderAsync: jest.fn(async () => source) };
  const crop = { crop: jest.fn(), release: jest.fn(), renderAsync: jest.fn(async () => result) };
  (ImageManipulator.manipulate as jest.Mock)
    .mockReturnValueOnce(original)
    .mockReturnValueOnce(crop);
  const ref = { current: {} as View };
  const images = await captureReaderView(ref, [{ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }]);
  expect(captureRef).toHaveBeenCalledWith(ref, { format: 'png', result: 'tmpfile' });
  expect(crop.crop).toHaveBeenCalledWith({ originX: 108, originY: 192, width: 864, height: 1536 });
  expect(result.saveAsync).toHaveBeenCalledWith({ format: 'png', compress: 1, base64: true });
  expect(images[0]).toMatchObject({
    src: 'data:image/png;base64,iVBORw0KGgoAAA==',
    width: 864,
    height: 1536,
  });
  expect(removePreview).toHaveBeenCalledWith('file:///crop.png');
  expect(releaseCapture).toHaveBeenCalledWith('file:///shot.png');
  expect(source.release).toHaveBeenCalled();
  expect(original.release).toHaveBeenCalled();
  expect(crop.release).toHaveBeenCalled();
});
