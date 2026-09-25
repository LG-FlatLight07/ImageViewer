import { verifyNetworkImage } from '../verifyNetworkImage';

const mockDelete = jest.fn();
const mockDownload = jest.fn();
const mockRender = jest.fn();
const mockDecode = jest.fn();
const mockCancel = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: class {
    uri: string;
    exists = true;
    size = 100;
    constructor(...paths: string[]) {
      this.uri = paths.join('/');
    }
    bytes() {
      return new Uint8Array();
    }
    delete() {
      mockDelete(this.uri);
    }
  },
}));
jest.mock('expo-file-system/legacy', () => ({
  createDownloadResumable: (...args: unknown[]) => {
    mockDownload(...args);
    return { downloadAsync: async () => ({ status: 200 }), cancelAsync: mockCancel };
  },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test' }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      renderAsync: mockRender,
      resize: jest.fn(),
      release: jest.fn(),
    }),
  },
}));
jest.mock('jpeg-js', () => ({ decode: () => mockDecode() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockRender.mockResolvedValue({
    width: 800,
    height: 1200,
    release: jest.fn(),
    saveAsync: async () => ({ uri: 'file:///cache/preview.jpg' }),
  });
  mockDecode.mockReturnValue({ data: new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]) });
});

it('keeps content, preserves the URL, and cleans the original temporary file', async () => {
  const src = 'https://cdn.example/contents/hash?sig=a%2Fb&exp=123';
  const result = await verifyNetworkImage(
    src,
    'https://reader.example/',
    new AbortController().signal,
  );
  expect(result?.previewUri).toBe('file:///cache/preview.jpg');
  expect(mockDownload.mock.calls[0][0]).toBe(src);
  expect(mockDelete).toHaveBeenCalledWith('file:///cache/network-check-test');
  expect(mockDelete).not.toHaveBeenCalledWith('file:///cache/preview.jpg');
});

it('discards white previews and removes their temporary files', async () => {
  mockDecode.mockReturnValue({ data: new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]) });
  expect(
    await verifyNetworkImage(
      'https://cdn.example/contents/a',
      'https://reader.example/',
      new AbortController().signal,
    ),
  ).toBeNull();
  expect(mockDelete).toHaveBeenCalledWith('file:///cache/preview.jpg');
});

it('excludes responses which cannot be decoded as images', async () => {
  mockRender.mockRejectedValue(new Error('Not an image'));
  expect(
    await verifyNetworkImage(
      'https://cdn.example/contents/a',
      'https://reader.example/',
      new AbortController().signal,
    ),
  ).toBeNull();
});

it('does not start requests after leaving the screen', async () => {
  const controller = new AbortController();
  controller.abort();
  expect(
    await verifyNetworkImage(
      'https://cdn.example/contents/a',
      'https://reader.example/',
      controller.signal,
    ),
  ).toBeNull();
  expect(mockDownload).not.toHaveBeenCalled();
});
