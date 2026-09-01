import { buildPageSequenceUrl, extractPageSequenceInfo } from '../pageSequence';

describe('extractPageSequenceInfo', () => {
  it('extracts the trailing number in a page URL', () => {
    const info = extractPageSequenceInfo('https://example.com/photo/1167141');
    expect(info).toEqual({
      prefix: 'https://example.com/photo/',
      suffix: '',
      number: 1167141,
      digits: 7,
    });
  });

  it('extracts a number followed by a path/query suffix', () => {
    const info = extractPageSequenceInfo('https://example.com/read/page/12?lang=ja');
    expect(info).toEqual({
      prefix: 'https://example.com/read/page/',
      suffix: '?lang=ja',
      number: 12,
      digits: 2,
    });
  });

  it('returns null when the URL has no digits', () => {
    expect(extractPageSequenceInfo('https://example.com/about')).toBeNull();
  });
});

describe('buildPageSequenceUrl', () => {
  it('substitutes a new number at the same position', () => {
    const info = extractPageSequenceInfo('https://example.com/photo/1167141')!;
    expect(buildPageSequenceUrl(info, 1167142)).toBe('https://example.com/photo/1167142');
  });

  it('preserves zero-padding when the new number is shorter', () => {
    const info = extractPageSequenceInfo('https://example.com/page/007')!;
    expect(buildPageSequenceUrl(info, 8)).toBe('https://example.com/page/008');
  });

  it('does not truncate a number wider than the original padding', () => {
    const info = extractPageSequenceInfo('https://example.com/page/007')!;
    expect(buildPageSequenceUrl(info, 1234)).toBe('https://example.com/page/1234');
  });
});
