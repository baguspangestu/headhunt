import { getLocale } from 'next-intl/server';
import { HomePageContent } from './_components/HomePageContent';
import type { Banners } from '@/types/banner';
import type { Catalogs } from '@/types/catalog';
import { getActiveLimitedBanners } from '@/lib/active-banners';

export default async function HomePage() {
  const locale = await getLocale();

  const [banners, catalogs] = await Promise.all([
    import(`@/data/tracker/banners/${locale}.json`).then(
      (m) => m.default as Banners
    ),
    import(`@/data/tracker/catalogs/${locale}.json`).then(
      (m) => m.default as Catalogs
    ),
  ]);

  const initialNow = Date.now();
  const now = initialNow / 1000;

  const limitedBanners = getActiveLimitedBanners(banners, now).map((banner) => {
    let itemName = catalogs[banner.rateup]?.name ?? banner.rateup;
    if (banner.id.startsWith('joint')) {
      itemName =
        banner.featured?.map((id) => catalogs[id]?.name ?? id).join(', ') ??
        itemName;
    }
    return {
      id: banner.id,
      name: banner.name,
      endTime: banner.endTime,
      itemName,
      icon: catalogs[banner.rateup]?.icon ?? '',
      rotation: [...new Set(banner.featured ?? banner.rotate ?? [])].flatMap(
        (id) => {
          if (id === banner.rateup) return [];
          const character = catalogs[id];
          return character?.icon
            ? [{ id, name: character.name, icon: character.icon }]
            : [];
        }
      ),
    };
  });

  return <HomePageContent banners={limitedBanners} initialNow={initialNow} />;
}
