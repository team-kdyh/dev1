import { describe, expect, it } from 'vitest';
import { desiredStrategy, transitionState } from '../state-machine.js';
import type { AiContext, AiMemory } from '../types.js';

const context: AiContext = {
  frontLine: 0.5, powerRatio: 1, cash: 300, cashRate: 8, supplyFree: 12,
  enemyComp: { melee: 0, ranged: 0, siege: 0, support: 0, tank: 0, control: 0, ultimate: 0 },
  myComp: { melee: 0, ranged: 0, siege: 0, support: 0, tank: 0, control: 0, ultimate: 0 },
  timeElapsed: 0, myBaseHpRatio: 1, enemyBaseHpRatio: 1
};

describe('AI state machine', () => {
  it('uses unambiguous priority at state boundaries', () => {
    expect(desiredStrategy({ ...context, frontLine: 0.299 }, 500)).toBe('DEFEND');
    expect(desiredStrategy({ ...context, frontLine: 0.3 }, 500)).toBe('BUILD');
    expect(desiredStrategy({ ...context, frontLine: 0.75, powerRatio: 1.2, cash: 500 }, 500)).toBe('PRESSURE');
    expect(desiredStrategy({ ...context, frontLine: 0.751, powerRatio: 0.5 }, 500)).toBe('PUSH');
  });

  it('keeps the previous state during the 90 tick lock', () => {
    const memory: AiMemory = { strategy: 'BUILD', lastTransitionTick: 10, nextDecisionTick: 0, pendingCommands: [] };
    const defensive = { ...context, frontLine: 0.1 };
    expect(transitionState(memory, defensive, 99, { transitionLockTicks: 90, pressureCashThreshold: 500 }).strategy).toBe('BUILD');
    expect(transitionState(memory, defensive, 100, { transitionLockTicks: 90, pressureCashThreshold: 500 }).strategy).toBe('DEFEND');
  });
});
