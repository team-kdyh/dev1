import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../catalog.js';
import { createInitialMemory, evaluateAi } from '../controller.js';
import { XorShift32 } from '../rng.js';
import { snapshot } from './fixtures.js';

describe('AI controller', () => {
  it('produces the same command sequence for the same seed', () => {
    const run = (): string[] => {
      const rng = new XorShift32(12345);
      let memory = createInitialMemory();
      const commands: string[] = [];
      for (let tick = 0; tick <= 240; tick += 1) {
        const result = evaluateAi({ snapshot: snapshot({ tick }), playerId: 'p0', difficulty: 'normal', catalog: defaultCatalog, memory, rng });
        memory = result.memory;
        if (result.command) commands.push(JSON.stringify(result.command));
      }
      return commands;
    };
    expect(run()).toEqual(run());
    expect(run().length).toBeGreaterThan(0);
  });

  it('delays normal AI commands instead of returning them on evaluation tick', () => {
    const rng = new XorShift32(7);
    let memory = createInitialMemory();
    const first = evaluateAi({ snapshot: snapshot({ tick: 0 }), playerId: 'p0', difficulty: 'normal', catalog: defaultCatalog, memory, rng });
    expect(first.command).toBeUndefined();
    memory = first.memory;
    expect(memory.pendingCommands[0]?.executeTick).toBe(36);
    const due = evaluateAi({ snapshot: snapshot({ tick: 36 }), playerId: 'p0', difficulty: 'normal', catalog: defaultCatalog, memory, rng });
    expect(due.command?.tick).toBe(36);
  });
});
