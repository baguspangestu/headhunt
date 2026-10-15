'use client';

import { CloudflareImage } from '@/components/ui/CloudflareImage';
import { PageTitle } from '@/components/ui/PageTitle';
import { Tooltip } from '@/components/ui/Tooltip';
import { CONFIG } from '@/config';
import { useTranslations } from 'next-intl';
import { useCountdown } from '@/hooks/useCountdown';
import type { JSX } from 'react';
import { PiClockCountdownBold } from 'react-icons/pi';
import { FaArrowRight } from 'react-icons/fa6';
import { Link } from '@/i18n/navigation';
import {
  GiTwoShadows,
  GiHypersonicBolt,
  GiSaberAndPistol,
  GiShorts,
} from 'react-icons/gi';

type Props = {
  banners: BannerItemProps[];
  initialNow: number;
};

type BannerItemProps = {
  id: string;
  name: string;
  endTime?: number;
  itemName: string;
  icon: string;
  rotation?: { id: string; name: string; icon: string }[];
};

type MenuItem = {
  key: string;
  href: string;
  icon: JSX.Element;
  disabled?: boolean;
};

const pages: MenuItem[] = [
  { key: 'tracker', href: '/tracker', icon: <GiHypersonicBolt /> },
  { key: 'operators', href: '/operators', icon: <GiTwoShadows /> },
  { key: 'weapons', href: '/weapons', icon: <GiSaberAndPistol /> },
  { key: 'gear', href: '/gear', icon: <GiShorts />, disabled: true },
];

export const HomePageContent = ({ banners, initialNow }: Props) => {
  const t = useTranslations('HomePage');
  const tNav = useTranslations('Navbar');

  return (
    <div className="flex w-full flex-col">
      <PageTitle title={CONFIG.appName} desc={t('description')} centered />
      <div className="h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
      <div className="flex flex-col gap-8 pt-4 sm:pt-6">
        <section
          aria-labelledby="home-shortcuts"
          className="flex flex-col gap-3"
        >
          <h2
            id="home-shortcuts"
            className="text-base font-semibold text-white/85"
          >
            {t('shortcutMenu')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {pages.map((page) => {
              if (page.disabled) {
                return (
                  <div
                    key={page.key}
                    aria-disabled="true"
                    className="flex min-w-0 cursor-not-allowed flex-col gap-4 rounded-xl bg-neutral-800/50 p-4 text-white/40 sm:p-5"
                  >
                    <div className="flex items-center justify-between">
                      <span aria-hidden="true" className="text-2xl">
                        {page.icon}
                      </span>
                      <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        {tNav('comingSoon')}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">
                        {tNav(page.key)}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-white/35">
                        {t(`shortcuts.${page.key}`)}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={page.key}
                  href={page.href}
                  className="group flex min-w-0 flex-col gap-4 rounded-xl bg-neutral-800/80 p-4 transition-colors hover:bg-neutral-700/70 focus-visible:ring-2 focus-visible:ring-yellow-400 sm:p-5"
                >
                  <div className="flex items-center justify-between">
                    <span aria-hidden="true" className="text-2xl text-white/65">
                      {page.icon}
                    </span>
                    <FaArrowRight
                      aria-hidden="true"
                      className="text-xs text-white/25 transition-transform group-hover:text-yellow-300 motion-safe:group-hover:translate-x-1"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white/90">
                      {tNav(page.key)}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-white/50">
                      {t(`shortcuts.${page.key}`)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
        <section aria-labelledby="home-banners" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="home-banners"
              className="text-base font-semibold text-white/85"
            >
              {t('limitedBanners')}
            </h2>
            <Link
              href="/tracker"
              className="flex items-center gap-2 rounded-sm text-xs text-white/50 hover:text-yellow-300 focus-visible:outline-2 focus-visible:outline-yellow-400"
            >
              {t('openTracker')}
              <FaArrowRight aria-hidden="true" />
            </Link>
          </div>
          {banners.length === 0 && (
            <p className="rounded-xl bg-neutral-800/60 p-6 text-sm text-white/50">
              {t('noBanners')}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {banners.map((banner) => (
              <BannerItem key={banner.id} {...banner} initialNow={initialNow} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export const BannerItem = ({
  id,
  name,
  endTime,
  itemName,
  icon,
  initialNow,
  rotation = [],
}: BannerItemProps & { initialNow: number }) => {
  const t = useTranslations('HomePage');
  const countdown = useCountdown(endTime, initialNow);

  const endTimeText =
    endTime !== undefined
      ? countdown?.expired
        ? t('ended')
        : t('countdown', {
            days: countdown?.time?.days || 0,
            hours: countdown?.time?.hours || 0,
            minutes: countdown?.time?.minutes || 0,
            seconds: countdown?.time?.seconds || 0,
          })
      : undefined;

  const hash =
    id.startsWith('weponbox') || id.startsWith('weaponbox')
      ? id
      : id.split('_')[0];
  return (
    <Link
      href={`/tracker#${hash}`}
      scroll={false}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl bg-neutral-800/80 transition-colors hover:bg-neutral-700/70 focus-visible:ring-2 focus-visible:ring-yellow-400"
    >
      <div className="flex flex-1 items-center gap-4 p-4 sm:p-5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-900/60 sm:h-24 sm:w-24">
          <div className="pointer-events-none absolute inset-1 rounded-lg border border-white/10" />
          <CloudflareImage
            src={icon}
            alt={itemName}
            width={128}
            height={128}
            draggable={false}
            className="h-full w-full object-contain transition duration-300 motion-safe:group-hover:scale-105"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <h3 className="text-sm leading-snug font-semibold wrap-break-word text-white/90">
              {name}
            </h3>
            <div
              className="mt-1 text-sm leading-snug font-medium wrap-break-word"
              style={{ color: CONFIG.enumColors.rarities.rarity_6 }}
            >
              {itemName}
            </div>
            {rotation.length > 0 && (
              <div
                aria-label={t('rotation')}
                className="mt-2 flex flex-wrap gap-1.5"
              >
                {rotation.map((character) => (
                  <Tooltip
                    key={character.id}
                    title={character.name}
                    position="top"
                    className="rounded-lg"
                  >
                    <div className="h-8 w-8 overflow-hidden rounded-lg bg-neutral-900/60">
                      <CloudflareImage
                        src={character.icon}
                        alt={character.name}
                        width={40}
                        height={40}
                        draggable={false}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 bg-neutral-950/25 px-4 py-3 sm:px-5">
        <span className="text-xs text-white/40">{t('timeRemaining')}</span>
        <span
          className={`flex items-center gap-1.5 text-xs tabular-nums ${countdown?.expired ? 'text-white/40' : 'text-yellow-200/85'}`}
        >
          <PiClockCountdownBold aria-hidden="true" className="shrink-0" />
          <span>{endTimeText || t('longTime')}</span>
        </span>
      </div>
    </Link>
  );
};
