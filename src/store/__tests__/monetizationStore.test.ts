import {
  canCreateNewTag,
  canStartDownload,
  FREE_DAILY_DOWNLOADS,
  FREE_RANKING_VISIBLE,
  FREE_TAG_LIMIT,
  getRemainingFreeDownloads,
  hasUnlimitedDownloadsToday,
  PREMIUM_RANKING_VISIBLE,
  rankingVisibleCount,
} from '../monetizationStore';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const YESTERDAY = '2000-01-01'; // never matches todayKey(), regardless of when the test runs

describe('hasUnlimitedDownloadsToday', () => {
  it('is true once purchased, regardless of ad state', () => {
    expect(
      hasUnlimitedDownloadsToday({
        purchasedPremium: true,
        rewardedAdDate: null,
        dailyDownloadDate: null,
        dailyDownloadUsed: 0,
      }),
    ).toBe(true);
  });

  it('is true when the reward was claimed today', () => {
    expect(
      hasUnlimitedDownloadsToday({
        purchasedPremium: false,
        rewardedAdDate: todayKey(),
        dailyDownloadDate: null,
        dailyDownloadUsed: 0,
      }),
    ).toBe(true);
  });

  it('is false when the reward was claimed on a previous day', () => {
    expect(
      hasUnlimitedDownloadsToday({
        purchasedPremium: false,
        rewardedAdDate: YESTERDAY,
        dailyDownloadDate: null,
        dailyDownloadUsed: 0,
      }),
    ).toBe(false);
  });
});

describe('getRemainingFreeDownloads / canStartDownload', () => {
  it('reports the full free quota when nothing has been used today', () => {
    const state = {
      purchasedPremium: false,
      rewardedAdDate: null,
      dailyDownloadDate: null,
      dailyDownloadUsed: 0,
    };
    expect(getRemainingFreeDownloads(state)).toBe(FREE_DAILY_DOWNLOADS);
    expect(canStartDownload(state)).toBe(true);
  });

  it('ignores a stale usage count from a previous day', () => {
    const state = {
      purchasedPremium: false,
      rewardedAdDate: null,
      dailyDownloadDate: YESTERDAY,
      dailyDownloadUsed: FREE_DAILY_DOWNLOADS,
    };
    expect(getRemainingFreeDownloads(state)).toBe(FREE_DAILY_DOWNLOADS);
    expect(canStartDownload(state)).toBe(true);
  });

  it("blocks further downloads once today's quota is used up", () => {
    const state = {
      purchasedPremium: false,
      rewardedAdDate: null,
      dailyDownloadDate: todayKey(),
      dailyDownloadUsed: FREE_DAILY_DOWNLOADS,
    };
    expect(getRemainingFreeDownloads(state)).toBe(0);
    expect(canStartDownload(state)).toBe(false);
  });

  it('stays unlimited even past the quota once unlocked for the day', () => {
    const state = {
      purchasedPremium: false,
      rewardedAdDate: todayKey(),
      dailyDownloadDate: todayKey(),
      dailyDownloadUsed: FREE_DAILY_DOWNLOADS + 5,
    };
    expect(canStartDownload(state)).toBe(true);
  });
});

describe('canCreateNewTag', () => {
  it('allows new tags below the free limit', () => {
    expect(canCreateNewTag(false, FREE_TAG_LIMIT - 1)).toBe(true);
  });

  it('blocks new tags at or above the free limit when unpurchased', () => {
    expect(canCreateNewTag(false, FREE_TAG_LIMIT)).toBe(false);
  });

  it('is always allowed once purchased', () => {
    expect(canCreateNewTag(true, FREE_TAG_LIMIT * 10)).toBe(true);
  });
});

describe('rankingVisibleCount', () => {
  it('returns the free tier limit when unpurchased', () => {
    expect(rankingVisibleCount(false)).toBe(FREE_RANKING_VISIBLE);
  });

  it('returns the premium limit once purchased', () => {
    expect(rankingVisibleCount(true)).toBe(PREMIUM_RANKING_VISIBLE);
  });
});
