import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from '@/config';
import { TRACKER_CONFIG } from '@/config/tracker';
import type { GamePool } from '../src/types/api/game-pool';
import { bannerPoolConfig } from './config/banner-pools';
import { ensureDirs } from './lib/ensure-dirs';
import { logger, runScript } from './lib/logger';

const outputRoot = path.join(process.cwd(), 'raw', 'game', 'pool');

type PoolResult =
  | { localeId: string; status: 'existing' | 'unavailable' }
  | { localeId: string; status: 'fetched'; data: GamePool };

async function getContent(
  lang: string,
  poolId: string
): Promise<GamePool | null> {
  const params = new URLSearchParams({
    lang,
    pool_id: poolId,
    server_id: '2',
  });
  const response = await fetch(
    `${TRACKER_CONFIG.api.baseUrl}/api/content?${params}`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (!response.ok) {
    throw new Error(`Pool ${poolId} [${lang}]: HTTP ${response.status}`);
  }

  const data = (await response.json()) as GamePool;
  if (data.code === 40402) return null;
  if (data.code !== 0) {
    throw new Error(
      `Pool ${poolId} [${lang}]: API code ${data.code} (${data.msg ?? 'Unknown error'})`
    );
  }
  return data;
}

async function fetchLocale(
  poolId: string,
  outputDir: string,
  locale: (typeof CONFIG.locales)[number]
): Promise<PoolResult> {
  const filePath = path.join(outputDir, `${locale.id}.json`);
  try {
    await fs.access(filePath);
    return { localeId: locale.id, status: 'existing' };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Cannot check ${filePath}`, { cause: error });
    }
  }

  try {
    const data = await getContent(locale.value, poolId);
    return data
      ? { localeId: locale.id, status: 'fetched', data }
      : { localeId: locale.id, status: 'unavailable' };
  } catch (error) {
    throw new Error(`Failed to fetch pool ${poolId} [${locale.id}]`, {
      cause: error,
    });
  }
}

async function main() {
  await ensureDirs(outputRoot);
  logger.info(
    `Checking ${bannerPoolConfig.pools.length} pools across ${CONFIG.locales.length} languages`
  );

  let saved = 0;
  let existing = 0;
  let unavailable = 0;

  for (const pool of bannerPoolConfig.pools) {
    const outputDir = path.join(outputRoot, pool.id);
    const results = await Promise.all(
      CONFIG.locales.map((locale) => fetchLocale(pool.id, outputDir, locale))
    );
    const fetched = results.filter(
      (result): result is Extract<PoolResult, { status: 'fetched' }> =>
        result.status === 'fetched'
    );
    const missing = results
      .filter((result) => result.status === 'unavailable')
      .map((result) => result.localeId);
    const skipped = results.length - fetched.length - missing.length;

    if (fetched.length > 0) {
      await fs.mkdir(outputDir, { recursive: true });
      await Promise.all(
        fetched.map((result) =>
          fs.writeFile(
            path.join(outputDir, `${result.localeId}.json`),
            JSON.stringify(result.data)
          )
        )
      );
    }

    saved += fetched.length;
    existing += skipped;
    unavailable += missing.length;
    const summary = `Pool ${pool.id}: ${fetched.length} saved, ${skipped} existing, ${missing.length} unavailable`;
    if (missing.length > 0) {
      logger.warn(`${summary} (${missing.join(', ')})`);
    } else if (fetched.length > 0) {
      logger.success(summary);
    } else {
      logger.info(summary);
    }
  }

  logger.success(
    `Game pool results: ${saved} saved, ${existing} existing, ${unavailable} unavailable`
  );
}

runScript('Game pool data fetch', main);
