import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';
import { downloadImagesToNewFolder } from '../downloadService';
import { recordDownloadHistory } from '../../db/downloadHistoryRepository';

const mockWrites: { uri: string; body: string; options: unknown }[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents' },
  Directory: class {
    exists = false;
    name: string;
    uri: string;
    constructor(parent: string | { uri: string }, name: string) {
      this.name = name;
      this.uri = `${typeof parent === 'string' ? parent : parent.uri}/${name}`;
    }
    create() {}
  },
  File: class {
    uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}/${name}`;
    }
    write(body: string, options: unknown) {
      mockWrites.push({ uri: this.uri, body, options });
    }
    static downloadFileAsync: jest.Mock = jest.fn(async () => undefined);
  },
}));
jest.mock('../../db/foldersRepository', () => ({
  createFolder: jest.fn(async () => ({ id: 'folder' })),
}));
jest.mock('../../db/downloadHistoryRepository', () => ({
  recordDownloadHistory: jest.fn(async () => {}),
}));

it('saves canvas PNG bytes unchanged and records the viewed work URL/title', async () => {
  const base64 = 'iVBORw0KGgoAAA==';
  const sourceUrl = 'https://komiflo.com/#!/comics/123/read/page/1';
  const result = await downloadImagesToNewFolder({} as SQLiteDatabase, {
    folderName: 'Source title',
    sourceUrl,
    imageUrls: [`data:image/png;base64,${base64}`],
  });
  expect(result.successCount).toBe(1);
  expect(File.downloadFileAsync).not.toHaveBeenCalled();
  expect(mockWrites).toEqual([
    {
      uri: 'file:///documents/downloads/Source title/1.png',
      body: base64,
      options: { encoding: 'base64' },
    },
  ]);
  expect(recordDownloadHistory).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ pageUrl: sourceUrl, pageTitle: 'Source title', imageCount: 1 }),
  );
});
