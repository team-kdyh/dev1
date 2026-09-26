import type {
  AiCatalog,
  AiContext,
  AiStrategy,
  Command,
  PlayerId,
  PlayerSnapshot,
  SimulationSnapshot,
  UnitDefinition,
  UnitRole,
  WeightedAction
} from './types.js';

function command(tick: number, playerId: PlayerId, cmd: Command['cmd'], payload: Command['payload']): Command {
  return { tick, playerId, cmd, payload };
}

function playerOf(snapshot: SimulationSnapshot, playerId: PlayerId): PlayerSnapshot {
  const player = snapshot.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error(`Player ${playerId} was not found.`);
  return player;
}

function canAgeUp(player: PlayerSnapshot, snapshot: SimulationSnapshot, catalog: AiCatalog): { age: number; cost: number } | undefined {
  const next = catalog.ages.find((definition) => definition.age === player.age + 1);
  if (!next || player.cash < next.cost || player.cumulativeCash < next.cumulativeCashRequired) return undefined;
  if (next.previousAgeSecondsRequired !== undefined) {
    const ageTicks = snapshot.tick - (player.ageEnteredTick ?? snapshot.tick);
    if (ageTicks < next.previousAgeSecondsRequired * snapshot.tickRate) return undefined;
  }
  return { age: next.age, cost: next.cost };
}

function baseUnitWeight(unit: UnitDefinition, strategy: AiStrategy): number {
  const lowTierBonus = Math.max(0, 5 - unit.tier) * 4;
  const highTierBonus = unit.tier * 3;
  const has = (role: UnitRole): boolean => unit.roles.includes(role);
  switch (strategy) {
    case 'DEFEND': return 20 + lowTierBonus + (has('tank') ? 35 : 0) + (has('control') ? 18 : 0) + (has('support') ? 12 : 0);
    case 'BUILD': return 8 + lowTierBonus + (has('support') ? 10 : 0);
    case 'PRESSURE': return 15 + highTierBonus + (has('ranged') ? 14 : 0) + (has('control') ? 12 : 0);
    case 'PUSH': return 15 + highTierBonus + (has('siege') ? 40 : 0) + (has('ultimate') ? 25 : 0);
  }
}

function dominantCounterKey(context: AiContext): string | undefined {
  if (context.enemyComp.ultimate > 0) return 'ultimate';
  const candidates: Array<[string, number]> = [
    ['tank_heavy', context.enemyComp.tank],
    ['melee_heavy', context.enemyComp.melee],
    ['ranged_heavy', context.enemyComp.ranged],
    ['siege_heavy', context.enemyComp.siege]
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return (candidates[0]?.[1] ?? 0) > 0 ? candidates[0]?.[0] : undefined;
}

function counterWeight(unit: UnitDefinition, context: AiContext, catalog: AiCatalog): number {
  const key = dominantCounterKey(context);
  if (!key) return 0;
  return (catalog.counters[key] ?? []).reduce(
    (sum, preference) => sum + (unit.roles.includes(preference.unitRole) ? preference.weight : 0),
    0
  );
}

export function enumerateLegalActions(
  snapshot: SimulationSnapshot,
  playerId: PlayerId,
  catalog: AiCatalog
): WeightedAction[] {
  const player = playerOf(snapshot, playerId);
  const actions: WeightedAction[] = [];

  for (const unit of catalog.units) {
    if (unit.faction !== player.faction) continue;
    if (!player.unlockedUnits.includes(unit.id)) continue;
    if (player.cash < unit.cost || player.supplyCap - player.supplyUsed < unit.supply) continue;
    if ((player.unitCooldowns[unit.id] ?? 0) > 0 || player.queueSize >= 5) continue;
    actions.push({
      command: command(snapshot.tick, playerId, 'SPAWN_UNIT', { unitId: unit.id }),
      weight: 1,
      reason: 'legal unit',
      category: 'unit'
    });
  }

  for (const upgrade of catalog.upgrades) {
    const level = player.upgradeLevels[upgrade.id] ?? 0;
    if (level >= upgrade.maxLevel) continue;
    const cost = upgrade.costs[level];
    if (cost === undefined || player.cash < cost) continue;
    actions.push({
      command: command(snapshot.tick, playerId, 'BUY_UPGRADE', { upgradeId: upgrade.id }),
      weight: 1,
      reason: 'legal upgrade',
      category: 'upgrade'
    });
  }

  const nextAge = canAgeUp(player, snapshot, catalog);
  if (nextAge) {
    actions.push({
      command: command(snapshot.tick, playerId, 'AGE_UP', { age: nextAge.age }),
      weight: 1,
      reason: 'legal age up',
      category: 'age'
    });
  }

  for (const strategy of catalog.strategies) {
    if (strategy.faction !== player.faction || (player.strategyCooldowns[strategy.id] ?? 0) > 0) continue;
    actions.push({
      command: command(snapshot.tick, playerId, 'USE_STRATEGY', { strategyId: strategy.id }),
      weight: 1,
      reason: 'legal strategy',
      category: 'strategy'
    });
  }
  return actions;
}

export function scoreActions(
  actions: readonly WeightedAction[],
  strategy: AiStrategy,
  context: AiContext,
  catalog: AiCatalog,
  useCounters: boolean
): WeightedAction[] {
  const unitsById = new Map(catalog.units.map((unit) => [unit.id, unit]));
  return actions.map((action) => {
    let weight = 1;
    let reason = action.reason;
    if (action.category === 'unit') {
      const unit = unitsById.get(String(action.command.payload.unitId));
      if (unit) {
        weight = baseUnitWeight(unit, strategy) + (useCounters ? counterWeight(unit, context, catalog) : 0);
        weight *= Math.max(0.25, 1 - unit.cost / Math.max(context.cash * 2, 1));
        reason = useCounters ? `${strategy} + counter` : strategy;
      }
    } else if (action.category === 'upgrade') {
      weight = strategy === 'BUILD' ? 65 : strategy === 'DEFEND' && action.command.payload.upgradeId === 'defense_facility' ? 55 : 12;
      reason = `${strategy} upgrade`;
    } else if (action.category === 'age') {
      weight = strategy === 'BUILD' ? 80 : strategy === 'PRESSURE' ? 35 : 8;
      reason = `${strategy} age`;
    } else if (action.category === 'strategy') {
      weight = strategy === 'DEFEND' || strategy === 'PUSH' ? 75 : 20;
      reason = `${strategy} strategy`;
    }
    return { ...action, weight: Math.max(0.01, weight), reason };
  });
}
