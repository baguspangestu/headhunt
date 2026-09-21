import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { execFileSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const buildId = (() => {
  if (process.env.NODE_ENV === 'development') return 'development';
  if (process.env.HEADHUNT_BUILD_MODE === 'preview') return 'preview';

  const commitSha = process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA;
  if (commitSha) return commitSha.slice(0, 7);

  try {
    const hasLocalChanges = Boolean(
      execFileSync('git', ['status', '--porcelain'], {
        encoding: 'utf8',
      }).trim()
    );
    if (hasLocalChanges) return 'local';

    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return process.env.npm_package_version ?? 'development';
  }
})();

const cloudflareImageTransformations =
  process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_TRANSFORMATIONS ?? 'false';

const localNetworkOrigins = Object.values(networkInterfaces())
  .flatMap((network) => network ?? [])
  .filter(({ address, family, internal }) =>
    Boolean(address && family === 'IPv4' && !internal)
  )
  .map(({ address }) => address);

const nextConfig: NextConfig = {
  allowedDevOrigins: localNetworkOrigins,
  htmlLimitedBots: /.*/,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_CLOUDFLARE_IMAGE_TRANSFORMATIONS:
      cloudflareImageTransformations,
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
