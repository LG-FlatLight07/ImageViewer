import { Directory, File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Folder } from './types';

export async function listFolderImageUris(
  folder: Pick<Folder, 'dirPath'> | null,
): Promise<string[]> {
  if (!folder?.dirPath) {
    return [];
  }
  try {
    const directory = new Directory(folder.dirPath);
    if (!directory.exists) {
      return [];
    }
    const files = directory.list().filter((entry): entry is File => entry instanceof File);
    files.sort((a, b) => a.name.localeCompare(b.name));
    return files.map((file) => file.uri);
  } catch {
    return [];
  }
}

export async function deleteImageFiles(uris: string[]): Promise<void> {
  for (const uri of uris) {
    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // best-effort; skip files that can't be removed and continue with the rest
    }
  }
}

export async function deleteFolderImages(
  db: SQLiteDatabase,
  folder: Folder,
  uris: string[],
): Promise<void> {
  await deleteImageFiles(uris);
  // Re-read disk: best-effort deletion may have left some requested files intact.
  const remaining = await listFolderImageUris(folder);
  await db.runAsync(
    'UPDATE download_history SET first_image_uri = ? WHERE folder_id = ?',
    remaining[0] ?? null,
    folder.id,
  );
}

export async function deleteFolderFiles(folder: Folder | null): Promise<void> {
  if (!folder?.dirPath) {
    return;
  }
  try {
    const directory = new Directory(folder.dirPath);
    if (directory.exists) {
      directory.delete();
    }
  } catch {
    // best-effort cleanup; the DB row (deleted separately) is the source of
    // truth for what the app shows, so a stray directory on disk is harmless
  }
}
