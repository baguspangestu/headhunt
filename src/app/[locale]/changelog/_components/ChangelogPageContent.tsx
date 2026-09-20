'use client';

import { PageTitle } from '@/components/ui/PageTitle';
import { useLocale, useTranslations } from 'next-intl';
import {
  FaArrowRightArrowLeft,
  FaChartSimple,
  FaCloudArrowUp,
  FaFileArrowDown,
  FaGlobe,
  FaGithub,
  FaHouse,
  FaImage,
  FaList,
  FaPalette,
  FaRotate,
  FaShieldHalved,
  FaUserGroup,
} from 'react-icons/fa6';

const releases = [
  {
    id: '2026.09.20',
    date: '2026-09-20T00:00:00+07:00',
    titleKey: 'currentReleaseTitle',
    changesKey: 'currentChanges',
    changes: [
      { key: 'importPrivacy', icon: FaShieldHalved },
      { key: 'webImport', icon: FaGlobe },
      { key: 'backupRestore', icon: FaFileArrowDown },
      { key: 'profileManagement', icon: FaUserGroup },
      { key: 'notifications', icon: FaRotate },
      { key: 'openSource', icon: FaGithub },
    ],
  },
  {
    id: '2026.09.14',
    date: '2026-09-14T00:00:00+07:00',
    titleKey: 'latestReleaseTitle',
    changesKey: 'latestChanges',
    changes: [
      { key: 'headhuntResults', icon: FaList },
      { key: 'mobileNavigation', icon: FaArrowRightArrowLeft },
      { key: 'socialPreviews', icon: FaImage },
      { key: 'trackerNavigation', icon: FaHouse },
      { key: 'analytics', icon: FaChartSimple },
      { key: 'legalPages', icon: FaFileArrowDown },
    ],
  },
  {
    id: '2026.09.12',
    date: '2026-09-12T00:00:00+07:00',
    titleKey: 'newReleaseTitle',
    changesKey: 'newChanges',
    changes: [
      { key: 'trackerNavigation', icon: FaList },
      { key: 'trackerStatistics', icon: FaChartSimple },
      { key: 'driveRestore', icon: FaRotate },
      { key: 'interface', icon: FaPalette },
      { key: 'branding', icon: FaImage },
      { key: 'homepage', icon: FaHouse },
    ],
  },
  {
    id: '2026.09.03',
    date: '2026-09-03T00:00:00+07:00',
    titleKey: 'releaseTitle',
    changesKey: 'changes',
    changes: [
      { key: 'cloudBackup', icon: FaCloudArrowUp },
      { key: 'localBackup', icon: FaFileArrowDown },
      { key: 'profiles', icon: FaUserGroup },
      { key: 'importV2', icon: FaArrowRightArrowLeft },
      { key: 'statistics', icon: FaChartSimple },
      { key: 'interface', icon: FaPalette },
    ],
  },
] as const;

export const ChangelogPageContent = () => {
  const t = useTranslations('ChangelogPage');
  const locale = useLocale();

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(date));

  return (
    <>
      <PageTitle
        title={t('title')}
        desc={t('description')}
        descPosition="right"
      />

      <div className="flex flex-1 flex-col gap-4">
        {releases.map((release, releaseIndex) => (
          <article
            key={release.id}
            className="overflow-hidden rounded-xl bg-neutral-800/80"
          >
            <header className="flex flex-col gap-4 bg-neutral-950/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl leading-tight font-bold text-white sm:text-2xl">
                    {t(release.titleKey)}
                  </h2>
                  {releaseIndex === 0 && (
                    <span className="rounded-md bg-yellow-400/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-200 uppercase">
                      {t('latest')}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-white/50">
                  {formatDate(release.date)}
                </p>
              </div>
              <span className="w-fit shrink-0 font-mono text-sm font-semibold text-white/45">
                {release.id}
              </span>
            </header>

            <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
              {release.changes.map(({ key, icon: Icon }) => (
                <section
                  key={key}
                  className="group rounded-lg bg-neutral-900/60 p-3 transition-colors hover:bg-neutral-900 sm:p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/55 transition-colors group-hover:text-yellow-300">
                      <Icon className="text-base" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm leading-snug font-semibold text-white/90 sm:text-base">
                        {t(`${release.changesKey}.${key}.title`)}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">
                        {t(`${release.changesKey}.${key}.description`)}
                      </p>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
};
