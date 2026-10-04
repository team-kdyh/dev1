import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SimEvent } from '../sim/contracts';
import { BALANCE_DATA, unitsOfFaction } from '../data/balanceData';
import { FakeSimAdapter } from './FakeSimAdapter';

afterEach(() => vi.unstubAllGlobals());

/**
 * 전투가 실제로 일어나는지 지킨다.
 *
 * 대열 규칙(뒤를 기다리기)에 상한이 없으면 교착된다 — 생산이 계속되는 동안
 * 선두 뒤에는 항상 새 낙오자가 생기므로 선두가 영구히 멈춰 서고,
 * 최악의 경우 양측이 아예 만나지 못해 본진만 두들기게 된다.
 * 화면으로는 "느리네" 정도로 보이고 타입 검사로는 전혀 잡히지 않으므로 여기서 막는다.
 */
interface RunResult {
  events: SimEvent[];
  /** 한 번이라도 스냅샷에 투사체가 담겼는가 */
  sawProjectile: boolean;
}

function collectEvents(seed: number, frames: number): RunResult {
  let nextFrame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});

  let now = 0;
  vi.stubGlobal('performance', { now: () => now });

  const events: SimEvent[] = [];
  const adapter = new FakeSimAdapter(BALANCE_DATA, seed);
  adapter.onEvents((batch) => events.push(...batch));

  const roster = unitsOfFaction(BALANCE_DATA, 'semicon').filter((def) => def.tier <= 3);

  let sawProjectile = false;
  adapter.start();
  for (let i = 0; i < frames; i += 1) {
    now += 16.7;
    if (i % 150 === 0) {
      const def = roster[(i / 150) % roster.length];
      if (def) adapter.send({ type: 'SPAWN_UNIT', defId: def.id });
    }
    const frame = nextFrame;
    nextFrame = undefined;
    frame?.(now);
    if (adapter.getSnapshot().projectiles.length > 0) sawProjectile = true;
  }
  adapter.stop();
  return { events, sawProjectile };
}

describe('전투 피드백 이벤트', () => {
  const { events, sawProjectile } = collectEvents(20261004, 4200);
  const kinds = new Set(events.map((event) => event.type));

  it('양쪽 진영이 모두 유닛을 생산한다', () => {
    const owners = new Set(
      events
        .filter((event): event is Extract<SimEvent, { type: 'spawn' }> => event.type === 'spawn')
        .map((event) => event.owner),
    );
    expect(owners.has(0)).toBe(true);
    expect(owners.has(1)).toBe(true);
  });

  it('유닛끼리 교전한다 — 대열 규칙이 교착되지 않는다', () => {
    expect(kinds.has('attack')).toBe(true);
    expect(kinds.has('hit')).toBe(true);
    expect(kinds.has('kill')).toBe(true);
  });

  it('원거리 유닛의 투사체가 스냅샷에 담긴다', () => {
    // 이 브랜치는 투사체를 스냅샷으로 넘긴다(ProjectileLayer.draw).
    // 비어 있으면 기기별 탄환 20여 종이 전부 화면에 나오지 않는다.
    expect(sawProjectile).toBe(true);
  });

  it('원거리 공격과 스킬이 플래그로 구분된다', () => {
    const attacks = events.filter(
      (event): event is Extract<SimEvent, { type: 'attack' }> => event.type === 'attack',
    );
    expect(attacks.length).toBeGreaterThan(0);
    expect(attacks.some((event) => event.ranged)).toBe(true);
    expect(kinds.has('skill')).toBe(true);
  });
});
