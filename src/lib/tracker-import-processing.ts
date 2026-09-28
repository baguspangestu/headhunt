import { HeadhuntTypeId, headhuntTypes } from '@/data/tracker/headhunt-types';
import { GachaResult, type Headhunt, type RecordItem } from '@/types/profile';
import type { ImportEventItem, ImportRecordItem } from '@/types/import';
import { mergeTrackerStats } from '@/lib/tracker-stats';
import {
  advanceGuarantee,
  advancePity,
  getGuaranteeKey,
  supportsRotate,
  usesBannerPity,
  type GuaranteeState,
  type PityState,
} from '@/lib/tracker-pity';

export type ImportBannerMetadata = Record<
  string,
  { id: string; rateup: string; rotate?: string[] }
>;

/** Transform fetched history without changing the existing profile or fetch results. */
export function processImportedHeadhunt(
  oldHeadhunt: Headhunt | undefined,
  rawRecords: Map<string, ImportRecordItem[]>,
  rawEvents: Map<string, ImportEventItem[]>,
  bannerMetadata: ImportBannerMetadata,
  url: string
): Headhunt {
  const newHeadhunt: Headhunt = {
    url,
    types: {},
    banners: {},
    records: {},
    events: {},
    eventsBackfillPending: false,
  };

  for (const type of headhuntTypes) {
    const events = rawEvents.get(type.id) ?? [];
    if (events.length > 0) {
      newHeadhunt.events![type.id] = events.map((event) => ({
        ...event,
        typeId: type.id,
      }));
    }

    const records = rawRecords.get(type.id);
    if (!records?.length) {
      // Event-only pages advance the cursor without affecting pity or stats.
      if (events.length > 0) {
        const oldType = oldHeadhunt?.types[type.id];
        newHeadhunt.types[type.id] = {
          id: type.id,
          lastRecordId: Math.max(
            oldType?.lastRecordId ?? 0,
            ...events.map((event) => event.id)
          ),
          r5Pity: oldType?.r5Pity,
          r6Pity: oldType?.r6Pity,
          r4Count: oldType?.r4Count ?? 0,
          r5Count: oldType?.r5Count ?? 0,
          r6Count: oldType?.r6Count ?? 0,
          freeCount: oldType?.freeCount ?? 0,
          r5AvgPity: oldType?.r5AvgPity ?? 0,
          r6AvgPity: oldType?.r6AvgPity ?? 0,
          rateupWin: oldType?.rateupWin ?? 0,
          rotateWin: oldType?.rotateWin ?? 0,
          guarantee: oldType?.guarantee ?? 0,
        };
      }
      continue;
    }

    const hasBannerPity = usesBannerPity(type.id);
    const oldType = oldHeadhunt?.types[type.id];
    const pityMap = new Map<string, PityState>();
    const weaponPoolVersions = new Map<string, number>();
    const resetWeaponPity = new Set<string>();
    if (type.id === HeadhuntTypeId.RerunWpn) {
      for (const oldRecord of oldHeadhunt?.records[type.id] ?? []) {
        const oldVersion =
          oldRecord.poolVersion === undefined ? 1 : oldRecord.poolVersion;
        if (oldVersion != null && !weaponPoolVersions.has(oldRecord.bannerId)) {
          weaponPoolVersions.set(oldRecord.bannerId, oldVersion);
        }
      }
    }

    const rateupState = new Map<string, GuaranteeState>();
    const oldRerunRateupState = new Map<string, GuaranteeState>();
    if (
      type.id === HeadhuntTypeId.RerunChr ||
      type.id === HeadhuntTypeId.RerunWpn
    ) {
      for (const oldRecord of oldHeadhunt?.records[type.id] ?? []) {
        if (oldRecord.isFree === true || oldRecord.pity === 0) continue;
        const key = getGuaranteeKey(type.id, oldRecord.bannerId);
        const state = oldRerunRateupState.get(key) ?? {
          pullCount: 0,
          hasRateup: false,
        };
        state.pullCount++;
        state.hasRateup ||=
          oldRecord.result === GachaResult.Rateup ||
          oldRecord.result === GachaResult.Guarantee;
        oldRerunRateupState.set(key, state);
      }
    }

    let lastRecordId = Math.max(0, ...events.map((event) => event.id));
    const processedRecords: RecordItem[] = [];

    for (let i = records.length - 1; i >= 0; i--) {
      const record = records[i];
      lastRecordId = Math.max(lastRecordId, record.id);
      const banner = bannerMetadata[record.bannerId];
      const oldBanner = oldHeadhunt?.banners[record.bannerId];
      let pity = 0;
      let result: GachaResult =
        record.itemId === banner?.rateup
          ? GachaResult.Rateup
          : supportsRotate(type.id) && banner?.rotate?.includes(record.itemId)
            ? GachaResult.Rotate
            : GachaResult.Lose;

      const pityKey = hasBannerPity ? record.bannerId : type.id;
      if (type.id === HeadhuntTypeId.RerunWpn && record.poolVersion != null) {
        const previousVersion = weaponPoolVersions.get(record.bannerId);
        if (
          previousVersion !== undefined &&
          previousVersion !== record.poolVersion
        ) {
          pityMap.delete(pityKey);
          resetWeaponPity.add(pityKey);
        }
        weaponPoolVersions.set(record.bannerId, record.poolVersion);
      }
      const previousPity = resetWeaponPity.has(pityKey)
        ? undefined
        : hasBannerPity
          ? oldBanner
          : oldHeadhunt?.types[type.id];
      if (!record.isFree) {
        const nextPity = advancePity(
          pityMap.get(pityKey) ?? {
            pity5: previousPity?.r5Pity ?? 0,
            pity6: previousPity?.r6Pity ?? 0,
          },
          record.rarity
        );
        pity = nextPity.pity;
        pityMap.set(pityKey, nextPity.state);

        const {
          r4Count = 0,
          r5Count = 0,
          r6Count = 0,
          freeCount = 0,
        } = oldBanner ?? {};
        const count = r4Count + r5Count + r6Count - freeCount;
        const guaranteeKey = getGuaranteeKey(type.id, record.bannerId);
        const previousGuarantee = rateupState.get(guaranteeKey) ??
          oldRerunRateupState.get(guaranteeKey) ?? {
            pullCount: count,
            hasRateup: Boolean(oldBanner?.rateupWin),
          };
        const nextGuarantee = advanceGuarantee(
          previousGuarantee,
          record.itemId === banner?.rateup,
          type.guaranteeAt
        );
        if (nextGuarantee.guaranteed) result = GachaResult.Guarantee;
        rateupState.set(guaranteeKey, nextGuarantee.state);
      }

      processedRecords.push({
        id: record.id,
        typeId: type.id,
        bannerId: record.bannerId,
        ...(record.seriesName ? { seriesName: record.seriesName } : {}),
        ...(record.poolVersion !== undefined
          ? { poolVersion: record.poolVersion }
          : {}),
        itemId: record.itemId,
        rarity: record.rarity,
        pity,
        isFree: record.isFree,
        isNew: record.isNew,
        result,
        timestamp: record.timestamp,
      });
    }
    newHeadhunt.records[type.id] = processedRecords.reverse();

    const recordsByBanner = new Map<string, RecordItem[]>();
    for (const record of processedRecords) {
      const group = recordsByBanner.get(record.bannerId) ?? [];
      group.push(record);
      recordsByBanner.set(record.bannerId, group);
    }
    for (const [id, bannerRecords] of recordsByBanner) {
      const pity = pityMap.get(id);
      const stats = mergeTrackerStats(bannerRecords, oldHeadhunt?.banners[id]);
      newHeadhunt.banners[id] = {
        id,
        typeId: type.id,
        ...(hasBannerPity
          ? {
              r5Pity: Math.min(pity?.pity5 ?? 0, pity?.pity6 ?? 0),
              r6Pity: pity?.pity6 ?? 0,
            }
          : {}),
        r4Count: stats.r4Count,
        r5Count: stats.r5Count,
        r6Count: stats.r6Count,
        freeCount: stats.freeCount,
        r5AvgPity: stats.r5AvgPity,
        r6AvgPity: stats.r6AvgPity,
        rotateWin: stats.rotateWin,
        rateupWin: stats.rateupWin,
        guarantee: stats.guarantee,
      };
    }

    const pity = pityMap.get(type.id);
    const stats = mergeTrackerStats(processedRecords, oldType);
    newHeadhunt.types[type.id] = {
      id: type.id,
      lastRecordId,
      ...(!hasBannerPity
        ? {
            r5Pity: Math.min(pity?.pity5 ?? 0, pity?.pity6 ?? 0),
            r6Pity: pity?.pity6 ?? 0,
          }
        : {}),
      r4Count: stats.r4Count,
      r5Count: stats.r5Count,
      r6Count: stats.r6Count,
      freeCount: stats.freeCount,
      r5AvgPity: stats.r5AvgPity,
      r6AvgPity: stats.r6AvgPity,
      rotateWin: stats.rotateWin,
      rateupWin: stats.rateupWin,
      guarantee: stats.guarantee,
    };
  }

  return newHeadhunt;
}

/** Combine one completed import with the existing profile without mutating either. */
export function mergeImportedHeadhunt(
  oldHeadhunt: Headhunt | undefined,
  newHeadhunt: Headhunt
): Headhunt {
  const oldRecords = oldHeadhunt?.records ?? {};
  const mergedRecords: Headhunt['records'] = { ...oldRecords };

  for (const typeId in newHeadhunt.records) {
    const oldList = (oldRecords[typeId] ?? []).map((record) =>
      (typeId === HeadhuntTypeId.RerunChr ||
        typeId === HeadhuntTypeId.RerunWpn) &&
      record.poolVersion === undefined
        ? { ...record, poolVersion: 1 }
        : record
    );
    const newList = newHeadhunt.records[typeId] ?? [];

    mergedRecords[typeId] = [...newList, ...oldList];
  }

  const mergedEvents = { ...(oldHeadhunt?.events ?? {}) };
  for (const typeId in newHeadhunt.events ?? {}) {
    mergedEvents[typeId] = [
      ...(newHeadhunt.events?.[typeId] ?? []),
      ...(oldHeadhunt?.events?.[typeId] ?? []),
    ];
  }

  return {
    url: newHeadhunt.url,
    types: { ...(oldHeadhunt?.types ?? {}), ...newHeadhunt.types },
    banners: { ...(oldHeadhunt?.banners ?? {}), ...newHeadhunt.banners },
    records: mergedRecords,
    events: mergedEvents,
    eventsBackfillPending: false,
  };
}
