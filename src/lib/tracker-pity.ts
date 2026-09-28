import { HeadhuntTypeId } from '@/data/tracker/headhunt-types';

export type PityState = { pity5: number; pity6: number };
export type GuaranteeState = { pullCount: number; hasRateup: boolean };

export const usesBannerPity = (typeId: string) =>
  typeId === HeadhuntTypeId.Weponbox ||
  typeId === HeadhuntTypeId.Joint ||
  typeId === HeadhuntTypeId.RerunWpn;

export const supportsRotate = (typeId: string) =>
  typeId === HeadhuntTypeId.Special;

export const getGuaranteeKey = (typeId: string, bannerId: string) => {
  if (
    typeId !== HeadhuntTypeId.RerunChr &&
    typeId !== HeadhuntTypeId.RerunWpn
  ) {
    return bannerId;
  }

  // Carry the rate-up guarantee across versions of one pool ID. A future
  // cross-pool series needs an explicit mapping, not a matching display name.
  return `${typeId}:${bannerId}`;
};

export const advancePity = (previous: PityState, rarity: number) => {
  const pity5 = previous.pity5 + 1;
  const pity6 = previous.pity6 + 1;

  if (rarity === 6) {
    return { pity: pity6, state: { pity5, pity6: 0 } };
  }
  if (rarity === 5) {
    return { pity: Math.min(pity5, pity6), state: { pity5: 0, pity6 } };
  }
  return { pity: 1, state: { pity5, pity6 } };
};

export const advanceGuarantee = (
  previous: GuaranteeState,
  isRateup: boolean,
  guaranteeAt?: number
) => {
  const pullCount = previous.pullCount + 1;
  return {
    guaranteed:
      isRateup &&
      pullCount === (guaranteeAt ?? Infinity) &&
      !previous.hasRateup,
    state: {
      pullCount,
      hasRateup: previous.hasRateup || isRateup,
    },
  };
};
