'use client';

import { Loading } from '@/components/ui/Loading';
import { PageTitle } from '@/components/ui/PageTitle';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHash } from '@/hooks/useHash';
import { FaDownload, FaFileImport, FaGear } from 'react-icons/fa6';
import { FaSyncAlt } from 'react-icons/fa';
import type { Banners } from '@/types/banner';
import { Button } from '@/components/ui/Button';
import { useStorageStore } from '@/store/useStorageStore';
import { useImportStore } from '@/store/useImportStore';
import { TypeCard } from './TypeCard';
import { ImportRecords } from './ImportRecords';
import { HeadhuntRecords } from './HeadhuntRecords';
import { RecentHeadhunts } from './RecentHeadhunts';
import { RecentBanners } from './RecentBanners';
import { DetailRecords } from './DetailRecords';
import type { Catalogs } from '@/types/catalog';
import type { Enums } from '@/types/enums';
import type { RecordItem } from '@/types/profile';
import { SettingsMenu } from './SettingsMenu';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type TrackerPageContentProps = {
  types: Types;
  banners: Banners;
  catalogs: Catalogs;
  rarities: Enums['rarities'];
};

type Types = {
  operatorTypes: TypeItem[];
  weaponTypes: TypeItem[];
};

type TypeItem = {
  id: string;
  name: string;
  icons: IconItem[];
  r5PityLimit: number;
  r6PityLimit: number;
  guaranteeAt?: number;
};

type IconItem = {
  name: string;
  url: string;
};

export const TrackerPageContent = ({
  types,
  banners,
  catalogs,
  rarities,
}: TrackerPageContentProps) => {
  const t = useTranslations('TrackerPage');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const hasHydrated = useStorageStore((s) => s.hasHydrated);
  const profile = useStorageStore((s) => s.getCurrentProfile());
  const importRecords = useImportStore((s) => s.importRecords);
  const isImporting = useImportStore((s) => s.isImporting);
  const processType = useImportStore((s) => s.processType);

  const [selectedBannerId, setSelectedBannerId] = useState<string | null>(null);

  const [isOpenImport, setIsOpenImport] = useState(false);
  const [isOpenSettings, setIsOpenSettings] = useState(false);
  const handleCloseSettings = useCallback(() => setIsOpenSettings(false), []);

  useEffect(() => {
    // The URL hash selects a category, not a scroll anchor. Reset the shared
    // layout's scroll position when entering Tracker from another page.
    const frame = requestAnimationFrame(() => {
      document.getElementById('scroll-container')?.scrollTo({
        top: 0,
        behavior: 'instant',
      });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (searchParams.get('settings') !== 'google-drive') return;
    setIsOpenSettings(true);
    router.replace(pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const combinedHeadhuntTypes = useMemo(
    () => [...types.operatorTypes, ...types.weaponTypes],
    [types]
  );

  const sidebarTypes = useMemo(() => {
    const bottomTypeIds = new Set(['joint', 'standard', 'beginner']);
    return [
      ...types.operatorTypes.filter((type) => !bottomTypeIds.has(type.id)),
      ...types.weaponTypes,
      ...types.operatorTypes.filter((type) => bottomTypeIds.has(type.id)),
    ];
  }, [types.operatorTypes, types.weaponTypes]);

  const hashList = useMemo(
    () => combinedHeadhuntTypes.map((e) => e.id),
    [combinedHeadhuntTypes]
  );

  const hash = useHash(hasHydrated ? types.operatorTypes[0]?.id : '', hashList);

  const isBannerType = useMemo(
    () => types.operatorTypes.some((type) => type.id === hash),
    [types.operatorTypes, hash]
  );

  const { records, bannerIds } = useMemo(() => {
    if (!hasHydrated) {
      return { records: [], bannerIds: new Set<string>() };
    }

    const allRecords = profile?.stores?.headhunt?.records;
    const bannerIds = new Set<string>();

    const isMainType = types.operatorTypes
      .slice(0, 3)
      .some((type) => type.id === hash);

    let result: RecordItem[] = [];

    if (isBannerType) {
      const source = allRecords?.[hash] ?? [];

      if (isMainType) {
        for (const r of source) {
          bannerIds.add(r.bannerId);
        }
      }

      result = selectedBannerId
        ? source.filter((r) => r.bannerId === selectedBannerId)
        : source;
    } else {
      const baseKey = hash.split('_')[0];
      const source = allRecords?.[baseKey] ?? [];

      result = source.filter((r) => r.bannerId === hash);
    }

    return { records: result, bannerIds };
  }, [
    hasHydrated,
    profile?.stores?.headhunt?.records,
    types.operatorTypes,
    isBannerType,
    hash,
    selectedBannerId,
  ]);

  const headhuntTypesMap = useMemo(() => {
    const map = new Map<string, TypeItem>();
    combinedHeadhuntTypes.forEach((type) => {
      map.set(type.id, type);
    });
    return map;
  }, [combinedHeadhuntTypes]);

  const guaranteeLimit = useMemo(() => {
    const limit =
      combinedHeadhuntTypes.find((type) => type.id === hash)?.guaranteeAt ||
      Infinity;
    return limit;
  }, [combinedHeadhuntTypes, hash]);

  useEffect(() => {
    const timer = setTimeout(() => setSelectedBannerId(null), 0);
    return () => clearTimeout(timer);
  }, [hash]);

  const handleSelectBanner = (id: string | null) => {
    setSelectedBannerId(id);
  };

  const handleSync = async () => {
    if (!profile?.stores?.headhunt?.url || isImporting) return;
    importRecords(profile.stores.headhunt.url, 'sync', profile.id);
  };

  const handleOpenImport = () => {
    setIsOpenImport(true);
  };

  const handleOpenSettings = () => {
    if (isImporting) return;
    setIsOpenSettings(true);
  };

  const resetKey = `${hash}-${selectedBannerId ?? 'all'}`;

  return (
    <>
      <div className="z-30 -mx-4 -mt-4 flow-root bg-neutral-900/80 px-4 pt-4 backdrop-blur-xs lg:sticky lg:top-0 lg:mx-0 lg:px-0">
        <PageTitle title={t('pageTitle')}>
          <div className="flex w-full flex-wrap items-stretch justify-center gap-2 lg:w-auto lg:justify-end">
            <Button
              onClick={handleSync}
              variant="secondary"
              disabled={
                !hasHydrated || !profile?.stores?.headhunt?.url || isImporting
              }
            >
              {isImporting && processType === 'sync' ? (
                <>
                  <FaSyncAlt className="animate-spin" />
                  <span>{t('syncing')}</span>
                </>
              ) : (
                <>
                  <FaSyncAlt />
                  <span>{t('sync')}</span>
                </>
              )}
            </Button>
            <Button
              onClick={handleOpenImport}
              disabled={!hasHydrated || (isImporting && processType === 'sync')}
            >
              <FaFileImport />
              {isImporting && processType === 'import' ? (
                <span>{t('importing')}</span>
              ) : (
                <span>{t('import')}</span>
              )}
            </Button>
            <Button
              onClick={handleOpenSettings}
              variant="secondary"
              isNew
              disabled={!hasHydrated || isImporting}
              aria-label={t('SettingsMenu.openSettings')}
            >
              <FaGear />
              <span>{t('SettingsMenu.title')}</span>
            </Button>
          </div>
        </PageTitle>
      </div>

      <div className="grid w-full flex-1 gap-2 xl:grid-cols-[minmax(17rem,1fr)_minmax(0,2fr)]">
        <aside className="min-w-0 xl:sticky xl:top-20 xl:h-fit">
          <div className="overflow-hidden rounded-xl xl:bg-neutral-900/35">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:max-h-[calc(100dvh-9.5rem)] xl:flex-col xl:overflow-y-auto xl:overscroll-contain xl:pr-1.5">
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-100/90 sm:col-span-2">
                {t('refactorAnnouncement')}
              </p>
              {sidebarTypes.map((type) => {
                const isWeaponBanner = type.id.startsWith('weponbox_');
                const typeStats = hasHydrated
                  ? isWeaponBanner
                    ? profile?.stores?.headhunt?.banners[type.id]
                    : profile?.stores?.headhunt?.types[type.id]
                  : undefined;

                let pity5 = typeStats?.r5Pity ?? 0;
                let pity6 = typeStats?.r6Pity ?? 0;

                if (type.id === 'weponbox') {
                  pity5 = 0;
                  pity6 = 0;
                } else if (type.id === 'joint' && hasHydrated) {
                  const bannerStats =
                    profile?.stores?.headhunt?.banners['joint_1_2_2'];
                  pity5 = bannerStats?.r5Pity ?? 0;
                  pity6 = bannerStats?.r6Pity ?? 0;
                }

                return (
                  <div key={type.id} className="w-full">
                    <TypeCard
                      hash={type.id}
                      name={type.name}
                      icons={type.icons}
                      pity5={pity5}
                      pity6={pity6}
                      pity5Limit={type.r5PityLimit}
                      pity6Limit={type.r6PityLimit}
                      isSelected={type.id === hash}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-col gap-4">
          {!hasHydrated ? (
            <div className="flex flex-1 items-center justify-center rounded-xl bg-neutral-800/80 py-4">
              <Loading label={t('loading')} />
            </div>
          ) : profile?.stores?.headhunt?.records ? (
            <>
              {bannerIds.size > 0 && (
                <RecentBanners
                  key={`wp-types-${hash}`}
                  banners={banners}
                  bannerIds={bannerIds}
                  selectedId={selectedBannerId}
                  onSelected={handleSelectBanner}
                />
              )}
              {selectedBannerId ? (
                <DetailRecords
                  label={banners[selectedBannerId].name ?? selectedBannerId}
                  stats={profile.stores.headhunt.banners[selectedBannerId]}
                  hash={hash}
                />
              ) : (
                <DetailRecords
                  label={headhuntTypesMap.get(hash)?.name}
                  stats={
                    isBannerType
                      ? profile.stores.headhunt.types[hash]
                      : profile.stores.headhunt.banners[hash]
                  }
                  hash={hash}
                />
              )}
              <RecentHeadhunts
                key={`recent-${resetKey}`}
                hash={hash}
                records={records}
                catalogs={catalogs}
                rarities={rarities}
                guaranteedLimit={guaranteeLimit}
              />
              <HeadhuntRecords
                key={`record-${resetKey}`}
                hash={hash}
                records={records}
                catalogs={catalogs}
                banners={banners}
                rarities={rarities}
                disabled={!profile.stores.headhunt.url || isImporting}
                isSyncing={isImporting && processType === 'sync'}
                onSync={handleSync}
              />
            </>
          ) : (
            <div className="flex min-h-112 flex-1 flex-col items-center justify-center rounded-xl bg-neutral-800/80 px-5 py-10 text-center">
              <div className="mb-5">
                {/* Local static logo does not need Cloudflare image optimization. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/web-app-manifest-512x512.png"
                  alt=""
                  width={96}
                  height={96}
                  draggable={false}
                  className="size-20 rounded-xl object-cover sm:size-24"
                />
              </div>

              <div className="max-w-lg">
                <h2 className="text-xl font-bold text-white sm:text-2xl">
                  {profile?.stores?.headhunt
                    ? t('noGachaRecords')
                    : t('noRecordImported')}
                </h2>
                {!profile?.stores?.headhunt && (
                  <p className="mt-2 text-sm leading-6 text-neutral-400 sm:text-base">
                    {t.rich('importInstruction', {
                      bold: (chunks) => (
                        <span className="font-semibold text-neutral-200">
                          {chunks}
                        </span>
                      ),
                    })}
                  </p>
                )}
              </div>

              <div className="mt-6 flex w-full max-w-sm flex-col justify-center gap-2 sm:flex-row">
                {profile?.stores?.headhunt ? (
                  <Button
                    onClick={handleSync}
                    variant="secondary"
                    className="sm:min-w-32"
                    disabled={!profile.stores.headhunt?.url || isImporting}
                  >
                    {isImporting && processType === 'sync' ? (
                      <>
                        <FaSyncAlt className="animate-spin" />
                        <span>{t('syncing')}</span>
                      </>
                    ) : (
                      <>
                        <FaSyncAlt />
                        <span>{t('sync')}</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setIsOpenImport(true)}
                    className="sm:min-w-32"
                    disabled={isImporting && processType === 'sync'}
                  >
                    <FaFileImport />
                    {isImporting && processType === 'import' ? (
                      <span>{t('importing')}</span>
                    ) : (
                      <span>{t('import')}</span>
                    )}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="sm:min-w-32"
                  onClick={handleOpenSettings}
                  disabled={isImporting}
                >
                  <FaDownload />
                  <span>{t('SettingsMenu.restore')}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImportRecords
        isOpen={isOpenImport}
        onClose={() => setIsOpenImport(false)}
      />
      <SettingsMenu isOpen={isOpenSettings} onClose={handleCloseSettings} />
    </>
  );
};
