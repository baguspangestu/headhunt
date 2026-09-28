'use client';

import { create } from 'zustand';
import { useStorageStore } from './useStorageStore';
import { HeadhuntTypeId, headhuntTypes } from '@/data/tracker/headhunt-types';
import type { ImportEventItem, ImportRecordItem } from '@/types/import';
import banners from '@/data/tracker/banners/en.json';
import type { Banners } from '@/types/banner';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { delay } from '@/lib/delay';
import {
  fetchTrackerType,
  TrackerImportError,
} from '@/lib/tracker-import-fetch';
import {
  mergeImportedHeadhunt,
  processImportedHeadhunt,
  type ImportBannerMetadata,
} from '@/lib/tracker-import-processing';

type ImportProcessType = 'import' | 'sync';

type ImportState = {
  processType: ImportProcessType;
  isImporting: boolean;
  totalRecord: number;
  errorType: 'unknown' | 'expired' | 'network' | null;

  importRecords: (
    url: string,
    processType?: ImportProcessType,
    profileId?: string,
    saveImportUrl?: boolean
  ) => Promise<boolean>;
};

export const useImportStore = create<ImportState>((set, get) => ({
  processType: 'import',
  isImporting: false,
  totalRecord: 0,
  errorType: null,

  importRecords: async (
    url,
    processType = 'import',
    profileId,
    saveImportUrl = false
  ) => {
    if (get().isImporting) return false;

    const { profiles, currentProfileId, setProfile } =
      useStorageStore.getState();

    const targetProfileId = profileId ?? currentProfileId;
    const profile = profiles[targetProfileId];
    if (!profile) return false;

    const headhuntBanners: ImportBannerMetadata = Object.fromEntries(
      Object.entries(banners as Banners).map(([key, value]) => [
        key,
        {
          id: value.id,
          rateup: value.rateup,
          rotate: value.rotate,
        },
      ])
    );

    const parsedUrl = new URL(url);

    let isError = false;
    set({ processType, isImporting: true, totalRecord: 0, errorType: null });

    try {
      const oldHeadhunt = profile.stores?.headhunt;

      // Sync keeps its URL. Manual import only persists it when requested.
      let savedUrl = processType === 'sync' || saveImportUrl ? url : '';

      const newRawRecords = new Map<string, ImportRecordItem[]>();
      const newRawEvents = new Map<string, ImportEventItem[]>();
      const recordsEndpoint = `/api/v3/tracker/${processType}`;

      for (const type of headhuntTypes) {
        if (isError) break;

        const lastRecordId = oldHeadhunt?.types[type.id]?.lastRecordId ?? 0;
        const existingEventIds = new Set(
          (oldHeadhunt?.events?.[type.id] ?? []).map((event) => event.id)
        );
        const backfillEvents = oldHeadhunt?.eventsBackfillPending === true;

        try {
          const fetched = await fetchTrackerType({
            endpoint: recordsEndpoint,
            typeId: type.id,
            url: parsedUrl,
            lastRecordId,
            existingEventIds,
            backfillEvents,
            onRecords: (count) =>
              set((state) => ({ totalRecord: state.totalRecord + count })),
            onServerId: (resolvedUrl) => {
              if (processType === 'sync' || saveImportUrl) {
                savedUrl = resolvedUrl;
              }
            },
          });
          newRawRecords.set(type.id, fetched.records);
          newRawEvents.set(type.id, fetched.events);
        } catch (error) {
          // Keep the error notification visible before ending the import.
          await delay(300);
          isError = true;
          set({
            errorType:
              error instanceof TrackerImportError
                ? error.type
                : error instanceof TypeError
                  ? 'network'
                  : 'unknown',
          });
        }
      }

      if (isError) {
        return false;
      }

      //* Check & Get Temporary Missing Banners
      const missingBannerIds = new Set<string>();

      for (const type of headhuntTypes) {
        if (
          type.id === HeadhuntTypeId.Beginner ||
          type.id === HeadhuntTypeId.Standard
        ) {
          continue;
        }

        const records = newRawRecords.get(type.id);
        if (!records?.length) continue;

        for (const { bannerId } of records) {
          if (!headhuntBanners[bannerId]) {
            missingBannerIds.add(bannerId);
          }
        }
      }

      if (missingBannerIds.size) {
        try {
          const response = await fetchWithRetry('/api/v1/tracker/banner', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ids: [...missingBannerIds],
            }),
          });

          if (!response.ok) {
            // Kasih delay minimal 300ms biar notif muncul
            await delay(300);
            isError = true;
            set({
              errorType: response.status === 401 ? 'expired' : 'unknown',
            });
          }

          if (response.ok) {
            const json = (await response.json()) as {
              data: ImportBannerMetadata;
            };

            for (const [id, banner] of Object.entries(json.data)) {
              headhuntBanners[id] = banner;
            }
          }
        } catch (err: unknown) {
          // Kasih delay minimal 300ms biar notif muncul
          await delay(300);
          isError = true;
          set({
            errorType: err instanceof TypeError ? 'network' : 'unknown',
          });
        }
      }

      if (isError) {
        return false;
      }

      const processedHeadhunt = processImportedHeadhunt(
        oldHeadhunt,
        newRawRecords,
        newRawEvents,
        headhuntBanners,
        savedUrl
      );

      setProfile(
        {
          ...profile,
          stores: {
            ...(profile?.stores ?? {}),
            headhunt: mergeImportedHeadhunt(oldHeadhunt, processedHeadhunt),
          },
        },
        { makeActive: false }
      );

      return true;
    } catch {
      await delay(300);
      set({ errorType: 'unknown' });
      return false;
    } finally {
      set({ isImporting: false });
    }
  },
}));
