import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createFolder } from '../db/foldersRepository';

const DOWNLOAD_CONCURRENCY = 4;
const INVALID_FILENAME_CHARS = '/\\:*?"<>|';

function applyExclusions(rawName: string, exclusions: string[]): string {
  return exclusions.reduce((name, exclusion) => {
    const trimmed = exclusion.trim();
    if (!trimmed) {
      return name;
    }
    return name.split(trimmed).join('');
  }, rawName);
}

function sanitizeFolderName(rawName: string, exclusions: string[] = []): string {
  const withoutExclusions = applyExclusions(rawName, exclusions);
  const withoutInvalidChars = Array.from(withoutExclusions)
    .map((ch) => (ch.charCodeAt(0) < 0x20 || INVALID_FILENAME_CHARS.includes(ch) ? ' ' : ch))
    .join('');
  const cleaned = withoutInvalidChars.replace(/\s+/g, ' ').trim().slice(0, 80);
  return cleaned.length > 0 ? cleaned : '無題のダウンロード';
}

function resolveUniqueDirectory(baseName: string): Directory {
  const downloadsRoot = new Directory(Paths.document, 'downloads');
  if (!downloadsRoot.exists) {
    downloadsRoot.create({ intermediates: true, idempotent: true });
  }

  let candidateName = baseName;
  for (let attempt = 1; ; attempt += 1) {
    const candidate = new Directory(downloadsRoot, candidateName);
    if (!candidate.exists) {
      return candidate;
    }
    candidateName = `${baseName} (${attempt + 1})`;
  }
}

function inferExtension(url: string): string {
  const withoutQuery = url.split('?')[0];
  const match = withoutQuery.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

async function downloadWithConcurrency(
  urls: string[],
  directory: Directory,
  concurrency: number,
  onEach: () => void,
): Promise<number> {
  let successCount = 0;
  let nextIndex = 0;
  const digits = String(urls.length).length;

  async function worker() {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= urls.length) {
        return;
      }
      const url = urls[index];
      const fileName = `${String(index + 1).padStart(digits, '0')}.${inferExtension(url)}`;
      try {
        await File.downloadFileAsync(url, new File(directory, fileName), { idempotent: true });
        successCount += 1;
      } catch {
        // skip failed downloads and continue with the rest of the batch
      } finally {
        onEach();
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return successCount;
}

export async function downloadImagesToNewFolder(
  db: SQLiteDatabase,
  options: {
    folderName: string;
    sourceUrl: string;
    imageUrls: string[];
    folderNameExclusions?: string[];
    onProgress?: (completed: number, total: number) => void;
  },
): Promise<{ folderId: string; successCount: number; failureCount: number }> {
  const baseName = sanitizeFolderName(options.folderName, options.folderNameExclusions);
  const directory = resolveUniqueDirectory(baseName);
  directory.create({ intermediates: true, idempotent: true });

  const total = options.imageUrls.length;
  let completed = 0;
  const successCount = await downloadWithConcurrency(
    options.imageUrls,
    directory,
    DOWNLOAD_CONCURRENCY,
    () => {
      completed += 1;
      options.onProgress?.(completed, total);
    },
  );

  const dirPath = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
  const folder = await createFolder(db, {
    name: directory.name,
    parentId: null,
    dirPath,
    sourceUrl: options.sourceUrl,
    imageCount: successCount,
  });

  return { folderId: folder.id, successCount, failureCount: total - successCount };
}
