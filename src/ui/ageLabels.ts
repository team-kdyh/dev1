import agesSource from '../data/balance/ages.json';

/**
 * 티어 해금 조건의 표시 문구. (§4.1 "미해금 → 자물쇠, 조건 툴팁")
 *
 * 문구를 코드에 적지 않는다 — 시대 이름과 해금 티어는 전부 C의 `ages.json`에서 읽는다.
 * 데이터에 없는 티어면 아무것도 표시하지 않는다(지어내지 않는다).
 */

interface AgeSource {
  readonly age: number;
  readonly name: string;
  readonly tiers: readonly number[];
  readonly cost: number;
}

const AGES = (agesSource.ages as AgeSource[]) ?? [];

/** 티어 → 그 티어가 열리는 시대. 없으면 undefined. */
const AGE_OF_TIER = new Map<number, AgeSource>();
for (const age of AGES) {
  for (const tier of age.tiers) AGE_OF_TIER.set(tier, age);
}

/**
 * 이 티어를 쓰려면 무엇이 필요한가.
 * @returns 표시할 문구, 또는 데이터로 알 수 없으면 null
 */
export function unlockHint(tier: number): string | null {
  const age = AGE_OF_TIER.get(tier);
  if (!age) return null;
  return `${age.name} 필요`;
}

/** 현재 시대(0-base)에서 이 티어까지 몇 시대를 더 올려야 하는가. 모르면 null. */
export function agesAway(tier: number, currentAge: number): number | null {
  const age = AGE_OF_TIER.get(tier);
  if (!age) return null;
  return Math.max(0, age.age - 1 - currentAge);
}
