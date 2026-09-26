import { matchesContentsFilter } from '../contentsFilter';

const wanted = 'https://HOGEHOGE/396_desktop_medium_2x/contents/hash?exp=123&sig=abc';
const other = 'https://xxx/scrambled/contents/hash?exp=123&sig=HOGEHOGE';

it('filters the example hosts without matching query text', () => {
  expect(matchesContentsFilter(wanted, 'HOGEHOGE')).toBe(true);
  expect(matchesContentsFilter(other, 'HOGEHOGE')).toBe(false);
});

it('supports parent paths and complete pasted directory URLs', () => {
  for (const filter of [
    '396_desktop_medium_2x',
    ' https://HOGEHOGE/396_desktop_medium_2x/contents/ ',
  ]) {
    expect(matchesContentsFilter(wanted, filter)).toBe(true);
    expect(matchesContentsFilter(other, filter)).toBe(false);
  }
  expect(matchesContentsFilter(other, 'scrambled')).toBe(true);
});

it('does not match image filenames or paths below contents', () => {
  expect(matchesContentsFilter('https://xxx/contents/HOGEHOGE/hash.jpg', 'HOGEHOGE')).toBe(false);
  expect(matchesContentsFilter(wanted, 'hash')).toBe(false);
});

it('allows all candidates when cleared and rejects invalid URLs with a condition', () => {
  expect(matchesContentsFilter(wanted, '')).toBe(true);
  expect(matchesContentsFilter(other, '  ')).toBe(true);
  expect(matchesContentsFilter('invalid', 'HOGEHOGE')).toBe(false);
});
