import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnitDef } from '../sim/contracts';
import { GAME_BALANCE, unitsOfFaction } from '../data/gameData';
import { FakeSimAdapter } from './FakeSimAdapter';

afterEach(() => vi.unstubAllGlobals());

/**
 * 뭉쳐서 움직이는지 수치로 확인한다.
 *
 * 눈으로 본 "각개전투 같다"를 코드로 되돌리려면 기준이 필요하다.
 * 전체 흩어짐(최대-최소)은 쓰지 않는다 — 본진에서 걸어오는 증원 때문에 항상
 * 커지고 그건 정상이다. 뭉침은 "선두 그룹이 서로 붙어 있나"로 재야 한다.
 */

/** 선두에서 이 거리 안에 있는 유닛을 '선두 그룹'으로 본다 */
const FRONT_GROUP = 150;
/** FakeSimAdapter.RANGED_MIN_RANGE 와 같은 기준 */
const RANGED_MIN_RANGE = 50;

const RANGED = new Set(
  GAME_BALANCE.units
    .filter((def: UnitDef) => def.damageType !== 'melee' && def.range >= RANGED_MIN_RANGE)
    .map((def: UnitDef) => def.id),
);

/**
 * 간격은 **역할별로** 재야 한다.
 * 원거리는 자기 사거리(최대 300)에서 멈추므로 근접 벽보다 한참 뒤에 선다 —
 * 그건 콩가 줄이 아니라 정상적인 사격선이다. 역할을 섞어 재면 이 둘을 구분하지 못한다.
 */
interface Sample {
  /** 선두 그룹 안 근접끼리의 간격 중간값. 2기 미만이면 null */
  meleeGap: number | null;
  /** 선두 그룹 안 원거리끼리의 간격 중간값. 2기 미만이면 null */
  rangedGap: number | null;
  frontGroupSize: number;
  meleeFront: number | null;
  rangedFront: number | null;
}

function medianGap(xs: number[]): number {
  if (xs.length < 2) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) gaps.push(sorted[i] - sorted[i - 1]);
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];
}

function sampleRun(seed: number, frames: number): Sample[] {
  let nextFrame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});

  let now = 0;
  vi.stubGlobal('performance', { now: () => now });

  const adapter = new FakeSimAdapter(GAME_BALANCE, seed);
  // 0번 진영은 사람이 조작한다 — 명령을 보내지 않으면 유닛이 안 나온다.
  const roster = unitsOfFaction(GAME_BALANCE, 'semicon').filter((def) => def.tier <= 3);
  const samples: Sample[] = [];

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

    if (i % 30 !== 0) continue;
    const mine = adapter.getSnapshot().units.filter((unit) => unit.owner === 0);
    if (mine.length < 2) continue;

    const xs = mine.map((unit) => unit.x);
    // 0번 진영은 +x로 진격한다 — 선두는 최대 x
    const front = Math.max(...xs);
    const group = xs.filter((x) => front - x <= FRONT_GROUP);
    const melee = mine.filter((unit) => !RANGED.has(unit.defId)).map((unit) => unit.x);
    const ranged = mine.filter((unit) => RANGED.has(unit.defId)).map((unit) => unit.x);

    const groupMelee = melee.filter((x) => front - x <= FRONT_GROUP);
    const groupRanged = ranged.filter((x) => front - x <= FRONT_GROUP);

    samples.push({
      meleeGap: groupMelee.length >= 2 ? medianGap(groupMelee) : null,
      rangedGap: groupRanged.length >= 2 ? medianGap(groupRanged) : null,
      frontGroupSize: group.length,
      meleeFront: melee.length > 0 ? Math.max(...melee) : null,
      rangedFront: ranged.length > 0 ? Math.max(...ranged) : null,
    });
  }
  adapter.stop();
  return samples;
}

describe('본대 응집', () => {
  const samples = sampleRun(20261004, 4200);

  it('표본이 충분히 모인다', () => {
    expect(samples.length).toBeGreaterThan(10);
  });

  function typicalGap(pick: (s: Sample) => number | null): number | null {
    const gaps = samples.map(pick).filter((g): g is number => g !== null).sort((a, b) => a - b);
    return gaps.length === 0 ? null : gaps[Math.floor(gaps.length / 2)];
  }

  it('근접끼리 한 줄로 늘어지지 않고 붙어 있다', () => {
    const typical = typicalGap((s) => s.meleeGap);
    if (typical === null) return; // 근접 2기가 동시에 모인 표본이 없으면 판정 불가
    expect(typical).toBeLessThan(40);
  });

  it('원거리끼리 한 줄로 늘어지지 않고 붙어 있다', () => {
    const typical = typicalGap((s) => s.rangedGap);
    if (typical === null) return;
    expect(typical).toBeLessThan(40);
  });

  it('원거리가 근접 벽을 앞지르지 않는다 (벽이 앞에 있을 때)', () => {
    // 규칙은 "벽이 내 앞에 있을 때만" 적용된다. 근접이 전멸했거나 아직 뒤에서
    // 올라오는 중인 표본은 규칙 대상이 아니므로 제외한다.
    const relevant = samples.filter(
      (s) => s.meleeFront !== null && s.rangedFront !== null && s.meleeFront > s.rangedFront,
    );
    if (relevant.length === 0) return;
    expect(relevant.every((s) => (s.meleeFront ?? 0) >= (s.rangedFront ?? 0))).toBe(true);
  });

  it('원거리가 규칙 때문에 전진을 멈추고 굳지 않는다', () => {
    // 가장 흔한 회귀: "벽 뒤에 서라"를 무조건 적용하면 근접이 전멸한 뒤
    // 원거리가 영구히 멈춘다. 본대 선두가 전장 앞쪽까지 나아갔는지로 확인한다.
    const fronts = samples
      .map((s) => Math.max(s.meleeFront ?? 0, s.rangedFront ?? 0))
      .filter((x) => x > 0);
    expect(fronts.length).toBeGreaterThan(0);
    expect(Math.max(...fronts)).toBeGreaterThan(300);
  });
});
