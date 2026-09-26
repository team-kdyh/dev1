import { describe, expect, it } from 'vitest';
import { buildContext } from '../context.js';
import { snapshot } from './fixtures.js';

describe('buildContext', () => {
  it('normalizes the front line from each player perspective', () => {
    const state = snapshot({
      units: [
        { id: 1, definitionId: 'semicon_t5_fold', ownerId: 'p0', x: 350, hp: 900, maxHp: 900, atk: 30, atkSpeed: 0.8, roles: ['melee', 'tank'] },
        { id: 2, definitionId: 'orchard_t5_pad_shield', ownerId: 'p1', x: 550, hp: 850, maxHp: 850, atk: 36, atkSpeed: 0.75, roles: ['melee', 'tank'] }
      ]
    });
    expect(buildContext(state, 'p0').frontLine).toBeCloseTo(0.45);
    expect(buildContext(state, 'p1').frontLine).toBeCloseTo(0.55);
  });

  it('returns a finite neutral power ratio when both armies are empty', () => {
    expect(buildContext(snapshot(), 'p0').powerRatio).toBe(1);
  });

  it('caps the power ratio when only my army exists', () => {
    const state = snapshot({
      units: [{ id: 1, definitionId: 'semicon_t1_buds', ownerId: 'p0', x: 100, hp: 180, maxHp: 180, atk: 14, atkSpeed: 1.1, roles: ['melee'] }]
    });
    expect(buildContext(state, 'p0').powerRatio).toBe(10);
  });
});
