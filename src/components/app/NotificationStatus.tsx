'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { FaCheck } from 'react-icons/fa';
import { FaCircleExclamation } from 'react-icons/fa6';
import { useTranslations } from 'next-intl';
import { useNotificationStore } from '@/store/useNotificationStore';

export const NotificationStatus = () => {
  const t = useTranslations('NotificationStatus');
  const notification = useNotificationStore((state) => state.notification);
  const clear = useNotificationStore((state) => state.clear);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!notification) return;

    const showTimer = setTimeout(() => setShow(true), 0);
    const hideTimer = setTimeout(() => setShow(false), notification.duration);
    const clearTimer = setTimeout(
      () => clear(notification.id),
      notification.duration + 300
    );

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [clear, notification]);

  return (
    <div
      role={notification?.type === 'error' ? 'alert' : 'status'}
      aria-live={notification?.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={clsx(
        'fixed top-17 left-1/2 z-60 flex w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 items-start gap-3 overflow-hidden rounded-xl p-3 shadow-xl shadow-black/30 backdrop-blur-md transition-all duration-300 ease-out sm:top-18 sm:p-4',
        notification?.type === 'error'
          ? 'bg-red-950/95 text-red-300'
          : 'bg-emerald-950/95 text-emerald-300',
        show && notification
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none -translate-y-full opacity-0'
      )}
    >
      <div
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          notification?.type === 'error' ? 'bg-red-400/15' : 'bg-emerald-400/15'
        )}
      >
        {notification?.type === 'error' ? (
          <FaCircleExclamation aria-hidden="true" />
        ) : (
          <FaCheck aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm leading-tight font-semibold text-white">
          {notification?.title ??
            t(notification?.type === 'error' ? 'error' : 'success')}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-white/65 sm:text-sm">
          {notification?.message}
        </p>
      </div>
    </div>
  );
};
