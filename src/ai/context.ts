import type { AiContext, Composition, PlayerId, SimulationSnapshot, UnitRole, UnitSnapshot } from './types.js';

const roles: UnitRole[] = ['melee', 'ranged', 'siege', 'support', 'tank', 'control', 'ultimate'];

function emptyComposition(): Composition {
  return { melee: 0, ranged: 0, siege: 0, support: 0, tank: 0, control: 0, ultimate: 0 };
}

function compositionOf(units: readonly UnitSnapshot[]): Composition {
  const composition = emptyComposition();
  for (const unit of units) {
    for (const role of roles) {
      if (unit.roles.includes(role)) composition[role] += 1;
    }
  }
  return composition;
}

function powerOf(units: readonly UnitSnapshot[]): number {
  return units.reduce((sum, unit) => sum + (Math.max(0, unit.hp) * unit.atk * unit.atkSpeed) / 1000, 0);
}

function physicalFront(
  mine: readonly UnitSnapshot[],
  enemy: readonly UnitSnapshot[],
  playerId: PlayerId,
  laneLength: number
): number {
  if (mine.length === 0 && enemy.length === 0) return laneLength / 2;
  const myLeading = mine.length === 0
    ? undefined
    : playerId === 'p0' ? Math.max(...mine.map((unit) => unit.x)) : Math.min(...mine.map((unit) => unit.x));
  const enemyLeading = enemy.length === 0
    ? undefined
    : playerId === 'p0' ? Math.min(...enemy.map((unit) => unit.x)) : Math.max(...enemy.map((unit) => unit.x));
  if (myLeading === undefined) return enemyLeading ?? laneLength / 2;
  if (enemyLeading === undefined) return myLeading;
  return (myLeading + enemyLeading) / 2;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function buildContext(snapshot: SimulationSnapshot, playerId: PlayerId): AiContext {
  const player = snapshot.players.find((candidate) => candidate.id === playerId);
  const enemyPlayer = snapshot.players.find((candidate) => candidate.id !== playerId);
  if (!player || !enemyPlayer) throw new Error(`AI context requires two players; missing ${playerId}.`);

  const mine = snapshot.units.filter((unit) => unit.ownerId === playerId);
  const enemy = snapshot.units.filter((unit) => unit.ownerId !== playerId);
  const front = physicalFront(mine, enemy, playerId, snapshot.laneLength);
  const normalizedFront = playerId === 'p0' ? front / snapshot.laneLength : (snapshot.laneLength - front) / snapshot.laneLength;
  const myPower = powerOf(mine);
  const enemyPower = powerOf(enemy);
  const powerRatio = enemyPower === 0 ? (myPower === 0 ? 1 : 10) : Math.min(10, myPower / enemyPower);

  return {
    frontLine: clamp01(normalizedFront),
    powerRatio,
    cash: player.cash,
    cashRate: player.cashRate,
    supplyFree: Math.max(0, player.supplyCap - player.supplyUsed),
    enemyComp: compositionOf(enemy),
    myComp: compositionOf(mine),
    timeElapsed: snapshot.tick / snapshot.tickRate,
    myBaseHpRatio: player.baseMaxHp <= 0 ? 0 : clamp01(player.baseHp / player.baseMaxHp),
    enemyBaseHpRatio: enemyPlayer.baseMaxHp <= 0 ? 0 : clamp01(enemyPlayer.baseHp / enemyPlayer.baseMaxHp)
  };
}
