import { useEffect, useMemo, useRef, useState } from 'react';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { Filter } from '@/components/ui/Filter';
import { Button } from '@/components/ui/Button';
import { FaSyncAlt } from 'react-icons/fa';
import type { Enums } from '@/types/enums';
import { CONFIG } from '@/config';
import type { RecordItem } from '@/types/profile';
import type { Banners } from '@/types/banner';
import type { Catalogs } from '@/types/catalog';
import { useLocale, useTranslations } from 'next-intl';
import { PiImageBroken } from 'react-icons/pi';
import { CloudflareImage } from '@/components/ui/CloudflareImage';
import { EmptyFilterState } from '@/components/ui/EmptyFilterState';

type HeadhuntRecordsProps = {
  hash: string;
  records: RecordItem[];
  banners: Partial<Banners>;
  catalogs: Partial<Catalogs>;
  rarities: Enums['rarities'];
  isSyncing: boolean;
  disabled: boolean;
  onSync: () => void;
};

const formatTimestamp = ({ ts, locale }: { ts: number; locale: string }) => {
  const date = new Date(ts);

  const formatted = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);

  return formatted;
};

const PAGE_SIZE = 50;

const isIncluded = <T,>(filter: T[], value: T) =>
  filter.length === 0 || filter.includes(value);

export const HeadhuntRecords = ({
  hash,
  records,
  catalogs,
  banners,
  rarities,
  isSyncing,
  disabled,
  onSync,
}: HeadhuntRecordsProps) => {
  const t = useTranslations('TrackerPage');
  const locale = useLocale();

  const [visible, setVisible] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const isWeapon = hash.startsWith('weponbox') || hash === 'rerun_wpn';
  const hideBanner = hash === 'standard' || hash === 'beginner';

  const [rarityFilter, setRarityFilter] = useState<string[]>([
    'rarity_5',
    'rarity_6',
  ]);

  const handleChangeRarity = (values: string[]) => {
    setRarityFilter(values);
    setVisible(PAGE_SIZE);
  };

  const recordsWithNo = useMemo(() => {
    return records.map((record, index) => ({
      no: records.length - index,
      ...record,
    }));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return recordsWithNo.filter((record) =>
      isIncluded(rarityFilter, `rarity_${record.rarity}`)
    );
  }, [recordsWithNo, rarityFilter]);

  const visibleRecords = useMemo(() => {
    return filteredRecords.slice(0, visible);
  }, [filteredRecords, visible]);

  const hasMore = visible < filteredRecords.length;

  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore) {
        setVisible((prev) => {
          if (prev >= filteredRecords.length) return prev;
          return prev + PAGE_SIZE;
        });
      }
    });

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, filteredRecords.length]);

  return (
    <>
      <div className="flex flex-col gap-4 rounded-xl bg-neutral-800/80 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">
            {isWeapon ? t('issueRecords') : t('headhuntRecords')}
          </h2>

          <div className="shrink-0">
            <Filter
              data={rarities
                .filter((r) =>
                  ['rarity_4', 'rarity_5', 'rarity_6'].includes(r.id)
                )
                .map((e) => ({
                  id: e.id,
                  name: `${e.name}★`,
                  icon: 'rarity',
                  color: CONFIG.enumColors.rarities[e.id],
                }))}
              value={rarityFilter}
              onChange={handleChangeRarity}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {visibleRecords.length ? (
            <table className="table-records w-max min-w-full table-auto text-center whitespace-nowrap">
              <thead>
                <tr>
                  <th className="w-10">{t('pull')}</th>
                  <th className="text-left">
                    {isWeapon ? t('weapon') : t('operator')}
                  </th>
                  <th className="w-15">{t('pity')}</th>
                  {!hideBanner && <th className="w-30">{t('banner')}</th>}
                  <th className="w-40">{t('time')}</th>
                </tr>
              </thead>

              <tbody>
                {visibleRecords.map((record, index) => {
                  const catalog = catalogs[record.itemId];
                  const banner = banners[record.bannerId];

                  const name = catalog?.name ?? record.itemId;
                  const rarityId =
                    catalog?.rarityId ??
                    (`rarity_${record.rarity}` as keyof typeof CONFIG.enumColors.rarities);
                  const time = formatTimestamp({
                    ts: record.timestamp,
                    locale:
                      CONFIG.locales.find((l) => l.id === locale)?.value ??
                      'en-US',
                  });

                  return (
                    <tr
                      key={index}
                      style={
                        {
                          color: CONFIG.enumColors.rarities[rarityId],
                          '--hover-bg': CONFIG.enumColors.rarities[rarityId],
                        } as React.CSSProperties
                      }
                      className="hover:bg-(--hover-bg)/5"
                    >
                      <td className="rounded-l-xl">{record.no}</td>

                      <td className="flex items-center gap-2">
                        {catalog ? (
                          <CloudflareImage
                            src={catalog.icon}
                            alt={name}
                            width={40}
                            height={40}
                            draggable={false}
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center">
                            <PiImageBroken
                              size={24}
                              className="text-white/60"
                            />
                          </div>
                        )}
                        <span>{name}</span>
                      </td>

                      <td>{record.pity || 'Free'}</td>

                      {!hideBanner && (
                        <td>
                          <div className="flex items-center justify-center">
                            <div className="relative h-full w-full overflow-hidden rounded-md">
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
                                <div className="flex h-8 w-full items-center justify-center rounded-md bg-neutral-900/80 text-xs text-white/60">
                                  Unknown
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      )}

                      <td className="rounded-r-xl">{time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyFilterState title={t('noRecordFound')} compact transparent>
              <Button onClick={onSync} variant="secondary" disabled={disabled}>
                {isSyncing ? (
                  <>
                    <FaSyncAlt className="animate-spin" />
                    <span> {t('syncing')}</span>
                  </>
                ) : (
                  <>
                    <FaSyncAlt />
                    <span>{t('sync')}</span>
                  </>
                )}
              </Button>
            </EmptyFilterState>
          )}
        </div>
      </div>

      {hasMore && (
        <div
          ref={loadMoreRef}
          className="flex items-center justify-center gap-2 rounded-xl bg-neutral-800 px-3 py-2"
        >
          <AiOutlineLoading3Quarters size={24} className="animate-spin" />
          <p>{t('loading')}</p>
        </div>
      )}
    </>
  );
};
