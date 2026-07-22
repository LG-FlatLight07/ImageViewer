import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createFolder } from '../db/foldersRepository';
import { recordDownloadHistory } from '../db/downloadHistoryRepository';

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

function buildDownloadHeaders(sourceUrl: string): Record<string, string> {
  // Many image CDNs (very common on manga/gallery sites) reject requests
  // that don't look like they came from the page itself (hotlink
  // protection) — a bare download request with no Referer/Origin is a
  // frequent cause of every image in a batch failing. A normal in-page
  // <img> load always carries these headers, so replicate that here.
  const headers: Record<string, string> = { Referer: sourceUrl };
  try {
    headers.Origin = new URL(sourceUrl).origin;
  } catch {
    // sourceUrl wasn't a parseable absolute URL — send Referer only.
  }
  return headers;
}

async function downloadWithConcurrency(
  urls: string[],
  directory: Directory,
  concurrency: number,
  headers: Record<string, string>,
  onEach: () => void,
): Promise<{ successCount: number; firstImageUri: string | null }> {
  let successCount = 0;
  let nextIndex = 0;
  const digits = String(urls.length).length;
  // Tracks the lowest-index successful download so the caller can cache a
  // stable "first image" thumbnail regardless of concurrent completion order.
  let firstSuccessIndex = -1;
  let firstImageUri: string | null = null;

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
        const file = new File(directory, fileName);
        await File.downloadFileAsync(url, file, { idempotent: true, headers });
        successCount += 1;
        if (firstSuccessIndex === -1 || index < firstSuccessIndex) {
          firstSuccessIndex = index;
          firstImageUri = file.uri;
        }
      } catch {
        // skip failed downloads and continue with the rest of the batch
      } finally {
        onEach();
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return { successCount, firstImageUri };
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
  const { successCount, firstImageUri } = await downloadWithConcurrency(
    options.imageUrls,
    directory,
    DOWNLOAD_CONCURRENCY,
    buildDownloadHeaders(options.sourceUrl),
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

  await recordDownloadHistory(db, {
    folderId: folder.id,
    pageUrl: options.sourceUrl,
    pageTitle: options.folderName,
    firstImageUri,
    imageCount: successCount,
  });

  return { folderId: folder.id, successCount, failureCount: total - successCount };
}
