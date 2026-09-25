import type { SQLiteDatabase } from 'expo-sqlite';
import { listViewerImages } from '../viewerImages';
import { getFolder, listFolders } from '../foldersRepository';
import { listFolderImageUris } from '../folderImages';

jest.mock('../foldersRepository', () => ({ getFolder: jest.fn(), listFolders: jest.fn() }));
jest.mock('../folderImages', () => ({ listFolderImageUris: jest.fn() }));

const db = {} as SQLiteDatabase;
beforeEach(() => {
  jest.clearAllMocks();
  (getFolder as jest.Mock).mockImplementation(async (_db, id) => ({ id, parentId: null }));
  (listFolderImageUris as jest.Mock).mockImplementation(async (folder) =>
    folder ? [`file:///${folder.id}/01.jpg`] : [],
  );
  (listFolders as jest.Mock).mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});

it('follows the displayed descending order instead of alphabetical order', async () => {
  const images = await listViewerImages(db, 'c', ['c', 'b', 'a']);
  expect(images.map((image) => image.uri)).toEqual(['file:///c/01.jpg', 'file:///b/01.jpg']);
  expect(listFolders).not.toHaveBeenCalled();
});

it('preserves filtered results, including folders with different parents', async () => {
  const images = await listViewerImages(db, 'a', ['a', 'c']);
  expect(images.map((image) => image.folderId)).toEqual(['a', 'c']);
  expect(listFolders).not.toHaveBeenCalled();
});

it('stops at the end of the visible list', async () => {
  expect(await listViewerImages(db, 'a', ['c', 'a'])).toHaveLength(1);
});

it('does not append an unrelated folder if the current folder is absent', async () => {
  expect(await listViewerImages(db, 'a', ['b', 'c'])).toHaveLength(1);
});

it('handles a next folder deleted since the list was opened', async () => {
  (getFolder as jest.Mock).mockImplementation(async (_db, id) => (id === 'b' ? null : { id }));
  expect(await listViewerImages(db, 'a', ['a', 'b'])).toHaveLength(1);
});
