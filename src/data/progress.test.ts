import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProgress, sanitizeProgress, saveProgress } from './progress';

afterEach(() => vi.unstubAllGlobals());

describe('campaign progress persistence', () => {
  it('discards corrupt values instead of breaking unlocks or research levels', () => {
    expect(sanitizeProgress({
      rp: Infinity,
      cleared: ['semicon_01', 'semicon_01', 'missing', 42],
      research: { semicon_initial_capital: 99, orchard_cash_rate: -4, unknown: 12 },
    })).toEqual({
      rp: 0,
      cleared: ['semicon_01'],
      research: { semicon_initial_capital: 3, orchard_cash_rate: 0 },
    });
  });

  it('keeps the current session playable when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    expect(saveProgress({ rp: 150, cleared: ['semicon_01'], research: {} })).toBe(false);
    expect(loadProgress()).toEqual({ rp: 150, cleared: ['semicon_01'], research: {} });
  });
});
