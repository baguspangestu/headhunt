import { headhuntTypes, HeadhuntTypeId } from '@/data/tracker/headhunt-types';
import bannerCatalog from '@/data/tracker/banners/en.json';
import type { Banners } from '@/types/banner';
import type { Headhunt, Profile, RecordItem } from '@/types/profile';
import { GachaResult } from '@/types/profile';
import { summarizeTrackerRecords } from './tracker-stats';
import {
  advanceGuarantee,
  advancePity,
  getGuaranteeKey,
  supportsRotate,
  usesBannerPity,
  type GuaranteeState,
  type PityState,
} from './tracker-pity';

const typeConfig = new Map(headhuntTypes.map((type) => [type.id, type]));
const banners = bannerCatalog as Banners;

const isRecord = (value: unknown): value is RecordItem => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RecordItem>;

  return (
    typeof record.id === 'number' &&
    Number.isFinite(record.id) &&
    typeof record.typeId === 'string' &&
    Boolean(record.typeId) &&
    typeof record.bannerId === 'string' &&
    Boolean(record.bannerId) &&
    typeof record.itemId === 'string' &&
    Boolean(record.itemId) &&
    typeof record.rarity === 'number' &&
    record.rarity >= 1 &&
    record.rarity <= 6 &&
    typeof record.timestamp === 'number' &&
    Number.isFinite(record.timestamp)
  );
};

const calculateStats = (records: RecordItem[]) => {
  const summary = summarizeTrackerRecords(records);
  const {
    r4Count,
    r5Count,
    r6Count,
    freeCount,
    r5PityTotal,
    r6PityTotal,
    rotateWinCount,
    rateupWinCount,
    guaranteeCount: guarantee,
  } = summary;

  const attempt = r6Count - guarantee;

  return {
    r4Count,
    r5Count,
    r6Count,
    freeCount,
    r5AvgPity: r5Count ? r5PityTotal / r5Count : 0,
    r6AvgPity: r6Count ? r6PityTotal / r6Count : 0,
    rotateWin: attempt > 0 ? rotateWinCount / attempt : 0,
    rateupWin: attempt > 0 ? rateupWinCount / attempt : 0,
    guarantee,
  };
};

const rebuildRecords = (headhunt: Headhunt) => {
  const chronologicalRecords = Object.entries(headhunt.records)
    .flatMap(([typeId, records]) =>
      (records ?? []).filter(isRecord).map((record) => ({ ...record, typeId }))
    )
    .sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);

  const pityStates = new Map<string, PityState>();
  const weaponPoolVersions = new Map<string, number>();
  const guaranteeStates = new Map<string, GuaranteeState>();
  const rebuiltRecords: Record<string, RecordItem[]> = {};

  for (const record of chronologicalRecords) {
    const type = typeConfig.get(record.typeId as HeadhuntTypeId);
    const banner = banners[record.bannerId];
    const isFree = record.isFree === true || record.pity === 0;
    const pityKey = usesBannerPity(record.typeId)
      ? record.bannerId
      : record.typeId;
    // Rerun records saved before poolVersion existed all belong to edition 1.
    const poolVersion =
      record.poolVersion === undefined &&
      (record.typeId === HeadhuntTypeId.RerunChr ||
        record.typeId === HeadhuntTypeId.RerunWpn)
        ? 1
        : record.poolVersion;
    if (record.typeId === HeadhuntTypeId.RerunWpn && poolVersion != null) {
      const previousVersion = weaponPoolVersions.get(record.bannerId);
      if (previousVersion !== undefined && previousVersion !== poolVersion) {
        pityStates.delete(pityKey);
      }
      weaponPoolVersions.set(record.bannerId, poolVersion);
    }
    let pity = 0;
    let result = banner
      ? record.itemId === banner.rateup
        ? GachaResult.Rateup
        : supportsRotate(record.typeId) &&
            banner.rotate?.includes(record.itemId)
          ? GachaResult.Rotate
          : GachaResult.Lose
      : (record.typeId === HeadhuntTypeId.RerunChr ||
            record.typeId === HeadhuntTypeId.Joint) &&
          record.result === GachaResult.Rotate
        ? GachaResult.Lose
        : record.result;

    if (!isFree) {
      const nextPity = advancePity(
        pityStates.get(pityKey) ?? { pity5: 0, pity6: 0 },
        record.rarity
      );
      pity = nextPity.pity;
      pityStates.set(pityKey, nextPity.state);

      const guaranteeKey = getGuaranteeKey(record.typeId, record.bannerId);
      const isRateup = banner
        ? record.itemId === banner.rateup
        : record.result === GachaResult.Rateup ||
          record.result === GachaResult.Guarantee;
      const nextGuarantee = advanceGuarantee(
        guaranteeStates.get(guaranteeKey) ?? {
          pullCount: 0,
          hasRateup: false,
        },
        isRateup,
        type?.guaranteeAt
      );
      if (nextGuarantee.guaranteed) result = GachaResult.Guarantee;
      guaranteeStates.set(guaranteeKey, nextGuarantee.state);
    }

    const rebuiltRecord: RecordItem = {
      id: record.id,
      typeId: record.typeId,
      bannerId: record.bannerId,
      ...(record.seriesName ? { seriesName: record.seriesName } : {}),
      ...(poolVersion !== undefined ? { poolVersion } : {}),
      itemId: record.itemId,
      rarity: record.rarity,
      pity,
      isFree,
      isNew: record.isNew,
      result,
      timestamp: record.timestamp,
    };
    (rebuiltRecords[record.typeId] ??= []).push(rebuiltRecord);
  }

  for (const records of Object.values(rebuiltRecords)) records.reverse();

  return { records: rebuiltRecords, pityStates };
};

export const rebuildHeadhuntForV2 = (headhunt: Headhunt): Headhunt => {
  const { records, pityStates } = rebuildRecords(headhunt);
  const types: Headhunt['types'] = {};

  for (const typeId of Object.keys(records)) {
    const typeRecords = records[typeId] ?? [];
    const pity = pityStates.get(typeId);
    types[typeId] = {
      id: typeId,
      lastRecordId: typeRecords.reduce(
        (latest, record) => Math.max(latest, record.id),
        0
      ),
      ...(!usesBannerPity(typeId)
        ? {
            r5Pity: Math.min(pity?.pity5 ?? 0, pity?.pity6 ?? 0),
            r6Pity: pity?.pity6 ?? 0,
          }
        : {}),
      ...calculateStats(typeRecords),
    };
  }

  const recordsByBanner = new Map<string, RecordItem[]>();
  for (const typeRecords of Object.values(records)) {
    for (const record of typeRecords ?? []) {
      const bannerRecords = recordsByBanner.get(record.bannerId) ?? [];
      bannerRecords.push(record);
      recordsByBanner.set(record.bannerId, bannerRecords);
    }
  }

  const banners: Headhunt['banners'] = {};

  for (const bannerId of recordsByBanner.keys()) {
    const bannerRecords = recordsByBanner.get(bannerId) ?? [];
    const typeId = bannerRecords[0]?.typeId;
    if (!typeId) continue;
    const pity = pityStates.get(bannerId);

    banners[bannerId] = {
      id: bannerId,
      typeId,
      ...(usesBannerPity(typeId)
        ? {
            r5Pity: Math.min(pity?.pity5 ?? 0, pity?.pity6 ?? 0),
            r6Pity: pity?.pity6 ?? 0,
          }
        : {}),
      ...calculateStats(bannerRecords),
    };
  }

  return { ...headhunt, types, banners, records };
};

export const migrateProfilesToV2 = (
  profiles: Record<string, Profile>
): Record<string, Profile> =>
  Object.fromEntries(
    Object.entries(profiles).map(([id, profile]) => [
      id,
      profile.stores?.headhunt
        ? {
            ...profile,
            id,
            stores: {
              ...profile.stores,
              headhunt: rebuildHeadhuntForV2(profile.stores.headhunt),
            },
          }
        : { ...profile, id },
    ])
  );

/** Reclassify weapon reruns imported by v2's unfiltered weapon endpoint. */
const prepareV3Backfill = (
  headhunt: Headhunt,
  backfillEvents: boolean
): Headhunt => {
  const types = { ...headhunt.types };
  for (const [typeId, events] of Object.entries(headhunt.events ?? {})) {
    const type = types[typeId];
    if (!type || !events?.length) continue;
    types[typeId] = {
      ...type,
      lastRecordId: Math.max(
        type.lastRecordId,
        ...events.map((event) => event.id)
      ),
    };
  }
  return {
    ...headhunt,
    types,
    eventsBackfillPending: backfillEvents
      ? true
      : headhunt.eventsBackfillPending,
  };
};

export const rebuildHeadhuntForV3 = (
  headhunt: Headhunt,
  backfillEvents = true
): Headhunt => {
  const records = { ...headhunt.records };
  const regularWeapons = records[HeadhuntTypeId.Weponbox] ?? [];
  const rerunWeapons = records[HeadhuntTypeId.RerunWpn] ?? [];
  const misplacedReruns = regularWeapons.filter((record) =>
    record.bannerId.startsWith('rerun_wpn_')
  );
  const rerunCharacters = records[HeadhuntTypeId.RerunChr] ?? [];
  if (
    !misplacedReruns.length &&
    !rerunWeapons.length &&
    !rerunCharacters.length
  ) {
    return prepareV3Backfill(headhunt, backfillEvents);
  }

  records[HeadhuntTypeId.Weponbox] = regularWeapons.filter(
    (record) => !record.bannerId.startsWith('rerun_wpn_')
  );
  records[HeadhuntTypeId.RerunWpn] = [
    ...new Map(
      [...rerunWeapons, ...misplacedReruns].map((record) => [
        record.id,
        {
          ...record,
          typeId: HeadhuntTypeId.RerunWpn,
        },
      ])
    ).values(),
  ];

  const recalculated = rebuildHeadhuntForV2({ ...headhunt, records });
  const types = { ...headhunt.types };
  const banners = { ...headhunt.banners };
  const affectedTypes = [HeadhuntTypeId.RerunChr, HeadhuntTypeId.RerunWpn];
  if (misplacedReruns.length) affectedTypes.push(HeadhuntTypeId.Weponbox);
  for (const typeId of affectedTypes) {
    const recalculatedType = recalculated.types[typeId];
    if (recalculatedType) types[typeId] = recalculatedType;
    else if (!headhunt.events?.[typeId]?.length) delete types[typeId];
  }
  for (const record of [
    ...rerunCharacters,
    ...rerunWeapons,
    ...misplacedReruns,
  ]) {
    if (!affectedTypes.includes(record.typeId as HeadhuntTypeId)) continue;
    delete banners[record.bannerId];
  }
  for (const [bannerId, banner] of Object.entries(recalculated.banners)) {
    if (banner && affectedTypes.includes(banner.typeId as HeadhuntTypeId)) {
      banners[bannerId] = banner;
    }
  }

  return prepareV3Backfill(
    {
      ...headhunt,
      types,
      banners,
      records: {
        ...headhunt.records,
        ...(misplacedReruns.length
          ? {
              [HeadhuntTypeId.Weponbox]:
                recalculated.records[HeadhuntTypeId.Weponbox],
            }
          : {}),
        [HeadhuntTypeId.RerunWpn]:
          recalculated.records[HeadhuntTypeId.RerunWpn],
        [HeadhuntTypeId.RerunChr]:
          recalculated.records[HeadhuntTypeId.RerunChr],
      },
    },
    backfillEvents
  );
};

export const migrateProfilesToV3 = (
  profiles: Record<string, Profile>,
  backfillEvents = true
): Record<string, Profile> =>
  Object.fromEntries(
    Object.entries(profiles).map(([id, profile]) => [
      id,
      profile.stores?.headhunt
        ? {
            ...profile,
            id,
            stores: {
              ...profile.stores,
              headhunt: rebuildHeadhuntForV3(
                profile.stores.headhunt,
                backfillEvents
              ),
            },
          }
        : { ...profile, id },
    ])
  );
