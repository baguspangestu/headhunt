'use client';

import clsx from 'clsx';
import { FaCheck, FaSyncAlt } from 'react-icons/fa';
import { useEffect, useState } from 'react';
import { useImportStore } from '@/store/useImportStore';
import { FaCircleExclamation } from 'react-icons/fa6';
import { useTranslations } from 'next-intl';

export const ImportStatus = () => {
  const t = useTranslations('ImportStatus');
  const processType = useImportStore((s) => s.processType);
  const isImporting = useImportStore((s) => s.isImporting);
  const totalRecord = useImportStore((s) => s.totalRecord);
  const errorType = useImportStore((s) => s.errorType);

  const [show, setShow] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (isImporting) {
      timeout = setTimeout(() => setShow(true), 0);
    } else {
      timeout = setTimeout(() => setShow(false), 3000);
    }

    return () => clearTimeout(timeout);
  }, [isImporting]);

  const errorMsg =
    errorType === 'expired'
      ? t('urlExpired')
      : errorType === 'network'
        ? t('networkError')
        : t('unknownError');

  const title = isImporting
    ? processType === 'import'
      ? t('importing')
      : t('syncing')
    : errorType
      ? t('failed')
      : processType === 'import'
        ? t('importComplete')
        : t('syncComplete');

  const message = errorType
    ? errorMsg
    : isImporting
      ? totalRecord
        ? t('found', { total: totalRecord })
        : t('preparing')
      : totalRecord
        ? t('added', { total: totalRecord })
        : t('noNewRecords');

  const displayClass = show
    ? 'translate-y-0 opacity-100 pointer-events-auto'
    : '-translate-y-full opacity-0 pointer-events-none';

  const coloringClass = isImporting
    ? 'bg-neutral-800/95 text-yellow-300'
    : errorType
      ? 'bg-red-950/95 text-red-300'
      : 'bg-emerald-950/95 text-emerald-300';

  return (
    <div
      role={errorType ? 'alert' : 'status'}
      aria-live={errorType ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={clsx(
        'fixed top-17 left-1/2 z-60 flex w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 items-start gap-3 overflow-hidden rounded-xl p-3 shadow-xl shadow-black/30 backdrop-blur-md transition-all duration-300 ease-out sm:top-18 sm:p-4',
        coloringClass,
        displayClass
      )}
    >
      <div
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          isImporting
            ? 'bg-yellow-400/15'
            : errorType
              ? 'bg-red-400/15'
              : 'bg-emerald-400/15'
        )}
      >
        {isImporting ? (
          <FaSyncAlt className="animate-spin" aria-hidden="true" />
        ) : errorType ? (
          <FaCircleExclamation aria-hidden="true" />
        ) : (
          <FaCheck aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm leading-tight font-semibold text-white">
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-white/65 sm:text-sm">
          {message}
        </p>
      </div>

      {isImporting && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/5">
          <div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-yellow-300" />
        </div>
      )}
    </div>
  );
};
