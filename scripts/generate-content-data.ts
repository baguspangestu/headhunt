import fs from 'fs/promises';
import path from 'path';
import type { SKPortGuideOperators } from './types/skport-guide-operators';
import type { SKPortGuideWeapons } from './types/skport-guide-weapons';
import { writeJsonFiles } from './lib/write-json-files';
import { ensureDirs } from './lib/ensure-dirs';
import type { Catalog } from '@/types/catalog';
import type { SKPortGuideEnums } from './types/skport-guide-enums';
import type { Weapon, WeaponDetail } from '@/types/weapons';
import type { Operator } from '@/types/operator';
import type { RarityId } from '@/types/enums';
import type {
  SKPortWikiDetailWeapon,
  Document,
  InlineElement,
} from './types/skport-wiki-detail-weapon';
import { resizeImage, saveAsPng, downloadImage } from './lib/image';
import { runScript } from './lib/logger';

type OperatorExtra = {
  slug: string;
  avatarRt: string;
  avatarSq: string;
};

type WeaponExtra = {
  slug: string;
  icon: string;
};

const dir = process.cwd();
const BASE_LANG = 'en.json' as const;

const paths = {
  rawSKPortWikiDetail: path.join(dir, 'raw/skport/wiki/detail'),
  rawSKPortGuideEnums: path.join(dir, 'raw/skport/guide/enums'),
  rawSKPortGuideOperators: path.join(dir, 'raw/skport/guide/operators'),
  rawSKPortGuideWeapons: path.join(dir, 'raw/skport/guide/weapons'),
  generatedEnums: path.join(dir, 'src/data/enums'),
  generatedOperators: path.join(dir, 'src/data/operators'),
  generatedWeapons: path.join(dir, 'src/data/weapons'),
  generatedTrackerCatalogs: path.join(dir, 'src/data/tracker/catalogs'),
  assets: path.join(dir, 'public/assets'),
} as const;

const enumPicks = {
  rarities: 'rarities',
  charProperties: 'elements',
  professions: 'opClass',
  weaponTypes: 'wpTypes',
} as const;

async function readJsonFiles<T>(dir: string): Promise<Record<string, T>> {
  const files = await fs.readdir(dir);
  const data: Record<string, T> = {};

  await Promise.all(
    files.map(async (file) => {
      const content = await fs.readFile(path.join(dir, file), 'utf-8');
      data[file] = JSON.parse(content) as T;
    })
  );

  return data;
}

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getSKPortGuideOperatorId(
  op: SKPortGuideOperators['data']['chars'][number]
): string {
  const talent = op.abilityTalents.find((talent) =>
    talent.id.startsWith('chr_')
  );
  if (!talent) throw new Error(`[Operator -> ${op.name}]: Talent not found`);
  return talent.id.split('_').slice(0, -1).join('_');
}

function getSKPortGuideWeaponId(
  wp: SKPortGuideWeapons['data']['weapons'][number]
): string {
  const skill = wp.skills.find((skill) => skill.key.startsWith('sk_wpn_'));
  if (!skill) throw new Error(`[Weapon -> ${wp.name}]: Skill not found`);
  return skill.key.slice(3);
}

function placeMaleEndministratorFirst<T>(
  items: T[],
  getId: (item: T) => string
): T[] {
  const maleIndex = items.findIndex(
    (item) => getId(item) === 'chr_0002_endminm'
  );
  const femaleIndex = items.findIndex(
    (item) => getId(item) === 'chr_0003_endminf'
  );

  if (maleIndex < 0 || femaleIndex < 0 || maleIndex < femaleIndex) {
    return items;
  }

  const ordered = [...items];
  const [male] = ordered.splice(maleIndex, 1);
  ordered.splice(femaleIndex, 0, male);
  return ordered;
}

function transformEnum<T extends Record<string, string>>({
  json,
  enumPicks,
}: {
  json: SKPortGuideEnums;
  enumPicks: T;
}) {
  return Object.fromEntries(
    Object.entries(enumPicks).map(([jsonKey, outKey]) => {
      let items = json.data[jsonKey as keyof typeof json.data] ?? [];

      if (jsonKey === 'rarities') {
        items = [...items].sort((a, b) => a.key.localeCompare(b.key));
      }

      return [
        outKey,
        items.map((item) => ({
          id: item.key,
          name: item.value,
        })),
      ];
    })
  ) as Record<T[keyof T], { id: string; name: string }[]>;
}

function transformOperator({
  json,
  extraMap,
}: {
  json: SKPortGuideOperators;
  extraMap: Map<string, OperatorExtra>;
}) {
  return placeMaleEndministratorFirst(
    json.data.chars,
    getSKPortGuideOperatorId
  ).map((op) => {
    const id = getSKPortGuideOperatorId(op);
    const extra = extraMap.get(id);

    const slug =
      (extra?.slug ?? '') +
      (id === 'chr_0002_endminm'
        ? '-m'
        : id === 'chr_0003_endminf'
          ? '-f'
          : '');

    const data: Operator = {
      id,
      slug,
      name: op.name,
      avatar: extra?.avatarRt || '',
      rarityId: op.rarity.key,
      elementId: op.property.key,
      opClassId: op.profession.key,
      ...(op.labelType ? { labelType: op.labelType } : {}),
    };

    return data;
  });
}

function transformWeapon({
  file,
  json,
  extraMap,
  detailMap,
}: {
  file: string;
  json: SKPortGuideWeapons;
  extraMap: Map<string, WeaponExtra>;
  detailMap: Map<string, Map<string, Map<string, WeaponDetail>>>;
}) {
  return json.data.weapons.map((wp) => {
    const id = getSKPortGuideWeaponId(wp);
    const extra = extraMap.get(id);

    const slug = extra?.slug ?? '';
    const detailsByLocale = detailMap.get('weapons')?.get(slug);
    const weaponDetail =
      detailsByLocale?.get(file) ?? detailsByLocale?.get(BASE_LANG);

    const data: Weapon = {
      id: id,
      name: wp.name,
      icon: extra?.icon || '',
      rarityId: wp.rarity.key,
      HeadhuntTypeId: wp.type.key,
      detail: weaponDetail,
      skillLabels: wp.skills.map((e) => e.value),
      ...(wp.labelType ? { labelType: wp.labelType } : {}),
    };

    return data;
  });
}

function transformCatalog({
  operatorsDataMap,
  weaponsDataMap,
  operatorsExtraMap,
  weaponsExtraMap,
}: {
  operatorsDataMap: Record<string, SKPortGuideOperators>;
  weaponsDataMap: Record<string, SKPortGuideWeapons>;
  operatorsExtraMap: Map<string, OperatorExtra>;
  weaponsExtraMap: Map<string, WeaponExtra>;
}): Record<string, Catalog> {
  const catalogs: Record<string, Catalog> = {};

  const files = new Set([
    ...Object.keys(operatorsDataMap),
    ...Object.keys(weaponsDataMap),
  ]);

  for (const file of files) {
    const items = [
      ...placeMaleEndministratorFirst(
        operatorsDataMap[file]?.data.chars ?? [],
        getSKPortGuideOperatorId
      ).map((op) => {
        const id = getSKPortGuideOperatorId(op);

        return [
          id,
          {
            name: op.name,
            icon: operatorsExtraMap.get(id)?.avatarSq,
            rarityId: op.rarity.key as RarityId,
          },
        ];
      }),
      ...(weaponsDataMap[file]?.data.weapons ?? []).map((wp) => {
        const id = getSKPortGuideWeaponId(wp);

        return [
          id,
          {
            name: wp.name,
            icon: weaponsExtraMap.get(id)?.icon,
            rarityId: wp.rarity.key as RarityId,
          },
        ];
      }),
    ];

    catalogs[file] = Object.fromEntries(items);
  }

  return catalogs;
}

function getSKPortWikiTableCellContents({
  document,
  chapterId,
  blockId,
  cellPositions,
}: {
  document: Document;
  chapterId: string;
  blockId: string;
  cellPositions: {
    row: number;
    col: number;
  }[];
}) {
  const contentId =
    document.widgetCommonMap[chapterId]?.tabDataMap?.default?.content;
  const contentBlockMap = contentId
    ? document.documentMap[contentId]?.blockMap
    : undefined;
  const targetTable = contentBlockMap?.[blockId]?.table;

  if (!contentBlockMap || !targetTable) return [];

  return cellPositions.flatMap(({ row, col }) => {
    const rowId = targetTable.rowIds[row];
    const colId = targetTable.columnIds[col];
    if (!rowId || !colId) return [];

    const cellIds = targetTable.cellMap[`${rowId}_${colId}`]?.childIds;
    if (!cellIds?.length) return [];

    const blocks = cellIds
      .map((id) =>
        contentBlockMap[id]?.text?.inlineElements.filter(
          (element): element is InlineElement =>
            typeof element.text?.text === 'string'
        )
      )
      .filter((elements): elements is InlineElement[] =>
        Array.isArray(elements)
      );
    return [blocks];
  });
}

function findWidgetWithTable(
  document: Document,
  tableId: string
): string | undefined {
  for (const chapter of document.chapterGroup) {
    for (const widget of chapter.widgets) {
      const contentId =
        document.widgetCommonMap[widget.id]?.tabDataMap?.default?.content;
      if (
        contentId &&
        document.documentMap[contentId]?.blockMap?.[tableId]?.table
      ) {
        return widget.id;
      }
    }
  }
  return undefined;
}

async function getDetailMap() {
  const data = new Map<string, Map<string, Map<string, WeaponDetail>>>();

  function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
    if (!map.has(key)) {
      map.set(key, create());
    }
    return map.get(key)!;
  }

  const folders = await fs.readdir(paths.rawSKPortWikiDetail);

  // operators, weapons, ...
  for (const folder of folders) {
    if (folder !== 'weapons') continue;

    const items = await fs.readdir(
      path.join(paths.rawSKPortWikiDetail, folder)
    );

    // rossi, lupine-scarlet, ...
    for (const item of items) {
      const detailMaps = await readJsonFiles<SKPortWikiDetailWeapon>(
        path.join(paths.rawSKPortWikiDetail, folder, item)
      );

      // id.json, en.json, ...
      for (const [file, json] of Object.entries(detailMaps)) {
        // if (json.data.item.itemId !== "733") break;
        let baseATK = '-/-';
        let skills: {
          label: string;
          content: InlineElement[][];
        }[] = [];

        const document = json.data.item.document;
        const isRarity6 = json.data.item.tagIds.includes('10006');

        const chapterInformationId = findWidgetWithTable(document, 'siDaPc');
        const chapterSkillId = findWidgetWithTable(document, '6kzKo0');

        // Informasi Senjata
        if (chapterInformationId) {
          const cellPositions = [
            { row: 1, col: 1 }, // Base Atk
            { row: 1, col: 3 }, // Max Base Atk
            { row: 2, col: 3 }, // Skill 1
            { row: 3, col: 3 }, // Skill 2
            { row: 4, col: 3 }, // Skill 3
          ];

          const cellContent = getSKPortWikiTableCellContents({
            document,
            chapterId: chapterInformationId,
            blockId: 'siDaPc',
            cellPositions,
          });

          baseATK = cellContent
            .slice(0, 2)
            .map((e) => e?.[0]?.[0]?.text.text || '-')
            .join('/');

          if (!chapterSkillId) {
            skills = cellContent.slice(2).map((e) => ({
              label: '9/9',
              content: e ?? [],
            }));
          }
        }

        // Skill & Aktivasi
        if (chapterSkillId) {
          const cellPositions = [
            { row: 9, col: 1 },
            { row: 9, col: 2 },
            { row: isRarity6 ? 4 : 9, col: 3 },
          ];

          const cellContent = getSKPortWikiTableCellContents({
            document,
            chapterId: chapterSkillId,
            blockId: '6kzKo0',
            cellPositions,
          });

          skills = cellContent.map((e, i) => ({
            label: i === 2 && isRarity6 ? '4/9' : '9/9',
            content: e ?? [],
          }));
        }

        const content: WeaponDetail = { baseATK, skills };

        // SET DATA
        const map2 = getOrCreate(data, folder, () => new Map());
        const map3 = getOrCreate(map2, item, () => new Map());

        map3.set(file, content);
      }
    }
  }

  return data;
}

async function main() {
  await ensureDirs(
    paths.generatedEnums,
    paths.generatedOperators,
    paths.generatedWeapons,
    paths.generatedTrackerCatalogs,
    paths.assets
  );

  const [enumsDataMap, operatorsDataMap, weaponsDataMap] = await Promise.all([
    readJsonFiles<SKPortGuideEnums>(paths.rawSKPortGuideEnums),
    readJsonFiles<SKPortGuideOperators>(paths.rawSKPortGuideOperators),
    readJsonFiles<SKPortGuideWeapons>(paths.rawSKPortGuideWeapons),
  ]);

  const operatorsExtraMap = new Map<string, OperatorExtra>();
  const weaponsExtraMap = new Map<string, WeaponExtra>();
  const detailMap = await getDetailMap();

  for (const operator of operatorsDataMap[BASE_LANG].data.chars) {
    const id = getSKPortGuideOperatorId(operator);
    const slug = generateSlug(operator.name);

    const bufferRt = await downloadImage(operator.avatarRtUrl);
    const resizedBufferRt = await resizeImage({ buffer: bufferRt, width: 256 });
    const avatarRt = await saveAsPng({
      buffer: resizedBufferRt,
      outputDir: paths.assets,
    });

    const bufferSq = await downloadImage(operator.avatarSqUrl);
    const resizedBufferSq = await resizeImage({ buffer: bufferSq, width: 128 });
    const avatarSq = await saveAsPng({
      buffer: resizedBufferSq,
      outputDir: paths.assets,
    });

    operatorsExtraMap.set(id, { slug, avatarRt, avatarSq });
  }

  for (const weapon of weaponsDataMap[BASE_LANG].data.weapons) {
    const id = getSKPortGuideWeaponId(weapon);
    const slug = generateSlug(weapon.name);

    const buffer = await downloadImage(weapon.iconUrl);
    const resizedBuffer = await resizeImage({ buffer, width: 256 });
    const icon = await saveAsPng({
      buffer: resizedBuffer,
      outputDir: paths.assets,
    });

    weaponsExtraMap.set(id, { slug, icon });
  }

  // Proccess & Generate Output
  await writeJsonFiles(
    Object.fromEntries(
      Object.entries(enumsDataMap).map(([file, json]) => [
        file,
        transformEnum({
          json,
          enumPicks,
        }),
      ])
    ),
    paths.generatedEnums
  );

  await writeJsonFiles(
    Object.fromEntries(
      Object.entries(operatorsDataMap).map(([file, json]) => [
        file,
        transformOperator({
          json,
          extraMap: operatorsExtraMap,
        }),
      ])
    ),
    paths.generatedOperators
  );

  await writeJsonFiles(
    Object.fromEntries(
      Object.entries(weaponsDataMap).map(([file, json]) => [
        file,
        transformWeapon({
          file,
          json,
          extraMap: weaponsExtraMap,
          detailMap,
        }),
      ])
    ),
    paths.generatedWeapons
  );

  await writeJsonFiles(
    transformCatalog({
      operatorsDataMap,
      weaponsDataMap,
      operatorsExtraMap,
      weaponsExtraMap,
    }),
    paths.generatedTrackerCatalogs
  );
}

runScript('Content data generation', main);
