import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SimEvent } from '../sim/contracts';
import { GAME_BALANCE, unitsOfFaction } from '../data/gameData';
import { FakeSimAdapter } from './FakeSimAdapter';

afterEach(() => vi.unstubAllGlobals());

/**
 * 전투 피드백이 실제로 발행되는지 지킨다.
 *
 * 계약에 `attack`과 `skill`이 정의돼 있고 GameRenderer가 둘을 받아
 * 공격 애니메이션과 투사체를 띄우는데, FakeSim이 한 번도 내보내지 않던 적이 있다.
 * 그 상태에서는 UnitView의 공격 모션과 ProjectileLayer의 기기별 탄환이
 * 전부 도달 불가 코드가 되고, 화면에서는 유닛이 가만히 서서 HP만 깎인다.
 * 타입 검사로는 잡히지 않으므로 여기서 막는다.
 */
function collectEvents(seed: number, frames: number): SimEvent[] {
  let nextFrame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});

  let now = 0;
  vi.stubGlobal('performance', { now: () => now });

  const events: SimEvent[] = [];
  const adapter = new FakeSimAdapter(GAME_BALANCE, seed);
  adapter.onEvents((batch) => events.push(...batch));

  const roster = unitsOfFaction(GAME_BALANCE, 'semicon').filter((def) => def.tier <= 3);

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
  }
  adapter.stop();
  return events;
}

describe('전투 피드백 이벤트', () => {
  const events = collectEvents(20261004, 4200);
  const kinds = new Set(events.map((event) => event.type));

  it('공격이 일어나면 attack 이벤트가 나온다', () => {
    expect(kinds.has('attack')).toBe(true);
  });

  it('양쪽 진영이 모두 유닛을 생산한다', () => {
    // AI가 한 기도 못 뽑던 버그가 있었다 — FakeSim이 FACTION_OF_PLAYER를
    // placeholderBalance(['blue','red'])에서 가져와 유닛 풀이 빈 배열이 됐다.
    // 적이 없으니 전투가 아예 일어나지 않고 본진만 두들겼다.
    const owners = new Set(
      events
        .filter((event): event is Extract<SimEvent, { type: 'spawn' }> => event.type === 'spawn')
        .map((event) => event.owner),
    );
    expect(owners.has(0)).toBe(true);
    expect(owners.has(1)).toBe(true);
  });

  it('유닛끼리 교전한다 (본진만 때리지 않는다)', () => {
    expect(kinds.has('kill')).toBe(true);
  });

  it('attack 이벤트에 투사체를 쏠 목표 좌표가 담긴다', () => {
    const attacks = events.filter((event) => event.type === 'attack');
    expect(attacks.length).toBeGreaterThan(0);
    // targetX가 없으면 GameRenderer가 투사체를 쏘지 못한다
    expect(attacks.every((event) => event.type === 'attack' && event.targetX !== undefined)).toBe(true);
  });

  it('주기적으로 skill 이벤트가 나온다', () => {
    expect(kinds.has('skill')).toBe(true);
  });

  it('skillId는 밸런스 데이터에 있는 것만 쓴다', () => {
    const known = new Set(GAME_BALANCE.units.flatMap((def) => def.skills ?? []));
    const used = events
      .filter((event): event is Extract<SimEvent, { type: 'skill' }> => event.type === 'skill')
      .map((event) => event.skillId);
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((id) => known.has(id))).toBe(true);
  });

  it('hit 이벤트도 함께 나온다 (피해 표시)', () => {
    expect(kinds.has('hit')).toBe(true);
  });
});
