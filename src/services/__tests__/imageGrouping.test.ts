import { detectImageGroups } from '../imageGrouping';
import type { RawImageCandidate } from '../imageExtraction';

function image(src: string, overrides: Partial<RawImageCandidate> = {}): RawImageCandidate {
  return { src, width: 400, height: 600, isLikelyAd: false, ...overrides };
}

describe('detectImageGroups', () => {
  it('groups images that share a numbered filename pattern and sorts by sequence', () => {
    const result = detectImageGroups([
      image('https://cdn.example.com/manga/page_003.jpg'),
      image('https://cdn.example.com/manga/page_001.jpg'),
      image('https://cdn.example.com/manga/page_002.jpg'),
    ]);

    expect(result.primaryGroup).not.toBeNull();
    expect(result.primaryGroup?.images.map((i) => i.src)).toEqual([
      'https://cdn.example.com/manga/page_001.jpg',
      'https://cdn.example.com/manga/page_002.jpg',
      'https://cdn.example.com/manga/page_003.jpg',
    ]);
    expect(result.otherImages).toHaveLength(0);
  });

  it('excludes images flagged as ads by the in-page heuristic', () => {
    const result = detectImageGroups([
      image('https://cdn.example.com/manga/page_001.jpg'),
      image('https://cdn.example.com/manga/page_002.jpg'),
      image('https://cdn.example.com/ads/banner_001.jpg', { isLikelyAd: true }),
    ]);

    const allSrcs = [...(result.primaryGroup?.images ?? []), ...result.otherImages].map(
      (i) => i.src,
    );
    expect(allSrcs).not.toContain('https://cdn.example.com/ads/banner_001.jpg');
  });

  it('excludes images served from known ad domains', () => {
    const result = detectImageGroups([
      image('https://cdn.example.com/manga/page_001.jpg'),
      image('https://cdn.example.com/manga/page_002.jpg'),
      image('https://securepubads.doubleclick.net/gpt/1.jpg'),
    ]);

    const allSrcs = [...(result.primaryGroup?.images ?? []), ...result.otherImages].map(
      (i) => i.src,
    );
    expect(allSrcs).not.toContain('https://securepubads.doubleclick.net/gpt/1.jpg');
  });

  it('excludes images below the minimum size threshold (icons/tracking pixels)', () => {
    const result = detectImageGroups([
      image('https://cdn.example.com/icons/logo_001.png', { width: 32, height: 32 }),
    ]);

    expect(result.primaryGroup).toBeNull();
    expect(result.otherImages).toHaveLength(0);
  });

  it('only promotes a group to primary when it has at least two members', () => {
    const result = detectImageGroups([image('https://cdn.example.com/photo_042.jpg')]);

    expect(result.primaryGroup).toBeNull();
    expect(result.otherImages).toHaveLength(1);
  });

  it('keeps unpadded and zero-padded page numbers in the same group (e.g. 1..9 then 010, 011)', () => {
    const result = detectImageGroups([
      image('https://cdn.example.com/manga/page_1.jpg'),
      image('https://cdn.example.com/manga/page_2.jpg'),
      image('https://cdn.example.com/manga/page_9.jpg'),
      image('https://cdn.example.com/manga/page_010.jpg'),
      image('https://cdn.example.com/manga/page_011.jpg'),
    ]);

    expect(result.primaryGroup?.images.map((i) => i.src)).toEqual([
      'https://cdn.example.com/manga/page_1.jpg',
      'https://cdn.example.com/manga/page_2.jpg',
      'https://cdn.example.com/manga/page_9.jpg',
      'https://cdn.example.com/manga/page_010.jpg',
      'https://cdn.example.com/manga/page_011.jpg',
    ]);
    expect(result.otherImages).toHaveLength(0);
  });

  it('picks the largest group as primary and demotes smaller groups to otherImages', () => {
    const result = detectImageGroups([
      image('https://cdn.example.com/manga/page_001.jpg'),
      image('https://cdn.example.com/manga/page_002.jpg'),
      image('https://cdn.example.com/manga/page_003.jpg'),
      image('https://cdn.example.com/thumbs/thumb_001.jpg'),
      image('https://cdn.example.com/thumbs/thumb_002.jpg'),
    ]);

    expect(result.primaryGroup?.images).toHaveLength(3);
    expect(result.otherImages).toHaveLength(2);
  });
});
