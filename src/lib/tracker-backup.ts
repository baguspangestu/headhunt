import { z } from 'zod';
import { migrateProfilesToV2, migrateProfilesToV3 } from './tracker-migration';
import type { Profile } from '@/types/profile';

const legacyNumber = z.number().nonnegative().catch(0);
const legacyInteger = z.number().int().nonnegative().catch(0);
const sequenceNumber = z.number().nonnegative();

const detailSchema = z.object({
  r4Count: legacyNumber,
  r5Count: legacyNumber,
  r6Count: legacyNumber,
  freeCount: legacyNumber,
  r5AvgPity: legacyNumber,
  r6AvgPity: legacyNumber,
  rateupWin: legacyNumber,
  rotateWin: legacyNumber,
  guarantee: legacyNumber,
});

const typeSchema = detailSchema.extend({
  id: z.string().min(1),
  lastRecordId: sequenceNumber.catch(0),
  r5Pity: legacyInteger.optional(),
  r6Pity: legacyInteger.optional(),
});

const bannerSchema = detailSchema.extend({
  id: z.string().min(1),
  typeId: z.string().min(1),
  r5Pity: legacyInteger.optional(),
  r6Pity: legacyInteger.optional(),
});

const recordSchema = z.object({
  id: sequenceNumber,
  typeId: z.string().min(1),
  bannerId: z.string().min(1),
  seriesName: z.string().min(1).optional(),
  poolVersion: z.number().nullable().optional(),
  itemId: z.string().min(1),
  rarity: z.number().int().min(1).max(6),
  pity: legacyInteger,
  isFree: z.boolean().optional(),
  isNew: z.boolean().catch(false),
  result: z
    .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
    .catch(0),
  timestamp: legacyInteger,
});

const recordListSchema = z.array(z.unknown()).transform((records) =>
  records.flatMap((record) => {
    const result = recordSchema.safeParse(record);
    return result.success ? [result.data] : [];
  })
);

const eventSchema = z.object({
  id: sequenceNumber,
  typeId: z.string().min(1),
  bannerId: z.string().min(1),
  kind: z.string().min(1),
  timestamp: legacyInteger,
  raw: z
    .object({
      kind: z.string(),
      poolId: z.string(),
      poolName: z.string(),
      poolVersion: z.number().nullable(),
      nameText: z.string().nullable(),
      gachaTs: z.string(),
      seqId: z.string(),
    })
    .passthrough(),
});

const eventListSchema = z.array(z.unknown()).transform((events) =>
  events.flatMap((event) => {
    const result = eventSchema.safeParse(event);
    return result.success ? [result.data] : [];
  })
);

const profileSchema = z.object({
  id: z.string().catch(''),
  name: z.string().optional(),
  stores: z
    .object({
      headhunt: z
        .object({
          url: z.string().catch(''),
          types: z.record(z.string(), typeSchema.optional()).catch({}),
          banners: z.record(z.string(), bannerSchema.optional()).catch({}),
          records: z.record(z.string(), recordListSchema.optional()).catch({}),
          events: z.record(z.string(), eventListSchema.optional()).optional(),
          eventsBackfillPending: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
});

const backupSchema = z.object({
  app: z.literal('headhunt.cc'),
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  includesImportUrls: z.boolean().optional(),
  exportedAt: z.iso.datetime(),
  currentProfileId: z.string().catch(''),
  profiles: z
    .record(z.string(), profileSchema)
    .refine((profiles) => Object.keys(profiles).length > 0),
});

export type TrackerBackup = z.infer<typeof backupSchema>;

export const createTrackerBackup = (
  profiles: Record<string, Profile>,
  currentProfileId: string,
  options: { includeImportUrls?: boolean } = {}
): TrackerBackup => ({
  app: 'headhunt.cc',
  version: 3,
  includesImportUrls: options.includeImportUrls ?? true,
  exportedAt: new Date().toISOString(),
  currentProfileId,
  profiles:
    (options.includeImportUrls ?? true)
      ? profiles
      : Object.fromEntries(
          Object.entries(profiles).map(([id, profile]) => [
            id,
            profile.stores?.headhunt
              ? {
                  ...profile,
                  stores: {
                    ...profile.stores,
                    headhunt: { ...profile.stores.headhunt, url: '' },
                  },
                }
              : profile,
          ])
        ),
});

const withoutImportUrls = (
  profiles: TrackerBackup['profiles']
): TrackerBackup['profiles'] =>
  Object.fromEntries(
    Object.entries(profiles).map(([id, profile]) => [
      id,
      profile.stores?.headhunt
        ? {
            ...profile,
            stores: {
              ...profile.stores,
              headhunt: { ...profile.stores.headhunt, url: '' },
            },
          }
        : profile,
    ])
  );

export const calculateTrackerBackupHash = async (
  backup: TrackerBackup,
  options: { includeImportUrls?: boolean } = {}
) => {
  const includeImportUrls =
    options.includeImportUrls ?? backup.includesImportUrls !== false;
  const canonicalContent = JSON.stringify({
    version: backup.version,
    currentProfileId: backup.currentProfileId,
    profiles: includeImportUrls
      ? backup.profiles
      : withoutImportUrls(backup.profiles),
  });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalContent)
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
};

export const isTrackerBackupEqualToProfiles = async (
  backup: TrackerBackup,
  profiles: Record<string, Profile>,
  currentProfileId: string
) => {
  // Parse the in-memory data through the same schema as an imported backup so
  // defaults and object shapes cannot produce a false difference.
  const localBackup = parseTrackerBackup(
    createTrackerBackup(profiles, currentProfileId)
  );
  // Restore replaces the full profile, including its URL. A URL-free backup
  // must not be considered identical to a browser profile with a saved URL.
  const [backupHash, localHash] = await Promise.all([
    calculateTrackerBackupHash(backup, { includeImportUrls: true }),
    calculateTrackerBackupHash(localBackup, { includeImportUrls: true }),
  ]);

  return backupHash === localHash;
};

export const parseTrackerBackup = (value: unknown): TrackerBackup => {
  const backup = backupSchema.parse(value);
  const normalizedProfiles = Object.fromEntries(
    Object.entries(backup.profiles).map(([id, profile]) => [
      id,
      { ...profile, id },
    ])
  );
  const profiles =
    backup.version === 3
      ? migrateProfilesToV3(normalizedProfiles, false)
      : migrateProfilesToV3(
          backup.version === 1
            ? migrateProfilesToV2(normalizedProfiles)
            : normalizedProfiles
        );
  const currentProfileId = profiles[backup.currentProfileId]
    ? backup.currentProfileId
    : Object.keys(profiles)[0];

  return { ...backup, version: 3, profiles, currentProfileId };
};
