import { describe, expect, it } from 'vitest';
import { frontlineTarget } from './frontline';

function field(me: 0 | 1, allyX: number, enemyX: number):
  { me: 0 | 1; units: { owner: 0 | 1; x: number }[] } {
  return {
    me,
    units: [
      { owner: me, x: allyX },
      { owner: me === 0 ? 1 : 0, x: enemyX },
    ],
  };
}

describe('battle camera target', () => {
  it('keeps the advancing ally in view on both sides while the armies are apart', () => {
    expect(frontlineTarget(field(0, 150, 850), 320)).toBeCloseTo(233.2);
    expect(frontlineTarget(field(1, 850, 150), 320)).toBeCloseTo(766.8);
  });

  it('centers a nearby clash', () => {
    expect(frontlineTarget(field(0, 450, 550), 320)).toBe(500);
    expect(frontlineTarget(field(1, 550, 450), 320)).toBe(500);
  });
});
