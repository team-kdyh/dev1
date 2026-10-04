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

  it('counts kill rewards toward age unlocks and resolves a full-health timeout as a draw', () => {
    const sim = new LocalSimAdapter(GAME_BALANCE, 1337, { timeLimitSeconds: 30 });
    let reward = 0;
    sim.onEvents((events) => {
      for (const event of events) {
        if (event.type !== 'kill' || event.owner === 0) continue;
        const def = GAME_BALANCE.units.find((unit) => unit.id === event.defId);
        reward += Math.round((def?.cost ?? 0) * 0.4);
      }
    });
    sim.send({ type: 'SPAWN_UNIT', defId: 'semicon_t1_buds' });
    sim.advanceTicks(30 * 30);
    expect(reward).toBeGreaterThan(0);
    expect(sim.getSnapshot().players[0].cumulativeCash).toBeCloseTo(
      (GAME_BALANCE.startCash ?? 300) + GAME_BALANCE.cashPerSecond * 30 + reward,
    );

    const timeout = new LocalSimAdapter(GAME_BALANCE, 1, {
      timeLimitSeconds: 1, baseHp: 3000, enemyBaseHp: 5000,
    });
    timeout.advanceTicks(30);
    expect(timeout.getSnapshot().phase).toBe('over');
    expect(timeout.getSnapshot().winner).toBeNull();
    const rejected: string[] = [];
    timeout.onEvents((events) => {
      for (const event of events) if (event.type === 'rejected') rejected.push(event.reason);
    });
    timeout.send({ type: 'SPAWN_UNIT', defId: 'semicon_t1_buds' });
    expect(rejected).toEqual(['GAME_OVER']);
  });

  it('applies campaign enemy stat boosts only to enemy units', () => {
    const plain = new LocalSimAdapter(GAME_BALANCE, 42, { me: 0 });
    const boosted = new LocalSimAdapter(GAME_BALANCE, 42, { me: 0, enemyStatMod: 1.2 });
    for (const sim of [plain, boosted]) {
      sim.send({ type: 'SPAWN_UNIT', defId: 'semicon_t1_buds' });
      sim.advanceTicks(60);
    }
    const units = (sim: LocalSimAdapter, owner: 0 | 1) =>
      sim.getSnapshot().units.find((unit) => unit.owner === owner);
    expect(units(boosted, 1)?.maxHp).toBeCloseTo((units(plain, 1)?.maxHp ?? 0) * 1.2);
    expect(units(boosted, 0)?.maxHp).toBe(units(plain, 0)?.maxHp);
  });

  it('brings the scripted final-stage boss onto the battlefield for either faction', () => {
    for (const me of [0, 1] as const) {
      const sim = new LocalSimAdapter(GAME_BALANCE, 42, {
        me, enemyBossAtSeconds: 2, enemyStatMod: 1.2,
      });
      sim.advanceTicks(60);
      const boss = sim.getSnapshot().units.find((unit) => unit.owner !== me && unit.tier === 9);
      expect(boss?.maxHp).toBeCloseTo((me === 0 ? 2400 * 1.2 : 2600 * 1.2 * 1.2));
    }
  });

  it('gives the Semicon final boss a real timed reinforcement skill without consuming supply', () => {
    const sim = new LocalSimAdapter(GAME_BALANCE, 42, {
      me: 1, enemyBossAtSeconds: 2, timeLimitSeconds: 30,
    });
    let reinforced = false;
    sim.onEvents((events) => {
      reinforced ||= events.some((event) => event.type === 'skill' &&
        event.skillId === 'semicon_increase_production');
    });
    sim.advanceTicks(30 * 23);
    expect(reinforced).toBe(true);
    const enemy = sim.getSnapshot().units.filter((unit) => unit.owner === 0);
    expect(enemy.filter((unit) => unit.defId === 'semicon_t3_aphone').length).toBeGreaterThanOrEqual(4);
    expect(sim.getSnapshot().players[0].supply).toBeLessThan(enemy.length);
  });

  it('lets the Orchard final boss stop an advancing army and heal its side once', () => {
    const sim = new LocalSimAdapter(GAME_BALANCE, 42, {
      me: 0, enemyBossAtSeconds: 2, timeLimitSeconds: 60,
    });
    const skills: string[] = [];
    sim.onEvents((events) => {
      for (const event of events) if (event.type === 'skill') skills.push(event.skillId);
    });
    for (let tick = 0; tick < 30 * 45 && sim.getSnapshot().phase === 'playing'; tick++) {
      if (tick % 45 === 0) sim.send({ type: 'SPAWN_UNIT', defId: 'semicon_t1_buds' });
      if (tick % 90 === 0) sim.send({ type: 'SPAWN_UNIT', defId: 'semicon_t3_aphone' });
      sim.advanceTicks(1);
    }
    expect(skills).toContain('orchard_presentation');
    expect(skills.filter((id) => id === 'orchard_one_more_thing')).toHaveLength(1);
  });

  it('spawns short-lived Vision decoys without charging supply', () => {
    const sim = new LocalSimAdapter(GAME_BALANCE, 42, {
      me: 1, startAge: 2, startCash: 1000,
    });
    sim.send({ type: 'SPAWN_UNIT', defId: 'orchard_t6_vision' });
    let visionsAtCast = 0;
    let supplyAtCast = 0;
    sim.onEvents((events) => {
      if (!events.some((event) => event.type === 'skill' && event.skillId === 'orchard_illusion')) return;
      const snapshot = sim.getSnapshot();
      visionsAtCast = snapshot.units.filter((unit) => unit.owner === 1 &&
        unit.defId === 'orchard_t6_vision').length;
      supplyAtCast = snapshot.players[1].supply;
    });
    sim.advanceTicks(30 * 20);
    expect(visionsAtCast).toBe(3);
    expect(supplyAtCast).toBe(2);
  });

  it('temporarily converts an enemy for the Semicon final boss', () => {
    const sim = new LocalSimAdapter(GAME_BALANCE, 42, {
      me: 1, enemyBossAtSeconds: 2, timeLimitSeconds: 60, startCash: 500,
    });
    let convertedId: number | undefined;
    sim.onEvents((events) => {
      if (!events.some((event) => event.type === 'skill' && event.skillId === 'semicon_acquisition')) return;
      convertedId = sim.getSnapshot().units.find((unit) => unit.owner === 0 &&
        unit.defId.startsWith('orchard_'))?.id;
    });
    for (let tick = 0; tick < 30 * 50 && sim.getSnapshot().phase === 'playing'; tick++) {
      if (tick % 45 === 0) sim.send({ type: 'SPAWN_UNIT', defId: 'orchard_t1_airpods' });
      sim.advanceTicks(1);
    }
    expect(convertedId).toBeTypeOf('number');
    expect(sim.getSnapshot().units.some((unit) => unit.id === convertedId)).toBe(false);
  });

  it('finishes a full-length PvE match without invalid resources or health', () => {
    for (const me of [0, 1] as const) {
      const sim = new LocalSimAdapter(GAME_BALANCE, 1337, { me });
      for (let tick = 0; tick < 30 * 480 && sim.getSnapshot().phase === 'playing'; tick++) {
        if (tick % 45 === 0) sim.send({
          type: 'SPAWN_UNIT', defId: me === 0 ? 'semicon_t1_buds' : 'orchard_t1_airpods',
        });
        sim.advanceTicks(1);
      }
      const snapshot = sim.getSnapshot();
      expect(snapshot.phase).toBe('over');
      expect(snapshot.elapsedMs).toBeLessThanOrEqual(480_000);
      for (const player of snapshot.players) {
        expect(Number.isFinite(player.cash)).toBe(true);
        expect(player.cash).toBeGreaterThanOrEqual(0);
        expect(player.baseHp).toBeGreaterThanOrEqual(0);
        expect(player.supply).toBeLessThanOrEqual(player.supplyMax);
      }
    }
  });

  it('lets the AI unlock its second age instead of endlessly buying starter units', () => {
    for (const me of [0, 1] as const) {
      const sim = new LocalSimAdapter(GAME_BALANCE, 1337, { me });
      sim.advanceTicks(30 * 300);
      expect(sim.getSnapshot().players[me === 0 ? 1 : 0].age).toBeGreaterThanOrEqual(2);
    }
  });
});
