import semicon from './balance/units/semicon.json' with { type: 'json' };
import orchard from './balance/units/orchard.json' with { type: 'json' };
import meta from './balance/meta.json' with { type: 'json' };
import ages from './balance/ages.json' with { type: 'json' };
import upgrades from './balance/upgrades.json' with { type: 'json' };
import strategies from './balance/strategies.json' with { type: 'json' };
import damage from './balance/damage_matrix.json';
import art from '../../assets/manifest.json';
import type { BalanceData, UnitDef } from '../sim/contracts';

type SourceUnit = {
  id: string; faction: string; tier: number; name: string; desc: string;
  cost: number; supply: number; cooldown: number; roles: string[]; skills: string[];
  assets: { sprite: string; sfxAttack: string; sfxDeath: string };
  stats: { hp: number; armor: number; armorClass: NonNullable<UnitDef['armorClass']>; atk: number;
    atkSpeed: number; range: number; moveSpeed: number; dmgType: NonNullable<UnitDef['damageType']>;
    targetType: string; targetPolicy: string; splashRadius?: number };
};

export const FACTION_OF_PLAYER = ['semicon', 'orchard'] as const;

const artIdByTier = new Map<string, string>();
for (const [id, entry] of Object.entries(art.units)) {
  artIdByTier.set(entry.faction + ':' + entry.tier, id);
}

const sourceUnits = [...semicon.units, ...orchard.units] as SourceUnit[];

export const GAME_BALANCE: BalanceData = {
  units: sourceUnits.map((u): UnitDef => {
    const artId = artIdByTier.get(u.faction + ':' + u.tier);
    if (!artId) throw new Error('Missing Track D art for ' + u.id);
    return {
      id: u.id, faction: u.faction, tier: u.tier, name: u.name,
      description: u.desc, cost: u.cost, supply: u.supply,
      buildMs: Math.round(u.cooldown * 1000), cooldownMs: Math.round(u.cooldown * 1000),
      hp: u.stats.hp, dps: u.stats.atk * u.stats.atkSpeed,
      range: u.stats.range, speed: u.stats.moveSpeed,
      attack: u.stats.atk, attackIntervalMs: Math.round(1000 / u.stats.atkSpeed),
      armor: u.stats.armor, armorClass: u.stats.armorClass,
      damageType: u.stats.dmgType, targetType: u.stats.targetType,
      targetPolicy: u.stats.targetPolicy,
      ...(u.stats.splashRadius === undefined ? {} : { splashRadius: u.stats.splashRadius }),
      roles: u.roles, skills: u.skills, artId,
      spriteKey: u.assets.sprite,
      sfxAttackKey: u.assets.sfxAttack,
      sfxDeathKey: u.assets.sfxDeath,
    };
  }),
  ageUpCost: ages.ages.slice(1).map((age) => age.cost),
  cashPerSecond: meta.economy.baseCashPerSecond,
  startCash: meta.economy.startCash,
  cashCap: meta.economy.cashCap,
  supplyMax: meta.supply.base,
  baseHp: meta.bases.hp,
  queueMax: 5,
  ages: ages.ages,
  upgrades: upgrades.upgrades.map((u) => ({ ...u, cost: u.costs[0] ?? 0 })),
  strategies: strategies.strategies.map((s) => ({
    id: s.id, faction: s.faction, name: s.name, cooldownMs: s.cooldown * 1000,
    effects: s.effects,
  })),
  damageMatrix: damage.matrix,
  baseTurretDps: meta.bases.turret.dpsByLevel,
  baseTurretRange: meta.bases.turret.range,
};

export function unitsOfFaction(balance: BalanceData, faction: string): UnitDef[] {
  return balance.units.filter((u) => u.faction === faction).sort((a, b) => a.tier - b.tier);
}

export function findUnitDef(balance: BalanceData, id: string): UnitDef | undefined {
  return balance.units.find((u) => u.id === id);
}

export function artIdOf(gameId: string): string {
  const unit = GAME_BALANCE.units.find((u) => u.id === gameId);
  if (!unit?.artId) throw new Error('Missing art mapping for ' + gameId);
  return unit.artId;
}
