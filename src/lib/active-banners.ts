import type { Banners } from '@/types/banner';

export function getActiveLimitedBanners(banners: Banners, now: number) {
  return Object.values(banners)
    .filter(
      (banner) =>
        now >= (banner.startTime ?? 0) &&
        now <= (banner.endTime ?? Infinity) &&
        banner.startTime != null
    )
    .sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0));
}
