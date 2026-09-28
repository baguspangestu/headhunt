export type ResImportRecord = {
  data: DataImportRecord;
};

export type DataImportRecord = {
  list: ImportRecordItem[];
  hasMore: boolean;
  nextId?: number;
  serverId?: string;
};

export type ImportRecordItem = {
  id: number;
  bannerId: string;
  seriesName?: string;
  /** Edition number within a RE-Factor series; different series may share it. */
  poolVersion?: number | null;
  itemId: string;
  rarity: number;
  isFree?: boolean;
  isNew: boolean;
  timestamp: number;
};

export type ImportEventItem = {
  id: number;
  bannerId: string;
  kind: string;
  timestamp: number;
  raw: GameRecordOther;
};

export type DataImportRecordV3 = Omit<DataImportRecord, 'list'> & {
  list: (ImportRecordItem & { kind: 'draw' })[];
  events: ImportEventItem[];
};

export type ResImportRecordV3 = { data: DataImportRecordV3 };

export type ResGameRecord = {
  code: number;
  data: DataGameRecord;
  msg: string;
};

type DataGameRecord = {
  list: (GameRecordOperator | GameRecordWeapon | GameRecordOther)[];
  hasMore: boolean;
};

export type GameRecordOperator = GameRecordDraw & {
  charId: string;
  charName: string;
  isFree: boolean;
};

export type GameRecordWeapon = GameRecordDraw & {
  poolType: string | null;
  weaponId: string;
  weaponName: string;
  weaponType: string;
};

export type GameRecordOther = GameRecordBase & {
  kind: string;
} & Record<string, unknown>;

type GameRecordDraw = GameRecordBase & {
  kind: 'draw';
  rarity: number;
  isNew: boolean;
};

type GameRecordBase = {
  kind: string;
  poolId: string;
  poolName: string;
  poolVersion: number | null;
  nameText: string | null;
  gachaTs: string;
  seqId: string;
};
