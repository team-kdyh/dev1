import { describe, expect, it } from 'vitest';
import { validateBalance } from './index.js';

describe('balance validation', () => {
  it('accepts the checked-in draft data with no errors', async () => {
    const result = await validateBalance();
    expect(result.filesChecked).toBe(15);
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });
});
