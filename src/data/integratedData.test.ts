import { describe, expect, it } from 'vitest';
import { BALANCE_DATA } from './balanceData';
import { hasUnitArt, resolveAssetUnitId } from './assetMap';
import { getUnitPreviewFrame } from '../render/unitAssets';

describe('active track data integration', () => {
  it('exposes the complete two-faction, nine-tier roster', () => {
    expect(BALANCE_DATA.units).toHaveLength(18);

    for (const faction of ['semicon', 'orchard']) {
      const units = BALANCE_DATA.units.filter((unit) => unit.faction === faction);
      expect(units.map((unit) => unit.tier).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });

  it('keeps codex copy and skill names from Track C', () => {
    for (const unit of BALANCE_DATA.units) {
      expect(unit.description.length).toBeGreaterThan(0);
      expect(unit.roles.length).toBeGreaterThan(0);
      expect(unit.skills.length).toBeGreaterThan(0);
      expect(unit.skillIds).toHaveLength(unit.skills.length);
      expect(unit.attackIntervalMs).toBeGreaterThan(0);
    }
  });

  it('maps every gameplay unit to one unique Track D character', () => {
    const assetIds = BALANCE_DATA.units.map((unit) => resolveAssetUnitId(unit.id));
    expect(new Set(assetIds).size).toBe(18);

    for (const unit of BALANCE_DATA.units) {
      expect(hasUnitArt(unit.id), unit.id).toBe(true);
      const preview = getUnitPreviewFrame(unit.id);
      expect(preview, unit.id).toBeDefined();
      expect(preview?.frame.w).toBeGreaterThan(0);
      expect(preview?.frame.h).toBeGreaterThan(0);
    }
  });
});
