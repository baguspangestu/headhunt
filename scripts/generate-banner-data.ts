import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import type {
  GamePoolOperator,
  GamePoolWeapon,
} from '../src/types/api/game-pool';
import { writeJsonFiles } from './lib/write-json-files';
import { bannerPoolConfig } from './config/banner-pools';
import type { Banner } from '@/types/banner';
import { downloadImage, resizeImage, saveAsPng } from './lib/image';
import { logger, runScript } from './lib/logger';

const dir = process.cwd();

const paths = {
  rawPools: path.join(dir, 'raw/game/pool'),
  generatedBanners: path.join(dir, 'src/data/tracker/banners'),
  assets: path.join(dir, 'public/assets'),
};
async function ensureDirs(...dirs: string[]) {
  await Promise.all(dirs.map((d) => fs.mkdir(d, { recursive: true })));
}

type PoolData = GamePoolOperator | GamePoolWeapon;

interface IPoolResult {
  poolId: string;
  files: Record<string, PoolData>;
}

export async function readAllPools(): Promise<IPoolResult[]> {
  const poolDirs = await fs.readdir(paths.rawPools, { withFileTypes: true });

  // ambil hanya folder
  const folders = poolDirs.filter((d) => d.isDirectory());

  const results = await Promise.all(
    folders.map(async (folder) => {
      const poolId = folder.name;
      const folderPath = path.join(paths.rawPools, poolId);

      const files = await fs.readdir(folderPath, { withFileTypes: true });

      const jsonFiles = files.filter(
        (f) => f.isFile() && f.name.endsWith('.json')
      );

      const fileEntries = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(folderPath, file.name);
          const content = await fs.readFile(filePath, 'utf-8');

          try {
            const parsed: PoolData = JSON.parse(content);
            return [file.name, parsed] as const;
          } catch {
            logger.warn(`Failed to parse ${file.name}`);
            return null;
          }
        })
      );

      // filter null + jadi object
      const validEntries = Object.fromEntries(
        fileEntries.filter(
          (entry): entry is readonly [string, PoolData] => entry !== null
        )
      );

      return {
        poolId,
        files: validEntries,
      };
    })
  );

  return results;
}

async function cropImage({
  buffer,
  isRight = false,
}: {
  isRight: boolean;
  buffer: Buffer;
}): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const width = metadata.width;
  const height = metadata.height;

  // Crop rasio 3.2:1
  const targetWidth = Math.floor(height * 3.2);
  const cropWidth = Math.min(targetWidth, width);

  const cropped = image.extract({
    left: isRight ? width - cropWidth : 0,
    top: 0,
    width: cropWidth,
    height: height,
  });

  return cropped.toBuffer();
}

type BannerAsset = {
  imageUrl: string;
  cropFromRight: boolean;
};

async function bannerImages(
  assets: Map<string, BannerAsset>,
  outputDir: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  await Promise.all(
    Array.from(assets).map(async ([id, asset]) => {
      const buffer = await downloadImage(asset.imageUrl);
      const croppedBuffer = await cropImage({
        buffer,
        isRight: asset.cropFromRight,
      });
      const resizedBuffer = await resizeImage({
        buffer: croppedBuffer,
        width: 256,
      });
      const banner = await saveAsPng({
        buffer: resizedBuffer,
        outputDir,
      });

      map.set(id, banner);
    })
  );

  return map;
}

function getTimestampSecond(iso: string) {
  return Math.floor(Date.parse(iso) / 1000);
}
type PoolId = (typeof bannerPoolConfig.pools)[number]['id'];

async function main() {
  await ensureDirs(paths.generatedBanners, paths.assets);

  const results = await readAllPools();

  const orderMap = new Map(
    bannerPoolConfig.pools.map((pool, index) => [pool.id, index])
  );
  const sortedResults = results.sort((a, b) => {
    const indexA = orderMap.get(a.poolId as PoolId) ?? Infinity;
    const indexB = orderMap.get(b.poolId as PoolId) ?? Infinity;
    return indexA - indexB;
  });

  const assets = new Map<string, BannerAsset>();

  for (const result of sortedResults) {
    Object.values(result.files).forEach((json) => {
      const configPool = bannerPoolConfig.pools.find(
        (pool) => pool.id === result.poolId
      );
      const image =
        configPool && 'img' in configPool
          ? configPool.img
          : json.data.pool.up6_image;
      if (image) {
        assets.set(result.poolId, {
          imageUrl: image,
          cropFromRight:
            json.data.pool.pool_gacha_type === 'weapon' ||
            result.poolId.startsWith('joint'),
        });
      }
    });
  }

  logger.info(`Found ${assets.size} unique assets`);

  const assetsMap = await bannerImages(assets, paths.assets);

  const bannerMap: Record<string, Record<string, Banner>> = {};

  for (const result of sortedResults) {
    for (const [fileName, json] of Object.entries(result.files)) {
      const locale = fileName;

      const data = json.data.pool;
      const pool = bannerPoolConfig.pools.find(
        (pool) => pool.id === result.poolId
      );
      const isOperator = data.pool_gacha_type === 'char';

      let rotate: string[] = [];
      let featured: string[] = [];

      if (isOperator) {
        const pool = (json as GamePoolOperator).data.pool;
        if (pool.pool_type === 'special') {
          rotate = pool.rotate_list
            .map((e) => pool.all.find((f) => f.name === e.name)?.id)
            .filter((id): id is string => Boolean(id));
        }
        if (pool.pool_type === 'extra') {
          featured = pool.all.filter((e) => e.rarity === 6).map((e) => e.id);
        }
      }

      if (!bannerMap[locale]) bannerMap[locale] = {};

      bannerMap[locale][result.poolId] = {
        id: result.poolId,
        name: data.pool_name,
        image: assetsMap.get(result.poolId) || '',
        rateup: data.all.find((e) => e.name === data.up6_name)!.id,
        ...(rotate.length ? { rotate } : {}),
        ...(featured.length ? { featured } : {}),
        ...(pool && 'startAt' in pool
          ? { startTime: getTimestampSecond(pool.startAt) }
          : {}),
        ...(pool && 'endAt' in pool
          ? { endTime: getTimestampSecond(pool.endAt) }
          : {}),
      };
    }
  }

  await writeJsonFiles(bannerMap, paths.generatedBanners);
}

runScript('Banner data generation', main);
