import { hasImageContent } from '../imageContent';

function solid(r: number, g: number, b: number, a = 255) {
  return new Uint8Array(Array.from({ length: 64 }, () => [r, g, b, a]).flat());
}

it('rejects white, black, solid color and fully transparent placeholders', () => {
  for (const pixels of [
    solid(255, 255, 255),
    solid(0, 0, 0),
    solid(255, 0, 0),
    solid(0, 0, 0, 0),
  ]) {
    expect(hasImageContent(pixels)).toBe(false);
  }
});

it('ignores nearly white compression noise', () => {
  const pixels = solid(255, 255, 255);
  pixels[0] = 250;
  expect(hasImageContent(pixels)).toBe(false);
});

it('retains sparse drawings on a mostly white page', () => {
  const pixels = solid(255, 255, 255);
  pixels[20] = pixels[21] = pixels[22] = 60;
  expect(hasImageContent(pixels)).toBe(true);
});

it('retains color detail with equal luminance', () => {
  const pixels = solid(255, 0, 0);
  pixels[0] = 0;
  pixels[1] = 255;
  expect(hasImageContent(pixels)).toBe(true);
});

it('ignores invisible RGB variation', () => {
  const pixels = solid(255, 255, 255, 0);
  pixels[0] = 0;
  expect(hasImageContent(pixels)).toBe(false);
});
