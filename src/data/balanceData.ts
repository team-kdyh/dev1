import agesSource from './balance/ages.json';
import metaSource from './balance/meta.json';
import orchardSkillsSource from './balance/skills/orchard.json';
import semiconSkillsSource from './balance/skills/semicon.json';
import orchardUnitsSource from './balance/units/orchard.json';
import semiconUnitsSource from './balance/units/semicon.json';
import type { BalanceData, UnitDef } from '../sim/contracts';

interface SourceUnit {
  id: string;
  name: string;
  desc: string;
  faction: string;
  tier: number;
  cost: number;
  supply: number;
  cooldown: number;
  roles: string[];
  skills: string[];
  stats: {
    hp: number;
    atk: number;
    atkSpeed: number;
    dmgType: 'melee' | 'ranged' | 'magic' | 'siege';
    range: number;
    moveSpeed: number;
  };
}

interface SourceSkill { id: string; name: string }

const sourceUnits = [
  ...semiconUnitsSource.units,
  ...orchardUnitsSource.units,
] as unknown as SourceUnit[];

const skillNames = new Map(
  ([...semiconSkillsSource.skills, ...orchardSkillsSource.skills] as SourceSkill[])
    .map((skill) => [skill.id, skill.name]),
);

function toClientUnit(unit: SourceUnit): UnitDef {
  return {
    id: unit.id,
    name: unit.name,
    description: unit.desc,
    faction: unit.faction,
    tier: unit.tier,
    cost: unit.cost,
    supply: unit.supply,
    buildMs: Math.round(unit.cooldown * 1000),
    cooldownMs: Math.round(unit.cooldown * 1000),
    hp: unit.stats.hp,
    dps: Number((unit.stats.atk * unit.stats.atkSpeed).toFixed(2)),
    attackIntervalMs: Math.round(1000 / unit.stats.atkSpeed),
    damageType: unit.stats.dmgType,
    range: unit.stats.range,
    speed: unit.stats.moveSpeed,
    roles: unit.roles,
    skillIds: unit.skills,
    skills: unit.skills.map((skillId) => skillNames.get(skillId) ?? skillId),
  };
}

const ageUpCost = agesSource.ages
  .filter((age) => age.age > 1)
  .sort((a, b) => a.age - b.age)
  .map((age) => age.cost);

export const BALANCE_DATA: BalanceData = {
  units: sourceUnits.map(toClientUnit),
  ageUpCost,
  cashPerSecond: metaSource.economy.baseCashPerSecond,
  supplyMax: metaSource.supply.base,
  baseHp: metaSource.bases.hp,
  queueMax: 5,
};

export const FACTION_OF_PLAYER = ['semicon', 'orchard'] as const;

export function unitsOfFaction(balance: BalanceData, faction: string): UnitDef[] {
  return balance.units.filter((unit) => unit.faction === faction).sort((a, b) => a.tier - b.tier);
}

export function findUnitDef(balance: BalanceData, id: string): UnitDef | undefined {
  return balance.units.find((unit) => unit.id === id);
}
