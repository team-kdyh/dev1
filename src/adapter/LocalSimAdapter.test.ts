import { describe, expect, it } from 'vitest';
import art from '../../assets/manifest.json';
import audio from '../../assets/audio/manifest.json';
import logical from '../data/assets.manifest.json';
import { GAME_BALANCE } from '../data/gameData';
import { LocalSimAdapter } from './LocalSimAdapter';

describe('merged game contracts', () => {
  it('maps every Track C unit to playable Track D art and sound', () => {
    expect(GAME_BALANCE.units).toHaveLength(18);
    const ids = new Set<string>();
    const resolvedKeys = new Set<string>();
    for (const unit of GAME_BALANCE.units) {
      expect(unit.artId).toBeTruthy();
      expect(art.units[unit.artId as keyof typeof art.units]).toBeDefined();
      const sfx = audio.sfx[unit.artId as keyof typeof audio.sfx];
      expect(sfx).toHaveProperty('attack');
      expect(sfx).toHaveProperty('death');
      expect(sfx).toHaveProperty('skill');
      ids.add(unit.artId!);
      resolvedKeys.add(unit.spriteKey!);
      resolvedKeys.add(unit.sfxAttackKey!);
      resolvedKeys.add(unit.sfxDeathKey!);
    }
    for (const faction of ['semicon', 'orchard']) {
      for (let age = 1; age <= 4; age++) resolvedKeys.add('bases.' + faction + '.age' + age);
    }
    expect(ids.size).toBe(18);
    expect(new Set(logical.keys)).toEqual(resolvedKeys);
    expect(logical.placeholder).toBe(false);
  });

  it('applies Track B input delay and production to both factions', () => {
    for (const [me, id] of [[0, 'semicon_t1_buds'], [1, 'orchard_t1_airpods']] as const) {
      const sim = new LocalSimAdapter(GAME_BALANCE, 42, { me });
      sim.send({ type: 'SPAWN_UNIT', defId: id });
      sim.advanceTicks(1);
      expect(sim.getSnapshot().players[me].queue).toHaveLength(0);
      sim.advanceTicks(1);
      expect(sim.getSnapshot().players[me].queue).toHaveLength(1);
      sim.advanceTicks(60);
      expect(sim.getSnapshot().units.some((unit) => unit.owner === me && unit.defId === id)).toBe(true);
    }
  });

  it('produces deterministic snapshots with the same seed and commands', () => {
    const run = () => {
      const sim = new LocalSimAdapter(GAME_BALANCE, 777);
      sim.send({ type: 'SPAWN_UNIT', defId: 'semicon_t1_buds' });
      sim.advanceTicks(120);
      return sim.getSnapshot();
    };
    expect(run()).toEqual(run());
  });

  it('starts both factions near the same time and reports the actual attack destination', () => {
    for (const me of [0, 1] as const) {
      const sim = new LocalSimAdapter(GAME_BALANCE, 1337, { me, difficulty: 'normal' });
      const spawnTicks = new Map<number, number>();
      let firstAttack: { x: number; targetX?: number } | undefined;
      sim.onEvents((events) => {
        for (const event of events) {
          if (event.type === 'spawn' && !spawnTicks.has(event.owner)) {
            spawnTicks.set(event.owner, sim.getSnapshot().tick);
          }
          if (event.type === 'attack' && !firstAttack) firstAttack = event;
        }
      });
      sim.send({ type: 'SPAWN_UNIT', defId: me === 0 ? 'semicon_t1_buds' : 'orchard_t1_airpods' });
      sim.advanceTicks(30 * 8);
      expect(spawnTicks.get(0)).toBeLessThan(30 * 3);
      expect(spawnTicks.get(1)).toBeLessThan(30 * 3);
      expect(firstAttack?.targetX).toBeTypeOf('number');
      expect(firstAttack?.targetX).not.toBe(firstAttack?.x);
    }
  });
});
