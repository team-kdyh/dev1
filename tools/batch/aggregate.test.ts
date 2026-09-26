import { describe, expect, it } from 'vitest';
import { createSmokeAdapter } from './adapters/smoke.js';
import { runBatch } from './run-batch.js';

describe('batch runner', () => {
  it('marks smoke output as non-authoritative', async () => {
    const adapter = createSmokeAdapter();
    const result = await runBatch(adapter, [
      { index: 0, seed: 10, p0: { faction: 'semicon', difficulty: 'normal' }, p1: { faction: 'orchard', difficulty: 'normal' }, maxTicks: 14_400 },
      { index: 1, seed: 11, p0: { faction: 'semicon', difficulty: 'normal' }, p1: { faction: 'orchard', difficulty: 'normal' }, maxTicks: 14_400 }
    ]);
    expect(result.summary.matches).toBe(2);
    expect(result.summary.verdict).toBe('NON_AUTHORITATIVE');
    expect(result.summary.warnings[0]).toContain('밸런스 판정');
  });
});
