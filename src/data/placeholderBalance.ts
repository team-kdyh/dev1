/**
 * 임시 밸런스 데이터. **C의 밸런스 JSON이 나오면 통째로 교체한다.**
 * A 코드 어디에도 이 숫자를 다시 적지 않는다 — 항상 BalanceData를 통해 읽는다.
 */
import type { BalanceData, UnitDef } from '../sim/contracts';

const TIER_NAMES = [
  '클립', '건전지', '쿨러팬', '키캡', '램', '하드디스크', '그래픽카드', '메인보드', '서버랙',
];

function makeUnits(faction: string): UnitDef[] {
  return TIER_NAMES.map((name, i) => {
    const tier = i + 1;
    return {
      id: `${faction}_t${tier}`,
      name: `${name} T${tier}`,
      tier,
      faction,
      cost: 40 + i * i * 22 + i * 40,
      supply: 1 + Math.floor(i / 2),
      buildMs: 900 + i * 260,
      cooldownMs: 400 + i * 220,
      hp: 90 + i * 110,
      dps: 12 + i * 13,
      range: tier >= 4 && tier % 2 === 0 ? 70 : 18,
      speed: 34 - i * 1.6,
    } satisfies UnitDef;
  });
}

export const PLACEHOLDER_BALANCE: BalanceData = {
  units: [...makeUnits('blue'), ...makeUnits('red')],
  ageUpCost: [800, 1800, 3600, 6400],
  cashPerSecond: 8,
  supplyMax: 12,
  baseHp: 1000,
  queueMax: 5,
};

/** 진영별 유닛 목록을 티어 순으로. 유닛 바가 쓴다. */
export function unitsOfFaction(balance: BalanceData, faction: string): UnitDef[] {
  return balance.units.filter((u) => u.faction === faction).sort((a, b) => a.tier - b.tier);
}

export function findUnitDef(balance: BalanceData, id: string): UnitDef | undefined {
  return balance.units.find((u) => u.id === id);
}

export const FACTION_OF_PLAYER = ['blue', 'red'] as const;
