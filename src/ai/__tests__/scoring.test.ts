import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../catalog.js';
import { enumerateLegalActions } from '../scoring.js';
import { snapshot } from './fixtures.js';

describe('legal action enumeration', () => {
  it('does not emit unaffordable or supply-blocked unit commands', () => {
    const base = snapshot();
    const state = snapshot({
      players: base.players.map((player) => player.id === 'p0'
        ? { ...player, cash: 0, supplyUsed: 12, supplyCap: 12 }
        : player)
    });
    const actions = enumerateLegalActions(state, 'p0', defaultCatalog);
    expect(actions.some((action) => action.command.cmd === 'SPAWN_UNIT')).toBe(false);
    expect(actions.some((action) => action.command.cmd === 'BUY_UPGRADE')).toBe(false);
  });

  it('honors production queue and unit cooldowns', () => {
    const base = snapshot();
    const state = snapshot({
      players: base.players.map((player) => player.id === 'p0'
        ? { ...player, queueSize: 5, unitCooldowns: { semicon_t1_buds: 30 } }
        : player)
    });
    expect(enumerateLegalActions(state, 'p0', defaultCatalog).some((action) => action.category === 'unit')).toBe(false);
  });
});
