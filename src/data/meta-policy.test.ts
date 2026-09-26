import { describe, expect, it } from 'vitest';
import research from './meta/research_tree.json';
import { isResearchEnabled, parseResearchPolicy, researchForMatch } from './meta-policy.js';

const policy = parseResearchPolicy({
  rankedPolicy: research.rankedPolicy,
  quickMatchPolicy: research.quickMatchPolicy
});

describe('research match policy', () => {
  it('always strips research from ranked matches', () => {
    const purchased = [{ nodeId: 'semicon_initial_capital', level: 3 }];
    expect(isResearchEnabled('ranked', policy)).toBe(false);
    expect(researchForMatch('ranked', policy, purchased)).toEqual([]);
  });

  it('keeps research in quick matches', () => {
    const purchased = [{ nodeId: 'semicon_initial_capital', level: 2 }];
    expect(researchForMatch('quick', policy, purchased)).toEqual(purchased);
  });
});
