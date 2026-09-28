import type { Banners } from '@/types/banner';
import { useMemo, useState } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { CloudflareImage } from '@/components/ui/CloudflareImage';
import { useTranslations } from 'next-intl';

type RecentBannersProps = {
  banners: Partial<Banners>;
  bannerIds: Set<string>;
  selectedId: string | null;
  onSelected: (id: string | null) => void;
};

const PAGE_SIZE = 5;

export const RecentBanners = ({
  banners,
  bannerIds,
  selectedId,
  onSelected,
}: RecentBannersProps) => {
  const t = useTranslations('TrackerPage');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const bannerIdsArray = useMemo(() => [...bannerIds], [bannerIds]);
  const visibleBannerIds = useMemo(
    () => bannerIdsArray.slice(0, visible),
    [bannerIdsArray, visible]
  );

  const hasMore = visible < bannerIdsArray.length;

  const handleLoadMore = () => {
    if (hasMore) {
      setVisible((prev) => {
        if (prev >= bannerIdsArray.length) return prev;
        return prev + PAGE_SIZE;
      });
    }
  };

  const getColor = (isSelected: boolean) =>
    isSelected
      ? 'ring-2 bg-white/10'
      : 'bg-neutral-900 hover:ring-2 hover:ring-white/50 ';

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-neutral-800/80 px-3 py-2">
      <h2 className="text-xl font-bold">{t('recentBanners')}</h2>

      <div
        className="grid items-center gap-2"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(6rem, 1fr))',
        }}
      >
        <button
          type="button"
          aria-pressed={selectedId === null}
          className={`${getColor(selectedId === null)} flex h-full w-full cursor-pointer items-center justify-center rounded-md px-3 py-1`}
          onClick={() => onSelected(null)}
        >
          <span className="line-clamp-1 text-xs font-semibold">{t('all')}</span>
        </button>
        {visibleBannerIds.map((bannerId) => {
          const banner = banners[bannerId];

          const isSelected = bannerId === selectedId;
          const colorClass = getColor(isSelected);

          return (
            <button
              type="button"
              key={bannerId}
              onClick={() => onSelected(isSelected ? null : bannerId)}
              aria-pressed={isSelected}
              aria-label={banner?.name ?? bannerId}
              className={`${colorClass} relative h-full w-full cursor-pointer overflow-hidden rounded-md`}
            >
              {banner ? (
                <CloudflareImage
                  src={banner.image}
                  alt={banner.name}
                  width={96}
                  height={32}
                  draggable={false}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-md bg-neutral-900/80 text-xs text-white/60">
                  Unknown
                </div>
              )}
            </button>
          );
        })}
        {hasMore && (
          <Tooltip
            position="right"
            title={`${bannerIdsArray.length - visible}`}
          >
            <button
              type="button"
              className="w-full cursor-pointer self-center rounded-xl bg-neutral-700/80 px-3 py-1 text-xs text-white/80 transition hover:bg-neutral-700 hover:text-white active:bg-neutral-700/60 active:text-white/60"
              onClick={handleLoadMore}
            >
              {t('more')}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
