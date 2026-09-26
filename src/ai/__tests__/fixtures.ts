import type { SimulationSnapshot } from '../types.js';

export function snapshot(overrides: Partial<SimulationSnapshot> = {}): SimulationSnapshot {
  return {
    tick: 0,
    tickRate: 30,
    laneLength: 1000,
    players: [
      {
        id: 'p0', faction: 'semicon', cash: 2000, cashRate: 8, supplyUsed: 0, supplyCap: 12,
        age: 2, ageEnteredTick: 0, cumulativeCash: 3000, baseHp: 5000, baseMaxHp: 5000,
        unlockedUnits: ['semicon_t1_buds', 'semicon_t2_watch_medic', 'semicon_t3_aphone', 'semicon_t4_sphone_sniper', 'semicon_t5_fold', 'semicon_t6_tab_artillery'],
        unitCooldowns: {}, strategyCooldowns: {}, upgradeLevels: {}, queueSize: 0
      },
      {
        id: 'p1', faction: 'orchard', cash: 2000, cashRate: 8, supplyUsed: 0, supplyCap: 12,
        age: 2, ageEnteredTick: 0, cumulativeCash: 3000, baseHp: 5000, baseMaxHp: 5000,
        unlockedUnits: ['orchard_t1_airpods', 'orchard_t2_watch_trainer', 'orchard_t3_phone', 'orchard_t4_phone_pro', 'orchard_t5_pad_shield', 'orchard_t6_vision'],
        unitCooldowns: {}, strategyCooldowns: {}, upgradeLevels: {}, queueSize: 0
      }
    ],
    units: [],
    ...overrides
  };
}
