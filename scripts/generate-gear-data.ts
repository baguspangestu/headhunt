import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from '@/config';
import type { Gear, GearDetail, GearFilters } from '@/types/gear';
import type { SKPortGuideGear } from './types/skport-guide-gear';
import { downloadImage, resizeImage, saveAsPng } from './lib/image';
import { ensureDirs } from './lib/ensure-dirs';
import { logger, runScript } from './lib/logger';
import { writeJsonFiles } from './lib/write-json-files';

type RawWikiDetail = {
  code: number;
  data?: {
    item?: {
      name?: string;
      document?: {
        chapterGroup?: {
          title: string;
          widgets: { id: string; title: string }[];
        }[];
        widgetCommonMap?: Record<
          string,
          { tabDataMap?: Record<string, { content?: string }> }
        >;
        documentMap?: Record<string, { blockMap?: Record<string, RawBlock> }>;
      };
    };
  };
};

type RawBlock = {
  text?: { inlineElements?: { text?: { text?: string } }[] };
  table?: {
    rowIds: string[];
    columnIds: string[];
    cellMap: Record<string, { childIds: string[] }>;
  };
};

const dir = process.cwd();
const paths = {
  guide: path.join(dir, 'raw/skport/guide/gear'),
  wiki: path.join(dir, 'raw/skport/wiki/detail/gear'),
  assets: path.join(dir, 'public/assets'),
  output: path.join(dir, 'src/data/gear'),
  filters: path.join(dir, 'src/data/gear/filters'),
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCellText(
  blockMap: Record<string, RawBlock> | undefined,
  childIds: string[] | undefined
) {
  return (childIds ?? [])
    .map((id) =>
      (blockMap?.[id]?.text?.inlineElements ?? [])
        .map((inline) => inline.text?.text ?? '')
        .join('')
        .trim()
    )
    .filter(Boolean)
    .join(' ');
}

function extractDetail(raw: RawWikiDetail | undefined): GearDetail | undefined {
  const item = raw?.data?.item;
  if (!item?.name) return undefined;

  const stats = (item.document?.chapterGroup ?? [])
    .filter((chapter) =>
      chapter.title.toLowerCase().includes('gear information')
    )
    .flatMap((chapter) =>
      chapter.widgets
        .filter((widget) => widget.title.toLowerCase().includes('stats'))
        .flatMap((widget) => {
          const contentId =
            item.document?.widgetCommonMap?.[widget.id]?.tabDataMap?.default
              ?.content;
          const blockMap =
            item.document?.documentMap?.[contentId ?? '']?.blockMap;
          const table = Object.values(blockMap ?? {}).find(
            (block) => block.table
          )?.table;
          if (!table) return [];

          return table.rowIds.flatMap((rowId) => {
            const cells = table.columnIds.map((columnId) =>
              getCellText(
                blockMap,
                table.cellMap[`${rowId}_${columnId}`]?.childIds
              )
            );
            return cells[0] && cells[1]
              ? [{ label: cells[0], value: cells[1] }]
              : [];
          });
        })
    );

  return {
    name: item.name,
    stats,
  };
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function buildImageMap(
  equips: { id: string; name: string; iconUrl: string }[]
) {
  const entries = await Promise.all(
    equips.map(async (equip) => {
      try {
        const buffer = await downloadImage(equip.iconUrl);
        const resized = await resizeImage({ buffer, width: 128, height: 128 });
        return [
          equip.id,
          await saveAsPng({ buffer: resized, outputDir: paths.assets }),
        ] as const;
      } catch {
        logger.warn(`Failed to download gear icon: ${equip.name}`);
        return [equip.id, ''] as const;
      }
    })
  );
  return new Map(entries);
}

async function main() {
  await ensureDirs(paths.output, paths.filters, paths.assets);
  const locales = CONFIG.locales.filter((locale) => locale.enable);
  const englishGuide = await readJson<SKPortGuideGear>(
    path.join(paths.guide, 'en.json')
  );
  if (!englishGuide) throw new Error('English gear guide data is missing');

  const imageMap = await buildImageMap(englishGuide.data.equips);
  const englishNameById = new Map(
    englishGuide.data.equips.map((equip) => [equip.id, equip.name])
  );
  const wikiDirs = await fs.readdir(paths.wiki, { withFileTypes: true });
  const wikiMap = new Map<string, RawWikiDetail>();
  for (const entry of wikiDirs.filter((item) => item.isDirectory())) {
    const raw = await readJson<RawWikiDetail>(
      path.join(paths.wiki, entry.name, 'en.json')
    );
    if (raw) wikiMap.set(entry.name, raw);
  }

  const output: Record<string, Record<string, Gear>> = {};
  const filtersOutput: Record<string, GearFilters> = {};
  for (const locale of locales) {
    const guide = await readJson<SKPortGuideGear>(
      path.join(paths.guide, `${locale.id}.json`)
    );
    if (!guide) {
      throw new Error(`Gear guide data is missing or invalid for ${locale.id}`);
    }

    const options = (values: { id: string; name: string }[]) =>
      Object.values(
        values.reduce<Record<string, { id: string; name: string }>>(
          (result, value) => ({ ...result, [value.id]: value }),
          {}
        )
      ).sort((a, b) => a.name.localeCompare(b.name));

    filtersOutput[`${locale.id}.json`] = {
      rarities: options(
        guide.data.equips.map((equip) => ({
          id: equip.rarity.key,
          name: equip.rarity.value,
        }))
      ),
      types: options(
        guide.data.equips.map((equip) => ({
          id: equip.type.key,
          name: equip.type.value,
        }))
      ),
      levels: options(
        guide.data.equips.map((equip) => ({
          id: equip.level.key,
          name: equip.level.value,
        }))
      ),
      properties: options(
        guide.data.equips.flatMap((equip) =>
          equip.properties.map((property) => ({
            id: property,
            name: property.replace('equip_attr_', '').replaceAll('_', ' '),
          }))
        )
      ),
      suits: options(
        guide.data.equips
          .filter((equip) => equip.suit)
          .map((equip) => ({ id: equip.suit!.id, name: equip.suit!.name }))
      ),
      flags: [
        {
          id: 'accessory',
          name: locale.id === 'id' ? 'Aksesori' : 'Accessory',
        },
        {
          id: 'enhanceable',
          name: locale.id === 'id' ? 'Bisa ditingkatkan' : 'Enhanceable',
        },
      ],
    };

    output[`${locale.id}.json`] = Object.fromEntries(
      guide.data.equips.map((equip) => {
        const detail = extractDetail(
          wikiMap.get(slugify(englishNameById.get(equip.id) ?? equip.name))
        );
        return [
          equip.id,
          {
            id: equip.id,
            name: equip.name,
            icon: imageMap.get(equip.id) ?? '',
            rarityId: equip.rarity.key,
            typeId: equip.type.key,
            levelId: equip.level.key,
            propertyIds: equip.properties,
            isAccessory: equip.isAccessory,
            baseAttrValue: equip.baseAttrValue,
            canEnhance: equip.canEnhance,
            suit: equip.suit,
            ...(detail ? { detail } : {}),
          } satisfies Gear,
        ];
      })
    );
    logger.info(
      `Generated ${guide.data.equips.length} gear items for ${locale.id}`
    );
  }

  await writeJsonFiles(output, paths.output);
  await writeJsonFiles(filtersOutput, paths.filters);
}

runScript('Gear data generation', main);
