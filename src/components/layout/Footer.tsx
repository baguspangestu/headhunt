import { CONFIG } from '@/config';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export const Footer = () => {
  const t = useTranslations('App');
  const isCommitBuild = /^[0-9a-f]{7}$/i.test(CONFIG.buildId);
  const buildUrl = isCommitBuild
    ? `${CONFIG.repositoryUrl}/commit/${CONFIG.buildId}`
    : CONFIG.repositoryUrl;

  return (
    <footer className="w-full bg-neutral-800/80 p-4 lg:rounded-xl">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-between gap-2 text-center text-sm text-white/80 lg:flex-row">
          <div className="text-center lg:text-left">
            <p>{`${CONFIG.appName} ${t('disclaimerP1')}`}</p>
            <p>{t('disclaimerP2')}</p>
          </div>
          <div className="text-center lg:text-right">
            <div className="flex justify-center gap-2 lg:justify-end">
              <Link
                href="/privacy-policy"
                className="duration-300 hover:text-yellow-500"
              >
                {t('privacyPolicy')}
              </Link>
              <span aria-hidden="true">•</span>
              <Link
                href="/terms-of-service"
                className="duration-300 hover:text-yellow-500"
              >
                {t('termsOfService')}
              </Link>
              {/* •
              <Link
                href={CONFIG.discordUrl}
                target="_blank"
                className="hover:text-yellow-500 duration-300"
              >
                Discord
              </Link> */}
            </div>
            <div className="flex items-center justify-center gap-1 lg:justify-end">
              <span>{t('build')}:</span>
              <Link
                href={buildUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-white/90 transition-colors hover:text-yellow-400"
              >
                {CONFIG.buildId}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
