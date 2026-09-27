import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from '@/config';
import { logger, runScript } from './lib/logger';
import {
  getAuthenticatedSkportSession,
  signedGet,
  type SkportApiResponse,
  type SkportSession,
} from './lib/skport-api';

const endpoints = {
  enums: { path: '/web/v1/game/endfield/enums', dataKey: 'rarities' },
  operators: { path: '/web/v1/game/endfield/search-chars', dataKey: 'chars' },
  weapons: { path: '/web/v1/game/endfield/search-weapons', dataKey: 'weapons' },
  gear: { path: '/web/v1/game/endfield/search-equipments', dataKey: 'equips' },
} as const;

type ApiResponse = SkportApiResponse<Record<string, unknown>>;

async function fetchGuideData(
  type: keyof typeof endpoints,
  locale: (typeof CONFIG.locales)[number],
  session: SkportSession,
  cred: string,
  deviceId: string
) {
  const endpoint = endpoints[type];
  const response = await signedGet<ApiResponse>(
    endpoint.path,
    new URLSearchParams(),
    locale.region,
    session,
    cred,
    deviceId
  );
  if (!Array.isArray(response.data?.[endpoint.dataKey])) {
    throw new Error(`Invalid ${type} data for ${locale.id}`);
  }
  return response;
}

async function saveJson(type: string, locale: string, data: ApiResponse) {
  const outputDir = path.join(process.cwd(), 'raw', 'skport', 'guide', type);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${locale}.json`), JSON.stringify(data));
}

async function main() {
  const { cred, session, deviceId } = await getAuthenticatedSkportSession(
    (candidate, signingSession, currentDeviceId) =>
      fetchGuideData(
        'enums',
        CONFIG.locales[0],
        signingSession,
        candidate,
        currentDeviceId
      )
  );
  const results: {
    type: keyof typeof endpoints;
    locale: string;
    data: ApiResponse;
  }[] = [];

  logger.info(
    `Fetching guide data for ${CONFIG.locales.length} languages (${Object.keys(endpoints).length} endpoints each)`
  );
  for (const [index, locale] of CONFIG.locales.entries()) {
    const batch = await Promise.all(
      (Object.keys(endpoints) as (keyof typeof endpoints)[]).map(
        async (type) => {
          try {
            return {
              type,
              locale: locale.id,
              data: await fetchGuideData(type, locale, session, cred, deviceId),
            };
          } catch (error) {
            throw new Error(`Failed to fetch ${type} for ${locale.id}`, {
              cause: error,
            });
          }
        }
      )
    );
    results.push(...batch);
    logger.info(
      `Fetched [${index + 1}/${CONFIG.locales.length}] ${locale.name} (${batch.length} endpoints)`
    );
  }

  logger.success(`Fetched ${results.length} API responses`);
  logger.info(`Saving ${results.length} JSON files`);
  for (const { type, locale, data } of results) {
    await saveJson(type, locale, data);
  }
  logger.success(`Saved ${results.length} JSON files to raw/skport/guide`);
}

runScript('SKPort guide data fetch', main);
