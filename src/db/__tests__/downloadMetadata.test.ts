import { recordDownloadHistory } from '../downloadHistoryRepository';
import { supabase } from '../../services/supabaseClient';
import { normalizeUrlKey } from '../../services/urlNormalization';
import type { SQLiteDatabase } from 'expo-sqlite';
jest.mock('../../services/supabaseClient', () => ({
  supabase: { rpc: jest.fn().mockResolvedValue({ error: null }) },
}));

it('sends the displayed reader URL and unmodified extracted title to ranking', async () => {
  const pageUrl = 'https://komiflo.com/#!/comics/35347/read/page/1';
  const pageTitle = '[作者] 作品タイトル?';
  const db = {
    withTransactionAsync: async (f: () => Promise<void>) => f(),
    runAsync: jest.fn().mockResolvedValue({}),
  };
  await recordDownloadHistory(db as unknown as SQLiteDatabase, {
    folderId: 'test',
    pageUrl,
    pageTitle,
    firstImageUri: null,
    imageCount: 5,
  });
  expect(supabase!.rpc).toHaveBeenCalledWith(
    'record_download',
    expect.objectContaining({ p_source_url: pageUrl, p_page_title: pageTitle, p_url_key: pageUrl }),
  );
  expect(normalizeUrlKey(pageUrl)).not.toBe(normalizeUrlKey(pageUrl.replace('35347', '34999')));
});
it('still combines section anchors, but preserves hash routes and URL queries', () => {
  expect(normalizeUrlKey('https://example.com/a/#section')).toBe('https://example.com/a');
  expect(normalizeUrlKey('https://example.com/#/a')).not.toBe(
    normalizeUrlKey('https://example.com/#/b'),
  );
  expect(normalizeUrlKey('https://example.com/?id=1')).not.toBe(
    normalizeUrlKey('https://example.com/?id=2'),
  );
});
