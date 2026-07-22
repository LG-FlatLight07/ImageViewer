import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createFolder } from '../db/foldersRepository';
import { recordDownloadHistory } from '../db/downloadHistoryRepository';

const DOWNLOAD_CONCURRENCY = 4;
// Characters invalid on the filesystem itself (Windows/Android), PLUS
// characters that are legal in a filename but illegal when left unescaped
// in a path segment under Android's strict java.net.URI parser (used
// internally by expo-file-system for existence/permission checks on the
// directory's file:// URI). `[` `]` `{` `}` `^` and backtick are all valid
// in an Android filename and common in page titles (e.g. a "[進行中]"
// status tag), but the native module builds the folder's URI without
// percent-encoding them, so a folder name containing one throws
// "IllegalArgumentException: Illegal character in path" the moment the
// directory is touched — silently turning every download into a failure.
const INVALID_FILENAME_CHARS = '/\\:*?"<>|[]{}^`#%;';

function applyExclusions(rawName: string, exclusions: string[]): string {
  return exclusions.reduce((name, exclusion) => {
    const trimmed = exclusion.trim();
    if (!trimmed) {
      return name;
    }
    return name.split(trimmed).join('');
  }, rawName);
}

export function sanitizeFolderName(rawName: string, exclusions: string[] = []): string {
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
        try {
          await File.downloadFileAsync(url, file, { idempotent: true, headers });
        } catch (headerErr) {
          // Some sites reject a synthetic Referer/Origin outright (e.g. a
          // strict allowlist, or a CDN expecting no referrer at all for
          // signed/tokenized URLs) even though the same image downloaded
          // fine with no headers before this was added. Retry bare so a
          // site that worked before this header logic existed keeps working.
          try {
            await File.downloadFileAsync(url, file, { idempotent: true });
          } catch (bareErr) {
            console.warn('[downloadService] image download failed (with and without headers)', {
              url,
              headerErr: headerErr instanceof Error ? headerErr.message : String(headerErr),
              bareErr: bareErr instanceof Error ? bareErr.message : String(bareErr),
            });
            throw bareErr;
          }
        }
        successCount += 1;
        if (firstSuccessIndex === -1 || index < firstSuccessIndex) {
          firstSuccessIndex = index;
          firstImageUri = file.uri;
        }
      } catch {
        // already logged above (or the file-system write itself failed) —
        // skip this image and continue with the rest of the batch
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

  try {
    await recordDownloadHistory(db, {
      folderId: folder.id,
      pageUrl: options.sourceUrl,
      pageTitle: options.folderName,
      firstImageUri,
      imageCount: successCount,
    });
  } catch (err) {
    // The folder and its images already exist on disk and in `folders` at
    // this point — a failure recording ranking/jump-URL metadata is a
    // secondary bookkeeping problem, not a reason to tell the user their
    // download failed when it didn't. Log it and keep going.
    console.warn(
      '[downloadService] recordDownloadHistory failed (folder/images were saved regardless)',
      err instanceof Error ? err.message : String(err),
    );
  }

  return { folderId: folder.id, successCount, failureCount: total - successCount };
}
