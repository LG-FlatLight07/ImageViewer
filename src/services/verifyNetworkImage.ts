import { File, Paths } from 'expo-file-system';
import { createDownloadResumable } from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { randomUUID } from 'expo-crypto';
import { decode } from 'jpeg-js';
import { hasImageContent } from './imageContent';

export function removePreview(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* Cache cleanup. */
  }
}

/** Decode locally so CDN images can be checked without canvas/CORS restrictions. */
export async function verifyNetworkImage(src: string, sourceUrl: string, signal: AbortSignal) {
  const file = new File(Paths.cache, `network-check-${randomUUID()}`);
  let preview: string | undefined;
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let image: Awaited<ReturnType<NonNullable<typeof context>['renderAsync']>> | undefined;
  try {
    for (const headers of [{ Referer: sourceUrl, Origin: new URL(sourceUrl).origin }, undefined]) {
      if (signal.aborted) return null;
      const task = createDownloadResumable(src, file.uri, { headers });
      const cancel = () => {
        void task.cancelAsync().catch(() => {});
      };
      signal.addEventListener('abort', cancel);
      const timer = setTimeout(cancel, 15000);
      try {
        const result = await task.downloadAsync();
        if (result && result.status >= 200 && result.status < 300) break;
        if (!headers) return null;
      } catch {
        if (!headers) return null;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
      }
    }
    if (signal.aborted || !file.exists || !file.size) return null;
    context = ImageManipulator.manipulate(file.uri);
    image = await context.renderAsync();
    const width = image.width,
      height = image.height;
    if (width <= 16 || height <= 16) return null;
    image.release();
    image = undefined;
    context.resize({ width: 192, height: 192 });
    image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
    preview = result.uri;
    const decoded = decode(await new File(preview).bytes(), {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 1,
      maxMemoryUsageInMB: 16,
    });
    if (signal.aborted || !hasImageContent(decoded.data)) return null;
    const keptPreview = preview;
    preview = undefined;
    return { previewUri: keptPreview, width, height };
  } catch {
    return null; // HTML/error bodies and corrupt/unsupported images are not selectable.
  } finally {
    image?.release();
    context?.release();
    removePreview(file.uri);
    if (preview) removePreview(preview);
  }
}
