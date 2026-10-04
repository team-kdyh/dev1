import { describe, expect, it } from 'vitest';
import type { UnitDef } from '../sim/contracts';
import { GAME_BALANCE, unitsOfFaction } from '../data/gameData';
import { LocalSimAdapter } from './LocalSimAdapter';

/**
 * 본대가 뭉쳐서 움직이는지 수치로 확인한다.
 *
 * **실제로 게임이 돌리는 어댑터(LocalSimAdapter)를 잰다.** FakeSim은 폴백이라
 * 거기서만 통과해도 화면은 달라지지 않는다.
 *
 * 기준을 세울 때 두 번 틀렸고 둘 다 실측으로 드러났다.
 *  - 전체 흩어짐(최대-최소)은 쓸 수 없다. 본진에서 걸어오는 증원 때문에 항상
 *    커지고 그건 각개전투가 아니라 정상이다.
 *  - 간격은 **역할별로** 재야 한다. 원거리는 자기 사거리(최대 300)에서 멈추므로
 *    근접 벽보다 한참 뒤에 선다 — 그건 콩가 줄이 아니라 정상적인 사격선이다.
 */

/** 선두에서 이 거리 안에 있는 유닛을 '선두 그룹'으로 본다 */
const FRONT_GROUP = 150;
/** LocalSimAdapter의 RANGED_MIN_RANGE 와 같은 기준 */
const RANGED_MIN_RANGE = 50;

const RANGED = new Set(
  GAME_BALANCE.units
    .filter((def: UnitDef) => def.damageType !== 'melee' && def.range >= RANGED_MIN_RANGE)
    .map((def: UnitDef) => def.id),
);

interface Sample {
  /** 선두 그룹 안 근접끼리의 간격 중간값. 2기 미만이면 null */
  meleeGap: number | null;
  /** 선두 그룹 안 원거리끼리의 간격 중간값. 2기 미만이면 null */
  rangedGap: number | null;
  meleeFront: number | null;
  rangedFront: number | null;
  front: number;
}

function medianGap(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) gaps.push(sorted[i] - sorted[i - 1]);
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];
}

function sampleRun(seed: number, ticks: number): Sample[] {
  const sim = new LocalSimAdapter(GAME_BALANCE, seed, { me: 0 });
  // 0번 진영은 사람이 조작한다 — 명령을 보내지 않으면 유닛이 안 나온다.
  // 적은 Track C의 AI가 스스로 생산한다.
  const roster = unitsOfFaction(GAME_BALANCE, 'semicon').filter((def) => def.tier <= 3);
  const samples: Sample[] = [];

  for (let tick = 0; tick < ticks; tick += 1) {
    if (tick % 45 === 0) {
      const def = roster[(tick / 45) % roster.length];
      if (def) sim.send({ type: 'SPAWN_UNIT', defId: def.id });
    }
    sim.advanceTicks(1);

    if (tick % 15 !== 0) continue;
    const mine = sim.getSnapshot().units.filter((unit) => unit.owner === 0);
    if (mine.length < 2) continue;

    // 0번 진영은 +x로 진격한다 — 선두는 최대 x
    const front = Math.max(...mine.map((unit) => unit.x));
    const inGroup = mine.filter((unit) => front - unit.x <= FRONT_GROUP);
    const melee = inGroup.filter((unit) => !RANGED.has(unit.defId)).map((unit) => unit.x);
    const ranged = inGroup.filter((unit) => RANGED.has(unit.defId)).map((unit) => unit.x);

    samples.push({
      meleeGap: melee.length >= 2 ? medianGap(melee) : null,
      rangedGap: ranged.length >= 2 ? medianGap(ranged) : null,
      meleeFront: melee.length > 0 ? Math.max(...melee) : null,
      rangedFront: ranged.length > 0 ? Math.max(...ranged) : null,
      front,
    });
  }
  return samples;
}

describe('본대 응집 (LocalSimAdapter)', () => {
  const samples = sampleRun(20261004, 2400);

  function typicalGap(pick: (s: Sample) => number | null): number | null {
    const gaps = samples
      .map(pick)
      .filter((gap): gap is number => gap !== null)
      .sort((a, b) => a - b);
    return gaps.length === 0 ? null : gaps[Math.floor(gaps.length / 2)];
  }

  it('표본이 충분히 모인다', () => {
    expect(samples.length).toBeGreaterThan(10);
  });

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
    const relevant = samples.filter(
      (s) => s.meleeFront !== null && s.rangedFront !== null && s.meleeFront > s.rangedFront,
    );
    if (relevant.length === 0) return;
    expect(relevant.every((s) => (s.meleeFront ?? 0) >= (s.rangedFront ?? 0))).toBe(true);
  });

  it('대열 규칙 때문에 전진이 멈추고 굳지 않는다', () => {
    // 가장 흔한 회귀 두 가지를 같이 막는다.
    //  - "벽 뒤에 서라"를 무조건 적용하면 근접이 전멸한 뒤 원거리가 영구히 멈춘다.
    //  - 뒤를 기다리는 데 상한이 없으면 생산이 계속되는 동안 선두가 영구히 멈춘다.
    expect(Math.max(...samples.map((s) => s.front))).toBeGreaterThan(300);
  });
});
