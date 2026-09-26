import type { RandomSource, WeightedAction } from './types.js';

export function selectWeightedAction(
  actions: readonly WeightedAction[],
  rng: RandomSource
): WeightedAction | undefined {
  const total = actions.reduce((sum, action) => sum + Math.max(0, action.weight), 0);
  if (total <= 0) return undefined;
  let cursor = rng.next() * total;
  for (const action of actions) {
    cursor -= Math.max(0, action.weight);
    if (cursor < 0) return action;
  }
  return actions.at(-1);
}
