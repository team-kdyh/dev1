import type { ProjectileStyle, UnitDef } from '../sim/contracts';

export const SKILL_EVERY_ATTACKS = 4;

/** 짧은 사거리로 조정된 원거리 보병도 투사체 표현은 유지한다. */
export function isRangedAttack(def: UnitDef): boolean {
  return def.range >= 100 || def.roles.includes('ranged');
}

export function projectileStyleFor(def: UnitDef, skill: boolean): ProjectileStyle {
  if (skill) return 'skill';
  if (def.damageType === 'siege' || def.roles.includes('siege')) return 'shell';
  if (def.damageType === 'magic') return 'pulse';
  return 'bullet';
}

/** 탱커는 공격을 자주 막고, 나머지 유닛도 낮은 확률로 방어 반응을 보여준다. */
export function blockChanceFor(def: UnitDef): number {
  return def.roles.includes('tank') ? 0.55 : 0.08;
}

export function projectileDurationMs(distance: number, style: ProjectileStyle): number {
  const speed = style === 'bullet' ? 620 : style === 'shell' ? 360 : style === 'skill' ? 430 : 460;
  return Math.max(220, Math.min(900, (Math.abs(distance) / speed) * 1000));
}
