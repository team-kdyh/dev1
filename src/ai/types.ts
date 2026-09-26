export type FactionId = 'semicon' | 'orchard';
export type PlayerId = 'p0' | 'p1';
export type AiStrategy = 'DEFEND' | 'BUILD' | 'PRESSURE' | 'PUSH';
export type DifficultyId = 'easy' | 'normal' | 'hard' | 'expert';
export type UnitRole = 'melee' | 'ranged' | 'siege' | 'support' | 'tank' | 'control' | 'ultimate';

export interface UnitStats {
  hp: number;
  armor: number;
  armorClass: 'light' | 'heavy' | 'structure';
  atk: number;
  atkSpeed: number;
  range: number;
  moveSpeed: number;
  dmgType: 'melee' | 'ranged' | 'siege' | 'magic';
  targetType: 'single' | 'splash' | 'pierce' | 'chain';
  splashRadius?: number;
}

export interface UnitDefinition {
  id: string;
  faction: FactionId;
  tier: number;
  name: string;
  desc: string;
  cost: number;
  supply: number;
  cooldown: number;
  roles: UnitRole[];
  stats: UnitStats & { targetPolicy: string };
  skills: string[];
  traits: string[];
  assets: { sprite: string; sfxAttack: string; sfxDeath: string };
}

export interface UnitSnapshot {
  id: number;
  definitionId: string;
  ownerId: PlayerId;
  x: number;
  hp: number;
  maxHp: number;
  atk: number;
  atkSpeed: number;
  roles: UnitRole[];
}

export interface PlayerSnapshot {
  id: PlayerId;
  faction: FactionId;
  cash: number;
  cashRate: number;
  supplyUsed: number;
  supplyCap: number;
  age: number;
  ageEnteredTick?: number;
  cumulativeCash: number;
  baseHp: number;
  baseMaxHp: number;
  unlockedUnits: string[];
  unitCooldowns: Record<string, number>;
  strategyCooldowns: Record<string, number>;
  upgradeLevels: Record<string, number>;
  queueSize: number;
}

export interface SimulationSnapshot {
  tick: number;
  tickRate: number;
  laneLength: number;
  players: readonly PlayerSnapshot[];
  units: readonly UnitSnapshot[];
}

export interface Composition {
  melee: number;
  ranged: number;
  siege: number;
  support: number;
  tank: number;
  control: number;
  ultimate: number;
}

export interface AiContext {
  frontLine: number;
  powerRatio: number;
  cash: number;
  cashRate: number;
  supplyFree: number;
  enemyComp: Composition;
  myComp: Composition;
  timeElapsed: number;
  myBaseHpRatio: number;
  enemyBaseHpRatio: number;
}

export type CommandType =
  | 'SPAWN_UNIT'
  | 'USE_STRATEGY'
  | 'BUY_UPGRADE'
  | 'AGE_UP'
  | 'CANCEL_QUEUE'
  | 'SURRENDER';

export interface Command {
  tick: number;
  playerId: PlayerId;
  cmd: CommandType;
  payload: Record<string, string | number | boolean>;
}

export interface ScheduledCommand {
  executeTick: number;
  command: Command;
}

export interface AiMemory {
  strategy: AiStrategy;
  lastTransitionTick: number;
  nextDecisionTick: number;
  pendingCommands: readonly ScheduledCommand[];
}

export interface DifficultyProfile {
  id: DifficultyId;
  reactionDelaySeconds: number;
  resourceEfficiency: number;
  counterAccuracy: number;
  strategyUseChance: number;
  activeUseChance: number;
}

export interface CounterPreference {
  unitRole: UnitRole;
  weight: number;
}

export type CounterTable = Record<string, CounterPreference[]>;

export interface UpgradeDefinition {
  id: string;
  costs: number[];
  maxLevel: number;
}

export interface StrategyDefinition {
  id: string;
  faction: FactionId;
}

export interface AgeDefinition {
  age: number;
  cost: number;
  cumulativeCashRequired: number;
  previousAgeSecondsRequired?: number;
}

export interface AiCatalog {
  units: readonly UnitDefinition[];
  upgrades: readonly UpgradeDefinition[];
  strategies: readonly StrategyDefinition[];
  ages: readonly AgeDefinition[];
  counters: CounterTable;
  difficulties: Readonly<Record<DifficultyId, DifficultyProfile>>;
  evaluationIntervalTicks: number;
  transitionLockTicks: number;
  pressureCashThreshold: number;
}

export interface RandomSource {
  next(): number;
}

export interface WeightedAction {
  command: Command;
  weight: number;
  reason: string;
  category: 'unit' | 'upgrade' | 'age' | 'strategy';
}
