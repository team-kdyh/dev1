import semiconUnits from '../data/balance/units/semicon.json' with { type: 'json' };
import orchardUnits from '../data/balance/units/orchard.json' with { type: 'json' };
import upgrades from '../data/balance/upgrades.json' with { type: 'json' };
import strategies from '../data/balance/strategies.json' with { type: 'json' };
import ages from '../data/balance/ages.json' with { type: 'json' };
import counters from '../data/balance/ai/counters.json' with { type: 'json' };
import difficulties from '../data/balance/ai/difficulties.json' with { type: 'json' };
import meta from '../data/balance/meta.json' with { type: 'json' };
import type { AiCatalog, DifficultyId, DifficultyProfile, UnitDefinition } from './types.js';

const difficultyMap = Object.fromEntries(
  difficulties.difficulties.map((profile) => [profile.id, profile])
) as Record<DifficultyId, DifficultyProfile>;

export const defaultCatalog: AiCatalog = {
  units: [...semiconUnits.units, ...orchardUnits.units] as unknown as UnitDefinition[],
  upgrades: upgrades.upgrades as unknown as AiCatalog['upgrades'],
  strategies: strategies.strategies as unknown as AiCatalog['strategies'],
  ages: ages.ages as unknown as AiCatalog['ages'],
  counters: counters.counters as unknown as AiCatalog['counters'],
  difficulties: difficultyMap,
  evaluationIntervalTicks: meta.ai.evaluationIntervalTicks,
  transitionLockTicks: meta.ai.transitionLockTicks,
  pressureCashThreshold: 500
};
