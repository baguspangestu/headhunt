import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  getGoogleReturnTo,
  GOOGLE_TOKEN_COOKIE,
  GOOGLE_RETURN_COOKIE,
} from '../src/lib/google-oauth';
import { GET as callback } from '../src/app/api/auth/google/callback/route';
import { GET as sessionRoute } from '../src/app/api/auth/google/session/route';
import {
  deleteAllGoogleDriveBackups,
  listGoogleDriveBackups,
} from '../src/lib/google-drive-backup';
import {
  createTrackerBackup,
  calculateTrackerBackupHash,
  isTrackerBackupEqualToProfiles,
  parseTrackerBackup,
} from '../src/lib/tracker-backup';
import { extractImportCredential } from '../src/lib/validators/import-url';
import { useStorageStore } from '../src/store/useStorageStore';

async function main() {
  const origin = 'https://headhunt.cc';
  const importOrigin =
    'https://ef-webview.gryphline.com/api/record/char?lang=en-us&pool_type=E_CharacterGachaPoolType_Special&';

  for (const [query, expected] of [
    ['token=current&server_id=2', { token: 'current', server: '2' }],
    ['u8_token=legacy&server=3', { token: 'legacy', server: '3' }],
    ['token=mixed&server=2', { token: 'mixed', server: '2' }],
    [
      'u8_token=mixed-legacy&server_id=3',
      { token: 'mixed-legacy', server: '3' },
    ],
  ] as const) {
    assert.deepEqual(
      extractImportCredential(`${importOrigin}${query}`),
      expected
    );
  }
  assert.deepEqual(
    extractImportCredential(
      'https://ef-webview.gryphline.com/page/gacha_char?token=legacy-url&server_id=2'
    ),
    { token: 'legacy-url', server: '2' }
  );
  assert.equal(
    extractImportCredential('https://example.com/?token=x&server_id=2'),
    null
  );

  for (const value of [
    '/\\example.com',
    '//example.com',
    'https://example.com',
    '/\t/example.com',
  ]) {
    assert.equal(getGoogleReturnTo(value, origin), '/');
    const response = await callback(
      new NextRequest(`${origin}/api/auth/google/callback`, {
        headers: {
          cookie: `${GOOGLE_RETURN_COOKIE}=${encodeURIComponent(value)}`,
        },
      })
    );
    assert.equal(response.headers.get('location'), `${origin}/`);
  }
  for (const value of ['/id/tracker?tab=history#records', '/.//example.com']) {
    const normalized = getGoogleReturnTo(value, origin);
    assert.equal(new URL(normalized, origin).origin, origin);
    assert.equal(getGoogleReturnTo(normalized, origin), normalized);
  }

  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const originalSecret = process.env.GOOGLE_CLIENT_SECRET;
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
  try {
    const backup = parseTrackerBackup({
      app: 'headhunt.cc',
      version: 2,
      exportedAt: new Date().toISOString(),
      currentProfileId: 'abc',
      profiles: {
        abc: { id: 'abc', name: 'Original', stores: {} },
        '9007199254740992': { id: '9007199254740992', stores: {} },
      },
    });
    const profileWithUrl = {
      id: 'with-url',
      stores: {
        // Intentionally use a different key order than the backup schema.
        headhunt: { records: {}, banners: {}, types: {}, url: 'secret' },
      },
    };
    const privateBackup = createTrackerBackup(
      { 'with-url': profileWithUrl },
      'with-url',
      { includeImportUrls: false }
    );
    assert.equal(privateBackup.profiles['with-url'].stores?.headhunt?.url, '');
    assert.equal(privateBackup.includesImportUrls, false);
    assert.equal(profileWithUrl.stores.headhunt.url, 'secret');
    const backupWithUrl = createTrackerBackup(
      { 'with-url': profileWithUrl },
      'with-url'
    );
    assert.equal(backupWithUrl.includesImportUrls, true);
    assert.equal(
      await calculateTrackerBackupHash(
        parseTrackerBackup(JSON.parse(JSON.stringify(privateBackup)))
      ),
      await calculateTrackerBackupHash(parseTrackerBackup(backupWithUrl), {
        includeImportUrls: false,
      })
    );
    assert.equal(profileWithUrl.stores.headhunt.url, 'secret');
    assert.equal(
      await isTrackerBackupEqualToProfiles(
        parseTrackerBackup(JSON.parse(JSON.stringify(backupWithUrl))),
        { 'with-url': profileWithUrl },
        'with-url'
      ),
      true
    );
    assert.equal(
      await isTrackerBackupEqualToProfiles(
        parseTrackerBackup(JSON.parse(JSON.stringify(privateBackup))),
        { 'with-url': profileWithUrl },
        'with-url'
      ),
      false
    );
    assert.equal(
      await isTrackerBackupEqualToProfiles(
        parseTrackerBackup(JSON.parse(JSON.stringify(privateBackup))),
        privateBackup.profiles,
        'with-url'
      ),
      true
    );

    useStorageStore
      .getState()
      .restoreProfiles(backupWithUrl.profiles, backupWithUrl.currentProfileId);
    useStorageStore
      .getState()
      .restoreProfiles(privateBackup.profiles, privateBackup.currentProfileId);
    assert.equal(
      useStorageStore.getState().profiles['with-url'].stores?.headhunt?.url,
      ''
    );

    useStorageStore
      .getState()
      .restoreProfiles(backup.profiles, backup.currentProfileId);
    useStorageStore.getState().setProfile({ name: 'First', stores: {} });
    const profiles = useStorageStore.getState().profiles;
    assert.equal(Object.keys(profiles).length, 3);
    assert.equal(profiles.abc.name, 'Original');
    assert.equal(profiles['1'].name, 'First');
    useStorageStore.getState().setProfile({ name: 'Fourth', stores: {} });
    assert.equal(Object.keys(useStorageStore.getState().profiles).length, 3);

    const deleted: string[] = [];
    const pages: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === 'DELETE') {
        deleted.push(url.pathname.split('/').at(-1)!);
        return new Response(null, { status: 204 });
      }
      assert.ok(url.searchParams.get('fields')?.includes('nextPageToken'));
      const page = url.searchParams.get('pageToken') ?? '';
      pages.push(page);
      return Response.json(
        page === ''
          ? {
              files: Array.from({ length: 100 }, (_, id) => ({
                id: String(id),
                size: '10',
              })),
              nextPageToken: 'empty',
            }
          : page === 'empty'
            ? { nextPageToken: 'last' }
            : {
                files: [
                  {
                    id: '100',
                    size: '20',
                    appProperties: { contentHash: 'hash' },
                  },
                ],
              }
      );
    };
    const session = { accessToken: 'test', expiresAt: 0 };
    const files = await listGoogleDriveBackups(session);
    assert.equal(files.length, 101);
    assert.equal(files[100].contentHash, 'hash');
    assert.equal(files[100].size, 20);
    assert.deepEqual(pages, ['', 'empty', 'last']);
    await deleteAllGoogleDriveBackups(session);
    assert.equal(new Set(deleted).size, 101);

    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID =
      'test-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-only';
    for (const [status, error] of [
      [429, 'rate_limit_exceeded'],
      [500, 'server_error'],
      [400, 'invalid_client'],
      [400, 'invalid_grant'],
    ] as const) {
      globalThis.fetch = async () => Response.json({ error }, { status });
      const response = await sessionRoute(
        new NextRequest(`${origin}/api/auth/google/session`, {
          headers: { cookie: `${GOOGLE_TOKEN_COOKIE}=test-token` },
        })
      );
      const revoked = error === 'invalid_grant';
      assert.equal(response.status, revoked ? 200 : 503);
      assert.equal(response.cookies.has(GOOGLE_TOKEN_COOKIE), revoked);
    }
    globalThis.fetch = async (input) =>
      Response.json(
        String(input).includes('/token')
          ? { access_token: 'access', expires_in: 3600 }
          : { email: 'test@example.com' }
      );
    const response = await sessionRoute(
      new NextRequest(`${origin}/api/auth/google/session`, {
        headers: { cookie: `${GOOGLE_TOKEN_COOKIE}=test-token` },
      })
    );
    const body = (await response.json()) as { connected: boolean };
    assert.equal(body.connected, true);
    assert.equal(response.cookies.has(GOOGLE_TOKEN_COOKIE), false);
    console.log('All audit regression checks passed.');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalClientId === undefined)
      Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_GOOGLE_CLIENT_ID');
    else process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = originalClientId;
    if (originalSecret === undefined)
      Reflect.deleteProperty(process.env, 'GOOGLE_CLIENT_SECRET');
    else process.env.GOOGLE_CLIENT_SECRET = originalSecret;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
