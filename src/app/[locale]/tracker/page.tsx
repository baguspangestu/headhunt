import { getLocale } from 'next-intl/server';
import { TrackerPageContent } from './_components/TrackerPageContent';
import type { Banners } from '@/types/banner';
import type { Catalogs } from '@/types/catalog';
import type { Enums } from '@/types/enums';
import { HeadhuntTypeId, headhuntTypes } from '@/data/tracker/headhunt-types';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata() {
  const t = await getTranslations('TrackerPage');

  const metadata: Metadata = {
    title: t('title'),
    description: t('description'),
  };

  return metadata;
}

export default async function TrackerPage() {
  const locale = await getLocale();
  const t = await getTranslations('TrackerPage');

  const [banners, catalogs, enums] = await Promise.all([
    import(`@/data/tracker/banners/${locale}.json`).then(
      (m) => m.default as Banners
    ),
    import(`@/data/tracker/catalogs/${locale}.json`).then(
      (m) => m.default as Catalogs
    ),
    import(`@/data/enums/${locale}.json`).then((m) => m.default as Enums),
  ]);

  const now = Date.now() / 1000;

  const weaponBoxType = headhuntTypes.find(
    (type) => type.id === HeadhuntTypeId.Weponbox
  );

  const sortedBanners = Object.values(banners).sort((a, b) => {
    const aStart = a.startTime ?? 0;
    const bStart = b.startTime ?? 0;
    return bStart - aStart;
  });

  const activeBanners = sortedBanners.filter((banner) => {
    const start = banner.startTime ?? 0;
    const end = banner.endTime ?? Infinity;
    return now >= start && now <= end;
  });

  const weaponTypes = activeBanners
    .filter((banner) => banner.id.startsWith(HeadhuntTypeId.Weponbox))
    .map((banner) => {
      return {
        id: banner.id,
        name: banner.name,
        icons: [
          {
            name: catalogs[banner.rateup]?.name ?? banner.rateup,
            url: catalogs[banner.rateup]?.icon ?? '',
          },
        ],
        r5PityLimit: weaponBoxType!.r5PityLimit,
        r6PityLimit: weaponBoxType!.r6PityLimit,
        guaranteeAt: weaponBoxType!.guaranteeAt,
      };
    });

  const operatorTypes = headhuntTypes.map((type) => {
    const nameKey = `${type.id}Name` as Parameters<typeof t>[0];
    const typeName = t.has(nameKey)
      ? t(nameKey)
      : type.id === HeadhuntTypeId.RerunChr
        ? 'RE-Factor Headhunting'
        : type.id === HeadhuntTypeId.RerunWpn
          ? 'RE-Factor Issue'
          : type.id;
    const banner =
      activeBanners.find((banner) => banner.id.startsWith(type.id)) ??
      sortedBanners.find((banner) => banner.id.startsWith(type.id));

    let icons = banner?.rateup
      ? [
          {
            name: catalogs[banner.rateup]?.name ?? banner.rateup,
            url: catalogs[banner.rateup]?.icon ?? '',
          },
        ]
      : [
          {
            name: typeName,
            url: type.icon,
          },
        ];

    if (type.id === HeadhuntTypeId.Weponbox) {
      const activeWeaponIcons = weaponTypes
        .slice(0, 3)
        .flatMap((weaponType) => weaponType.icons);
      const activeWeaponIds = new Set(
        weaponTypes.map((weaponType) => weaponType.id)
      );
      const previousWeaponIcons = sortedBanners
        .filter(
          (weaponBanner) =>
            weaponBanner.id.startsWith(HeadhuntTypeId.Weponbox) &&
            (weaponBanner.startTime ?? 0) <= now &&
            !activeWeaponIds.has(weaponBanner.id)
        )
        .slice(0, 3 - activeWeaponIcons.length)
        .map((weaponBanner) => ({
          name: catalogs[weaponBanner.rateup]?.name ?? weaponBanner.rateup,
          url: catalogs[weaponBanner.rateup]?.icon ?? '',
        }));
      icons = [...activeWeaponIcons, ...previousWeaponIcons];
      if (icons.length === 0) icons = [{ name: typeName, url: type.icon }];
    }

    if (
      type.id === HeadhuntTypeId.Special ||
      type.id === HeadhuntTypeId.Joint
    ) {
      icons = (type.id === HeadhuntTypeId.Joint
        ? banner?.featured
        : banner?.rotate
      )?.map((id) => {
        return {
          name: catalogs[id]?.name ?? id,
          url: catalogs[id]?.icon ?? '',
        };
      }) ?? [
        {
          name: typeName,
          url: type.icon,
        },
      ];
    }

    return {
      id: type.id,
      name: typeName,
      icons,
      r5PityLimit: type.r5PityLimit,
      r6PityLimit: type.r6PityLimit,
      guaranteeAt: type.guaranteeAt,
    };
  });

  const types = {
    operatorTypes,
    weaponTypes,
  };

  const rarities = enums.rarities.filter((r) =>
    ['rarity_4', 'rarity_5', 'rarity_6'].includes(r.id)
  );

  return (
    <TrackerPageContent
      types={types}
      banners={banners}
      catalogs={catalogs}
      rarities={rarities}
    />
  );
}
