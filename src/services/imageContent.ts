/** Ignore transparent/near-uniform placeholders, but keep even sparse line art. */
export function hasImageContent(pixels: Uint8Array): boolean {
  const low = [255, 255, 255];
  const high = [0, 0, 0];
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    for (let c = 0; c < 3; c++) {
      const value = pixels[i + c] * alpha + 255 * (1 - alpha);
      low[c] = Math.min(low[c], value);
      high[c] = Math.max(high[c], value);
      if (high[c] - low[c] >= 16) return true;
    }
  }
  return false;
}
