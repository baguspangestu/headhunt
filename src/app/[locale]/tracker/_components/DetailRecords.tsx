import { CONFIG } from '@/config';
import type { BannerItem, TypeItem } from '@/types/profile';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { FaCircleInfo } from 'react-icons/fa6';

type DetailRecordsProps = {
  label?: string;
  stats: TypeItem | BannerItem | undefined;
  hash: string;
};

export const DetailRecords = ({
  label = 'Unknown',
  stats,
  hash,
}: DetailRecordsProps) => {
  const t = useTranslations('TrackerPage.DetailRecords');
  const locale = useLocale();

  const details = useMemo(() => {
    const isWeapon = hash.startsWith('weponbox') || hash === 'rerun_wpn';
    const isRerunCharacter = hash === 'rerun_chr';

    const localeValue =
      CONFIG.locales.find((l) => l.id === locale)?.value ?? 'en-US';

    const r4 = stats?.r4Count ?? 0;
    const r5 = stats?.r5Count ?? 0;
    const r6 = stats?.r6Count ?? 0;

    const totalPulls = r4 + r5 + r6;
    const hasR6 = r6 > 0;
    const hasFreePulls = (stats?.freeCount ?? 0) > 0;
    const hasGuaranteed = hash === 'special' || isWeapon || isRerunCharacter;

    const averagePityDescription = hasGuaranteed
      ? hasFreePulls
        ? t('r6AvgPityGuaranteedWithFreeDescription')
        : t('r6AvgPityGuaranteedDescription')
      : hasFreePulls
        ? t('r6AvgPityWithFreeDescription')
        : t('r6AvgPityDescription');

    const currencyMultiplier = isWeapon ? 198 : 500;

    const base = [
      {
        label: isWeapon ? t('totalIssue') : t('totalHeadhunt'),
        description: hasFreePulls
          ? t('totalPullsWithFreeDescription')
          : t('totalPullsDescription'),
        value: totalPulls,
      },
      {
        label: isWeapon ? t('totalArsenalTicket') : t('totalOroberyl'),
        description: isWeapon
          ? hasFreePulls
            ? t('totalArsenalTicketWithFreeDescription')
            : t('totalArsenalTicketDescription')
          : hasFreePulls
            ? t('totalOroberylWithFreeDescription')
            : t('totalOroberylDescription'),
        value: (totalPulls * currencyMultiplier).toLocaleString(localeValue),
      },
      {
        label: isWeapon ? t('r4Issue') : t('r4Headhunt'),
        description: t(
          hasFreePulls
            ? 'rarityCountWithFreeDescription'
            : 'rarityCountDescription',
          { rarity: 4 }
        ),
        value: r4,
      },
      {
        label: isWeapon ? t('r5Issue') : t('r5Headhunt'),
        description: t(
          hasFreePulls
            ? 'rarityCountWithFreeDescription'
            : 'rarityCountDescription',
          { rarity: 5 }
        ),
        value: r5,
      },
      {
        label: isWeapon ? t('r6Issue') : t('r6Headhunt'),
        description: t(
          hasFreePulls
            ? 'rarityCountWithFreeDescription'
            : 'rarityCountDescription',
          { rarity: 6 }
        ),
        value: r6,
      },
      {
        label: t('r6AvgPity'),
        description: averagePityDescription,
        value: hasR6 ? Math.round(stats?.r6AvgPity ?? 0) : '-',
      },
    ];

    if (hash === 'joint' || hash === 'standard' || hash === 'beginner') {
      return base;
    }

    const extra = [
      ...(!isWeapon && !isRerunCharacter
        ? [
            {
              label: t('rotateWinRate'),
              description: t('rotateWinRateDescription'),
              value: hasR6
                ? `${Math.round((stats?.rotateWin ?? 0) * 100)}%`
                : '-',
            },
          ]
        : []),
      {
        label: t('rateupWinRate'),
        description: t('rateupWinRateDescription'),
        value: hasR6 ? `${Math.round((stats?.rateupWin ?? 0) * 100)}%` : '-',
      },
    ];

    return [...base, ...extra];
  }, [stats, hash, locale, t]);

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-neutral-800/80 p-3 sm:p-4">
      <h2 className="text-lg leading-tight font-bold sm:text-xl">{label}</h2>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))' }}
      >
        {details.map((detail) => (
          <div
            key={detail.label}
            className="flex min-h-18 flex-col justify-center gap-1 rounded-lg bg-neutral-900/70 px-3 py-2"
          >
            <span className="flex max-w-full items-center gap-1.5 text-sm font-medium text-white/65">
              <span className="line-clamp-1">{detail.label}</span>
              <Tooltip
                title={
                  <span className="flex flex-col gap-1">
                    <span className="font-bold text-white">{detail.label}</span>
                    <span className="font-normal text-white/70">
                      {detail.description}
                    </span>
                  </span>
                }
                position="top"
              >
                <button
                  type="button"
                  className="shrink-0 cursor-help rounded-full text-white/35 transition-colors hover:text-yellow-300 focus-visible:text-yellow-300 focus-visible:outline-hidden"
                  aria-label={t('showDescription', { label: detail.label })}
                >
                  <FaCircleInfo className="text-xs" />
                </button>
              </Tooltip>
            </span>
            <span className="line-clamp-1 text-lg font-bold text-white tabular-nums">
              {detail.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
