import type { SQLiteDatabase } from 'expo-sqlite';
import type { Folder } from '../types';
import { deleteFolderImages } from '../folderImages';

const mockFiles = new Set<string>();
let mockFailedDelete: string | null = null;
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get name() {
      return this.uri.split('/').pop();
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    delete() {
      if (this.uri === mockFailedDelete) throw new Error('File is busy');
      mockFiles.delete(this.uri);
    }
  }
  return {
    File,
    Directory: class {
      exists = true;
      list() {
        return Array.from(mockFiles).map((uri) => new File(uri));
      }
    },
  };
});

const runAsync = jest.fn();
const db = { runAsync } as unknown as SQLiteDatabase;
const folder = { id: 'folder', dirPath: 'file:///folder' } as Folder;
const first = 'file:///folder/01.jpg';
const second = 'file:///folder/02.jpg';
beforeEach(() => {
  mockFiles.clear();
  mockFiles.add(first);
  mockFiles.add(second);
  mockFailedDelete = null;
  runAsync.mockClear();
});

it('updates the thumbnail to a remaining image after deleting the first', async () => {
  await deleteFolderImages(db, folder, [first]);
  expect(runAsync).toHaveBeenCalledWith(expect.any(String), second, 'folder');
});

it('clears the thumbnail after deleting all images', async () => {
  await deleteFolderImages(db, folder, [first, second]);
  expect(runAsync).toHaveBeenCalledWith(expect.any(String), null, 'folder');
});

it('uses actual remaining files when a deletion fails', async () => {
  mockFailedDelete = first;
  await deleteFolderImages(db, folder, [first]);
  expect(runAsync).toHaveBeenCalledWith(expect.any(String), first, 'folder');
});
