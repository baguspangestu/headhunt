import { getLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { Gear, GearFilters } from '@/types/gear';
import { GearPageContent } from './_components/GearPageContent';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('GearPage');

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function GearPage() {
  const locale = await getLocale();
  const [gear, filters] = await Promise.all([
    import(`@/data/gear/${locale}.json`).then(
      (module) => module.default as Record<string, Gear>
    ),
    import(`@/data/gear/filters/${locale}.json`).then(
      (module) => module.default as GearFilters
    ),
  ]);

  return <GearPageContent gear={Object.values(gear)} filters={filters} />;
}
