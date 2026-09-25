import type { SQLiteDatabase } from 'expo-sqlite';
import { getFolder, listFolders } from './foldersRepository';
import { listFolderImageUris } from './folderImages';

/** Uses the originating list's snapshot so filters and sort order survive navigation. */
export async function listViewerImages(
  db: SQLiteDatabase,
  folderId: string,
  folderOrder?: string[],
): Promise<{ uri: string; folderId: string }[]> {
  const folder = await getFolder(db, folderId);
  if (!folder) return [];
  const current = (await listFolderImageUris(folder)).map((uri) => ({ uri, folderId }));
  const order =
    folderOrder ??
    (
      await listFolders(db, {
        parentId: folder.parentId,
        sortKey: 'name',
      })
    ).map((sibling) => sibling.id);
  const ownIndex = order.indexOf(folderId);
  const nextId = ownIndex >= 0 ? order[ownIndex + 1] : undefined;
  if (!nextId) return current;
  const nextFolder = await getFolder(db, nextId);
  const next = (await listFolderImageUris(nextFolder)).map((uri) => ({ uri, folderId: nextId }));
  return [...current, ...next];
}
