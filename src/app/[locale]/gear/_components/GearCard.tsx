'use client';

import { CloudflareImage } from '@/components/ui/CloudflareImage';
import type { Gear } from '@/types/gear';
import { useTranslations } from 'next-intl';
import { TiArrowSortedDown } from 'react-icons/ti';

const rarityColors: Record<string, string> = {
  equip_rarity_1: '#a3a3a3',
  equip_rarity_2: '#86efac',
  equip_rarity_3: '#7dd3fc',
  equip_rarity_4: '#c4b5fd',
  equip_rarity_5: '#FF8000',
};

const formatSetDescription = (gear: Gear) =>
  (gear.suit?.skillDesc ?? '')
    .replace(
      /\{([^}:]+)(?::([^}]+))?\}/g,
      (match, key: string, format: string | undefined) => {
        const value = gear.suit?.skillDescParams[key];
        if (value === undefined) return match;
        const number = Number(value);
        return format?.includes('%') && Number.isFinite(number)
          ? `${Number((number * 100).toFixed(2))}%`
          : value;
      }
    )
    .replace(/[<>]/g, '');

export const GearCard = ({
  gear,
  typeName,
}: {
  gear: Gear;
  typeName: string;
}) => {
  const t = useTranslations('GearPage');

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl bg-neutral-800/80">
      <div className="flex items-start gap-3 bg-neutral-950/30 p-3 sm:p-4">
        <div
          style={{ borderColor: rarityColors[gear.rarityId] ?? '#a3a3a3' }}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-b-2 bg-neutral-900/80"
        >
          <div className="pointer-events-none absolute inset-1 rounded-lg border border-white/10" />
          <CloudflareImage
            src={gear.icon}
            alt={gear.name}
            width={128}
            height={128}
            draggable={false}
            className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium text-white/50">{typeName}</p>
          <h2 className="text-sm leading-snug font-semibold wrap-break-word text-white sm:text-base">
            {gear.name}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-white/65">
            <span
              style={{ color: rarityColors[gear.rarityId] }}
              className="rounded-md bg-white/5 px-2 py-1"
            >
              {gear.rarityId.replace('equip_rarity_', '')}★
            </span>
            <span className="rounded-md bg-white/10 px-2 py-1">
              Lv. {gear.levelId.replace('equip_level_', '')}
            </span>
            {gear.isAccessory && (
              <span className="rounded-md bg-cyan-400/15 px-2 py-1 text-cyan-200">
                {t('accessory')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3 text-sm sm:p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-neutral-900/60 p-3">
            <p className="text-xs text-white/45">{t('baseAttr')}</p>
            <p className="mt-1 font-bold text-yellow-200">
              {gear.baseAttrValue}
            </p>
          </div>
          <div className="rounded-lg bg-neutral-900/60 p-3">
            <p className="text-xs text-white/45">{t('type')}</p>
            <p className="mt-1 truncate font-semibold text-white/80">
              {typeName}
            </p>
          </div>
        </div>

        {gear.suit && (
          <details className="group/set rounded-lg bg-neutral-900/60 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-yellow-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-400 [&::-webkit-details-marker]:hidden">
              <span>{gear.suit.name}</span>
              <TiArrowSortedDown
                aria-hidden="true"
                className="shrink-0 text-base transition-transform duration-200 group-open/set:rotate-180"
              />
            </summary>
            <p className="mt-3 text-xs leading-relaxed whitespace-pre-line text-white/70">
              {formatSetDescription(gear)}
            </p>
          </details>
        )}

        {gear.detail?.stats.length ? (
          <section className="overflow-hidden rounded-lg bg-neutral-900/60">
            <h3 className="bg-white/5 px-3 py-2 font-semibold text-white/85">
              {t('stats')}
            </h3>
            <dl className="text-xs">
              {gear.detail.stats.map((stat) => (
                <div
                  key={`${stat.label}-${stat.value}`}
                  className="grid grid-cols-2 gap-3 px-3 py-2"
                >
                  <dt className="font-semibold text-white/70">{stat.label}</dt>
                  <dd className="text-right font-semibold text-yellow-200">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>
    </article>
  );
};
