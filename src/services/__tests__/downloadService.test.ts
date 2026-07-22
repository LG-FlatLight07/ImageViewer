import { sanitizeFolderName } from '../downloadService';

// Characters that are valid in an Android filename but throw
// "IllegalArgumentException: Illegal character in path" from Android's
// strict java.net.URI parser when left unescaped in a file:// URI path
// segment (used internally by expo-file-system for existence checks).
const URI_UNSAFE_CHARS = ['[', ']', '{', '}', '^', '`', '#', '%', ';'];

describe('sanitizeFolderName', () => {
  it('strips characters that break Android URI parsing', () => {
    for (const ch of URI_UNSAFE_CHARS) {
      const result = sanitizeFolderName(`title${ch}part`);
      expect(result).not.toContain(ch);
    }
  });

  it('reproduces the real-world crashing title without any unsafe characters remaining', () => {
    const title =
      '【hololive】常識改変ミスコンテスト (ホロライブ) [進行中] - 同人誌 - エロ漫画 momon GA（モモンガッ!!）';
    const result = sanitizeFolderName(title);
    for (const ch of URI_UNSAFE_CHARS) {
      expect(result).not.toContain(ch);
    }
    expect(result.length).toBeGreaterThan(0);
  });

  it('still removes filesystem-invalid characters', () => {
    const result = sanitizeFolderName('a/b\\c:d*e?f"g<h>i|j');
    for (const ch of ['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
      expect(result).not.toContain(ch);
    }
  });

  it('falls back to a default name when nothing usable remains', () => {
    expect(sanitizeFolderName('///???///')).toBe('無題のダウンロード');
  });

  it('applies folder-name exclusions before sanitizing', () => {
    expect(sanitizeFolderName('[TeamName] Title', undefined)).not.toContain('[');
    expect(sanitizeFolderName('SecretWord Title', ['SecretWord'])).not.toContain('SecretWord');
  });
});
