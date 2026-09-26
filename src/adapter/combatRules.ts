import type { ProjectileStyle, UnitDef } from '../sim/contracts';

export const SKILL_EVERY_ATTACKS = 4;

/** 수치가 짧아져도 기기 고유의 원거리/마법/공성 표현은 유지한다. */
export function isRangedAttack(def: UnitDef): boolean {
  return def.damageType !== 'melee';
}

export function projectileStyleFor(def: UnitDef, skill: boolean): ProjectileStyle {
  if (skill) return 'skill';
  return DEVICE_PROJECTILES[def.id] ?? fallbackProjectile(def);
}

/** 제품의 기능이 탄환의 실루엣만 봐도 읽히도록 유닛별 표현을 고정한다. */
const DEVICE_PROJECTILES: Readonly<Record<string, ProjectileStyle>> = {
  semicon_t2_watch_medic: 'heart',
  semicon_t3_aphone: 'data',
  semicon_t4_sphone_sniper: 'camera',
  semicon_t6_tab_artillery: 'pen',
  semicon_t7_book_station: 'window',
  semicon_t8_ai_assistant: 'ai',
  semicon_t9_chairman: 'command',
  orchard_t2_watch_trainer: 'rings',
  orchard_t3_phone: 'ecosystem',
  orchard_t4_phone_pro: 'lens',
  orchard_t6_vision: 'spatial',
  orchard_t7_air_notebook: 'air',
  orchard_t8_pro_notebook: 'thermal',
  orchard_t9_founder: 'keynote',
};

function fallbackProjectile(def: UnitDef): ProjectileStyle {
  if (def.damageType === 'siege' || def.roles.includes('siege')) return 'shell';
  if (def.damageType === 'magic') return 'pulse';
  return 'bullet';
}

/** 탱커는 공격을 자주 막고, 나머지 유닛도 낮은 확률로 방어 반응을 보여준다. */
export function blockChanceFor(def: UnitDef): number {
  return def.roles.includes('tank') ? 0.55 : 0.08;
}

export function projectileDurationMs(distance: number, style: ProjectileStyle): number {
  const speed = ['camera', 'lens'].includes(style)
    ? 760
    : ['shell', 'pen', 'air', 'thermal'].includes(style)
      ? 380
      : style === 'skill'
        ? 430
        : 520;
  return Math.max(220, Math.min(900, (Math.abs(distance) / speed) * 1000));
}
