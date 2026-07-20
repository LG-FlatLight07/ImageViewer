import { Directory, File } from 'expo-file-system';

import type { Folder } from './types';

export async function listFolderImageUris(folder: Folder | null): Promise<string[]> {
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
