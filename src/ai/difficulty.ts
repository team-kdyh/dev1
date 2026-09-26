import type { DifficultyProfile, RandomSource, WeightedAction } from './types.js';

export function applyDifficultyPolicy(
  actions: readonly WeightedAction[],
  profile: DifficultyProfile,
  rng: RandomSource
): WeightedAction[] {
  const strategyAllowed = rng.next() < profile.strategyUseChance;
  const available = actions.filter((action) => action.category !== 'strategy' || strategyAllowed);
  if (available.length <= 1 || rng.next() < profile.resourceEfficiency) return [...available];

  const sorted = [...available].sort((a, b) => b.weight - a.weight);
  const topCount = Math.max(1, Math.ceil(sorted.length / 3));
  const topCommands = new Set(sorted.slice(0, topCount).map((action) => action.command));
  return available.map((action) => ({
    ...action,
    weight: topCommands.has(action.command) ? action.weight * 0.15 : action.weight * 1.25,
    reason: `${action.reason} + intentional inefficiency`
  }));
}
