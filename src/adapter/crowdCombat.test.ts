import { describe, expect, it } from 'vitest';
import { GAME_BALANCE } from '../data/gameData';
import { LocalSimAdapter } from './LocalSimAdapter';

/** 아군 충돌 없이 한 지점에서 생산·공격하는 빠른 군단 전투. */
describe('crowded lane combat', () => {
  function stackedBattle(): LocalSimAdapter {
    const balance = {
      ...GAME_BALANCE,
      units: GAME_BALANCE.units.map((unit) => {
        if (unit.id === 'semicon_t1_buds') {
          return { ...unit, cost: 0, buildMs: 1, cooldownMs: 0, speed: 0,
            range: 1000, attackIntervalMs: 100 };
        }
        if (unit.id === 'orchard_t1_airpods') return { ...unit, hp: 10_000 };
        return unit;
      }),
    };
    return new LocalSimAdapter(balance, 42, { me: 0, difficulty: 'easy', timeLimitSeconds: 5 });
  }

  it('deploys multiple allied units on the same spawn coordinate', () => {
    const sim = stackedBattle();
    for (let index = 0; index < 3; index++) {
      sim.send({ type: 'SPAWN_UNIT', defId: 'semicon_t1_buds' });
      sim.advanceTicks(8);
    }
    const mine = sim.getSnapshot().units.filter((unit) => unit.owner === 0);
    expect(mine).toHaveLength(3);
    expect(mine.map((unit) => unit.x)).toEqual([60, 60, 60]);
  });

  it('lets every overlapping unit attack instead of blocking each other', () => {
    const sim = stackedBattle();
    const attackers = new Set<number>();
    sim.onEvents((events) => {
      for (const event of events) {
        if (event.type === 'attack' && event.owner === 0) attackers.add(event.unitId);
      }
    });
    for (let index = 0; index < 3; index++) {
      sim.send({ type: 'SPAWN_UNIT', defId: 'semicon_t1_buds' });
      sim.advanceTicks(8);
    }
    expect(attackers.size).toBe(3);
  });

  it('reaches the first unit clash in under five seconds', () => {
    const sim = new LocalSimAdapter(GAME_BALANCE, 42, { me: 0, difficulty: 'normal' });
    let firstClash: number | undefined;
    sim.onEvents((events) => {
      if (firstClash !== undefined) return;
      if (events.some((event) => event.type === 'attack' &&
        event.targetX !== undefined && event.targetX > 0 && event.targetX < 1000)) {
        firstClash = sim.getSnapshot().elapsedMs / 1000;
      }
    });
    sim.send({ type: 'SPAWN_UNIT', defId: 'semicon_t1_buds' });
    sim.advanceTicks(30 * 5);
    expect(firstClash).toBeDefined();
    expect(firstClash!).toBeLessThan(5);
  });
});
