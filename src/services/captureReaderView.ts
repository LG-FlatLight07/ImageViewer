import type { RefObject } from 'react';
import type { View } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { captureCrop, type ReaderCaptureRegion } from './readerCaptureGeometry';
import { removePreview } from './verifyNetworkImage';
import type { DetectedImage } from './imageGrouping';
import { MAX_READER_PAYLOAD } from './readerSnapshot';

export async function captureReaderView(
  ref: RefObject<View | null>,
  regions: ReaderCaptureRegion[],
): Promise<DetectedImage[]> {
  // Lazy import lets an older binary keep its ordinary browser/download features.
  // This native module requires a new Android/iOS build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const viewShot = require('react-native-view-shot') as typeof import('react-native-view-shot');
  const { captureRef, releaseCapture } = viewShot;
  const uri = await captureRef(ref, { format: 'png', result: 'tmpfile' });
  const dimensions = ImageManipulator.manipulate(uri);
  const images: DetectedImage[] = [];
  let size = 0;
  try {
    const original = await dimensions.renderAsync();
    const width = original.width,
      height = original.height;
    original.release();
    for (const region of regions) {
      const crop = captureCrop(region, width, height);
      const context = ImageManipulator.manipulate(uri);
      try {
        context.crop(crop); // No resize: preserve the native screenshot pixels.
        const image = await context.renderAsync();
        try {
          const output = await image.saveAsync({
            format: SaveFormat.PNG,
            compress: 1,
            base64: true,
          });
          try {
            if (!output.base64) throw new Error('CAPTURE_EMPTY');
            const src = `data:image/png;base64,${output.base64}`;
            size += src.length;
            if (size > MAX_READER_PAYLOAD) throw new Error('CAPTURE_TOO_LARGE');
            images.push({
              id: `capture-${images.length}`,
              src,
              width: output.width,
              height: output.height,
              sequenceNumber: null,
            });
          } finally {
            removePreview(output.uri);
          }
        } finally {
          image.release();
        }
      } finally {
        context.release();
      }
    }
    return images;
  } finally {
    dimensions.release();
    releaseCapture(uri);
  }
}
