import { LOGICAL_MAX, type PlayerId, type UnitSnapshot } from '../sim/contracts';

type FrontlineState = {
  readonly me: PlayerId;
  readonly units: readonly Pick<UnitSnapshot, 'owner' | 'x'>[];
};

/** 아군 선두가 화면에 남도록 추적하다가 교전이 가까워지면 두 진영 사이를 본다. */
export function frontlineTarget(snapshot: FrontlineState, visibleLogical: number): number {
  const dir = snapshot.me === 0 ? 1 : -1;
  let allyFront = Number.NEGATIVE_INFINITY;
  let enemyFront = Number.POSITIVE_INFINITY;
  for (const unit of snapshot.units) {
    const position = unit.x * dir;
    if (unit.owner === snapshot.me) allyFront = Math.max(allyFront, position);
    else enemyFront = Math.min(enemyFront, position);
  }
  if (allyFront === Number.NEGATIVE_INFINITY) return snapshot.me === 0 ? 0 : LOGICAL_MAX;
  if (enemyFront === Number.POSITIVE_INFINITY) return allyFront * dir;

  const gap = Math.max(0, enemyFront - allyFront);
  const target = allyFront + Math.min(gap / 2, Math.max(0, visibleLogical) * 0.26);
  return target * dir;
}
