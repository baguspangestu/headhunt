import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { CONFIG } from '@/config';
import {
  getAuthenticatedSkportSession,
  signedGet,
  SkportApiError,
  type SkportSession,
} from './lib/skport-api';
import { logger, runScript } from './lib/logger';
import type { SKPortWikiCatalog } from './types/skport-wiki-catalog';
import type { SKPortWikiDetailResponse } from './types/skport-wiki-detail';

const catalogDir = path.join(process.cwd(), 'raw', 'skport', 'wiki', 'catalog');
const detailDir = path.join(process.cwd(), 'raw', 'skport', 'wiki', 'detail');
const detailPath = '/web/v1/wiki/item/info';
const categories = {
  '1': 'operators',
  '2': 'weapons',
  '4': 'gear',
} as const;
const concurrency = 4;
const maxAttempts = 3;

type CategoryId = keyof typeof categories;
type Locale = (typeof CONFIG.locales)[number];
type DetailTask = {
  locale: Locale;
  category: (typeof categories)[CategoryId];
  itemId: string;
  slug: string;
};

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function readCatalog(localeId: string): Promise<SKPortWikiCatalog> {
  const content = await readFile(
    path.join(catalogDir, `${localeId}.json`),
    'utf8'
  );
  const catalog = JSON.parse(content) as SKPortWikiCatalog;
  if (catalog.code !== 0 || !Array.isArray(catalog.data?.catalog)) {
    throw new Error(
      `Invalid wiki catalog for ${localeId}; run npm run get:wiki-catalog`
    );
  }
  return catalog;
}

function getItems(catalog: SKPortWikiCatalog, categoryId: CategoryId) {
  const mainType = catalog.data.catalog.find((entry) => entry.id === '1');
  const category = mainType?.typeSub.find((entry) => entry.id === categoryId);
  if (!category || !Array.isArray(category.items)) {
    throw new Error(`Wiki catalog is missing category ${categoryId}`);
  }
  return category.items;
}

function buildTasks(
  englishCatalog: SKPortWikiCatalog,
  catalogs: Map<string, SKPortWikiCatalog>
): DetailTask[] {
  const slugs = new Map<string, string>();
  for (const categoryId of Object.keys(categories) as CategoryId[]) {
    for (const item of getItems(englishCatalog, categoryId)) {
      const slug = generateSlug(item.name);
      if (!slug) throw new Error(`Empty English slug for item ${item.itemId}`);
      slugs.set(`${categoryId}:${item.itemId}`, slug);
    }
  }

  const tasks: DetailTask[] = [];
  for (const locale of CONFIG.locales.filter((entry) => entry.enable)) {
    const catalog = catalogs.get(locale.id);
    if (!catalog) throw new Error(`Missing wiki catalog for ${locale.id}`);
    for (const categoryId of Object.keys(categories) as CategoryId[]) {
      for (const item of getItems(catalog, categoryId)) {
        const slug = slugs.get(`${categoryId}:${item.itemId}`);
        if (!slug) {
          throw new Error(
            `No English slug for ${locale.id} item ${item.itemId}`
          );
        }
        tasks.push({
          locale,
          category: categories[categoryId],
          itemId: item.itemId,
          slug,
        });
      }
    }
  }
  return tasks;
}

function isRetryable(error: unknown): boolean {
  return (
    (error instanceof SkportApiError &&
      (error.status === 429 || error.status >= 500)) ||
    error instanceof TypeError ||
    (error instanceof Error && error.name === 'TimeoutError')
  );
}

async function fetchDetail(
  task: DetailTask,
  session: SkportSession,
  cred: string,
  deviceId: string
): Promise<SKPortWikiDetailResponse> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await signedGet<SKPortWikiDetailResponse>(
        detailPath,
        new URLSearchParams({ id: task.itemId }),
        task.locale.region,
        session,
        cred,
        deviceId
      );
      if (response.data?.item?.itemId !== task.itemId) {
        throw new Error('SKPort returned a different or empty wiki item');
      }
      return response;
    } catch (error) {
      if (attempt === maxAttempts || !isRetryable(error)) {
        throw new Error(
          `Failed to fetch ${task.category}/${task.slug} [${task.locale.id}]`,
          { cause: error }
        );
      }
      const waitMs = 500 * 2 ** (attempt - 1);
      const reason =
        error instanceof SkportApiError
          ? `HTTP ${error.status}, API code ${error.code}`
          : error instanceof Error
            ? error.name
            : 'Unknown error';
      logger.warn(
        `Retrying ${task.category}/${task.slug} [${task.locale.id}] (${attempt + 1}/${maxAttempts}) in ${waitMs}ms: ${reason}`
      );
      await delay(waitMs);
    }
  }
  throw new Error('Unexpected retry state');
}

async function fetchAll(
  tasks: DetailTask[],
  session: SkportSession,
  cred: string,
  deviceId: string
): Promise<SKPortWikiDetailResponse[]> {
  const results: (SKPortWikiDetailResponse | undefined)[] = new Array(
    tasks.length
  );
  let nextIndex = 0;
  let completed = 0;
  let firstError: unknown;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (firstError === undefined) {
        const index = nextIndex++;
        if (index >= tasks.length) return;
        try {
          results[index] = await fetchDetail(
            tasks[index],
            session,
            cred,
            deviceId
          );
          completed++;
          if (completed % 25 === 0 || completed === tasks.length) {
            logger.info(`Fetched ${completed}/${tasks.length} wiki details`);
          }
        } catch (error) {
          firstError = error;
        }
      }
    })
  );
  if (firstError) throw firstError;
  if (results.some((response) => !response)) {
    throw new Error('Some wiki details were not fetched');
  }
  return results as SKPortWikiDetailResponse[];
}

async function main() {
  const enabledLocales = CONFIG.locales.filter((locale) => locale.enable);
  const catalogs = new Map<string, SKPortWikiCatalog>();
  for (const localeId of new Set([
    'en',
    ...enabledLocales.map((locale) => locale.id),
  ])) {
    catalogs.set(localeId, await readCatalog(localeId));
  }
  const tasks = buildTasks(catalogs.get('en')!, catalogs);
  if (tasks.length === 0) throw new Error('No wiki detail items in catalog');

  const { cred, session, deviceId } = await getAuthenticatedSkportSession(
    (candidate, signingSession, currentDeviceId) =>
      signedGet<SKPortWikiDetailResponse>(
        detailPath,
        new URLSearchParams({ id: tasks[0].itemId }),
        tasks[0].locale.region,
        signingSession,
        candidate,
        currentDeviceId
      )
  );

  logger.info(
    `Fetching ${tasks.length} wiki details for ${enabledLocales.length} languages (${concurrency} concurrent)`
  );
  const results = await fetchAll(tasks, session, cred, deviceId);

  logger.info(`Saving ${results.length} wiki detail files`);
  for (const [index, task] of tasks.entries()) {
    const outputDir = path.join(detailDir, task.category, task.slug);
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      path.join(outputDir, `${task.locale.id}.json`),
      JSON.stringify(results[index])
    );
  }
  logger.success(
    `Saved ${results.length} wiki detail files to raw/skport/wiki/detail`
  );
}

runScript('SKPort wiki detail fetch', main);
