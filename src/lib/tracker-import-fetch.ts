import { fetchWithRetry } from './fetch-with-retry';
import type {
  ImportEventItem,
  ImportRecordItem,
  ResImportRecordV3,
} from '@/types/import';

export type TrackerImportErrorType = 'unknown' | 'expired' | 'network';

export class TrackerImportError extends Error {
  constructor(public readonly type: TrackerImportErrorType) {
    super(type);
    this.name = 'TrackerImportError';
  }
}

type FetchTrackerTypeInput = {
  endpoint: string;
  typeId: string;
  url: URL;
  lastRecordId: number;
  existingEventIds: Set<number>;
  backfillEvents: boolean;
  onRecords: (count: number) => void;
  onServerId: (url: string) => void;
};

export async function fetchTrackerType({
  endpoint,
  typeId,
  url,
  lastRecordId,
  existingEventIds,
  backfillEvents,
  onRecords,
  onServerId,
}: FetchTrackerTypeInput) {
  const records: ImportRecordItem[] = [];
  const events: ImportEventItem[] = [];
  const fetchedRecordIds = new Set<number>();
  let hasMore = true;
  let nextId: number | undefined;

  while (hasMore) {
    let response: Response;
    try {
      response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type_id: typeId,
          url,
          ...(nextId ? { last_id: nextId } : {}),
        }),
      });
    } catch (error) {
      throw new TrackerImportError(
        error instanceof TypeError ? 'network' : 'unknown'
      );
    }
    if (!response.ok) {
      throw new TrackerImportError(
        response.status === 401 ? 'expired' : 'unknown'
      );
    }

    let json: ResImportRecordV3;
    try {
      json = (await response.json()) as ResImportRecordV3;
    } catch (error) {
      throw new TrackerImportError(
        error instanceof TypeError ? 'network' : 'unknown'
      );
    }
    if (json.data.serverId) {
      url.searchParams.set('server_id', json.data.serverId);
      onServerId(url.toString());
    }
    const previousCursor = nextId;
    nextId = json.data.nextId;

    const newRecords = json.data.list.filter(
      (record) => record.id > lastRecordId && !fetchedRecordIds.has(record.id)
    );
    const newEvents = json.data.events.filter(
      (event) =>
        !existingEventIds.has(event.id) &&
        (backfillEvents || event.id > lastRecordId)
    );
    for (const record of newRecords) fetchedRecordIds.add(record.id);
    for (const event of newEvents) existingEventIds.add(event.id);
    records.push(...newRecords);
    events.push(...newEvents);
    onRecords(newRecords.length);

    hasMore = json.data.hasMore;
    if (hasMore && (!nextId || nextId === previousCursor)) {
      throw new TrackerImportError('unknown');
    }
    if (!backfillEvents && nextId && nextId <= lastRecordId) break;
  }

  return { records, events };
}
