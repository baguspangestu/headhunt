import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { importUrlSchema } from '@/lib/validators/import-url';
import { TRACKER_CONFIG, TRACKER_IMPORT_URL_EXAMPLE } from '@/config/tracker';
import {
  OFFICIAL_RECORDBOOK_URL,
  WEB_IMPORT_BOOKMARKLET,
} from '@/lib/web-import-bookmarklet';
import { useImportStore } from '@/store/useImportStore';
import { useStorageStore } from '@/store/useStorageStore';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import {
  FaArrowUpRightFromSquare,
  FaCheck,
  FaClipboard,
  FaCircleInfo,
  FaFileImport,
  FaLink,
  FaPaste,
  FaShieldHalved,
  FaTerminal,
  FaUser,
} from 'react-icons/fa6';
import { MdError } from 'react-icons/md';
import { TiArrowSortedDown } from 'react-icons/ti';

type ImportRecordsProps = {
  isOpen: boolean;
  onClose: () => void;
};

type StepProps = {
  number: number;
  title: string;
  children: ReactNode;
};

const Step = ({ number, title, children }: StepProps) => (
  <div className="flex gap-3 rounded-xl bg-white/5 p-3">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-400/15 text-sm font-bold text-yellow-300">
      {number}
    </span>
    <div className="min-w-0 flex-1">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-1 text-sm leading-relaxed text-white/60">
        {children}
      </div>
    </div>
  </div>
);

export const ImportRecords = ({ isOpen, onClose }: ImportRecordsProps) => {
  const t = useTranslations('TrackerPage.ImportRecords');
  const trackerT = useTranslations('TrackerPage');
  const importRecords = useImportStore((state) => state.importRecords);
  const isImporting = useImportStore((state) => state.isImporting);
  const profiles = useStorageStore((state) => state.profiles);
  const currentProfileId = useStorageStore((state) => state.currentProfileId);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [saveImportUrl, setSaveImportUrl] = useState(false);
  const [copied, setCopied] = useState<'web' | 'windows' | null>(null);
  const [targetProfileId, setTargetProfileId] = useState(currentProfileId);
  const [defaultImportTab, setDefaultImportTab] = useState(0);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [isOpen, isImporting]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node))
        setProfileMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [profileMenuOpen]);

  const profileEntries = Object.entries(profiles);
  const targetProfile = profiles[targetProfileId];
  const targetHasImportedData = Boolean(targetProfile?.stores?.headhunt);
  const targetHasSavedImportUrl = Boolean(targetProfile?.stores?.headhunt?.url);

  const command = `iwr "${TRACKER_CONFIG.import.powershellScriptRawUrl}" -UseB | iex`;

  useEffect(() => {
    if (isOpen) {
      setTargetProfileId(currentProfileId);
      const userAgent = navigator.userAgent;
      const isIPadOS =
        /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;

      setDefaultImportTab(
        /Windows/i.test(userAgent)
          ? 0
          : /Android/i.test(userAgent)
            ? 1
            : /iPhone|iPad|iPod/i.test(userAgent) || isIPadOS
              ? 2
              : 3
      );
      return;
    }

    if (!isOpen) {
      setError('');
      setCopied(null);
    }
  }, [currentProfileId, isOpen]);

  const validateUrl = (value: string) => {
    const normalizedValue = value.trim();
    setUrl(normalizedValue);
    if (!normalizedValue) {
      setError('');
      return;
    }
    setError(
      importUrlSchema.safeParse(normalizedValue).success ? '' : t('invalidUrl')
    );
  };

  const handleImport = () => {
    if (isImporting || !url || error || !targetProfile) return;
    void importRecords(url, 'import', targetProfileId, saveImportUrl).then(
      (succeeded) => {
        if (!succeeded) return;
        setUrl('');
        setError('');
        setSaveImportUrl(false);
      }
    );
    onClose();
  };

  const handleCopy = async (value: string, source: 'web' | 'windows') => {
    await navigator.clipboard.writeText(value);
    setCopied(source);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Modal title={t('title')} isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {targetHasImportedData && (
          <div className="flex items-start gap-3 rounded-xl bg-yellow-500/10 p-3 text-yellow-200">
            <FaCircleInfo className="mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed">
              {trackerT.rich(
                targetHasSavedImportUrl
                  ? 'reimportInstruction'
                  : 'reimportWithoutSavedUrlInstruction',
                {
                  bold: (chunks) => (
                    <strong className="font-semibold">{chunks}</strong>
                  ),
                }
              )}
            </p>
          </div>
        )}

        <Tabs
          tabs={['Windows', 'Android', 'iOS', 'Web']}
          defaultActiveIndex={defaultImportTab}
          resetKey={isOpen}
        >
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-xl bg-white/5">
              <iframe
                className="aspect-video w-full"
                src="https://www.youtube-nocookie.com/embed/NQUQrlTbc90"
                title={t('WindowsSteps.videoGuide')}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <Step number={1} title={t('WindowsSteps.openHeadHuntingTitle')}>
              {t.rich('WindowsSteps.openHeadHuntingDesc', {
                game: (chunks) => (
                  <strong className="text-white/85">{chunks}</strong>
                ),
                menu: (chunks) => (
                  <strong className="text-white/85">{chunks}</strong>
                ),
              })}
            </Step>
            <Step number={2} title={t('WindowsSteps.openPowerShellTitle')}>
              {t.rich('WindowsSteps.openPowerShellDesc', {
                app: (chunks) => (
                  <strong className="text-white/85">{chunks}</strong>
                ),
                key: (chunks) => (
                  <kbd className="rounded-sm bg-white/10 px-1.5 py-0.5 font-medium text-white/85">
                    {chunks}
                  </kbd>
                ),
              })}
            </Step>
            <Step number={3} title={t('WindowsSteps.runCommandTitle')}>
              <p>
                {t.rich('WindowsSteps.runCommandDesc', {
                  app: (chunks) => (
                    <strong className="text-white/85">{chunks}</strong>
                  ),
                  key: (chunks) => (
                    <kbd className="rounded-sm bg-white/10 px-1.5 py-0.5 font-medium text-white/85">
                      {chunks}
                    </kbd>
                  ),
                })}
              </p>
              <div className="mt-3 overflow-hidden rounded-xl bg-neutral-950/70">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-white/45">
                  <span className="flex items-center gap-1.5">
                    <FaTerminal />
                    PowerShell
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(command, 'windows')}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {copied === 'windows' ? (
                      <FaCheck className="text-green-300" />
                    ) : (
                      <FaClipboard />
                    )}
                    {t(copied === 'windows' ? 'copied' : 'copy')}
                  </button>
                </div>
                <code className="block p-3 text-xs leading-relaxed break-all whitespace-pre-wrap text-white/70">
                  {command}
                </code>
              </div>
              <a
                href={TRACKER_CONFIG.import.powershellScriptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-yellow-300 transition-colors hover:text-yellow-200 focus-visible:ring-2 focus-visible:ring-yellow-300/60 focus-visible:outline-hidden"
              >
                {t('WindowsSteps.reviewScript')}
                <FaArrowUpRightFromSquare aria-hidden="true" />
              </a>
            </Step>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-xl bg-yellow-400/10 p-3 text-yellow-200">
              <FaShieldHalved className="mt-0.5 shrink-0" />
              <div className="text-sm leading-relaxed">
                <p className="font-semibold">
                  {t('MobileSteps.securityTitle')}
                </p>
                <p className="mt-0.5 text-yellow-100/65">
                  {t('MobileSteps.securityDescription')}
                </p>
              </div>
            </div>
            <Step number={1} title={t('AndroidSteps.installTitle')}>
              <p>{t('AndroidSteps.installDescription')}</p>
              <a
                href={TRACKER_CONFIG.import.androidCaptureAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-yellow-300 transition-colors hover:text-yellow-200 focus-visible:ring-2 focus-visible:ring-yellow-300/60 focus-visible:outline-hidden"
              >
                {t('AndroidSteps.openStore')}
                <FaArrowUpRightFromSquare aria-hidden="true" />
              </a>
            </Step>
            <Step number={2} title={t('AndroidSteps.setupTitle')}>
              {t('AndroidSteps.setupDescription')}
            </Step>
            <Step number={3} title={t('MobileSteps.captureTitle')}>
              {t('AndroidSteps.captureDescription')}
            </Step>
            <Step number={4} title={t('MobileSteps.copyTitle')}>
              {t('AndroidSteps.copyDescription')}
            </Step>
            <Step number={5} title={t('MobileSteps.cleanupTitle')}>
              {t('AndroidSteps.cleanupDescription')}
            </Step>
            <div className="flex items-start gap-2.5 rounded-xl bg-white/5 p-3 text-white/50">
              <FaCircleInfo className="mt-0.5 shrink-0 text-white/35" />
              <p className="text-xs leading-relaxed">
                {t('AndroidSteps.fallback')}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-xl bg-yellow-400/10 p-3 text-yellow-200">
              <FaShieldHalved className="mt-0.5 shrink-0" />
              <div className="text-sm leading-relaxed">
                <p className="font-semibold">
                  {t('MobileSteps.securityTitle')}
                </p>
                <p className="mt-0.5 text-yellow-100/65">
                  {t('MobileSteps.securityDescription')}
                </p>
              </div>
            </div>
            <Step number={1} title={t('IOSSteps.installTitle')}>
              <p>{t('IOSSteps.installDescription')}</p>
              <a
                href={TRACKER_CONFIG.import.iosCaptureAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-yellow-300 transition-colors hover:text-yellow-200 focus-visible:ring-2 focus-visible:ring-yellow-300/60 focus-visible:outline-hidden"
              >
                {t('IOSSteps.openStore')}
                <FaArrowUpRightFromSquare aria-hidden="true" />
              </a>
            </Step>
            <Step number={2} title={t('IOSSteps.setupTitle')}>
              {t('IOSSteps.setupDescription')}
            </Step>
            <Step number={3} title={t('MobileSteps.captureTitle')}>
              {t('IOSSteps.captureDescription')}
            </Step>
            <Step number={4} title={t('MobileSteps.copyTitle')}>
              {t('IOSSteps.copyDescription')}
            </Step>
            <Step number={5} title={t('MobileSteps.cleanupTitle')}>
              {t('IOSSteps.cleanupDescription')}
            </Step>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-xl bg-green-500/10 p-3 text-green-200">
              <FaShieldHalved className="mt-0.5 shrink-0" />
              <div className="text-sm leading-relaxed">
                <p className="font-semibold">{t('WebSteps.securityTitle')}</p>
                <p className="mt-0.5 text-green-100/65">
                  {t('WebSteps.securityDescription')}
                </p>
              </div>
            </div>
            <Step number={1} title={t('WebSteps.openRecordBookTitle')}>
              <p>{t('WebSteps.openRecordBookDesc')}</p>
              <a
                href={OFFICIAL_RECORDBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-yellow-300 transition-colors hover:text-yellow-200 focus-visible:ring-2 focus-visible:ring-yellow-300/60 focus-visible:outline-hidden"
              >
                {t('WebSteps.openOfficialSite')}
                <FaArrowUpRightFromSquare aria-hidden="true" />
              </a>
            </Step>
            <Step number={2} title={t('WebSteps.createBookmarkTitle')}>
              <p>{t('WebSteps.createBookmarkDesc')}</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => void handleCopy(WEB_IMPORT_BOOKMARKLET, 'web')}
              >
                {copied === 'web' ? (
                  <FaCheck className="text-green-300" />
                ) : (
                  <FaClipboard />
                )}
                {t(
                  copied === 'web'
                    ? 'WebSteps.bookmarkletCopied'
                    : 'WebSteps.copyBookmarklet'
                )}
              </Button>
              <details className="mt-2 max-w-full min-w-0 overflow-hidden text-xs text-white/45">
                <summary className="cursor-pointer py-1 font-medium text-white/55 hover:text-white/75">
                  {t('WebSteps.reviewBookmarklet')}
                </summary>
                <div className="mt-1 max-w-full overflow-hidden rounded-lg bg-neutral-950/70">
                  <code className="block max-h-24 w-full max-w-full min-w-0 overflow-auto overscroll-contain p-3 leading-relaxed break-all whitespace-pre-wrap">
                    {WEB_IMPORT_BOOKMARKLET}
                  </code>
                </div>
              </details>
            </Step>
            <Step number={3} title={t('WebSteps.runBookmarkTitle')}>
              {t('WebSteps.runBookmarkDesc')}
            </Step>
          </div>
        </Tabs>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleImport();
          }}
          className="rounded-xl bg-white/5 p-4"
        >
          <div className="mb-4">
            <label
              htmlFor={profileEntries.length > 1 ? 'import-profile' : undefined}
              className="font-semibold text-white"
            >
              {t('targetProfile')}
            </label>
            <p className="mt-1 text-sm leading-relaxed text-white/50">
              {t(
                profileEntries.length > 1
                  ? 'targetProfileDescription'
                  : 'singleTargetProfileDescription'
              )}
            </p>

            {profileEntries.length > 1 ? (
              <div
                ref={profileMenuRef}
                className="relative mt-3"
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && profileMenuOpen) {
                    event.stopPropagation();
                    setProfileMenuOpen(false);
                    profileTriggerRef.current?.focus();
                  }
                }}
              >
                <button
                  ref={profileTriggerRef}
                  id="import-profile"
                  type="button"
                  disabled={isImporting}
                  aria-expanded={profileMenuOpen}
                  aria-controls={
                    profileMenuOpen ? 'import-profile-options' : undefined
                  }
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-neutral-950/60 px-3 py-2.5 text-left text-sm text-white/85 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaUser
                    aria-hidden="true"
                    className="shrink-0 text-white/35"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {targetProfile?.name ?? t('unnamedProfile')}
                  </span>
                  <TiArrowSortedDown
                    aria-hidden="true"
                    className={
                      profileMenuOpen
                        ? 'shrink-0 rotate-180 text-base text-white/45 transition-transform duration-200'
                        : 'shrink-0 text-base text-white/45 transition-transform duration-200'
                    }
                  />
                </button>
                {profileMenuOpen && !isImporting && (
                  <div className="mt-2 overflow-hidden rounded-xl bg-neutral-700">
                    <div
                      id="import-profile-options"
                      role="group"
                      aria-label={t('targetProfile')}
                      className="flex max-h-64 flex-col gap-1 overflow-y-auto overscroll-contain p-2"
                    >
                      {profileEntries.map(([id, profile]) => (
                        <button
                          type="button"
                          key={id}
                          aria-pressed={id === targetProfileId}
                          onClick={() => {
                            setTargetProfileId(id);
                            setProfileMenuOpen(false);
                            profileTriggerRef.current?.focus();
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-yellow-400 aria-pressed:bg-yellow-400/15 aria-pressed:text-yellow-200"
                        >
                          <span className="min-w-0 flex-1 wrap-break-word">
                            {profile.name ?? t('unnamedProfile')}
                            {id === currentProfileId
                              ? ' — ' + t('activeProfile')
                              : ''}
                          </span>
                          {id === targetProfileId && (
                            <FaCheck
                              aria-hidden="true"
                              className="shrink-0 text-yellow-300"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-yellow-500/10 p-3">
                <span className="rounded-lg bg-yellow-400/15 p-2 text-yellow-300">
                  <FaUser />
                </span>
                <span className="min-w-0 text-sm font-medium text-white/85">
                  {targetProfile?.name ?? t('unnamedProfile')}
                </span>
              </div>
            )}
          </div>

          <div className="h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

          <div className="pt-4">
            <label htmlFor="import-url" className="font-semibold text-white">
              {t('urlLabel')}
            </label>
            <p className="mt-1 text-sm leading-relaxed text-white/50">
              {t('urlDescription')}
            </p>
            <div className="relative mt-3">
              <FaLink className="absolute top-1/2 left-3 -translate-y-1/2 text-white/35" />
              <input
                id="import-url"
                type="url"
                value={url}
                onChange={(event) => validateUrl(event.target.value)}
                placeholder={TRACKER_IMPORT_URL_EXAMPLE}
                className={`w-full rounded-xl border bg-neutral-950/60 py-2.5 pr-3 pl-10 text-sm text-white outline-hidden transition-colors placeholder:text-white/25 ${error ? 'border-red-400/60 focus:border-red-400' : 'border-white/10 focus:border-yellow-400/60'}`}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="mt-2 min-h-5">
              {error && (
                <p
                  className="flex items-center gap-1.5 text-sm text-red-300"
                  role="alert"
                >
                  <MdError />
                  <span>{error}</span>
                </p>
              )}
            </div>
            <label className="mt-1 flex cursor-pointer items-start gap-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={saveImportUrl}
                onChange={(event) => setSaveImportUrl(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-yellow-400"
              />
              <span>
                <span className="block font-medium text-white">
                  {t('saveImportUrl')}
                </span>
                <span className="mt-0.5 block leading-relaxed text-white/50">
                  {t('saveImportUrlDescription')}
                </span>
              </span>
            </label>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    validateUrl(await navigator.clipboard.readText());
                  } catch {
                    setError(t('clipboardError'));
                  }
                }}
              >
                <FaPaste />
                {t('paste')}
              </Button>
              <Button
                type="submit"
                disabled={isImporting || !url || !!error || !targetProfile}
              >
                <FaFileImport />
                {isImporting
                  ? trackerT('importing')
                  : t('importToProfile', {
                      name: targetProfile?.name ?? t('unnamedProfile'),
                    })}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
