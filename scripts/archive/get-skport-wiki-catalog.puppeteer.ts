import { CONFIG } from '@/config';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { SKPortWikiCatalog } from '../types/skport-wiki-catalog';
import { logger, runScript } from '../lib/logger';
import { browserConfig } from '../config/browser';

const pageUrl = 'https://wiki.skport.com/endfield';
const endpoints: Record<string, string> = {
  'catalog?typeMainId=1': 'catalog',
};

const dir = process.cwd();

async function saveJson(type: string, locale: string, data: unknown) {
  const rawSkportWikiDir = path.join(dir, 'raw/skport/wiki/', type);
  await mkdir(rawSkportWikiDir, { recursive: true });
  const filePath = path.join(rawSkportWikiDir, `${locale}.json`);
  await writeFile(filePath, JSON.stringify(data), 'utf-8');
}

async function main() {
  const browser = await puppeteer.launch({
    ...browserConfig,
    headless: true,
  });

  for (const locale of CONFIG.locales) {
    logger.info(`Loading ${locale.name}`);
    const page = await browser.newPage();

    const pending = new Set(Object.keys(endpoints));
    let done = false;

    page.on('response', async (response) => {
      const url = response.url();

      const matched = [...pending].find((e) => url.includes(e));
      if (!matched) return;

      try {
        const text = await response.text();
        const res = JSON.parse(text) as SKPortWikiCatalog;

        const type = endpoints[matched];

        await saveJson(type, locale.id, res);
        logger.success(`Saved [${locale.id}] (${type})`);

        pending.delete(matched);

        if (pending.size === 0 && !done) {
          done = true;
          await page.close();
        }
      } catch {}
    });

    await page.evaluateOnNewDocument((region) => {
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
    }, locale.region);

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

    await new Promise((r) => setTimeout(r, 5000));
    if (!page.isClosed()) await page.close();
  }

  await browser.close();
}

runScript('SKPort wiki catalog fetch', main);
