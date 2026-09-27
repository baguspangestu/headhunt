import path from 'node:path';

export const browserConfig = {
  executablePath:
    process.env.CHROME_EXECUTABLE_PATH ??
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  userDataDir:
    process.env.PUPPETEER_USER_DATA_DIR ??
    path.join(process.cwd(), '.data', 'puppeteer-profile'),
} as const;
