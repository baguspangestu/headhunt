'use client';

import { useSelectedLayoutSegment } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, type JSX } from 'react';
import {
  GiHypersonicBolt,
  GiSaberAndPistol,
  GiShorts,
  GiTwoShadows,
  GiWoodCabin,
} from 'react-icons/gi';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  FaClockRotateLeft,
  FaDiscord,
  FaGithub,
  FaUser,
} from 'react-icons/fa6';
import { TiArrowSortedDown } from 'react-icons/ti';
import { CONFIG } from '@/config';
import { useStorageStore } from '@/store/useStorageStore';

type NavbarProps = {
  onClick?: (href?: string) => void;
};

type MenuItem = {
  key: string;
  href: string;
  icon: JSX.Element;
  disabled?: boolean;
  separatorBefore?: boolean;
};

const menu: MenuItem[] = [
  { key: 'home', href: '/', icon: <GiWoodCabin /> },
  { key: 'tracker', href: '/tracker', icon: <GiHypersonicBolt /> },
  { key: 'operators', href: '/operators', icon: <GiTwoShadows /> },
  { key: 'weapons', href: '/weapons', icon: <GiSaberAndPistol /> },
  { key: 'gear', href: '/gear', icon: <GiShorts />, disabled: true },
  {
    key: 'changelog',
    href: '/changelog',
    icon: <FaClockRotateLeft />,
    separatorBefore: true,
  },
];

export const Navbar = ({ onClick }: NavbarProps) => {
  const segment = '/' + (useSelectedLayoutSegment() ?? '');
  const t = useTranslations('Navbar');
  const profiles = useStorageStore((state) => state.profiles);
  const currentProfileId = useStorageStore((state) => state.currentProfileId);
  const hasHydrated = useStorageStore((state) => state.hasHydrated);
  const setCurrentProfileId = useStorageStore(
    (state) => state.setCurrentProfileId
  );
  const profileEntries = Object.values(profiles);
  const currentProfile = profiles[currentProfileId];
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const closeOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node))
        setIsProfileMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [isProfileMenuOpen]);

  const scrollToTop = () => {
    const container = document.getElementById('scroll-container');

    if (container && window.innerWidth >= 1024) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col justify-start gap-2">
          {menu.map((item) => {
            const isActive = segment === item.href;

            const baseClass =
              'flex gap-2 items-center rounded-xl p-2 duration-300 w-full';

            const activeClass = isActive
              ? 'bg-white/5 text-yellow-400'
              : 'hover:bg-white/10';

            const disabledClass = item.disabled
              ? 'opacity-40 cursor-not-allowed pointer-events-none'
              : '';

            if (item.disabled) {
              return (
                <Fragment key={item.key}>
                  {item.separatorBefore && (
                    <div className="my-1 h-px bg-white/8" />
                  )}
                  <div className={`${baseClass} ${disabledClass}`}>
                    {item.icon}
                    <span className="truncate">{t(item.key)}</span>
                    <span className="ml-auto rounded-md bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold text-white/50 uppercase">
                      {t('comingSoon')}
                    </span>
                  </div>
                </Fragment>
              );
            }

            return (
              <Fragment key={item.key}>
                {item.separatorBefore && (
                  <div className="my-1 h-px bg-white/8" />
                )}
                <Link
                  href={item.href}
                  onClick={
                    isActive
                      ? (event) => {
                          event.preventDefault();
                          scrollToTop();
                          onClick?.();
                        }
                      : onClick
                        ? (event) => {
                            event.preventDefault();
                            onClick(item.href);
                          }
                        : undefined
                  }
                  className={`${baseClass} ${activeClass}`}
                >
                  {item.icon}
                  <span className="truncate">{t(item.key)}</span>
                </Link>
              </Fragment>
            );
          })}
        </div>
      </div>
      <div className="shrink-0 p-2 pt-0">
        <div className="grid grid-cols-2 gap-1">
          <Link
            href={CONFIG.discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm transition duration-300 hover:bg-[#5865F2] active:bg-[#5865F2]/90"
          >
            <FaDiscord size={22} className="shrink-0" />
            <span className="truncate">{t('joinDiscord')}</span>
          </Link>
          <Link
            href={CONFIG.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm transition duration-300 hover:bg-white/10 active:bg-white/15"
          >
            <FaGithub size={22} className="shrink-0" />
            <span className="truncate">{t('githubRepository')}</span>
          </Link>
        </div>

        <div className="mx-2 my-2 h-px bg-white/8" />

        <div ref={profileMenuRef} className="relative">
          {hasHydrated && isProfileMenuOpen && profileEntries.length > 1 && (
            <div
              id="sidebar-profile-options"
              role="listbox"
              aria-label={t('selectProfile')}
              className="absolute right-0 bottom-full left-0 z-10 mb-2 flex flex-col gap-1 overflow-hidden rounded-xl bg-neutral-700 p-1.5"
            >
              {profileEntries.map((profile) => {
                const isActive = profile.id === currentProfileId;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setCurrentProfileId(profile.id);
                      setIsProfileMenuOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-yellow-400/15 text-yellow-200'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${isActive ? 'bg-yellow-300' : 'bg-white/20'}`}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {profile.name || t('unnamedProfile')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            disabled={!hasHydrated || profileEntries.length < 2}
            aria-expanded={isProfileMenuOpen}
            aria-controls={
              isProfileMenuOpen ? 'sidebar-profile-options' : undefined
            }
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white/5 p-2.5 text-left transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:cursor-default"
          >
            <span className="rounded-lg bg-yellow-400/15 p-2 text-yellow-300">
              <FaUser aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white/85">
                {hasHydrated
                  ? currentProfile?.name || t('unnamedProfile')
                  : t('loadingProfile')}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
                <span
                  className={`h-1.5 w-1.5 rounded-full bg-yellow-300 ${hasHydrated ? '' : 'animate-pulse'}`}
                />
                {t(hasHydrated ? 'selectedProfile' : 'loadingProfileStatus')}
              </span>
            </span>
            {hasHydrated && profileEntries.length > 1 && (
              <TiArrowSortedDown
                aria-hidden="true"
                className={`shrink-0 text-white/40 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
