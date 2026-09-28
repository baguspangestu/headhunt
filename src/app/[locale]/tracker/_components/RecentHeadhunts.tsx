import { useMemo, useState } from 'react';
import { Filter } from '@/components/ui/Filter';
import { Tooltip } from '@/components/ui/Tooltip';
import type { Enums, RarityId } from '@/types/enums';
import { CONFIG } from '@/config';
import type { RecordItem } from '@/types/profile';
import { GachaResult } from '@/types/profile';
import type { Catalogs } from '@/types/catalog';
import { PiImageBroken } from 'react-icons/pi';
import { CloudflareImage } from '@/components/ui/CloudflareImage';
import { useTranslations } from 'next-intl';
import clsx from 'clsx';

type RecentHeadhuntsProps = {
  hash: string;
  records: RecordItem[];
  catalogs: Partial<Catalogs>;
  rarities: Enums['rarities'];
  guaranteedLimit: number;
};

const PAGE_SIZE = 50;
const RATE_RESULT_TYPE_IDS = new Set([
  'special',
  'weponbox',
  'rerun_chr',
  'rerun_wpn',
]);

const isIncluded = <T,>(filter: T[], value: T) =>
  filter.length === 0 || filter.includes(value);

const RESULT_BADGES: Record<
  GachaResult,
  {
    label: string;
    className: string;
    legendClassName: string;
    translationKey:
      'resultLose' | 'resultRotate' | 'resultRateup' | 'resultGuarantee';
  }
> = {
  [GachaResult.Lose]: {
    label: 'L',
    className: 'bg-rose-600/90',
    legendClassName: 'bg-rose-500/15 text-rose-100/80',
    translationKey: 'resultLose',
  },
  [GachaResult.Rotate]: {
    label: 'R',
    className: 'bg-sky-500/90',
    legendClassName: 'bg-sky-500/15 text-sky-100/80',
    translationKey: 'resultRotate',
  },
  [GachaResult.Rateup]: {
    label: 'W',
    className: 'bg-emerald-500/90',
    legendClassName: 'bg-emerald-500/15 text-emerald-100/80',
    translationKey: 'resultRateup',
  },
  [GachaResult.Guarantee]: {
    label: 'G',
    className: 'bg-violet-500/90',
    legendClassName: 'bg-violet-500/15 text-violet-100/80',
    translationKey: 'resultGuarantee',
  },
};

const getResultTranslationKey = (
  result: GachaResult,
  isRateupOnly: boolean
) => {
  if (isRateupOnly) {
    if (result === GachaResult.Lose) return 'resultWeaponLose';
    if (result === GachaResult.Rateup) return 'resultWeaponRateup';
  }

  return RESULT_BADGES[result].translationKey;
};

const getDisplayedResult = (record: RecordItem) =>
  record.typeId === 'rerun_chr' && record.result === GachaResult.Rotate
    ? GachaResult.Lose
    : record.result;

const getPityColor = ({
  pity,
  rarityId,
  isWeapon,
}: {
  pity: number;
  rarityId: RarityId;
  isWeapon: boolean;
}) => {
  let color = 'bg-blue-500/80';

  if (rarityId === 'rarity_6') {
    if (isWeapon) {
      if (pity > 30) color = 'bg-red-500/80';
      else if (pity > 20) color = 'bg-orange-500/80';
      else if (pity > 0) color = 'bg-green-500/80';
    } else {
      if (pity > 65) color = 'bg-red-500/80';
      else if (pity > 40) color = 'bg-orange-500/80';
      else if (pity > 0) color = 'bg-green-500/80';
    }
  } else {
    if (pity > 7) color = 'bg-red-500/80';
    else if (pity > 5) color = 'bg-orange-500/80';
    else if (pity > 0) color = 'bg-green-500/80';
  }

  return color;
};

export const RecentHeadhunts = ({
  hash,
  records,
  catalogs,
  rarities,
  guaranteedLimit,
}: RecentHeadhuntsProps) => {
  const t = useTranslations('TrackerPage');
  const isWeapon = hash.startsWith('weponbox') || hash === 'rerun_wpn';
  const isRateupOnly = isWeapon || hash === 'rerun_chr';

  const [visible, setVisible] = useState(PAGE_SIZE);
  const [rarityFilter, setRarityFilter] = useState<string[]>(['rarity_6']);

  const rarityOptions = useMemo(
    () =>
      rarities
        .filter((rarity) =>
          ['rarity_4', 'rarity_5', 'rarity_6'].includes(rarity.id)
        )
        .map((rarity) => ({
          id: rarity.id,
          name: `${rarity.name}★`,
          icon: 'rarity',
          color: CONFIG.enumColors.rarities[rarity.id],
        })),
    [rarities]
  );

  const handleChangeRarity = (values: string[]) => {
    setRarityFilter(values);
    setVisible(PAGE_SIZE);
  };

  const filteredRecords = useMemo(() => {
    return records.filter((record) =>
      isIncluded(rarityFilter, `rarity_${record.rarity}`)
    );
  }, [records, rarityFilter]);

  const visibleRecords = useMemo(() => {
    return filteredRecords.slice(0, visible);
  }, [filteredRecords, visible]);

  const hasMore = visible < filteredRecords.length;
  const availableResults = useMemo(
    () =>
      new Set(
        filteredRecords
          .filter(
            (record) =>
              record.rarity === 6 && RATE_RESULT_TYPE_IDS.has(record.typeId)
          )
          .map(getDisplayedResult)
      ),
    [filteredRecords]
  );
  const resultLegends = (
    Object.entries(RESULT_BADGES) as [
      string,
      (typeof RESULT_BADGES)[GachaResult],
    ][]
  ).filter(([result]) => availableResults.has(Number(result) as GachaResult));

  const handleLoadMore = () => {
    if (hasMore) {
      setVisible((prev) => {
        if (prev >= filteredRecords.length) return prev;
        return prev + PAGE_SIZE;
      });
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-neutral-800/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">
          {isWeapon ? t('recentIssues') : t('recentHeadhunts')}
        </h2>

        <div className="shrink-0">
          <Filter
            data={rarityOptions}
            value={rarityFilter}
            onChange={handleChangeRarity}
          />
        </div>
      </div>

      {resultLegends.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resultLegends.map(([result, badge]) => (
            <div
              key={result}
              className={clsx(
                'w-fit rounded-lg px-2.5 py-1 text-xs',
                badge.legendClassName
              )}
            >
              <span className="font-semibold">{badge.label}</span> ={' '}
              {Number(result) === GachaResult.Guarantee
                ? t('guaranteedDesc', { limit: guaranteedLimit })
                : t(
                    getResultTranslationKey(
                      Number(result) as GachaResult,
                      isRateupOnly
                    )
                  )}
            </div>
          ))}
        </div>
      )}

      <div
        className="grid items-center gap-4"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(4rem, 1fr))',
        }}
      >
        {visibleRecords.map((record) => {
          const catalog = catalogs[record.itemId];

          const name = catalog?.name ?? record.itemId;
          const rarityId =
            catalog?.rarityId ??
            (`rarity_${record.rarity}` as keyof typeof CONFIG.enumColors.rarities);
          const resultBadge =
            record.rarity === 6 && RATE_RESULT_TYPE_IDS.has(record.typeId)
              ? RESULT_BADGES[getDisplayedResult(record)]
              : null;

          const pityColor = getPityColor({
            pity: record.pity,
            rarityId: rarityId,
            isWeapon: isWeapon || hash === 'beginner',
          });

          return (
            <Tooltip
              key={`${record.typeId}-${record.id}`}
              title={
                <span className="flex flex-col gap-0.5">
                  <strong className="text-white">{name}</strong>
                  {resultBadge && (
                    <span className="font-normal text-white/70">
                      {resultBadge.label} ={' '}
                      {t(
                        getResultTranslationKey(
                          getDisplayedResult(record),
                          record.typeId === 'weponbox' ||
                            record.typeId === 'rerun_wpn' ||
                            record.typeId === 'rerun_chr'
                        )
                      )}
                    </span>
                  )}
                  <span className="font-normal text-white/70">
                    {record.isFree
                      ? t('freePull')
                      : `${t('pity')}: ${record.pity}`}
                  </span>
                </span>
              }
              position="top"
              className="group mx-auto w-16 rounded-xl"
            >
              <div
                className="overflow-hidden rounded-xl bg-neutral-900/60 ring-2 transition-[filter] duration-200 group-hover:brightness-110"
                style={
                  {
                    '--tw-ring-color': CONFIG.enumColors.rarities[rarityId],
                  } as React.CSSProperties
                }
              >
                <div className="relative h-16 w-16 overflow-hidden">
                  {catalog ? (
                    <CloudflareImage
                      src={catalog.icon}
                      alt={name}
                      width={64}
                      height={64}
                      draggable={false}
                      className="scale-110 transition-transform duration-300 group-hover:scale-115"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                      <PiImageBroken size={24} />
                    </div>
                  )}
                </div>
                <div className="flex h-5 border-t border-black/20 text-xs font-bold text-white">
                  {resultBadge && (
                    <span
                      className={clsx(
                        'flex w-6 shrink-0 items-center justify-center border-r border-black/20',
                        resultBadge.className
                      )}
                    >
                      {resultBadge.label}
                    </span>
                  )}
                  <span
                    className={clsx(
                      'flex min-w-0 flex-1 items-center justify-center px-1 font-semibold tabular-nums',
                      pityColor
                    )}
                  >
                    {record.isFree ? 'Free' : record.pity}
                  </span>
                </div>
              </div>
            </Tooltip>
          );
        })}
        {hasMore && (
          <Tooltip
            position="right"
            title={`${filteredRecords.length - visible}`}
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
    </section>
  );
};
