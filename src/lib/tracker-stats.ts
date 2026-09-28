import type { BannerItem, RecordItem, TypeItem } from '@/types/profile';
import { GachaResult } from '@/types/profile';

export const summarizeTrackerRecords = (records: RecordItem[]) =>
  records.reduce(
    (summary, record) => {
      // Backups created before `isFree` was stored use pity 0 for free pulls.
      const isFree = record.isFree === true || record.pity === 0;
      if (isFree) summary.freeCount++;

      if (record.rarity === 4) summary.r4Count++;
      if (record.rarity === 5) {
        summary.r5Count++;
        summary.r5PityTotal += record.pity;
      }
      if (record.rarity === 6) {
        summary.r6Count++;
        summary.r6PityTotal += record.pity;
      }

      if (
        record.result === GachaResult.Rotate ||
        record.result === GachaResult.Rateup
      ) {
        summary.rotateWinCount++;
      }
      if (record.result === GachaResult.Rateup) summary.rateupWinCount++;
      if (record.result === GachaResult.Guarantee) summary.guaranteeCount++;

      return summary;
    },
    {
      r4Count: 0,
      r5Count: 0,
      r6Count: 0,
      freeCount: 0,
      r5PityTotal: 0,
      r6PityTotal: 0,
      rotateWinCount: 0,
      rateupWinCount: 0,
      guaranteeCount: 0,
    }
  );

type AvgInput = { avg?: number; count?: number };
type NewData = { pityCount: number; count: number };

export function combineAverage(oldData: AvgInput, newData: NewData): number {
  const oldAvg = oldData.avg ?? 0;
  const oldCount = oldData.count ?? 0;
  const totalCount = oldCount + newData.count;
  if (totalCount === 0) return 0;
  return (oldAvg * oldCount + newData.pityCount) / totalCount;
}

export function mergeTrackerStats(
  records: RecordItem[],
  oldData: BannerItem | TypeItem | undefined
) {
  const newStats = summarizeTrackerRecords(records);
  const r4Count = (oldData?.r4Count ?? 0) + newStats.r4Count;
  const r5Count = (oldData?.r5Count ?? 0) + newStats.r5Count;
  const r6Count = (oldData?.r6Count ?? 0) + newStats.r6Count;
  const freeCount = (oldData?.freeCount ?? 0) + newStats.freeCount;

  const oldAttempt = (oldData?.r6Count ?? 0) - (oldData?.guarantee ?? 0);
  const oldRotateWinCount = (oldData?.rotateWin ?? 0) * oldAttempt;
  const oldRateupWinCount = (oldData?.rateupWin ?? 0) * oldAttempt;
  const rotateWinCount = oldRotateWinCount + newStats.rotateWinCount;
  const rateupWinCount = oldRateupWinCount + newStats.rateupWinCount;

  const guarantee = (oldData?.guarantee ?? 0) + newStats.guaranteeCount;
  const attempt = r6Count - guarantee;

  const r5AvgPity = combineAverage(
    { avg: oldData?.r5AvgPity, count: oldData?.r5Count },
    { pityCount: newStats.r5PityTotal, count: newStats.r5Count }
  );
  const r6AvgPity = combineAverage(
    { avg: oldData?.r6AvgPity, count: oldData?.r6Count },
    { pityCount: newStats.r6PityTotal, count: newStats.r6Count }
  );

  return {
    r4Count,
    r5Count,
    r6Count,
    freeCount,
    r5AvgPity,
    r6AvgPity,
    rotateWin: attempt > 0 ? rotateWinCount / attempt : 0,
    rateupWin: attempt > 0 ? rateupWinCount / attempt : 0,
    guarantee,
  };
}
