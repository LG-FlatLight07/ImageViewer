import { resolveInputToUrl } from '../urlUtils';

describe('resolveInputToUrl', () => {
  it('returns an empty string for blank input', () => {
    expect(resolveInputToUrl('   ')).toBe('');
  });

  it('passes through URLs that already include a scheme', () => {
    expect(resolveInputToUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('adds https:// to bare domains', () => {
    expect(resolveInputToUrl('example.com')).toBe('https://example.com');
    expect(resolveInputToUrl('sub.example.com/path')).toBe('https://sub.example.com/path');
  });

  it('treats plain text as a search query using the selected engine', () => {
    expect(resolveInputToUrl('cats and dogs')).toBe(
      'https://www.google.com/search?q=cats%20and%20dogs',
    );
    expect(resolveInputToUrl('cats and dogs', 'bing')).toBe(
      'https://www.bing.com/search?q=cats%20and%20dogs',
    );
    expect(resolveInputToUrl('cats and dogs', 'duckduckgo')).toBe(
      'https://duckduckgo.com/?q=cats%20and%20dogs',
    );
  });

  it('falls back to google for an unknown engine key', () => {
    // @ts-expect-error intentionally passing an invalid engine key
    expect(resolveInputToUrl('cats', 'unknown')).toBe('https://www.google.com/search?q=cats');
  });
});
