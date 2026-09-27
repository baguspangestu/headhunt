import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from '@/config';
import {
  getAuthenticatedSkportSession,
  signedGet,
  type SkportSession,
} from './lib/skport-api';
import { logger, runScript } from './lib/logger';
import type { SKPortWikiCatalog } from './types/skport-wiki-catalog';

const catalogPath = '/web/v1/wiki/item/catalog';
const outputDir = path.join(process.cwd(), 'raw', 'skport', 'wiki', 'catalog');

async function fetchCatalog(
  region: string,
  session: SkportSession,
  cred: string,
  deviceId: string
): Promise<SKPortWikiCatalog> {
  const response = await signedGet<SKPortWikiCatalog>(
    catalogPath,
    new URLSearchParams({ typeMainId: '1' }),
    region,
    session,
    cred,
    deviceId
  );
  if (!Array.isArray(response.data?.catalog)) {
    throw new Error('SKPort returned an invalid wiki catalog');
  }
  return response;
}

async function main() {
  const { cred, session, deviceId } = await getAuthenticatedSkportSession(
    (candidate, signingSession, currentDeviceId) =>
      fetchCatalog('en', signingSession, candidate, currentDeviceId)
  );

  const results: { locale: string; data: SKPortWikiCatalog }[] = [];
  logger.info(`Fetching wiki catalogs for ${CONFIG.locales.length} languages`);
  for (let index = 0; index < CONFIG.locales.length; index += 4) {
    const batch = CONFIG.locales.slice(index, index + 4);
    const fetched = await Promise.all(
      batch.map(async (locale) => {
        try {
          return {
            locale: locale.id,
            data: await fetchCatalog(locale.region, session, cred, deviceId),
          };
        } catch (error) {
          throw new Error(`Failed to fetch wiki catalog [${locale.id}]`, {
            cause: error,
          });
        }
      })
    );
    results.push(...fetched);
    logger.info(`Fetched ${results.length}/${CONFIG.locales.length} catalogs`);
  }

  await mkdir(outputDir, { recursive: true });
  for (const { locale, data } of results) {
    await writeFile(
      path.join(outputDir, `${locale}.json`),
      JSON.stringify(data)
    );
  }
  logger.success(
    `Saved ${results.length} wiki catalogs to raw/skport/wiki/catalog`
  );
}

runScript('SKPort wiki catalog fetch', main);
