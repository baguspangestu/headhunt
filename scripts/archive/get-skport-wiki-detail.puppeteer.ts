import fs from 'fs/promises';
import { CONFIG } from '@/config';
import type { Browser, HTTPResponse } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { SKPortWikiCatalog } from '../types/skport-wiki-catalog';
import type { SKPortWikiDetailResponse } from '../types/skport-wiki-detail';
import { logger, runScript } from '../lib/logger';
import { browserConfig } from '../config/browser';

const dir = process.cwd();

const paths = {
  rawCatalog: path.join(dir, 'raw/skport/wiki/catalog'),
} as const;

const pageUrl = 'https://wiki.skport.com/endfield/detail';

const subIds: Record<string, string> = {
  '1': 'operators',
  '2': 'weapons',
  '4': 'gear',
};

async function readJsonFiles<T>(dir: string): Promise<Record<string, T>> {
  const files = await fs.readdir(dir);
  const data: Record<string, T> = {};

  for (const file of files) {
    const content = await fs.readFile(path.join(dir, file), 'utf-8');
    data[file] = JSON.parse(content);
  }

  return data;
}

async function saveJson(dir: string, locale: string, data: unknown) {
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${locale}.json`);
  await writeFile(filePath, JSON.stringify(data), 'utf-8');
}

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSlugMap(
  json: SKPortWikiCatalog
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};

  const subData = json.data.catalog.find((e) => e.id === '1')?.typeSub;

  const items = Object.entries(subIds).flatMap(
    ([subId]) =>
      subData
        ?.find((e) => e.id === subId)
        ?.items.map((item) => ({
          subId,
          itemId: item.itemId,
          itemName: item.name,
        })) ?? []
  );

  for (const item of items) {
    if (!result[item.subId]) result[item.subId] = {};
    result[item.subId][item.itemId] = generateSlug(item.itemName);
  }

  return result;
}

async function fetchItem(
  browser: Browser,
  item: { subId: string; path: string; itemId: string },
  localeId: string,
  region: string
): Promise<SKPortWikiDetailResponse | null> {
  for (let attempt = 1; attempt <= Infinity; attempt++) {
    const page = await browser.newPage();

    try {
      let found = false;

      const data: SKPortWikiDetailResponse | null = await new Promise(
        async (resolve) => {
          const timeout = setTimeout(() => {
            if (!found) resolve(null);
          }, 8000);

          page.on('response', async (response: HTTPResponse) => {
            const url = response.url();

            if (!url.includes(`/web/v1/wiki/item/info?id=${item.itemId}`))
              return;

            try {
              const json = (await response.json()) as SKPortWikiDetailResponse;

              if (json.code !== 0) return;

              found = true;
              clearTimeout(timeout);
              resolve(json);
            } catch {
              resolve(null);
            }
          });

          await page.evaluateOnNewDocument((region: string) => {
            localStorage.setItem(
              'SK_THEME_INFO',
              JSON.stringify({
                region,
                lang: 'en',
                device: 'desktop',
                color: 'dark',
                nativeColor: 'dark',
              })
            );
          }, region);

          await page.goto(
            `${pageUrl}?mainTypeId=1&subTypeId=${item.subId}&gameEntryId=${item.itemId}`,
            { waitUntil: 'domcontentloaded' }
          );
        }
      );

      await page.close();

      if (data) return data;

      logger.warn(`[${localeId}] Retrying ${item.path} (attempt ${attempt})`);

      await new Promise((r) => setTimeout(r, 1000));
    } catch {
      await page.close();
    }
  }

  return null;
}

async function main() {
  const browser = await puppeteer.launch({
    ...browserConfig,
    headless: true,
  });

  const catalogMap = await readJsonFiles<SKPortWikiCatalog>(paths.rawCatalog);

  const slugMap = buildSlugMap(catalogMap['en.json']);

  const localesMap = Object.fromEntries(
    CONFIG.locales.filter((e) => e.enable).map((e) => [e.id, e])
  );

  for (const [file, json] of Object.entries(catalogMap)) {
    const subData = json.data.catalog.find((e) => e.id === '1')?.typeSub;

    const items = Object.entries(subIds).flatMap(
      ([subId, path]) =>
        subData
          ?.find((e) => e.id === subId)
          ?.items.map((item) => ({
            subId,
            path,
            itemId: item.itemId,
          })) ?? []
    );

    const localeId = file.split('.')[0];
    if (!localesMap[localeId]) continue;

    const total = items.length;
    let current = 0;

    logger.info(`[${localeId}] ${total} items found`);

    for (const item of items) {
      logger.info(`[${localeId}] ${++current}/${total} loading`);

      const res = await fetchItem(
        browser,
        item,
        localeId,
        localesMap[localeId].region
      );

      if (!res) {
        logger.error(`[${localeId}] Failed to load ${item.path}`);
        continue;
      }

      const rawDir = path.join(
        dir,
        'raw/skport/wiki/detail/',
        item.path,
        slugMap[item.subId][item.itemId]
      );

      await saveJson(rawDir, localeId, res);

      logger.success(
        `[${localeId}] Saved ${item.path}`,
        slugMap[item.subId][item.itemId]
      );
    }
  }

  await browser.close();
}

runScript('SKPort wiki detail fetch', main);
