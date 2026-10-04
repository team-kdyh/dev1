import { describe, expect, it } from 'vitest';
import { hasFactionBgm, hasUnitCombatAudio } from '../audio/AudioDirector';
import { BALANCE_DATA, findUnitDef } from '../data/balanceData';
import { blockChanceFor, isRangedAttack, projectileStyleFor } from './combatRules';

function unit(id: string) {
  const found = findUnitDef(BALANCE_DATA, id);
  if (!found) throw new Error(`missing unit: ${id}`);
  return found;
}

describe('combat presentation rules', () => {
  it('uses device-specific projectiles instead of generic gunfire', () => {
    expect(isRangedAttack(unit('semicon_t1_buds'))).toBe(false);
    expect(projectileStyleFor(unit('semicon_t2_watch_medic'), false)).toBe('heart');
    expect(projectileStyleFor(unit('semicon_t3_aphone'), false)).toBe('data');
    expect(projectileStyleFor(unit('semicon_t6_tab_artillery'), false)).toBe('pen');
    expect(projectileStyleFor(unit('semicon_t8_ai_assistant'), false)).toBe('ai');
    expect(projectileStyleFor(unit('orchard_t2_watch_trainer'), false)).toBe('rings');
    expect(projectileStyleFor(unit('orchard_t4_phone_pro'), false)).toBe('lens');
    expect(projectileStyleFor(unit('orchard_t8_pro_notebook'), false)).toBe('thermal');
    expect(projectileStyleFor(unit('orchard_t9_founder'), true)).toBe('skill');
  });

  it('brings every combat role into a compact readable battle line', () => {
    const ranged = BALANCE_DATA.units.filter(isRangedAttack);
    expect(ranged).toHaveLength(14);
    expect(Math.max(...BALANCE_DATA.units.map((definition) => definition.range))).toBe(75);
    expect(unit('semicon_t3_aphone').range).toBe(32);
    expect(unit('orchard_t3_phone').range).toBe(34);
    expect(isRangedAttack(unit('semicon_t3_aphone'))).toBe(true);
    expect(isRangedAttack(unit('orchard_t3_phone'))).toBe(true);
    expect(new Set(ranged.map((definition) => projectileStyleFor(definition, false))).size).toBe(14);
  });

  it('gives tanks a clearly higher block chance', () => {
    expect(blockChanceFor(unit('semicon_t5_fold'))).toBe(0.55);
    expect(blockChanceFor(unit('orchard_t5_pad_shield'))).toBe(0.55);
    expect(blockChanceFor(unit('semicon_t1_buds'))).toBe(0.08);
  });

  it('resolves attack, death, skill, and layered BGM audio for the full roster', () => {
    for (const definition of BALANCE_DATA.units) {
      expect(hasUnitCombatAudio(definition.id), definition.id).toBe(true);
    }
    expect(hasFactionBgm('semicon')).toBe(true);
    expect(hasFactionBgm('orchard')).toBe(true);
  });
});
