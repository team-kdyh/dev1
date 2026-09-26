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
  it('separates melee, bullets, shells, pulses, and skill shots', () => {
    expect(isRangedAttack(unit('semicon_t1_buds'))).toBe(false);
    expect(projectileStyleFor(unit('semicon_t3_aphone'), false)).toBe('bullet');
    expect(projectileStyleFor(unit('semicon_t6_tab_artillery'), false)).toBe('shell');
    expect(projectileStyleFor(unit('semicon_t8_ai_assistant'), false)).toBe('pulse');
    expect(projectileStyleFor(unit('orchard_t9_founder'), true)).toBe('skill');
  });

  it('keeps the shortened ranged roster inside the new 255-unit maximum', () => {
    const ranged = BALANCE_DATA.units.filter(isRangedAttack);
    expect(ranged).toHaveLength(11);
    expect(Math.max(...ranged.map((definition) => definition.range))).toBe(255);
    expect(unit('semicon_t3_aphone').range).toBe(135);
    expect(unit('orchard_t3_phone').range).toBe(145);
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
