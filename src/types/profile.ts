import type { ImportEventItem, ImportRecordItem } from './import';

export type Profile = {
  id: string;
  name?: string;
  stores?: Store;
};

type Store = {
  headhunt?: Headhunt;
};

export type Headhunt = {
  url: string;
  types: Partial<Record<string, TypeItem>>;
  banners: Partial<Record<string, BannerItem>>;
  records: Partial<Record<string, RecordItem[]>>;
  events?: Partial<Record<string, EventItem[]>>;
  eventsBackfillPending?: boolean;
};

export type EventItem = ImportEventItem & { typeId: string };

export type TypeItem = {
  id: string;
  lastRecordId: number;
  r5Pity?: number;
  r6Pity?: number;
} & Detail;

export type BannerItem = {
  id: string;
  typeId: string;
  r5Pity?: number;
  r6Pity?: number;
} & Detail;

type Detail = {
  r4Count: number;
  r5Count: number;
  r6Count: number;
  freeCount: number;
  r5AvgPity: number;
  r6AvgPity: number;
  rateupWin: number;
  rotateWin: number;
  guarantee: number;
};

export type RecordItem = Omit<ImportRecordItem, 'rarity'> & {
  typeId: string;
  pity: number;
  rarity: number;
  result: GachaResult;
};

export enum GachaResult {
  Lose = 0,
  Rotate = 1,
  Rateup = 2,
  Guarantee = 3,
}
