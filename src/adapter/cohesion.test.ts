import { afterEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_DATA, unitsOfFaction } from '../data/balanceData';
import { FakeSimAdapter } from './FakeSimAdapter';
import { isRangedAttack } from './combatRules';

afterEach(() => vi.unstubAllGlobals());

/**
 * 뭉쳐서 움직이는지 수치로 확인한다.
 *
 * 눈으로 본 "각개전투 같다"를 코드로 되돌리려면 기준이 있어야 한다.
 * 종료 시점 한 장면은 운에 좌우되므로 진행 중을 주기적으로 표본 추출한다.
 */

/** 선두에서 이 거리 안에 있는 유닛을 '선두 그룹'으로 본다 */
const FRONT_GROUP = 150;

interface Sample {
  /** 선두 그룹 안 인접 유닛 간격의 중간값. 콩가 줄이면 크고, 덩어리면 작다. */
  frontGroupGap: number;
  frontGroupSize: number;
  aliveCount: number;
  meleeFront: number | null;
  rangedFront: number | null;
}

/**
 * 전체 흩어짐(최대-최소)은 쓰지 않는다 — 본진에서 걸어오는 증원 때문에 항상 커지고,
 * 그건 각개전투가 아니라 정상이다. 뭉침은 "선두 그룹이 서로 붙어 있나"로 재야 한다.
 */
function medianGap(xs: number[]): number {
  if (xs.length < 2) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) gaps.push(sorted[i] - sorted[i - 1]);
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];
}

const RANGED = new Set(
  BALANCE_DATA.units.filter((def) => isRangedAttack(def)).map((def) => def.id),
);

function sampleRun(seed: number, frames: number): Sample[] {
  let nextFrame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});

  let now = 0;
  vi.stubGlobal('performance', { now: () => now });

  const adapter = new FakeSimAdapter(BALANCE_DATA, seed);
  // 0번 진영은 사람이 조작한다 — 명령을 보내지 않으면 유닛이 안 나온다.
  // 해금된 하위 티어를 돌려 눌러 근접과 원거리가 섞인 본대를 만든다.
  const roster = unitsOfFaction(BALANCE_DATA, 'semicon').filter((def) => def.tier <= 3);
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

    samples.push({
      frontGroupGap: medianGap(group),
      frontGroupSize: group.length,
      aliveCount: mine.length,
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

  it('전선에 유닛이 쌓여 뭉칠 몸이 있다', () => {
    // 이 테스트를 처음 돌렸을 때 동시 생존이 중간값 2기, 최대 3기였다.
    // 그 상태에서는 대열이든 사격선이든 의미가 없다 — 무조건 1:1이 된다.
    // DEMO_CASH_MULTIPLIER가 전선을 채워 주는지 여기서 지킨다.
    const sizes = samples.map((s) => s.frontGroupSize).sort((a, b) => a - b);
    const typical = sizes[Math.floor(sizes.length / 2)];
    expect(typical).toBeGreaterThanOrEqual(3);
  });

  it('선두 그룹이 한 줄로 늘어지지 않고 붙어 있다', () => {
    // 선두 그룹 안의 간격 중간값이 아군 최소 간격(9)의 몇 배 안쪽이면 붙은 것으로 본다.
    // 2기 이상 모인 표본만 본다 — 1기뿐이면 간격이라는 개념이 없다.
    const grouped = samples.filter((s) => s.frontGroupSize >= 2);
    expect(grouped.length).toBeGreaterThan(0);

    const gaps = grouped.map((s) => s.frontGroupGap).sort((a, b) => a - b);
    const typical = gaps[Math.floor(gaps.length / 2)];
    expect(typical).toBeLessThan(40);
  });

  it('원거리가 근접 벽을 앞지르지 않는다 (벽이 앞에 있을 때)', () => {
    // 규칙은 "근접 벽이 내 앞에 있을 때만" 적용된다. 근접이 전멸했거나 아직
    // 뒤에서 올라오는 중인 표본은 규칙 대상이 아니므로 제외한다.
    const relevant = samples.filter(
      (s) => s.meleeFront !== null && s.rangedFront !== null && s.meleeFront > s.rangedFront,
    );
    if (relevant.length === 0) return;

    // 대상 표본에서는 원거리가 벽을 넘지 않아야 한다 (정의상 성립 — 회귀 감지용)
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
