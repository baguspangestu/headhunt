import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { POST as importV3 } from '../src/app/api/v3/tracker/import/route';
import {
  rebuildHeadhuntForV2,
  rebuildHeadhuntForV3,
} from '../src/lib/tracker-migration';
import {
  createTrackerBackup,
  parseTrackerBackup,
} from '../src/lib/tracker-backup';
import { GachaResult } from '../src/types/profile';
import type { Headhunt, Profile, RecordItem } from '../src/types/profile';
import { useImportStore } from '../src/store/useImportStore';
import { useStorageStore } from '../src/store/useStorageStore';
import {
  fetchTrackerType,
  TrackerImportError,
} from '../src/lib/tracker-import-fetch';
import { processImportedHeadhunt } from '../src/lib/tracker-import-processing';

async function main() {
  const makeRecord = (
    id: number,
    typeId: string,
    bannerId: string,
    rarity = 4
  ): RecordItem => ({
    id,
    typeId,
    bannerId,
    itemId: 'wpn_pistol_0003',
    rarity,
    pity: 1,
    isFree: false,
    isNew: false,
    result: GachaResult.Lose,
    timestamp: id,
  });

  const nonDraw = {
    kind: 'gift_intel_book',
    poolId: 'rerun_wpn_first',
    poolName: 'First rerun',
    poolVersion: null,
    nameText: null,
    gachaTs: '2',
    seqId: '2',
    futureField: { amount: 1 },
  };

  const oldHeadhunt: Headhunt = {
    url: '',
    types: {},
    banners: {},
    records: {
      weponbox: [
        {
          ...makeRecord(4, 'weponbox', 'rerun_wpn_second', 6),
          result: GachaResult.Rateup,
        },
        makeRecord(3, 'weponbox', 'weponbox_first'),
        makeRecord(2, 'weponbox', 'rerun_wpn_first'),
        makeRecord(1, 'weponbox', 'rerun_wpn_first'),
      ],
    },
    events: {
      rerun_wpn: [
        {
          id: 5,
          typeId: 'rerun_wpn',
          bannerId: nonDraw.poolId,
          kind: nonDraw.kind,
          timestamp: 2,
          raw: nonDraw,
        },
      ],
    },
  };

  const rawRecords = new Map([
    [
      'rerun_wpn',
      [
        {
          id: 6,
          bannerId: 'rerun_wpn_first',
          poolVersion: 1,
          itemId: 'wpn_pistol_0003',
          rarity: 4,
          isNew: false,
          timestamp: 6,
        },
      ],
    ],
  ]);
  const rawEvents = new Map([
    [
      'rerun_wpn',
      [
        {
          id: 7,
          bannerId: nonDraw.poolId,
          kind: nonDraw.kind,
          timestamp: 7,
          raw: nonDraw,
        },
      ],
    ],
  ]);
  const bannerMetadata = {
    rerun_wpn_first: {
      id: 'rerun_wpn_first',
      rateup: 'wpn_pistol_0010',
    },
  };
  const inputsBeforeProcessing = JSON.stringify({
    records: [...rawRecords],
    events: [...rawEvents],
    bannerMetadata,
  });
  const processed = processImportedHeadhunt(
    undefined,
    rawRecords,
    rawEvents,
    bannerMetadata,
    ''
  );
  assert.equal(processed.records.rerun_wpn?.[0]?.pity, 1);
  assert.equal(processed.types.rerun_wpn?.lastRecordId, 7);
  assert.equal(processed.events?.rerun_wpn?.[0]?.raw, nonDraw);
  assert.equal(
    JSON.stringify({
      records: [...rawRecords],
      events: [...rawEvents],
      bannerMetadata,
    }),
    inputsBeforeProcessing,
    'record processing must not mutate fetched data or banner metadata'
  );
  assert.deepEqual(
    processImportedHeadhunt(
      undefined,
      rawRecords,
      rawEvents,
      bannerMetadata,
      ''
    ),
    processed
  );

  const rotatedItem = 'chr_0035_liino';
  const noRotateImport = processImportedHeadhunt(
    undefined,
    new Map([
      [
        'rerun_chr',
        [
          {
            id: 1,
            bannerId: 'rerun_chr_yvonne',
            itemId: rotatedItem,
            rarity: 6,
            isFree: false,
            isNew: false,
            timestamp: 1,
          },
        ],
      ],
      [
        'special',
        [
          {
            id: 2,
            bannerId: 'special_1_5_1',
            itemId: rotatedItem,
            rarity: 6,
            isFree: false,
            isNew: false,
            timestamp: 2,
          },
        ],
      ],
      [
        'joint',
        [
          {
            id: 3,
            bannerId: 'joint_1_2_2',
            itemId: rotatedItem,
            rarity: 6,
            isFree: false,
            isNew: false,
            timestamp: 3,
          },
        ],
      ],
    ]),
    new Map(),
    {
      rerun_chr_yvonne: {
        id: 'rerun_chr_yvonne',
        rateup: 'chr_0017_yvonne',
        rotate: [rotatedItem],
      },
      special_1_5_1: {
        id: 'special_1_5_1',
        rateup: 'chr_0034_typhoea',
        rotate: [rotatedItem],
      },
      joint_1_2_2: {
        id: 'joint_1_2_2',
        rateup: 'chr_0016_laevat',
        rotate: [rotatedItem],
      },
    },
    ''
  );
  assert.equal(noRotateImport.records.rerun_chr?.[0]?.result, GachaResult.Lose);
  assert.equal(noRotateImport.types.rerun_chr?.rotateWin, 0);
  assert.equal(noRotateImport.records.special?.[0]?.result, GachaResult.Rotate);
  assert.equal(noRotateImport.types.special?.rotateWin, 1);
  assert.equal(noRotateImport.records.joint?.[0]?.result, GachaResult.Lose);
  assert.equal(noRotateImport.types.joint?.rotateWin, 0);

  const legacyRerunWithRotate = rebuildHeadhuntForV3({
    url: '',
    types: {},
    banners: {},
    records: {
      rerun_chr: [
        {
          ...makeRecord(1, 'rerun_chr', 'rerun_chr_unknown', 6),
          itemId: rotatedItem,
          result: GachaResult.Rotate,
        },
      ],
    },
  });
  assert.equal(
    legacyRerunWithRotate.records.rerun_chr?.[0]?.result,
    GachaResult.Lose
  );
  assert.equal(legacyRerunWithRotate.types.rerun_chr?.rotateWin, 0);

  const migrateStorage = useStorageStore.persist.getOptions().migrate;
  assert.ok(migrateStorage);
  const migratedStorage = (await migrateStorage(
    {
      profiles: { '1': { id: '1', stores: { headhunt: oldHeadhunt } } },
      currentProfileId: '1',
    },
    2
  )) as { profiles: Record<string, Profile>; migrationNotice?: boolean };
  assert.equal(
    migratedStorage.profiles['1'].stores?.headhunt?.records.rerun_wpn?.length,
    3,
    'production storage v2 migrates directly to v3'
  );
  assert.equal(migratedStorage.migrationNotice, false);
  for (const version of [3, 4, 5]) {
    const previewStorage = { profiles: migratedStorage.profiles };
    assert.strictEqual(
      await migrateStorage(previewStorage, version),
      previewStorage,
      `existing v3 preview storage ${version} remains readable`
    );
  }

  const migrated = rebuildHeadhuntForV3(oldHeadhunt);
  assert.deepEqual(
    migrated.records.rerun_wpn?.map((record) => [record.id, record.pity]),
    [
      [4, 1],
      [2, 1],
      [1, 1],
    ]
  );
  assert.deepEqual(
    migrated.records.weponbox?.map((record) => [record.id, record.pity]),
    [[3, 1]]
  );
  assert.equal(migrated.types.rerun_wpn?.r4Count, 2);
  assert.equal(migrated.types.rerun_wpn?.r6Count, 1);
  assert.equal(migrated.types.rerun_wpn?.r6AvgPity, 1);
  assert.equal(migrated.records.rerun_wpn?.[0]?.result, GachaResult.Rateup);
  assert.equal(migrated.types.weponbox?.r4Count, 1);
  assert.equal(migrated.types.rerun_wpn?.r6Pity, undefined);
  assert.equal(migrated.banners.rerun_wpn_first?.r6Pity, 2);
  assert.equal(migrated.banners.rerun_wpn_second?.r6Pity, 0);
  assert.equal(migrated.types.weponbox?.r6Pity, undefined);
  assert.deepEqual(migrated.events?.rerun_wpn?.[0]?.raw.futureField, {
    amount: 1,
  });
  assert.equal(migrated.types.rerun_wpn?.lastRecordId, 5);

  const characterRecords = Array.from({ length: 120 }, (_, index) => {
    const id = index + 1;
    return {
      ...makeRecord(
        id,
        'rerun_chr',
        id <= 60 ? 'rerun_chr_yvonne' : 'rerun_chr_yvonne_2',
        id === 80 || id === 120 ? 6 : 4
      ),
      seriesName: 'Resplendent Spectrum',
      itemId: id === 120 ? 'chr_0017_yvonne' : 'chr_other',
      result: id === 120 ? GachaResult.Rateup : GachaResult.Lose,
    };
  });
  const characters = rebuildHeadhuntForV3({
    url: '',
    types: {},
    banners: {},
    records: { rerun_chr: characterRecords },
  });
  assert.equal(
    characters.records.rerun_chr?.find((record) => record.id === 80)?.pity,
    80,
    '6-star character pity carries between RE-Factor banners'
  );
  assert.equal(
    characters.records.rerun_chr?.find((record) => record.id === 120)?.pity,
    40,
    '6-star character pity resets when a 6-star is obtained'
  );
  assert.equal(
    characters.records.rerun_chr?.find((record) => record.id === 120)?.result,
    GachaResult.Rateup,
    'different pool IDs do not share the 120-pull guarantee even when their names match'
  );
  assert.equal(characters.records.rerun_chr?.[0]?.poolVersion, 1);

  const separateSeries = rebuildHeadhuntForV3({
    url: '',
    types: {},
    banners: {},
    records: {
      rerun_chr: [
        ...Array.from({ length: 60 }, (_, index) => ({
          ...makeRecord(index + 1, 'rerun_chr', 'rerun_chr_yvonne'),
          seriesName: 'Resplendent Spectrum',
          poolVersion: 1,
        })),
        ...Array.from({ length: 60 }, (_, index) => ({
          ...makeRecord(index + 61, 'rerun_chr', 'rerun_chr_rossi'),
          seriesName: 'Rossi Series',
          poolVersion: 1,
        })),
        ...Array.from({ length: 60 }, (_, index) => ({
          ...makeRecord(
            index + 121,
            'rerun_chr',
            'rerun_chr_yvonne',
            index === 59 ? 6 : 4
          ),
          seriesName: 'Resplendent Spectrum #2',
          poolVersion: 2,
          itemId: index === 59 ? 'chr_0017_yvonne' : 'chr_other',
          result: index === 59 ? GachaResult.Rateup : GachaResult.Lose,
        })),
      ],
    },
  });
  assert.equal(
    separateSeries.records.rerun_chr?.find((record) => record.id === 180)
      ?.result,
    GachaResult.Guarantee,
    'Yvonne edition 2 inherits only Yvonne edition 1 guarantee progress'
  );

  const weaponRecords = [
    ...Array.from({ length: 30 }, (_, index) => ({
      ...makeRecord(index + 1, 'rerun_wpn', 'rerun_wpn_yvonne'),
      seriesName: 'Tag Artist Issue',
      poolVersion: 1,
    })),
    {
      ...makeRecord(31, 'rerun_wpn', 'rerun_wpn_other', 6),
      seriesName: 'Another Issue',
      poolVersion: 1,
    },
    ...Array.from({ length: 50 }, (_, index) => ({
      ...makeRecord(
        index + 32,
        'rerun_wpn',
        'rerun_wpn_yvonne_2',
        index === 39 || index === 49 ? 6 : 4
      ),
      seriesName: 'Tag Artist Issue',
      poolVersion: 2,
      result: index === 49 ? GachaResult.Rateup : GachaResult.Lose,
    })),
  ];
  const weapons = rebuildHeadhuntForV3({
    url: '',
    types: {},
    banners: {},
    records: { rerun_wpn: weaponRecords },
  });
  assert.equal(
    weapons.records.rerun_wpn?.find((record) => record.id === 31)?.pity,
    1,
    '6-star weapon pity does not carry to another banner'
  );
  assert.equal(
    weapons.records.rerun_wpn?.find((record) => record.id === 32)?.pity,
    1,
    '6-star weapon pity also restarts in the next edition of the same series'
  );
  assert.equal(weapons.banners.rerun_wpn_yvonne?.r6Pity, 30);
  assert.equal(
    weapons.records.rerun_wpn?.find((record) => record.id === 81)?.result,
    GachaResult.Rateup,
    'different weapon pool IDs do not share the 80-result guarantee despite the same name'
  );

  const versionedWeapons = rebuildHeadhuntForV3({
    url: '',
    types: {},
    banners: {},
    records: {
      rerun_wpn: [
        ...Array.from({ length: 79 }, (_, index) => ({
          ...makeRecord(
            index + 1,
            'rerun_wpn',
            'rerun_wpn_yvonne',
            index === 39 ? 6 : 4
          ),
          seriesName: 'Tag Artist Issue',
        })),
        {
          ...makeRecord(80, 'rerun_wpn', 'rerun_wpn_yvonne', 6),
          seriesName: 'Tag Artist Issue #2',
          poolVersion: 2,
          itemId: 'wpn_pistol_0010',
          result: GachaResult.Rateup,
        },
      ],
    },
  });
  assert.equal(versionedWeapons.records.rerun_wpn?.[0]?.pity, 1);
  assert.deepEqual(
    Object.keys(versionedWeapons.banners),
    ['rerun_wpn_yvonne'],
    'both editions with the same pool ID remain one banner'
  );
  assert.equal(
    versionedWeapons.banners.rerun_wpn_yvonne?.r6Pity,
    0,
    'the fourth-issue 6-star pity resets when the pool version changes'
  );
  assert.equal(
    versionedWeapons.records.rerun_wpn?.find((record) => record.id === 79)
      ?.poolVersion,
    1,
    'legacy rerun records without a version are saved as edition 1'
  );
  assert.equal(
    versionedWeapons.records.rerun_wpn?.[0]?.result,
    GachaResult.Guarantee,
    'a new pool version resets 6-star pity but retains the series guarantee'
  );

  const nextWeaponEdition = rebuildHeadhuntForV3({
    url: '',
    types: {},
    banners: {},
    records: {
      rerun_wpn: [
        ...Array.from({ length: 30 }, (_, index) => ({
          ...makeRecord(index + 1, 'rerun_wpn', 'rerun_wpn_yvonne'),
          seriesName: 'Tag Artist Issue',
          poolVersion: 1,
        })),
        {
          ...makeRecord(31, 'rerun_wpn', 'rerun_wpn_yvonne'),
          seriesName: 'Tag Artist Issue',
          poolVersion: 2,
        },
      ],
    },
  });
  assert.equal(nextWeaponEdition.records.rerun_wpn?.[0]?.pity, 1);
  assert.equal(nextWeaponEdition.banners.rerun_wpn_yvonne?.r6Pity, 1);
  assert.equal(nextWeaponEdition.banners.rerun_wpn_yvonne?.r4Count, 31);

  const backup = parseTrackerBackup(
    createTrackerBackup(
      { '1': { id: '1', stores: { headhunt: migrated } } },
      '1'
    )
  );
  assert.equal(backup.version, 3);
  const legacyRerunBackup = createTrackerBackup(
    {
      '1': {
        id: '1',
        stores: {
          headhunt: {
            ...versionedWeapons,
            records: {
              ...versionedWeapons.records,
              rerun_wpn: versionedWeapons.records.rerun_wpn?.map((record) => ({
                ...record,
                poolVersion:
                  record.poolVersion === 1 ? undefined : record.poolVersion,
              })),
            },
          },
        },
      },
    },
    '1'
  );
  const restoredRerun =
    parseTrackerBackup(legacyRerunBackup).profiles['1'].stores?.headhunt;
  assert.equal(
    restoredRerun?.records.rerun_wpn?.find((record) => record.id === 79)
      ?.poolVersion,
    1,
    'v3 backups without poolVersion migrate existing reruns to edition 1'
  );
  assert.equal(restoredRerun?.records.rerun_wpn?.[0]?.pity, 1);
  const repairedV3Backup = parseTrackerBackup(
    createTrackerBackup(
      {
        '1': {
          id: '1',
          stores: {
            headhunt: {
              ...migrated,
              eventsBackfillPending: false,
              types: {
                ...migrated.types,
                rerun_wpn: {
                  ...migrated.types.rerun_wpn!,
                  r6Pity: 10,
                },
              },
            },
          },
        },
      },
      '1'
    )
  );
  assert.equal(
    repairedV3Backup.profiles['1'].stores?.headhunt?.types.rerun_wpn?.r6Pity,
    undefined,
    'already exported v3 backups are recalculated with banner-specific pity'
  );
  assert.equal(
    repairedV3Backup.profiles['1'].stores?.headhunt?.eventsBackfillPending,
    false
  );
  assert.equal(
    parseTrackerBackup(
      createTrackerBackup(
        { '1': { id: '1', stores: { headhunt: weapons } } },
        '1'
      )
    ).profiles['1'].stores?.headhunt?.records.rerun_wpn?.[0]?.seriesName,
    'Tag Artist Issue'
  );
  assert.equal(
    backup.profiles['1'].stores?.headhunt?.events?.rerun_wpn?.length,
    1
  );
  assert.deepEqual(
    backup.profiles['1'].stores?.headhunt?.events?.rerun_wpn?.[0]?.raw
      .futureField,
    { amount: 1 }
  );

  const legacyBackup = {
    ...createTrackerBackup(
      { '1': { id: '1', stores: { headhunt: oldHeadhunt } } },
      '1'
    ),
    version: 2,
  };
  const upgradedBackup = parseTrackerBackup(legacyBackup);
  assert.equal(upgradedBackup.version, 3);
  assert.equal(
    upgradedBackup.profiles['1'].stores?.headhunt?.types.rerun_wpn?.r6AvgPity,
    1
  );
  assert.equal(
    upgradedBackup.profiles['1'].stores?.headhunt?.eventsBackfillPending,
    true
  );

  const gameRecords = [
    {
      kind: 'draw',
      poolId: 'rerun_wpn_first',
      poolName: 'First rerun',
      poolVersion: 1,
      poolType: 'rerun',
      nameText: 'Weapon',
      weaponId: 'wpn_pistol_0003',
      weaponName: 'Weapon',
      weaponType: 'E_WeaponType_Pistol',
      rarity: 4,
      isNew: false,
      gachaTs: '10',
      seqId: '10',
    },
    {
      kind: 'draw',
      poolId: 'weponbox_first',
      poolName: 'Regular weapon',
      poolVersion: null,
      poolType: null,
      nameText: 'Weapon',
      weaponId: 'wpn_pistol_0003',
      weaponName: 'Weapon',
      weaponType: 'E_WeaponType_Pistol',
      rarity: 4,
      isNew: false,
      gachaTs: '9',
      seqId: '9',
    },
    { ...nonDraw, seqId: '8', poolType: 'rerun' },
    { ...nonDraw, seqId: '7', poolId: 'weponbox_first', poolType: null },
    {
      ...nonDraw,
      seqId: '6',
      kind: 'draw',
      poolType: 'rerun',
      weaponId: 'wpn_pistol_0003',
      rarity: 4,
      isNew: false,
    },
  ];

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({
        code: 0,
        data: { list: gameRecords, hasMore: true },
        msg: '',
      });

    for (const [typeId, drawIds, eventIds] of [
      ['rerun_wpn', [10, 6], [8]],
      ['weponbox', [9], [7]],
    ] as const) {
      const response = await importV3(
        new Request('https://headhunt.cc/api/v3/tracker/import', {
          method: 'POST',
          body: JSON.stringify({
            type_id: typeId,
            url: 'https://ef-webview.gryphline.com/api/record/char?token=test&server_id=2',
          }),
        })
      );
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        data: {
          list: {
            id: number;
            seriesName?: string;
            poolVersion?: number | null;
          }[];
          events: { id: number; raw: typeof nonDraw }[];
          nextId: number;
        };
      };
      assert.deepEqual(
        body.data.list.map((record) => record.id),
        drawIds
      );
      if (typeId === 'rerun_wpn') {
        assert.equal(body.data.list[0].seriesName, 'First rerun');
        assert.equal(body.data.list[0].poolVersion, 1);
      }
      assert.deepEqual(
        body.data.events.map((event) => event.id),
        eventIds
      );
      assert.equal(body.data.nextId, 6);
      assert.equal(body.data.events[0].raw.futureField.amount, 1);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  const calls: string[] = [];
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  try {
    useStorageStore
      .getState()
      .restoreProfiles({ '1': { id: '1', stores: {} } }, '1');
    globalThis.fetch = async (input, init) => {
      if (String(input) === '/api/v1/tracker/banner') {
        const { ids } = JSON.parse(String(init?.body)) as { ids: string[] };
        return Response.json({
          data: Object.fromEntries(
            ids.map((id) => [id, { id, rateup: 'wpn_pistol_0003' }])
          ),
        });
      }
      assert.equal(String(input), '/api/v3/tracker/import');
      const payload = JSON.parse(String(init?.body)) as {
        type_id: string;
        last_id?: number;
      };
      calls.push(`${payload.type_id}:${payload.last_id ?? 'first'}`);
      if (payload.type_id === 'rerun_chr') {
        return Response.json({
          data: {
            list: [
              {
                kind: 'draw',
                id: 21,
                bannerId: 'rerun_chr_next',
                itemId: 'chr_0017_yvonne',
                rarity: 6,
                isFree: false,
                isNew: false,
                timestamp: 21,
              },
              {
                kind: 'draw',
                id: 20,
                bannerId: 'rerun_chr_yvonne',
                itemId: 'chr_0017_yvonne',
                rarity: 4,
                isFree: false,
                isNew: false,
                timestamp: 20,
              },
            ],
            events: [],
            hasMore: false,
            nextId: 20,
          },
        });
      }
      if (payload.type_id === 'rerun_wpn' && !payload.last_id) {
        return Response.json({
          data: { list: [], events: [], hasMore: true, nextId: 50 },
        });
      }
      if (payload.type_id === 'rerun_wpn') {
        return Response.json({
          data: {
            list: [
              {
                kind: 'draw',
                id: 40,
                bannerId: 'rerun_wpn_yvonne',
                itemId: 'wpn_pistol_0003',
                rarity: 4,
                isNew: false,
                timestamp: 40,
              },
            ],
            events: [
              {
                id: 39,
                bannerId: 'rerun_wpn_yvonne',
                kind: nonDraw.kind,
                timestamp: 39,
                raw: { ...nonDraw, poolId: 'rerun_wpn_yvonne' },
              },
            ],
            hasMore: false,
            nextId: 39,
          },
        });
      }
      if (payload.type_id === 'weponbox') {
        return Response.json({
          data: {
            list: [
              {
                kind: 'draw',
                id: 38,
                bannerId: 'weponbox_constant_1',
                itemId: 'wpn_pistol_0003',
                rarity: 4,
                isNew: false,
                timestamp: 38,
              },
            ],
            events: [],
            hasMore: false,
            nextId: 38,
          },
        });
      }
      return Response.json({ data: { list: [], events: [], hasMore: false } });
    };

    const imported = await useImportStore
      .getState()
      .importRecords(
        'https://ef-webview.gryphline.com/api/record/char?token=test&server_id=2'
      );
    assert.equal(
      imported,
      true,
      JSON.stringify({ calls, errorType: useImportStore.getState().errorType })
    );
    const saved = useStorageStore.getState().profiles['1'].stores?.headhunt;
    // Full output captured before extracting the record-processing pipeline.
    assert.equal(
      createHash('sha256').update(JSON.stringify(saved)).digest('hex'),
      '50f5bd9a03b3f3ac295be7ed754acf1e5ef15fbb98d23bf5c6956cd6dad6d0f8'
    );
    assert.deepEqual(
      calls.filter((call) => call.startsWith('rerun_wpn:')),
      ['rerun_wpn:first', 'rerun_wpn:50']
    );
    assert.deepEqual(
      saved?.records.rerun_wpn?.map((record) => record.id),
      [40]
    );
    assert.deepEqual(
      saved?.records.weponbox?.map((record) => record.id),
      [38]
    );
    assert.deepEqual(
      saved?.events?.rerun_wpn?.map((event) => event.id),
      [39]
    );
    assert.equal(saved?.types.rerun_chr?.r6AvgPity, 2);
    assert.equal(saved?.types.rerun_wpn?.r6Pity, undefined);
    assert.equal(saved?.banners.rerun_wpn_yvonne?.r6Pity, 1);
    assert.equal(saved?.banners.weponbox_constant_1?.r6Pity, 1);

    const previousWeaponHistory = rebuildHeadhuntForV3({
      url: '',
      types: {},
      banners: {},
      records: {
        rerun_wpn: Array.from({ length: 79 }, (_, index) => ({
          ...makeRecord(
            index + 1,
            'rerun_wpn',
            'rerun_wpn_yvonne',
            index === 39 ? 6 : 4
          ),
          seriesName: 'Tag Artist Issue',
        })),
      },
    });
    useStorageStore
      .getState()
      .restoreProfiles(
        { '1': { id: '1', stores: { headhunt: previousWeaponHistory } } },
        '1'
      );
    globalThis.fetch = async (input, init) => {
      if (String(input) === '/api/v1/tracker/banner') {
        return Response.json({
          data: {
            rerun_wpn_yvonne_2: {
              id: 'rerun_wpn_yvonne_2',
              rateup: 'wpn_pistol_0010',
            },
          },
        });
      }
      assert.equal(String(input), '/api/v3/tracker/import');
      const payload = JSON.parse(String(init?.body)) as { type_id: string };
      if (payload.type_id !== 'rerun_wpn') {
        return Response.json({
          data: { list: [], events: [], hasMore: false },
        });
      }
      return Response.json({
        data: {
          list: [
            {
              kind: 'draw',
              id: 80,
              bannerId: 'rerun_wpn_yvonne_2',
              seriesName: 'Tag Artist Issue',
              itemId: 'wpn_pistol_0010',
              rarity: 6,
              isNew: false,
              timestamp: 80,
            },
          ],
          events: [],
          hasMore: false,
          nextId: 80,
        },
      });
    };
    assert.equal(
      await useImportStore
        .getState()
        .importRecords(
          'https://ef-webview.gryphline.com/api/record/char?token=test&server_id=2'
        ),
      true
    );
    const carried = useStorageStore.getState().profiles['1'].stores?.headhunt;
    assert.equal(
      createHash('sha256').update(JSON.stringify(carried)).digest('hex'),
      'a86abc0c58138963029de1f3729e52c0669561135d8f4c53184a875353fc3ddf'
    );
    assert.equal(carried?.records.rerun_wpn?.[0]?.pity, 1);
    assert.equal(carried?.records.rerun_wpn?.[0]?.result, GachaResult.Rateup);
    assert.equal(carried?.banners.rerun_wpn_yvonne?.r6Pity, 39);
    assert.equal(carried?.banners.rerun_wpn_yvonne_2?.r6Pity, 0);

    const previousVersion = {
      ...previousWeaponHistory,
      records: {
        ...previousWeaponHistory.records,
        rerun_wpn: previousWeaponHistory.records.rerun_wpn?.map((record) => ({
          ...record,
          poolVersion: undefined,
        })),
      },
    };
    useStorageStore
      .getState()
      .restoreProfiles(
        { '1': { id: '1', stores: { headhunt: previousVersion } } },
        '1'
      );
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), '/api/v3/tracker/import');
      const payload = JSON.parse(String(init?.body)) as { type_id: string };
      return Response.json({
        data: {
          list:
            payload.type_id === 'rerun_wpn'
              ? [
                  {
                    kind: 'draw',
                    id: 80,
                    bannerId: 'rerun_wpn_yvonne',
                    seriesName: 'Tag Artist Issue',
                    poolVersion: 2,
                    itemId: 'wpn_pistol_0010',
                    rarity: 6,
                    isNew: false,
                    timestamp: 80,
                  },
                ]
              : [],
          events: [],
          hasMore: false,
          nextId: 80,
        },
      });
    };
    assert.equal(
      await useImportStore
        .getState()
        .importRecords(
          'https://ef-webview.gryphline.com/api/record/char?token=test&server_id=2'
        ),
      true
    );
    const versionChanged =
      useStorageStore.getState().profiles['1'].stores?.headhunt;
    assert.equal(
      createHash('sha256').update(JSON.stringify(versionChanged)).digest('hex'),
      '53a743fc6f303e7a34d349a94dd64504e2d1b3512867f60dfd4e68efdb5db814'
    );
    assert.equal(versionChanged?.records.rerun_wpn?.[0]?.pity, 1);
    assert.equal(versionChanged?.records.rerun_wpn?.[0]?.poolVersion, 2);
    assert.equal(versionChanged?.records.rerun_wpn?.[1]?.poolVersion, 1);
    assert.equal(versionChanged?.banners.rerun_wpn_yvonne?.r6Pity, 0);
    assert.equal(
      versionChanged?.records.rerun_wpn?.[0]?.result,
      GachaResult.Guarantee
    );

    const previousCharacterHistory = rebuildHeadhuntForV3({
      url: '',
      types: {},
      banners: {},
      records: { rerun_chr: characterRecords.slice(0, 119) },
    });
    useStorageStore
      .getState()
      .restoreProfiles(
        { '1': { id: '1', stores: { headhunt: previousCharacterHistory } } },
        '1'
      );
    globalThis.fetch = async (input, init) => {
      if (String(input) === '/api/v1/tracker/banner') {
        return Response.json({
          data: {
            rerun_chr_yvonne_3: {
              id: 'rerun_chr_yvonne_3',
              rateup: 'chr_0017_yvonne',
            },
          },
        });
      }
      assert.equal(String(input), '/api/v3/tracker/import');
      const payload = JSON.parse(String(init?.body)) as { type_id: string };
      return Response.json({
        data: {
          list:
            payload.type_id === 'rerun_chr'
              ? [
                  {
                    kind: 'draw',
                    id: 120,
                    bannerId: 'rerun_chr_yvonne_3',
                    seriesName: 'Resplendent Spectrum',
                    itemId: 'chr_0017_yvonne',
                    rarity: 6,
                    isFree: false,
                    isNew: false,
                    timestamp: 120,
                  },
                ]
              : [],
          events: [],
          hasMore: false,
          nextId: 120,
        },
      });
    };
    assert.equal(
      await useImportStore
        .getState()
        .importRecords(
          'https://ef-webview.gryphline.com/api/record/char?token=test&server_id=2'
        ),
      true
    );
    const characterCarried =
      useStorageStore.getState().profiles['1'].stores?.headhunt;
    assert.equal(characterCarried?.records.rerun_chr?.[0]?.pity, 40);
    assert.equal(
      characterCarried?.records.rerun_chr?.[0]?.result,
      GachaResult.Rateup
    );
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, 'localStorage');
  }

  const backfillStorage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => backfillStorage.get(key) ?? null,
      setItem: (key: string, value: string) => backfillStorage.set(key, value),
      removeItem: (key: string) => backfillStorage.delete(key),
    },
  });
  try {
    const previous = rebuildHeadhuntForV3(
      rebuildHeadhuntForV2({
        url: '',
        types: {},
        banners: {},
        records: { special: [makeRecord(100, 'special', 'special_1_0_1')] },
      })
    );
    useStorageStore
      .getState()
      .restoreProfiles(
        { '1': { id: '1', stores: { headhunt: previous } } },
        '1'
      );
    globalThis.fetch = async (input, init) => {
      if (String(input) === '/api/v1/tracker/banner') {
        const { ids } = JSON.parse(String(init?.body)) as { ids: string[] };
        return Response.json({
          data: Object.fromEntries(
            ids.map((id) => [id, { id, rateup: 'chr_0017_yvonne' }])
          ),
        });
      }
      const payload = JSON.parse(String(init?.body)) as {
        type_id: string;
        last_id?: number;
      };
      if (payload.type_id !== 'special') {
        return Response.json({
          data: { list: [], events: [], hasMore: false },
        });
      }
      return Response.json({
        data: payload.last_id
          ? {
              list: [],
              events: [
                {
                  id: 99,
                  bannerId: 'special_1_0_1',
                  kind: nonDraw.kind,
                  timestamp: 99,
                  raw: { ...nonDraw, poolId: 'special_1_0_1', seqId: '99' },
                },
              ],
              hasMore: false,
              nextId: 99,
            }
          : {
              list: [
                {
                  kind: 'draw',
                  id: 101,
                  bannerId: 'special_1_0_1',
                  itemId: 'chr_0017_yvonne',
                  rarity: 4,
                  isFree: false,
                  isNew: false,
                  timestamp: 101,
                },
              ],
              events: [],
              hasMore: true,
              nextId: 101,
            },
      });
    };
    assert.equal(
      await useImportStore
        .getState()
        .importRecords(
          'https://ef-webview.gryphline.com/api/record/char?token=test&server_id=2'
        ),
      true
    );
    const saved = useStorageStore.getState().profiles['1'].stores?.headhunt;
    assert.deepEqual(
      saved?.records.special?.map((record) => record.id),
      [101, 100]
    );
    assert.deepEqual(
      saved?.events?.special?.map((event) => event.id),
      [99]
    );
    assert.equal(saved?.types.special?.r4Count, 2);
    assert.equal(saved?.eventsBackfillPending, false);
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, 'localStorage');
  }

  const originalFetchForErrors = globalThis.fetch;
  try {
    const fetchOptions = {
      endpoint: '/api/v3/tracker/import',
      typeId: 'rerun_wpn',
      url: new URL(
        'https://ef-webview.gryphline.com/api/record/weapon?token=test&server_id=2'
      ),
      lastRecordId: 0,
      existingEventIds: new Set<number>(),
      backfillEvents: false,
      onRecords: () => {},
      onServerId: () => {},
    };
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(
      fetchTrackerType(fetchOptions),
      (error: unknown) =>
        error instanceof TrackerImportError && error.type === 'expired'
    );

    globalThis.fetch = async () =>
      Response.json({
        data: { list: [], events: [], hasMore: true },
      });
    await assert.rejects(
      fetchTrackerType(fetchOptions),
      (error: unknown) =>
        error instanceof TrackerImportError && error.type === 'unknown'
    );
  } finally {
    globalThis.fetch = originalFetchForErrors;
  }

  const originalFetchForLifecycle = globalThis.fetch;
  const lifecycleStorage = new Map<string, string>();
  let failStorageWrites = false;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => lifecycleStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failStorageWrites) throw new Error('Storage quota exceeded');
        lifecycleStorage.set(key, value);
      },
      removeItem: (key: string) => lifecycleStorage.delete(key),
    },
  });
  try {
    useStorageStore
      .getState()
      .restoreProfiles({ '1': { id: '1', stores: {} } }, '1');

    let releaseFirstPage: ((response: Response) => void) | undefined;
    let requestCount = 0;
    const emptyPage = () =>
      Response.json({ data: { list: [], events: [], hasMore: false } });
    globalThis.fetch = async () => {
      requestCount++;
      if (requestCount === 1) {
        return new Promise<Response>((resolve) => {
          releaseFirstPage = resolve;
        });
      }
      return emptyPage();
    };

    const importUrl =
      'https://ef-webview.gryphline.com/api/record/char?token=test&server_id=2';
    const firstImport = useImportStore.getState().importRecords(importUrl);
    assert.equal(useImportStore.getState().isImporting, true);
    assert.equal(
      await useImportStore.getState().importRecords(importUrl),
      false,
      'a second import must not overwrite the active import'
    );
    assert.equal(requestCount, 1);
    assert.ok(releaseFirstPage);
    releaseFirstPage(emptyPage());
    assert.equal(await firstImport, true);
    assert.equal(useImportStore.getState().isImporting, false);

    globalThis.fetch = async () => emptyPage();
    failStorageWrites = true;
    assert.equal(
      await useImportStore.getState().importRecords(importUrl),
      false
    );
    assert.equal(useImportStore.getState().errorType, 'unknown');
    assert.equal(useImportStore.getState().isImporting, false);
  } finally {
    failStorageWrites = false;
    globalThis.fetch = originalFetchForLifecycle;
    Reflect.deleteProperty(globalThis, 'localStorage');
  }

  console.log('Tracker v3 tests passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
