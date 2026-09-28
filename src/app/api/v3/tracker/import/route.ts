import { TRACKER_CONFIG } from '@/config/tracker';
import { HeadhuntTypeId, headhuntTypes } from '@/data/tracker/headhunt-types';
import { jsonError, jsonSuccess } from '@/lib/api-response';
import { fetchJsonWithRetry } from '@/lib/fetch-json-with-retry';
import { parseJsonRequest } from '@/lib/parse-json-request';
import { importPayloadSchema } from '@/lib/validators/import-payload';
import type {
  DataImportRecordV3,
  GameRecordOperator,
  GameRecordOther,
  GameRecordWeapon,
  ResGameRecord,
} from '@/types/import';

type GameRecord = GameRecordOperator | GameRecordWeapon | GameRecordOther;

const isOperatorDraw = (record: GameRecord): record is GameRecordOperator =>
  record.kind === 'draw' &&
  'charId' in record &&
  typeof record.charId === 'string' &&
  typeof record.rarity === 'number' &&
  'isFree' in record &&
  typeof record.isFree === 'boolean' &&
  typeof record.isNew === 'boolean';

const isWeaponDraw = (record: GameRecord): record is GameRecordWeapon =>
  record.kind === 'draw' &&
  'weaponId' in record &&
  typeof record.weaponId === 'string' &&
  typeof record.rarity === 'number' &&
  typeof record.isNew === 'boolean';

const belongsToType = (record: GameRecord, typeId: HeadhuntTypeId) => {
  if (
    typeId !== HeadhuntTypeId.RerunWpn &&
    typeId !== HeadhuntTypeId.Weponbox
  ) {
    return true;
  }
  const isRerun =
    ('poolType' in record && record.poolType === 'rerun') ||
    record.poolId.startsWith('rerun_wpn_');
  return typeId === HeadhuntTypeId.RerunWpn ? isRerun : !isRerun;
};

export async function POST(req: Request) {
  const processType = new URL(req.url).pathname.endsWith('/sync')
    ? 'sync'
    : 'import';
  const payload = importPayloadSchema.safeParse(await parseJsonRequest(req));
  if (!payload.success) return jsonError('Bad Request');

  const { type_id: typeId, url, last_id: lastId } = payload.data;
  const type = headhuntTypes.find((entry) => entry.id === typeId)!;
  const serverIds =
    url.server === TRACKER_CONFIG.import.autoServerId
      ? TRACKER_CONFIG.import.serverIds
      : [url.server];
  let serverId = serverIds[0];
  let response: ResGameRecord | null = null;

  for (const candidateServerId of serverIds) {
    const recordUrl = new URL(type.endpoint, TRACKER_CONFIG.api.baseUrl);
    recordUrl.search = new URLSearchParams({
      lang: TRACKER_CONFIG.import.language,
      ...(lastId ? { seq_id: String(lastId) } : {}),
      ...(type.poolType ? { pool_type: type.poolType } : {}),
      token: url.token,
      server_id: candidateServerId,
    }).toString();
    response = await fetchJsonWithRetry<ResGameRecord>(recordUrl, {
      context: `tracker.${processType}.v3`,
    });
    if (response?.code === 0) {
      serverId = candidateServerId;
      break;
    }
  }

  if (response?.code === 40100) return jsonError('Invalid Token', 401);
  if (response?.code !== 0) return jsonError('Unknown Error', 500);

  const data: DataImportRecordV3 = {
    list: [],
    events: [],
    hasMore: response.data.hasMore,
    // This cursor must come from the unfiltered page: weapon pools share one endpoint.
    nextId: Number(response.data.list.at(-1)?.seqId) || undefined,
    ...(url.server === TRACKER_CONFIG.import.autoServerId ? { serverId } : {}),
  };

  for (const record of response.data.list) {
    if (!belongsToType(record, type.id)) continue;

    if (record.kind !== 'draw') {
      data.events.push({
        id: Number(record.seqId),
        bannerId: record.poolId,
        kind: record.kind,
        timestamp: Number(record.gachaTs),
        raw: record,
      });
      continue;
    }

    if (isOperatorDraw(record)) {
      data.list.push({
        kind: 'draw',
        id: Number(record.seqId),
        bannerId: record.poolId,
        seriesName: record.poolName,
        poolVersion: record.poolVersion,
        itemId: record.charId,
        rarity: record.rarity,
        isFree: record.isFree,
        isNew: record.isNew,
        timestamp: Number(record.gachaTs),
      });
    } else if (isWeaponDraw(record)) {
      data.list.push({
        kind: 'draw',
        id: Number(record.seqId),
        bannerId: record.poolId,
        seriesName: record.poolName,
        poolVersion: record.poolVersion,
        itemId: record.weaponId,
        rarity: record.rarity,
        isNew: record.isNew,
        timestamp: Number(record.gachaTs),
      });
    }
  }

  return jsonSuccess(data);
}
