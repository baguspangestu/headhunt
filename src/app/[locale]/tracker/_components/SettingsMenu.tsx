'use client';

import { Button } from '@/components/ui/Button';
import { TRACKER_CONFIG } from '@/config/tracker';
import { Modal } from '@/components/ui/Modal';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  calculateTrackerBackupHash,
  createTrackerBackup,
  isTrackerBackupEqualToProfiles,
  parseTrackerBackup,
  type TrackerBackup,
} from '@/lib/tracker-backup';
import {
  beginGoogleDriveConnection,
  deleteAllGoogleDriveBackups,
  disconnectGoogleDriveSession,
  downloadGoogleDriveBackup,
  getGoogleDriveSession,
  GoogleDriveError,
  listGoogleDriveBackups,
  setGoogleDriveBackupHash,
  unlinkGoogleDriveSession,
  uploadGoogleDriveBackup,
  type GoogleDriveSession,
} from '@/lib/google-drive-backup';
import { useStorageStore } from '@/store/useStorageStore';
import { useGoogleDriveStore } from '@/store/useGoogleDriveStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useLocale, useTranslations } from 'next-intl';
import { FaGoogleDrive, FaSave } from 'react-icons/fa';
import {
  FaDatabase,
  FaCheck,
  FaDownload,
  FaPlus,
  FaPen,
  FaShieldHalved,
  FaSpinner,
  FaTrash,
  FaUpload,
  FaUser,
  FaGoogle,
  FaClockRotateLeft,
  FaEye,
  FaEyeSlash,
  FaLinkSlash,
} from 'react-icons/fa6';
import { useCallback, useEffect, useRef, useState } from 'react';

type SettingsMenuProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const SettingsMenu = ({ isOpen, onClose }: SettingsMenuProps) => {
  const t = useTranslations('TrackerPage.SettingsMenu');
  const locale = useLocale();
  const profiles = useStorageStore((state) => state.profiles);
  const currentProfileId = useStorageStore((state) => state.currentProfileId);
  const localDataUpdatedAt = useStorageStore(
    (state) => state.localDataUpdatedAt
  );
  const restoreProfiles = useStorageStore((state) => state.restoreProfiles);
  const setProfile = useStorageStore((state) => state.setProfile);
  const setCurrentProfileId = useStorageStore(
    (state) => state.setCurrentProfileId
  );
  const removeProfile = useStorageStore((state) => state.removeProfile);
  const hasHydrated = useStorageStore((state) => state.hasHydrated);
  const googleDriveConnected = useStorageStore(
    (state) => state.googleDriveConnected
  );
  const setGoogleDriveConnected = useStorageStore(
    (state) => state.setGoogleDriveConnected
  );
  const lastBackupSignature = useStorageStore(
    (state) => state.googleDriveLastBackupSignature
  );
  const setLastBackupSignature = useStorageStore(
    (state) => state.setGoogleDriveLastBackupSignature
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupDragDepthRef = useRef(0);
  const notify = useNotificationStore((state) => state.notify);
  const [isBackupDragActive, setIsBackupDragActive] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<TrackerBackup | null>(
    null
  );
  const [pendingBackupDetails, setPendingBackupDetails] = useState<{
    source: 'json' | 'googleDrive';
    date: string;
    size: number;
  } | null>(null);
  const driveSession = useGoogleDriveStore((state) => state.session);
  const setDriveSession = useGoogleDriveStore((state) => state.setSession);
  const driveBackups = useGoogleDriveStore((state) => state.backups);
  const setDriveBackups = useGoogleDriveStore((state) => state.setBackups);
  const initialDriveBackup = useGoogleDriveStore(
    (state) => state.initialBackup
  );
  const setInitialDriveBackup = useGoogleDriveStore(
    (state) => state.setInitialBackup
  );
  const initialDriveBackupData = useGoogleDriveStore(
    (state) => state.initialBackupData
  );
  const setInitialDriveBackupData = useGoogleDriveStore(
    (state) => state.setInitialBackupData
  );
  const driveStatus = useGoogleDriveStore((state) => state.status);
  const setDriveStatus = useGoogleDriveStore((state) => state.setStatus);
  const sessionCheckAttempted = useGoogleDriveStore(
    (state) => state.sessionCheckAttempted
  );
  const setSessionCheckAttempted = useGoogleDriveStore(
    (state) => state.setSessionCheckAttempted
  );
  const resetGoogleDriveState = useGoogleDriveStore((state) => state.reset);
  const [historyPage, setHistoryPage] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isEmailVisible, setIsEmailVisible] = useState(false);
  const [isUnlinkConfirmationOpen, setIsUnlinkConfirmationOpen] =
    useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [pendingDeleteProfileId, setPendingDeleteProfileId] = useState<
    string | null
  >(null);
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [includeImportUrls, setIncludeImportUrls] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [visibleImportUrlProfileIds, setVisibleImportUrlProfileIds] = useState<
    Set<string>
  >(() => new Set());
  const [pendingDeleteImportUrlProfileId, setPendingDeleteImportUrlProfileId] =
    useState<string | null>(null);
  const lastSyncedDataRef = useRef<string | null>(null);
  const currentDataSignature = JSON.stringify({ currentProfileId, profiles });
  const hasLocalImportedData = Object.values(profiles).some(
    (profile) => profile.stores?.headhunt?.records !== undefined
  );
  const hasStoredImportUrl = Object.values(profiles).some((profile) =>
    Boolean(profile.stores?.headhunt?.url)
  );
  useEffect(() => {
    if (isOpen) {
      setIncludeImportUrls(false);
      setVisibleImportUrlProfileIds(new Set());
      setPendingDeleteImportUrlProfileId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!hasStoredImportUrl) setIncludeImportUrls(false);
  }, [hasStoredImportUrl]);

  const refreshDriveHistory = useCallback(
    async (session: GoogleDriveSession) => {
      const backups = await listGoogleDriveBackups(session);
      setDriveBackups(backups);
      setHistoryPage(0);
    },
    [setDriveBackups]
  );

  const profileCount = Object.keys(profiles).length;
  const hasReachedProfileLimit =
    profileCount >= TRACKER_CONFIG.profiles.maxCount;
  const recordCount = Object.values(profiles).reduce(
    (total, profile) =>
      total +
      Object.values(profile.stores?.headhunt?.records ?? {}).reduce(
        (profileTotal, records) => profileTotal + (records?.length ?? 0),
        0
      ),
    0
  );
  const latestLocalRecordTimestamp = Object.values(profiles).reduce(
    (latest, profile) =>
      Math.max(
        latest,
        ...Object.values(profile.stores?.headhunt?.records ?? {}).flatMap(
          (records) => records?.map((record) => record.timestamp) ?? []
        )
      ),
    0
  );
  const resolvedLocalUpdatedAt =
    localDataUpdatedAt || latestLocalRecordTimestamp;
  const localBackupSize = new TextEncoder().encode(
    JSON.stringify(
      createTrackerBackup(profiles, currentProfileId, { includeImportUrls })
    )
  ).byteLength;

  const handleBackup = () => {
    const backup = createTrackerBackup(profiles, currentProfileId, {
      includeImportUrls,
    });
    const blob = new Blob([JSON.stringify(backup)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `headhunt-backup-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    notify(t('backedUp'));
  };

  const handleRestore = () => {
    fileInputRef.current?.click();
  };

  const handleGoogleConnect = () => {
    beginGoogleDriveConnection(
      `${window.location.pathname}?settings=google-drive`
    );
  };

  const handleGoogleDisconnect = async () => {
    await disconnectGoogleDriveSession();
    resetGoogleDriveState();
    setIsHistoryOpen(false);
    setIsEmailVisible(false);
    setGoogleDriveConnected(false);
  };

  const handleGoogleUnlink = async () => {
    if (!driveSession || isUnlinking) return;

    setIsUnlinking(true);
    try {
      await deleteAllGoogleDriveBackups(driveSession);
      await unlinkGoogleDriveSession();
      resetGoogleDriveState();
      setIsHistoryOpen(false);
      setIsEmailVisible(false);
      setIsUnlinkConfirmationOpen(false);
      setGoogleDriveConnected(false);
      setLastBackupSignature('');
      lastSyncedDataRef.current = null;
    } catch {
      setDriveStatus('driveError');
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleGoogleBackup = useCallback(async () => {
    if (!driveSession) return;
    if (Date.now() >= driveSession.expiresAt) {
      setSessionCheckAttempted(false);
      setDriveSession(null);
      return;
    }

    if (
      lastSyncedDataRef.current === currentDataSignature ||
      lastBackupSignature === currentDataSignature
    ) {
      setDriveStatus('driveBackedUp');
      return;
    }

    setDriveStatus('backingUp');
    try {
      const uploadedBackup = await uploadGoogleDriveBackup(
        driveSession,
        createTrackerBackup(profiles, currentProfileId)
      );
      lastSyncedDataRef.current = currentDataSignature;
      setLastBackupSignature(currentDataSignature);
      if (isHistoryOpen) {
        setDriveBackups((backups) => [uploadedBackup, ...backups]);
      }
      setDriveStatus('driveBackedUp');
    } catch (error) {
      if (error instanceof GoogleDriveError && error.status === 401) {
        setSessionCheckAttempted(false);
        setDriveSession(null);
      }
      setDriveStatus('driveError');
    }
  }, [
    currentDataSignature,
    currentProfileId,
    driveSession,
    isHistoryOpen,
    lastBackupSignature,
    profiles,
    setLastBackupSignature,
    setDriveBackups,
    setDriveSession,
    setDriveStatus,
    setSessionCheckAttempted,
  ]);

  const handleGoogleRestore = async (fileId?: string) => {
    if (!driveSession) return;

    setDriveStatus('restoring');
    try {
      const backup = parseTrackerBackup(
        await downloadGoogleDriveBackup(driveSession, fileId)
      );
      if (
        await isTrackerBackupEqualToProfiles(backup, profiles, currentProfileId)
      ) {
        setPendingBackup(null);
        setPendingBackupDetails(null);
        lastSyncedDataRef.current = currentDataSignature;
        setLastBackupSignature(currentDataSignature);
        setDriveStatus('driveBackedUp');
        notify(t('identical'));
        return;
      }

      const driveBackup = driveBackups.find((item) => item.id === fileId);
      setPendingBackup(backup);
      setPendingBackupDetails({
        source: 'googleDrive',
        date: driveBackup?.modifiedTime ?? backup.exportedAt,
        size:
          driveBackup?.size ??
          new TextEncoder().encode(JSON.stringify(backup)).byteLength,
      });
      setDriveStatus(null);
    } catch (error) {
      if (error instanceof GoogleDriveError && error.status === 401) {
        setSessionCheckAttempted(false);
        setDriveSession(null);
      }
      setDriveStatus(
        error instanceof GoogleDriveError && error.status === 404
          ? 'driveNotFound'
          : 'driveError'
      );
    }
  };

  const handleUseLocalData = () => {
    setInitialDriveBackup(null);
    setInitialDriveBackupData(null);
    setDriveStatus('driveOutdated');
  };

  const handleUseGoogleDriveData = async () => {
    if (!driveSession || !initialDriveBackup) return;

    setDriveStatus('restoring');
    try {
      const backup =
        initialDriveBackupData ??
        parseTrackerBackup(
          await downloadGoogleDriveBackup(driveSession, initialDriveBackup.id)
        );
      const backupSignature = JSON.stringify({
        currentProfileId: backup.currentProfileId,
        profiles: backup.profiles,
      });
      setLastBackupSignature(backupSignature);
      lastSyncedDataRef.current = backupSignature;
      restoreProfiles(backup.profiles, backup.currentProfileId);
      setInitialDriveBackup(null);
      setInitialDriveBackupData(null);
      setDriveStatus('driveBackedUp');
      notify(t('restored'));
      onClose();
    } catch {
      setDriveStatus('driveError');
    }
  };

  useEffect(() => {
    if (!hasHydrated || driveSession || sessionCheckAttempted) {
      return;
    }

    setSessionCheckAttempted(true);
    setDriveStatus('connecting');
    void getGoogleDriveSession()
      .then(async (session) => {
        if (!session) {
          setDriveStatus(null);
          setGoogleDriveConnected(false);
          return;
        }
        let syncResolved = false;
        let waitingForChoice = false;
        const backups = await listGoogleDriveBackups(session);
        const latestBackup = backups[0];

        const restoreDriveBackup = async (cachedBackup?: TrackerBackup) => {
          setDriveStatus('restoring');
          const backup =
            cachedBackup ??
            parseTrackerBackup(
              await downloadGoogleDriveBackup(session, latestBackup.id)
            );
          const backupSignature = JSON.stringify({
            currentProfileId: backup.currentProfileId,
            profiles: backup.profiles,
          });
          setLastBackupSignature(backupSignature);
          lastSyncedDataRef.current = backupSignature;
          restoreProfiles(backup.profiles, backup.currentProfileId);
          setDriveStatus('driveBackedUp');
          notify(t('restored'));
          onClose();
          syncResolved = true;
        };

        if (latestBackup) {
          if (!hasLocalImportedData) {
            await restoreDriveBackup();
          } else {
            const normalizedLocalBackup = parseTrackerBackup(
              createTrackerBackup(profiles, currentProfileId)
            );
            const localContentHash = await calculateTrackerBackupHash(
              normalizedLocalBackup
            );
            let driveContentHash = latestBackup.contentHash;
            let downloadedDriveBackup: TrackerBackup | undefined;

            if (!driveContentHash) {
              downloadedDriveBackup = parseTrackerBackup(
                await downloadGoogleDriveBackup(session, latestBackup.id)
              );
              driveContentHash = await calculateTrackerBackupHash(
                downloadedDriveBackup
              );
              await setGoogleDriveBackupHash(
                session,
                latestBackup.id,
                driveContentHash
              );
            }

            if (driveContentHash === localContentHash) {
              setLastBackupSignature(currentDataSignature);
              lastSyncedDataRef.current = currentDataSignature;
              setDriveStatus('driveBackedUp');
              syncResolved = true;
            } else if (!googleDriveConnected) {
              setInitialDriveBackup(latestBackup);
              setInitialDriveBackupData(downloadedDriveBackup ?? null);
              waitingForChoice = true;
            } else if (
              new Date(latestBackup.modifiedTime).getTime() >
              resolvedLocalUpdatedAt
            ) {
              await restoreDriveBackup(downloadedDriveBackup);
            }
          }
        }
        setDriveSession(session);
        setGoogleDriveConnected(true);
        if (!syncResolved && !waitingForChoice) {
          lastSyncedDataRef.current = null;
          setDriveStatus('driveOutdated');
        }
      })
      .catch(() => {
        setDriveStatus('reconnectRequired');
      });
  }, [
    currentDataSignature,
    driveSession,
    googleDriveConnected,
    hasHydrated,
    hasLocalImportedData,
    currentProfileId,
    lastBackupSignature,
    notify,
    onClose,
    profiles,
    resolvedLocalUpdatedAt,
    restoreProfiles,
    setLastBackupSignature,
    setGoogleDriveConnected,
    setDriveSession,
    setDriveStatus,
    setInitialDriveBackup,
    setInitialDriveBackupData,
    sessionCheckAttempted,
    setSessionCheckAttempted,
    t,
  ]);

  useEffect(() => {
    if (!driveSession || initialDriveBackup) return;

    const timer = window.setTimeout(() => {
      void handleGoogleBackup();
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [driveSession, handleGoogleBackup, initialDriveBackup]);

  const handleToggleHistory = async () => {
    if (isHistoryOpen) {
      setIsHistoryOpen(false);
      return;
    }
    if (!driveSession) return;

    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      await refreshDriveHistory(driveSession);
    } catch {
      setDriveStatus('driveError');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleBackupFile = async (file: File) => {
    try {
      if (file.size > TRACKER_CONFIG.backup.maxFileSizeBytes)
        throw new Error('Backup is too large');

      const backup = parseTrackerBackup(JSON.parse(await file.text()));
      if (
        await isTrackerBackupEqualToProfiles(backup, profiles, currentProfileId)
      ) {
        setPendingBackup(null);
        setPendingBackupDetails(null);
        notify(t('identical'));
        return;
      }

      // Match the initial Google Drive restore flow: a fresh browser has no
      // local records to protect, so the selected backup can be applied
      // immediately without asking the user to choose between empty local
      // data and the JSON backup.
      if (!hasLocalImportedData) {
        lastSyncedDataRef.current = null;
        setLastBackupSignature('');
        if (driveSession) setDriveStatus('driveOutdated');
        restoreProfiles(backup.profiles, backup.currentProfileId);
        setPendingBackup(null);
        setPendingBackupDetails(null);
        notify(t('restored'));
        onClose();
        return;
      }

      setPendingBackup(backup);
      setPendingBackupDetails({
        source: 'json',
        date: backup.exportedAt,
        size: new TextEncoder().encode(JSON.stringify(backup)).byteLength,
      });
    } catch {
      notify(t('invalid'), 'error');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void handleBackupFile(file);
  };

  const handleBackupDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    backupDragDepthRef.current += 1;
    setIsBackupDragActive(true);
  };

  const handleBackupDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleBackupDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    backupDragDepthRef.current = Math.max(0, backupDragDepthRef.current - 1);
    if (backupDragDepthRef.current === 0) setIsBackupDragActive(false);
  };

  const handleBackupDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    backupDragDepthRef.current = 0;
    setIsBackupDragActive(false);

    const file = event.dataTransfer.files[0];
    if (file) void handleBackupFile(file);
  };

  const handleConfirmRestore = () => {
    if (!pendingBackup) return;

    const isGoogleDriveRestore = pendingBackupDetails?.source === 'googleDrive';
    const restoredProfiles = pendingBackup.profiles;
    const restoredDataSignature = JSON.stringify({
      currentProfileId: pendingBackup.currentProfileId,
      profiles: restoredProfiles,
    });

    if (isGoogleDriveRestore) {
      lastSyncedDataRef.current = restoredDataSignature;
      setLastBackupSignature(restoredDataSignature);
      setDriveStatus('driveBackedUp');
    } else {
      lastSyncedDataRef.current = null;
      setLastBackupSignature('');
      if (driveSession) setDriveStatus('driveOutdated');
    }

    restoreProfiles(restoredProfiles, pendingBackup.currentProfileId);
    setPendingBackup(null);
    setPendingBackupDetails(null);
    notify(t('restored'));
    onClose();
  };

  const handleAddProfile = () => {
    const name = profileName.trim();
    if (name.length < 2 || name.length > 20 || hasReachedProfileLimit) return;

    setProfile({ name, stores: {} }, { makeActive: false });
    setProfileName('');
    setIsAddingProfile(false);
  };

  const handleToggleAddProfile = () => {
    setIsAddingProfile((value) => !value);
    setProfileName('');
    setPendingDeleteProfileId(null);
    setEditingProfileId(null);
    setEditingProfileName('');
  };

  const handleDeleteProfile = () => {
    if (!pendingDeleteProfileId || profileCount <= 1) return;
    removeProfile(pendingDeleteProfileId);
    setPendingDeleteProfileId(null);
  };

  const handleDeleteImportUrl = () => {
    if (!pendingDeleteImportUrlProfileId) return;

    const profile = profiles[pendingDeleteImportUrlProfileId];
    const headhunt = profile?.stores?.headhunt;
    if (!profile || !headhunt?.url) return;

    setProfile(
      {
        ...profile,
        stores: {
          ...profile.stores,
          headhunt: { ...headhunt, url: '' },
        },
      },
      { makeActive: false }
    );
    setVisibleImportUrlProfileIds((ids) => {
      const next = new Set(ids);
      next.delete(profile.id);
      return next;
    });
    setPendingDeleteImportUrlProfileId(null);
    notify(t('importUrlDeleted'));
  };

  const handleEditProfile = () => {
    const profile = editingProfileId ? profiles[editingProfileId] : undefined;
    const name = editingProfileName.trim();
    if (!profile || name.length < 2 || name.length > 20) return;

    setProfile({ ...profile, name }, { makeActive: false });
    setEditingProfileId(null);
    setEditingProfileName('');
    setIsUnlinkConfirmationOpen(false);
  };

  const handleClose = () => {
    backupDragDepthRef.current = 0;
    setIsBackupDragActive(false);
    setPendingBackup(null);
    setPendingBackupDetails(null);
    setIsAddingProfile(false);
    setProfileName('');
    setPendingDeleteProfileId(null);
    setEditingProfileId(null);
    setEditingProfileName('');
    setVisibleImportUrlProfileIds(new Set());
    setPendingDeleteImportUrlProfileId(null);
    onClose();
  };

  const historyPageCount = Math.max(
    1,
    Math.ceil(driveBackups.length / TRACKER_CONFIG.backup.historyPageSize)
  );
  const visibleDriveBackups = driveBackups.slice(
    historyPage * TRACKER_CONFIG.backup.historyPageSize,
    (historyPage + 1) * TRACKER_CONFIG.backup.historyPageSize
  );
  const normalizedProfileName = profileName.trim();
  const isProfileNameValid =
    normalizedProfileName.length >= 2 && normalizedProfileName.length <= 20;
  const pendingDeleteProfile = pendingDeleteProfileId
    ? profiles[pendingDeleteProfileId]
    : undefined;
  const editingProfile = editingProfileId
    ? profiles[editingProfileId]
    : undefined;
  const profilesWithImportUrls = Object.values(profiles).filter((profile) =>
    Boolean(profile.stores?.headhunt?.url)
  );
  const pendingDeleteImportUrlProfile = pendingDeleteImportUrlProfileId
    ? profiles[pendingDeleteImportUrlProfileId]
    : undefined;
  const normalizedEditingProfileName = editingProfileName.trim();
  const isEditingProfileNameValid =
    normalizedEditingProfileName.length >= 2 &&
    normalizedEditingProfileName.length <= 20;
  const connectedEmail = driveSession?.email ?? '';
  const maskedEmail = '************';

  return (
    <Modal
      title={t('title')}
      isOpen={isOpen}
      disableClose={
        isUnlinking || (!!initialDriveBackup && driveStatus === 'restoring')
      }
      onClose={handleClose}
    >
      <div className="flex flex-col gap-4">
        {initialDriveBackup ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-linear-to-br from-blue-500/12 to-neutral-900/50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-500/15 p-3 text-blue-300">
                  <FaGoogleDrive className="text-xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white">
                    {t('chooseInitialDataTitle')}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">
                    {t('chooseInitialDataDescription')}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-white/5 p-3">
                  <span className="block text-xs text-white/45">
                    {t('browserData')}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-white/85">
                    {resolvedLocalUpdatedAt
                      ? new Intl.DateTimeFormat(locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(resolvedLocalUpdatedAt))
                      : t('unknownDate')}
                  </span>
                  <span className="mt-0.5 block text-xs text-white/45">
                    {t('backupSize', {
                      size: (localBackupSize / 1024).toFixed(2),
                    })}
                  </span>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <span className="block text-xs text-white/45">
                    {t('googleDriveData')}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-white/85">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(initialDriveBackup.modifiedTime))}
                  </span>
                  <span className="mt-0.5 block text-xs text-white/45">
                    {t('backupSize', {
                      size: (initialDriveBackup.size / 1024).toFixed(2),
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={handleUseLocalData}
                disabled={driveStatus === 'restoring'}
              >
                <FaDatabase />
                {t('useBrowserData')}
              </Button>
              <Button
                onClick={() => void handleUseGoogleDriveData()}
                disabled={driveStatus === 'restoring'}
              >
                {driveStatus === 'restoring' ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <FaGoogleDrive />
                )}
                {t(
                  driveStatus === 'restoring'
                    ? 'restoring'
                    : 'useGoogleDriveData'
                )}
              </Button>
            </div>
          </div>
        ) : pendingBackup ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-linear-to-br from-yellow-500/12 to-neutral-900/50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-yellow-400/15 p-3 text-yellow-300">
                  <FaUpload className="text-xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white">
                    {t('confirmRestoreTitle')}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    {t('restoreConfirmation')}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-white/5 p-3">
                  <span className="block text-xs text-white/45">
                    {t('browserData')}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-white/85">
                    {resolvedLocalUpdatedAt
                      ? new Intl.DateTimeFormat(locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(resolvedLocalUpdatedAt))
                      : t('unknownDate')}
                  </span>
                  <span className="mt-0.5 block text-xs text-white/45">
                    {t('backupSize', {
                      size: (localBackupSize / 1024).toFixed(2),
                    })}
                  </span>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <span className="block text-xs text-white/45">
                    {t(
                      pendingBackupDetails?.source === 'googleDrive'
                        ? 'googleDriveData'
                        : 'jsonBackupData'
                    )}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-white/85">
                    {pendingBackupDetails?.date
                      ? new Intl.DateTimeFormat(locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(pendingBackupDetails.date))
                      : t('unknownDate')}
                  </span>
                  <span className="mt-0.5 block text-xs text-white/45">
                    {t('backupSize', {
                      size: ((pendingBackupDetails?.size ?? 0) / 1024).toFixed(
                        2
                      ),
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPendingBackup(null);
                  setPendingBackupDetails(null);
                }}
              >
                <FaDatabase />
                {t('useBrowserData')}
              </Button>
              <Button onClick={handleConfirmRestore}>
                <FaUpload />
                {t(
                  pendingBackupDetails?.source === 'googleDrive'
                    ? 'useGoogleDriveData'
                    : 'useJsonBackupData'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl bg-linear-to-br from-neutral-700/60 via-neutral-800 to-neutral-800/60 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-yellow-400/15 p-3 text-yellow-300">
                  <FaDatabase className="text-xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white">
                    {t('backupRecords')}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    {t('description')}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/80">
                  {t('profileCount', { count: profileCount })}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/80">
                  {t('recordCount', { count: recordCount })}
                </span>
              </div>
            </div>

            <div className="h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

            <section
              className="flex flex-col gap-3"
              aria-labelledby="profiles-title"
            >
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3
                    id="profiles-title"
                    className="text-sm font-semibold text-white"
                  >
                    {t('profilesTitle')}
                  </h3>
                  <p className="mt-0.5 text-xs text-white/50">
                    {t('profilesDescription')}
                  </p>
                </div>
                {hasReachedProfileLimit ? (
                  <Tooltip
                    position="left"
                    title={t('profileLimitReached', {
                      count: TRACKER_CONFIG.profiles.maxCount,
                    })}
                  >
                    <Button size="sm" disabled>
                      <FaPlus />
                      {t('addProfile')}
                    </Button>
                  </Tooltip>
                ) : (
                  <Button size="sm" onClick={handleToggleAddProfile}>
                    <FaPlus />
                    {t('addProfile')}
                  </Button>
                )}
              </div>

              {isAddingProfile && (
                <form
                  className="rounded-xl bg-linear-to-br from-yellow-500/12 to-neutral-900/50 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleAddProfile();
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-yellow-500/15 p-3 text-yellow-300">
                      <FaPlus />
                    </span>
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="new-profile-name"
                        className="font-semibold text-white"
                      >
                        {t('addProfileTitle')}
                      </label>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">
                        {t('addProfileDescription')}
                      </p>
                    </div>
                  </div>
                  <input
                    id="new-profile-name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    minLength={2}
                    maxLength={20}
                    autoFocus
                    placeholder={t('profileNamePlaceholder')}
                    className="mt-3 w-full rounded-xl border border-white/15 bg-neutral-900/70 px-3 py-2 text-sm text-white outline-hidden transition-colors placeholder:text-white/30 focus:border-yellow-400/60"
                  />
                  <div className="mt-1.5 flex justify-between gap-3 text-xs">
                    <span
                      className={
                        profileName.length > 0 && !isProfileNameValid
                          ? 'text-red-300'
                          : 'text-white/45'
                      }
                    >
                      {t('profileNameHint')}
                    </span>
                    <span className="shrink-0 text-white/45">
                      {profileName.length}/20
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setIsAddingProfile(false);
                        setProfileName('');
                      }}
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      type="submit"
                      disabled={!isProfileNameValid || hasReachedProfileLimit}
                    >
                      <FaSave />
                      {t('createProfile')}
                    </Button>
                  </div>
                </form>
              )}

              <div className="overflow-hidden rounded-xl bg-white/5">
                {Object.values(profiles).map((profile, index, profileList) => (
                  <div
                    key={profile.id}
                    className={`flex items-stretch transition-colors ${index ? 'border-t border-white/5' : ''} ${profileList.length === 1 ? 'rounded-xl' : index === 0 ? 'rounded-t-xl' : index === profileList.length - 1 ? 'rounded-b-xl' : ''} ${profile.id === currentProfileId ? 'bg-yellow-400/8' : 'hover:bg-white/3'}`}
                  >
                    <button
                      type="button"
                      className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 p-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-yellow-400 ${index === 0 ? 'rounded-tl-xl' : ''} ${index === profileList.length - 1 ? 'rounded-bl-xl' : ''}`}
                      aria-pressed={profile.id === currentProfileId}
                      onClick={() => setCurrentProfileId(profile.id)}
                    >
                      <span
                        aria-hidden="true"
                        className={`relative rounded-lg p-2 ${profile.id === currentProfileId ? 'bg-yellow-400/20 text-yellow-300' : 'bg-white/5 text-white/50'}`}
                      >
                        {profile.id === currentProfileId ? (
                          <FaCheck />
                        ) : (
                          <FaUser />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {profile.name || t('unnamedProfile')}
                        </span>
                        {profile.id === currentProfileId ? (
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-yellow-400/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
                            {t('activeProfile')}
                          </span>
                        ) : (
                          <span className="block text-xs text-white/45">
                            {t('selectProfile')}
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-1 pr-3">
                      <Tooltip
                        position="top"
                        title={t('editProfile', {
                          name: profile.name || t('unnamedProfile'),
                        })}
                      >
                        <button
                          type="button"
                          className="cursor-pointer rounded-lg p-2 text-white/45 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                          onClick={() => {
                            setPendingDeleteProfileId(null);
                            setEditingProfileId(profile.id);
                            setEditingProfileName(profile.name ?? '');
                          }}
                          aria-label={t('editProfile')}
                        >
                          <FaPen />
                        </button>
                      </Tooltip>
                      <Tooltip
                        position="top"
                        title={
                          profileCount <= 1
                            ? t('cannotDeleteOnlyProfile')
                            : t('deleteProfile', {
                                name: profile.name || t('unnamedProfile'),
                              })
                        }
                      >
                        <button
                          type="button"
                          className="cursor-pointer rounded-lg p-2 text-white/45 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() => {
                            setEditingProfileId(null);
                            setEditingProfileName('');
                            setPendingDeleteProfileId(profile.id);
                          }}
                          disabled={profileCount <= 1}
                          aria-label={t('deleteProfile')}
                        >
                          <FaTrash />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>

              {editingProfile && (
                <form
                  className="rounded-xl bg-linear-to-br from-blue-500/12 to-neutral-900/50 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleEditProfile();
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-blue-500/15 p-3 text-blue-300">
                      <FaPen />
                    </span>
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="edit-profile-name"
                        className="font-semibold text-white"
                      >
                        {t('editProfileTitle')}
                      </label>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">
                        {t('editProfileDescription', {
                          name: editingProfile.name || t('unnamedProfile'),
                        })}
                      </p>
                    </div>
                  </div>
                  <input
                    id="edit-profile-name"
                    value={editingProfileName}
                    onChange={(event) =>
                      setEditingProfileName(event.target.value)
                    }
                    minLength={2}
                    maxLength={20}
                    autoFocus
                    className="mt-3 w-full rounded-xl border border-white/15 bg-neutral-900/70 px-3 py-2 text-sm text-white outline-hidden transition-colors focus:border-blue-400/60"
                  />
                  <div className="mt-1.5 flex justify-between gap-3 text-xs">
                    <span
                      className={
                        editingProfileName.length > 0 &&
                        !isEditingProfileNameValid
                          ? 'text-red-300'
                          : 'text-white/45'
                      }
                    >
                      {t('profileNameHint')}
                    </span>
                    <span className="shrink-0 text-white/45">
                      {editingProfileName.length}/20
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditingProfileId(null);
                        setEditingProfileName('');
                      }}
                    >
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={!isEditingProfileNameValid}>
                      <FaSave />
                      {t('saveProfileName')}
                    </Button>
                  </div>
                </form>
              )}

              {pendingDeleteProfile && (
                <div
                  className="rounded-xl bg-linear-to-br from-red-500/12 to-neutral-900/50 p-4"
                  role="alertdialog"
                  aria-labelledby="delete-profile-title"
                >
                  <div className="flex items-start gap-3">
                    <span className="p-1 text-xl text-red-300">
                      <FaTrash />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4
                        id="delete-profile-title"
                        className="font-semibold text-white"
                      >
                        {t('deleteProfileTitle')}
                      </h4>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">
                        {t('deleteProfileConfirmation', {
                          name:
                            pendingDeleteProfile.name || t('unnamedProfile'),
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setPendingDeleteProfileId(null)}
                    >
                      {t('cancel')}
                    </Button>
                    <Button variant="danger" onClick={handleDeleteProfile}>
                      <FaTrash />
                      {t('deletePermanently')}
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <div className="h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

            <section
              className="flex flex-col gap-3"
              aria-labelledby="import-urls-title"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    id="import-urls-title"
                    className="text-sm font-semibold text-white"
                  >
                    {t('importUrlsTitle')}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">
                    {t('importUrlsDescription')}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/55">
                  {t('savedImportUrlCount', {
                    count: profilesWithImportUrls.length,
                  })}
                </span>
              </div>

              {profilesWithImportUrls.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {profilesWithImportUrls.map((profile) => {
                    const importUrl = profile.stores?.headhunt?.url ?? '';
                    const isVisible = visibleImportUrlProfileIds.has(
                      profile.id
                    );

                    return (
                      <div
                        key={profile.id}
                        className="overflow-hidden rounded-xl bg-white/5"
                      >
                        <div className="flex items-start justify-between gap-3 px-3 pt-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white/85">
                              {profile.name || t('unnamedProfile')}
                            </p>
                          </div>
                          {profile.id === currentProfileId && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-yellow-400/15 px-2 py-1 text-[11px] font-semibold text-yellow-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
                              {t('activeProfile')}
                            </span>
                          )}
                        </div>
                        <div
                          aria-label={t('savedImportUrl')}
                          className="mx-3 mt-2 min-h-9 rounded-lg bg-neutral-950/45 px-3 py-2 font-mono text-xs leading-relaxed text-white/65"
                        >
                          {isVisible ? (
                            <span className="wrap-break-word">{importUrl}</span>
                          ) : (
                            <span
                              className="text-white/30 select-none"
                              aria-hidden="true"
                            >
                              ••••••••••••••••••••
                            </span>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-1 bg-black/10 px-3 py-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-2">
                          <button
                            type="button"
                            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/55 transition-colors hover:bg-white/6 hover:text-white"
                            onClick={() =>
                              setVisibleImportUrlProfileIds((ids) => {
                                const next = new Set(ids);
                                if (next.has(profile.id))
                                  next.delete(profile.id);
                                else next.add(profile.id);
                                return next;
                              })
                            }
                            aria-label={t(
                              isVisible ? 'hideImportUrl' : 'showImportUrl'
                            )}
                          >
                            {isVisible ? <FaEyeSlash /> : <FaEye />}
                            {t(isVisible ? 'hideImportUrl' : 'showImportUrl')}
                          </button>
                          <span className="hidden h-5 w-px bg-white/8 sm:block" />
                          <button
                            type="button"
                            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/55 transition-colors hover:bg-red-500/10 hover:text-red-300"
                            onClick={() =>
                              setPendingDeleteImportUrlProfileId(profile.id)
                            }
                            aria-label={t('deleteImportUrl')}
                          >
                            <FaTrash />
                            {t('deleteImportUrl')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl bg-white/4 p-4">
                  <span className="rounded-lg bg-white/5 p-2.5 text-white/30">
                    <FaLinkSlash aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white/65">
                      {t('noSavedImportUrls')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/40">
                      {t('noSavedImportUrlsDescription')}
                    </p>
                  </div>
                </div>
              )}

              {pendingDeleteImportUrlProfile?.stores?.headhunt?.url && (
                <div
                  className="rounded-xl bg-linear-to-br from-red-500/12 to-neutral-900/50 p-4"
                  role="alertdialog"
                  aria-labelledby="delete-import-url-title"
                >
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-red-500/15 p-3 text-red-300">
                      <FaLinkSlash />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4
                        id="delete-import-url-title"
                        className="font-semibold text-white"
                      >
                        {t('deleteImportUrlTitle')}
                      </h4>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">
                        {t('deleteImportUrlConfirmation')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setPendingDeleteImportUrlProfileId(null)}
                    >
                      {t('cancel')}
                    </Button>
                    <Button variant="danger" onClick={handleDeleteImportUrl}>
                      <FaLinkSlash />
                      {t('deleteImportUrl')}
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <div className="flex flex-col gap-4">
              <div className="order-1 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

              <section
                className="order-4 flex flex-col gap-3"
                aria-labelledby="local-backup-title"
              >
                <div>
                  <h3
                    id="local-backup-title"
                    className="text-sm font-semibold text-white"
                  >
                    {t('localBackup')}
                  </h3>
                  <p className="mt-0.5 text-xs text-white/50">
                    {t('localBackupDescription')}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col rounded-xl bg-white/5 p-4">
                    <div className="flex items-start gap-3">
                      <FaDownload className="mb-3 text-xl text-sky-300" />
                      <h3 className="font-semibold">{t('backup')}</h3>
                    </div>
                    <p className="mt-1 flex-1 text-sm leading-relaxed text-white/60">
                      {t('backupDescription')}
                    </p>
                    <label
                      className={`mt-4 flex items-start gap-3 text-sm ${
                        hasStoredImportUrl
                          ? 'cursor-pointer text-white/80'
                          : 'cursor-not-allowed text-white/35'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={includeImportUrls}
                        disabled={!hasStoredImportUrl}
                        onChange={(event) =>
                          setIncludeImportUrls(event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-yellow-400 disabled:opacity-40"
                      />
                      <span>
                        <span className="block font-medium">
                          {t('includeImportUrls')}
                        </span>
                        <span className="mt-0.5 block leading-relaxed opacity-70">
                          {t(
                            hasStoredImportUrl
                              ? 'includeImportUrlsDescription'
                              : 'noImportUrlsDescription'
                          )}
                        </span>
                      </span>
                    </label>
                    <Button
                      variant="secondary"
                      className="mt-3 w-full"
                      onClick={handleBackup}
                    >
                      <FaDownload />
                      {t('downloadBackup')}
                    </Button>
                  </div>

                  <div
                    className={`flex flex-col rounded-xl p-4 transition-colors ${
                      isBackupDragActive
                        ? 'bg-yellow-400/15 ring-2 ring-yellow-300/70 ring-inset'
                        : 'bg-white/5'
                    }`}
                    onDragEnter={handleBackupDragEnter}
                    onDragOver={handleBackupDragOver}
                    onDragLeave={handleBackupDragLeave}
                    onDrop={handleBackupDrop}
                  >
                    <div className="flex items-start gap-3">
                      <FaUpload className="mb-3 text-xl text-yellow-300" />
                      <h3 className="font-semibold">{t('restore')}</h3>
                    </div>
                    <p className="mt-1 flex-1 text-sm leading-relaxed text-white/60">
                      {t('restoreDescription')}
                    </p>
                    <p
                      className={`mt-4 text-center text-sm transition-colors ${
                        isBackupDragActive
                          ? 'font-medium text-yellow-200'
                          : 'text-white/45'
                      }`}
                    >
                      {t(
                        isBackupDragActive ? 'dropBackupActive' : 'dropBackup'
                      )}
                    </p>
                    <Button className="mt-4 w-full" onClick={handleRestore}>
                      <FaUpload />
                      {t('chooseBackup')}
                    </Button>
                  </div>
                </div>
              </section>

              <div className="order-3 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

              <section
                className="order-2 flex flex-col gap-3"
                aria-labelledby="cloud-backup-title"
              >
                <div>
                  <h3
                    id="cloud-backup-title"
                    className="text-sm font-semibold text-white"
                  >
                    {t('cloudBackup')}
                  </h3>
                  <p className="mt-0.5 text-xs text-white/50">
                    {t('cloudBackupDescription')}
                  </p>
                </div>

                <div className="rounded-xl bg-linear-to-br from-blue-500/10 to-white/3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-blue-400/15 p-3 text-blue-300">
                      <FaGoogleDrive className="text-xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-white">
                            {t('googleDrive')}
                          </h3>
                          <p className="mt-1 text-sm leading-relaxed text-white/60">
                            {t('googleDriveDescription')}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            driveSession
                              ? 'bg-green-500/15 text-green-300'
                              : 'bg-white/10 text-white/60'
                          }`}
                        >
                          {t(driveSession ? 'connected' : 'notConnected')}
                        </span>
                      </div>

                      {driveSession ? (
                        <div className="mt-4 -ml-14 flex w-[calc(100%+3.5rem)] flex-col gap-3">
                          <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                            <span className="min-w-0">
                              <span className="block text-xs text-white/45">
                                {t('connectedEmail')}
                              </span>
                              <span className="block truncate text-sm font-medium text-white/90">
                                {isEmailVisible ? connectedEmail : maskedEmail}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="cursor-pointer rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                              onClick={() =>
                                setIsEmailVisible((visible) => !visible)
                              }
                              aria-label={t(
                                isEmailVisible ? 'hideEmail' : 'showEmail'
                              )}
                            >
                              {isEmailVisible ? <FaEyeSlash /> : <FaEye />}
                            </button>
                          </div>

                          <div className="flex items-center gap-3 rounded-xl bg-neutral-900/30 px-3 py-2.5">
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${driveStatus === 'driveBackedUp' ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.6)]' : driveStatus === 'backingUp' || driveStatus === 'connecting' ? 'animate-pulse bg-blue-400' : driveStatus === 'driveOutdated' ? 'bg-yellow-400' : 'bg-red-400'}`}
                            />
                            <span className="min-w-0">
                              <span className="block text-xs text-white/45">
                                {t('syncStatus')}
                              </span>
                              <span className="block text-sm font-medium text-white/85">
                                {t(driveStatus ?? 'driveOutdated')}
                              </span>
                            </span>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <Button
                              onClick={() => void handleToggleHistory()}
                              disabled={isHistoryLoading}
                            >
                              {isHistoryLoading ? (
                                <FaSpinner className="animate-spin" />
                              ) : (
                                <FaClockRotateLeft />
                              )}
                              {t(
                                isHistoryLoading
                                  ? 'loadingHistory'
                                  : 'backupHistory'
                              )}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => void handleGoogleDisconnect()}
                            >
                              <FaGoogle />
                              {t('disconnect')}
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() =>
                                setIsUnlinkConfirmationOpen((isOpen) => !isOpen)
                              }
                            >
                              <FaLinkSlash />
                              {t('unlinkGoogleDrive')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          className="mt-4"
                          onClick={handleGoogleConnect}
                          disabled={driveStatus === 'connecting'}
                        >
                          <FaGoogle />
                          {t(
                            driveStatus === 'connecting'
                              ? 'connecting'
                              : 'connectGoogle'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {driveSession && isUnlinkConfirmationOpen && (
                  <div
                    className="rounded-xl bg-linear-to-br from-red-500/12 to-neutral-900/50 p-4"
                    role="alertdialog"
                    aria-labelledby="unlink-google-drive-title"
                  >
                    <div className="flex items-start gap-3">
                      <span className="rounded-xl bg-red-500/15 p-3 text-red-300">
                        <FaLinkSlash />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4
                          id="unlink-google-drive-title"
                          className="font-semibold text-white"
                        >
                          {t('unlinkGoogleDriveTitle')}
                        </h4>
                        <p className="mt-1 text-sm leading-relaxed text-white/60">
                          {t('unlinkGoogleDriveDescription')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="secondary"
                        onClick={() => setIsUnlinkConfirmationOpen(false)}
                        disabled={isUnlinking}
                      >
                        {t('cancel')}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => void handleGoogleUnlink()}
                        disabled={isUnlinking}
                      >
                        {isUnlinking ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <FaLinkSlash />
                        )}
                        {t(isUnlinking ? 'unlinking' : 'confirmUnlink')}
                      </Button>
                    </div>
                  </div>
                )}

                {driveSession && isHistoryOpen && (
                  <div className="overflow-hidden rounded-xl bg-neutral-900/40">
                    <div className="border-b border-white/10 px-4 py-3">
                      <h4 className="font-semibold text-white">
                        {t('dataHistory')}
                      </h4>
                      <p className="mt-0.5 text-xs text-white/50">
                        {t('dataHistoryDescription')}
                      </p>
                    </div>

                    <div className="divide-y divide-white/10">
                      {isHistoryLoading ? (
                        <div
                          className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-white/60"
                          role="status"
                        >
                          <FaSpinner className="animate-spin text-blue-300" />
                          <span>{t('loadingHistory')}</span>
                        </div>
                      ) : driveBackups.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-white/50">
                          {t('driveNotFound')}
                        </p>
                      ) : (
                        visibleDriveBackups.map((backup) => (
                          <div
                            key={backup.id}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white/90">
                                {new Intl.DateTimeFormat(locale, {
                                  dateStyle: 'medium',
                                  timeStyle: 'medium',
                                }).format(new Date(backup.modifiedTime))}
                              </p>
                              <p className="mt-0.5 text-xs text-white/45">
                                {t('backupSize', {
                                  size: (backup.size / 1024).toFixed(2),
                                })}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void handleGoogleRestore(backup.id)
                              }
                              disabled={driveStatus === 'restoring'}
                            >
                              <FaDownload />
                              {t('restore')}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    {historyPageCount > 1 && (
                      <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={historyPage === 0}
                          onClick={() => setHistoryPage((page) => page - 1)}
                        >
                          {t('previous')}
                        </Button>
                        <span className="text-xs text-white/60">
                          {t('pageOf', {
                            page: historyPage + 1,
                            total: historyPageCount,
                          })}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={historyPage + 1 >= historyPageCount}
                          onClick={() => setHistoryPage((page) => page + 1)}
                        >
                          {t('next')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex items-start gap-3 rounded-xl bg-yellow-500/10 p-3 text-yellow-200">
              <FaShieldHalved className="mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed">{t('securityWarning')}</p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
