'use client';

import LZString from 'lz-string';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { TRACKER_CONFIG } from '@/config/tracker';
import {
  migrateProfilesToV2,
  migrateProfilesToV3,
} from '@/lib/tracker-migration';
import type { Profile } from '@/types/profile';

type StorageState = {
  profiles: Record<string, Profile>;
  currentProfileId: string;
  googleDriveAutoBackup: boolean;
  googleDriveConnected: boolean;
  googleDriveLastBackupSignature: string;
  localDataUpdatedAt: number;
  hasHydrated: boolean;
  migrationNotice: boolean;

  getCurrentProfile: () => Profile | null;
  setProfile: (
    profile: Omit<Profile, 'id'> & { id?: string },
    options?: { makeActive?: boolean }
  ) => void;
  setCurrentProfileId: (id: string) => void;
  removeProfile: (id: string) => void;
  restoreProfiles: (
    profiles: Record<string, Profile>,
    currentProfileId: string
  ) => void;
  setGoogleDriveAutoBackup: (enabled: boolean) => void;
  setGoogleDriveConnected: (connected: boolean) => void;
  setGoogleDriveLastBackupSignature: (signature: string) => void;
  dismissMigrationNotice: () => void;
};

const storage = {
  getItem: (name: string) => {
    const compressed = localStorage.getItem(name);
    if (!compressed) return null;

    return LZString.decompressFromUTF16(compressed);
  },

  setItem: (name: string, value: string) => {
    const compressed = LZString.compressToUTF16(value);
    localStorage.setItem(name, compressed);
  },

  removeItem: (name: string) => {
    localStorage.removeItem(name);
  },
};

export const useStorageStore = create<StorageState>()(
  persist(
    (set, get) => ({
      profiles: {},
      currentProfileId: '',
      googleDriveAutoBackup: false,
      googleDriveConnected: false,
      googleDriveLastBackupSignature: '',
      localDataUpdatedAt: 0,
      hasHydrated: false,
      migrationNotice: false,

      getCurrentProfile: () => {
        const { profiles, currentProfileId } = get();
        return profiles[currentProfileId] || null;
      },

      setProfile: (profile, options) => {
        set((state) => {
          if (
            !profile.id &&
            Object.keys(state.profiles).length >=
              TRACKER_CONFIG.profiles.maxCount
          ) {
            return state;
          }

          let nextId = 1;
          while (Object.hasOwn(state.profiles, String(nextId))) nextId++;
          const id = profile.id || String(nextId);

          return {
            profiles: {
              ...state.profiles,
              [id]: { ...profile, id },
            },
            currentProfileId:
              options?.makeActive === false ? state.currentProfileId : id,
            localDataUpdatedAt: Date.now(),
          };
        });
      },

      setCurrentProfileId: (id) => {
        set({ currentProfileId: id });
      },

      removeProfile: (id) => {
        set((state) => {
          if (Object.keys(state.profiles).length <= 1 || !state.profiles[id]) {
            return state;
          }

          const profiles = Object.fromEntries(
            Object.entries(state.profiles).filter(
              ([profileId]) => profileId !== id
            )
          );
          let newCurrentId = state.currentProfileId;

          // jika profile yang dihapus adalah current, set ke id terkecil yang ada
          if (state.currentProfileId === id) {
            const remainingIds = Object.keys(profiles).sort((a, b) => +a - +b);
            newCurrentId = remainingIds[0] || '';
          }

          return {
            profiles,
            currentProfileId: newCurrentId,
            localDataUpdatedAt: Date.now(),
          };
        });
      },

      restoreProfiles: (profiles, currentProfileId) => {
        const profileIds = Object.keys(profiles);
        const nextCurrentProfileId = profiles[currentProfileId]
          ? currentProfileId
          : (profileIds[0] ?? '');

        set({
          profiles,
          currentProfileId: nextCurrentProfileId,
          localDataUpdatedAt: Date.now(),
        });
      },

      setGoogleDriveAutoBackup: (enabled) => {
        set({ googleDriveAutoBackup: enabled });
      },

      setGoogleDriveConnected: (connected) => {
        set({ googleDriveConnected: connected });
      },

      setGoogleDriveLastBackupSignature: (signature) => {
        set({ googleDriveLastBackupSignature: signature });
      },

      dismissMigrationNotice: () => {
        set({ migrationNotice: false });
      },
    }),
    {
      name: 'storage',
      version: 3,
      storage: createJSONStorage(() => storage),

      migrate: (persistedState, version) => {
        if (version >= 3 || !persistedState) return persistedState;

        const state = persistedState as Partial<StorageState>;
        if (!state.profiles) return persistedState;

        return {
          ...state,
          profiles: migrateProfilesToV3(
            version === 1 ? migrateProfilesToV2(state.profiles) : state.profiles
          ),
          migrationNotice: version === 1,
        } as StorageState;
      },

      partialize: (state) => ({
        profiles: state.profiles,
        currentProfileId: state.currentProfileId,
        googleDriveAutoBackup: state.googleDriveAutoBackup,
        googleDriveConnected: state.googleDriveConnected,
        googleDriveLastBackupSignature: state.googleDriveLastBackupSignature,
        localDataUpdatedAt: state.localDataUpdatedAt,
      }),

      onRehydrateStorage: () => (state) => {
        if (!state) return;

        state.hasHydrated = true;

        if (
          !state.currentProfileId ||
          Object.keys(state.profiles).length === 0
        ) {
          state.setProfile({ id: '1', name: 'Endministrator', stores: {} });
          state.setCurrentProfileId('1');
        }
      },
    }
  )
);
