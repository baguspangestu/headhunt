# Headhunt.cc

[![CI](https://github.com/baguspangestu/headhunt/actions/workflows/ci.yml/badge.svg)](https://github.com/baguspangestu/headhunt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Headhunt tracker and game-data catalog built with Next.js and deployed to
Cloudflare through OpenNext. The production site is available at
[headhunt.cc](https://headhunt.cc).

## Requirements

- Node.js 22 or newer
- npm
- A `.dev.vars` file based on `.dev.vars.example` for Cloudflare bindings

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm run check
npm run build
```

## Data scripts

Raw upstream responses live under `raw/`. Scripts in `scripts/` transform them
into the locale-specific JSON consumed from `src/data/`.

Common commands:

```bash
npm run generate:content
npm run generate:gear
npm run generate:banner
npm run get:pool
npm run get:guide
```

## Project structure

```text
public/            Static images and public response headers
raw/               Raw upstream game data used by generation scripts
scripts/           Data fetching and generation tools
src/app/           Next.js routes with route-private `_components` folders
src/components/    Global components grouped into `ui`, `layout`, and `shared`
src/config/        Runtime application configuration
src/data/          Generated locale-specific application data
src/hooks/         Shared React hooks
src/i18n/          Locale routing and request configuration
src/lib/           Framework-independent runtime utilities
src/store/         Client-side Zustand stores
src/types/         Application and external API type definitions
```

Route-specific components stay beside their route inside `_components`. Only
components reused across routes belong in `src/components/`:

```text
src/components/
├── layout/         Site shell, navigation, header, sidebar, and footer
├── shared/         Reusable application-aware components
└── ui/             Generic presentational controls
```

`get-record-url.ps1` intentionally remains in the repository root because the
published tracker UI downloads it through its stable GitHub raw URL.

Tracker-specific endpoints, import sources, supported server IDs, and backup
limits are centralized in `src/config/tracker.ts`. Keep environment-independent
product configuration there instead of duplicating literals across components,
API routes, or scripts.

Puppeteer scripts use the existing local defaults for Chrome. Override them on
another machine with `CHROME_EXECUTABLE_PATH` and `PUPPETEER_USER_DATA_DIR`.

## Image assets

Generated catalog images are stored in `public/assets/` using a SHA-256 content
hash as the filename. Because changing an image also changes its URL, these
files are served with a one-year immutable browser cache through
`public/_headers`.

The `deploy` and `upload` scripts automatically enable Cloudflare image
transformations, so `CloudflareImage` serves catalog images through
`/cdn-cgi/image/format=auto/...` and Cloudflare can select an efficient image
format. Local `build`, `start`, and `dev` scripts serve catalog images directly
from `/assets/...`. Local UI icons in the root of `public/` are served directly
as Workers Static Assets. The project does not use the Next.js Image component
or an Images binding.

## Google Drive backups

Create a Google OAuth 2.0 Web client, add the application's origins to its
authorized JavaScript origins, enable the Google Drive API, and set:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` must be available while Next.js is building the
application. For Cloudflare Workers Builds, configure it as a build variable in
the Cloudflare dashboard. Each fork should use its own Google OAuth client and
authorized JavaScript origins.

Configure `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` as a Cloudflare build variable as
well. Leave it unset to disable Google Analytics, especially when deploying a
fork with no dedicated Analytics property.

Add these authorized redirect URIs to the Google OAuth web client:

```text
http://localhost:3000/api/auth/google/callback
https://headhunt.cc/api/auth/google/callback
```

Google Drive backups use the restricted `drive.appdata` scope. The refresh token
is kept in a secure HttpOnly cookie and is never exposed to client JavaScript or
included in backup files. Configure `GOOGLE_CLIENT_SECRET` as a Cloudflare secret
in production; never commit the downloaded Google client-secret JSON file.

## Cloudflare preview and deployment

```bash
npm run preview
```

Before the first deployment, create the R2 incremental-cache bucket configured
in `wrangler.jsonc`, or replace its name with your own bucket:

```bash
npx wrangler r2 bucket create headhunt-opennext-cache
```

For a normal local deployment, commit the exact revision first:

```bash
npm run check
git add .
git commit -m "Describe the change"
npm run deploy
```

`npm run deploy` automatically runs `check-deploy.mjs` before building.
For a Git clone or fork, deployment is stopped when the working tree is dirty so
the Build ID always identifies the exact deployed source. A local commit does
not need an upstream branch and does not need to be pushed before deployment.

Downloaded source archives do not contain `.git`; in that case the Git check is
skipped with a warning and deployment is allowed. Clean CI checkouts, including
GitHub Actions and Cloudflare builds, pass the same clean-working-tree check.

The footer displays `development` for `npm run dev`, `preview` for
`npm run preview`, and `local` when a regular local build contains uncommitted
changes. Clean builds display a seven-character Git commit SHA, using
`GITHUB_SHA` or `CF_PAGES_COMMIT_SHA` when available and otherwise the local Git
`HEAD`. Builds from a source archive without Git metadata use the package
version. Only SHA values link directly to a commit; other values link to the
repository. The value is embedded during the build and does not make a runtime
API request.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. Report
suspected vulnerabilities privately as described in [SECURITY.md](SECURITY.md),
not through a public issue.

## License and third-party material

Original project source code is available under the [MIT License](LICENSE).
Game names, artwork, icons, data, and other third-party material remain the
property of their respective owners and are not granted under that license.
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.

Headhunt is an unofficial fan-made project and is not affiliated with or
endorsed by HYPERGRYPH or GRYPHLINE.
