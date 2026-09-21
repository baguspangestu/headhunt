import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
const supportedModes = new Set(['deploy', 'preview', 'upload']);

if (!supportedModes.has(mode)) {
  console.error('Usage: node cloudflare-build.mjs <deploy|preview|upload>');
  process.exit(1);
}

const cliPath = fileURLToPath(
  new URL(
    './node_modules/@opennextjs/cloudflare/dist/cli/index.js',
    import.meta.url
  )
);
const result = spawnSync(process.execPath, [cliPath, 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HEADHUNT_BUILD_MODE: mode,
    NEXT_PUBLIC_CLOUDFLARE_IMAGE_TRANSFORMATIONS: String(mode !== 'preview'),
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
