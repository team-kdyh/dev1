export type MatchMode = 'campaign' | 'quick' | 'ranked' | 'friendly';

export interface ResearchPolicy {
  rankedPolicy: 'disabled';
  quickMatchPolicy: 'enabled';
}

export interface PurchasedResearch {
  nodeId: string;
  level: number;
}

export function parseResearchPolicy(value: { rankedPolicy: string; quickMatchPolicy: string }): ResearchPolicy {
  if (value.rankedPolicy !== 'disabled' || value.quickMatchPolicy !== 'enabled') {
    throw new Error('Research policy must disable ranked and enable quick matches.');
  }
  return { rankedPolicy: value.rankedPolicy, quickMatchPolicy: value.quickMatchPolicy };
}

export function isResearchEnabled(mode: MatchMode, policy: ResearchPolicy): boolean {
  if (mode === 'ranked') return policy.rankedPolicy !== 'disabled';
  if (mode === 'quick') return policy.quickMatchPolicy === 'enabled';
  return mode === 'campaign' || mode === 'friendly';
}

export function researchForMatch(
  mode: MatchMode,
  policy: ResearchPolicy,
  purchased: readonly PurchasedResearch[]
): readonly PurchasedResearch[] {
  return isResearchEnabled(mode, policy) ? purchased : [];
}
