import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { logger } from './logger';

export const hashBuffer = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

export const downloadImage = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${url}`);
  return Buffer.from(await response.arrayBuffer());
};

export const resizeImage = async ({
  buffer,
  width,
  height,
}: {
  buffer: Buffer<ArrayBufferLike>;
  width?: number;
  height?: number;
}): Promise<Buffer<ArrayBufferLike>> => {
  return await sharp(buffer).resize({ width, height }).toBuffer();
};

export const squareImage = async (
  buffer: Buffer<ArrayBufferLike>
): Promise<Buffer<ArrayBufferLike>> => {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const size = Math.min(metadata.width, metadata.height);
  const cropped = image.extract({
    left: 0,
    top: 0,
    width: size,
    height: size,
  });
  return cropped.toBuffer();
};

export const saveAsPng = async ({
  buffer,
  outputDir,
}: {
  buffer: Buffer<ArrayBufferLike>;
  outputDir: string;
}): Promise<string> => {
  const image = sharp(buffer);
  const pngBuffer = await image.png().toBuffer();
  const hash = hashBuffer(pngBuffer);
  const filename = `${hash}.png`;
  const outputPath = path.join(outputDir, filename);

  try {
    await fs.access(outputPath);
  } catch {
    await fs.writeFile(outputPath, pngBuffer);
    logger.success(`Saved ${filename}`);
  }

  return hash;
};
