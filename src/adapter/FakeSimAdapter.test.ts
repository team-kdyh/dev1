import { afterEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_DATA } from '../data/balanceData';
import type { SimEvent } from '../sim/contracts';
import { FakeSimAdapter } from './FakeSimAdapter';

afterEach(() => vi.unstubAllGlobals());

describe('FakeSimAdapter combat loop', () => {
  it('emits attacks and keeps ranged projectiles in snapshots until impact', () => {
    let nextFrame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      nextFrame = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    const events: SimEvent[] = [];
    const adapter = new FakeSimAdapter(BALANCE_DATA, 20260926);
    adapter.onEvents((batch) => events.push(...batch));
    adapter.send({ type: 'SPAWN_UNIT', defId: 'semicon_t3_aphone' });
    adapter.start();

    let now = performance.now();
    let projectileSeen = false;
    for (let frame = 0; frame < 600; frame += 1) {
      const callback = nextFrame;
      if (!callback) break;
      nextFrame = undefined;
      now += 100;
      callback(now);
      projectileSeen ||= adapter.getSnapshot().projectiles.some((projectile) => projectile.style === 'data');
      if (projectileSeen && events.some((event) => event.type === 'skill')) break;
    }
    adapter.stop();

    expect(events.some((event) => event.type === 'attack' && event.ranged)).toBe(true);
    expect(events.some((event) => event.type === 'skill')).toBe(true);
    expect(projectileSeen).toBe(true);
  });
});
