import { setTimeout as delay } from 'node:timers/promises';
import puppeteer, { type Browser } from 'puppeteer-core';
import { browserConfig } from '../config/browser';
import { logger } from './logger';

const guideUrl = 'https://game.skport.com/tools/endfield/build-guide';
const credentialKey = 'SK_OAUTH_CRED_KEY';
const loginTimeoutMs = 10 * 60 * 1000;

async function openGuide(browser: Browser): Promise<void> {
  const page = await browser.newPage();
  await page.goto(guideUrl, { waitUntil: 'domcontentloaded' });
}

async function readCredential(browser: Browser): Promise<string> {
  for (const page of await browser.pages()) {
    if (!page.url().startsWith('https://game.skport.com/')) continue;
    try {
      const credential = await page.evaluate(
        (key) => localStorage.getItem(key),
        credentialKey
      );
      if (credential) return credential.trim();
    } catch {
      // The page may navigate while the user is signing in.
    }
  }
  return '';
}

export async function getSkportCredential(
  validate: (credential: string) => Promise<boolean>
): Promise<string> {
  logger.info('Checking saved SKPort login session');
  const inspectBrowser = await puppeteer.launch({
    ...browserConfig,
    headless: true,
  });
  try {
    await openGuide(inspectBrowser);
    const credential = await readCredential(inspectBrowser);
    if (credential && (await validate(credential))) {
      logger.success('Saved SKPort login session is valid');
      return credential;
    }
  } finally {
    await inspectBrowser.close();
  }

  logger.info('No valid session; opening Chrome for SKPort login');
  logger.info('Please sign in to SKPort in the Chrome window');
  const loginBrowser = await puppeteer.launch({
    ...browserConfig,
    headless: false,
  });
  try {
    await openGuide(loginBrowser);
    const deadline = Date.now() + loginTimeoutMs;
    let lastCheckedCredential = '';
    while (Date.now() < deadline) {
      const credential = await readCredential(loginBrowser);
      if (credential && credential !== lastCheckedCredential) {
        lastCheckedCredential = credential;
        if (await validate(credential)) {
          logger.success('SKPort login verified; closing Chrome');
          return credential;
        }
      }
      await delay(1000);
    }
    throw new Error('SKPort login timed out after 10 minutes');
  } finally {
    await loginBrowser.close();
  }
}
