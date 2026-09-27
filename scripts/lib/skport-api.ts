import { createHash, createHmac } from 'node:crypto';
import { getSkportCredential } from './skport-session';

const apiOrigin = 'https://zonai.skport.com';

export type SkportApiResponse<T = unknown> = {
  code: number;
  message?: string;
  timestamp?: string;
  data?: T;
};

export type SkportSession = {
  token: string;
  clockOffset: number;
};

export class SkportApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: number,
    message: string
  ) {
    super(`SKPort request failed (${status}, code ${code}): ${message}`);
  }
}

function isAuthenticationError(error: unknown): error is SkportApiError {
  return (
    error instanceof SkportApiError &&
    (error.status === 401 ||
      error.status === 403 ||
      error.code === 401 ||
      error.code === 403 ||
      /not logged in|log.?in|credential|unauthori|expired/i.test(error.message))
  );
}

async function requestJson<T extends SkportApiResponse>(
  url: string,
  headers?: HeadersInit
): Promise<T> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json()) as T;
  if (!response.ok || body.code !== 0) {
    throw new SkportApiError(
      response.status,
      body.code,
      body.message ?? 'Unknown error'
    );
  }
  return body;
}

export async function getSigningSession(): Promise<SkportSession> {
  const response = await requestJson<SkportApiResponse<{ token: string }>>(
    `${apiOrigin}/web/v1/auth/refresh`
  );
  const token = response.data?.token;
  const serverTime = Number(response.timestamp);
  if (typeof token !== 'string' || !token || !Number.isFinite(serverTime)) {
    throw new Error('SKPort did not return a valid signing session');
  }
  return {
    token,
    clockOffset: serverTime - Math.floor(Date.now() / 1000),
  };
}

export async function signedGet<T extends SkportApiResponse>(
  apiPath: string,
  query: URLSearchParams,
  region: string,
  session: SkportSession,
  cred: string,
  deviceId: string
): Promise<T> {
  const queryString = query.toString();
  const timestamp = String(Math.floor(Date.now() / 1000) + session.clockOffset);
  const metadata = JSON.stringify({
    platform: '3',
    timestamp,
    dId: deviceId,
    vName: '1.0.0',
  });
  const digest = createHmac('sha256', session.token)
    .update(apiPath + queryString + timestamp + metadata)
    .digest('hex');
  const sign = createHash('md5').update(digest).digest('hex');
  const url = `${apiOrigin}${apiPath}${queryString ? `?${queryString}` : ''}`;
  return requestJson<T>(url, {
    cred,
    'sk-language': region,
    platform: '3',
    vName: '1.0.0',
    timestamp,
    ...(deviceId ? { dId: deviceId } : {}),
    sign,
  });
}

export async function getAuthenticatedSkportSession(
  validate: (
    cred: string,
    session: SkportSession,
    deviceId: string
  ) => Promise<unknown>
): Promise<{ cred: string; session: SkportSession; deviceId: string }> {
  const deviceId = process.env.SKPORT_DEVICE_ID ?? '';
  const cred = await getSkportCredential(async (candidate) => {
    try {
      const session = await getSigningSession();
      await validate(candidate, session, deviceId);
      return true;
    } catch (error) {
      if (isAuthenticationError(error)) return false;
      throw error;
    }
  });
  return { cred, session: await getSigningSession(), deviceId };
}
