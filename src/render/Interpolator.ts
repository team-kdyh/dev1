import type { Snapshot } from '../sim/contracts';
import { TICK_MS } from '../adapter/SimAdapter';

/**
 * 보간. (명세 §2.2 "직전 및 현재 스냅샷을 유지한다")
 *
 * 명세 §1의 SimAdapter에는 getSnapshot()밖에 없으므로 accumulator를 물어볼 수 없다.
 * 대신 tick 번호가 바뀌는 순간을 프론트가 직접 관찰하고, 그 뒤 흐른 시간으로 alpha를 만든다.
 * 어댑터와 렌더러의 rAF 순서에 영향받지 않는다는 이점도 있다.
 */
export class Interpolator {
  private prevSnapshot: Snapshot;
  private currSnapshot: Snapshot;
  private sinceTickMs = 0;

  constructor(initial: Snapshot) {
    this.prevSnapshot = initial;
    this.currSnapshot = initial;
  }

  sample(snapshot: Snapshot, deltaMs: number): void {
    if (snapshot.tick !== this.currSnapshot.tick) {
      this.prevSnapshot = this.currSnapshot;
      this.currSnapshot = snapshot;
      this.sinceTickMs = 0;
    } else {
      this.sinceTickMs += deltaMs;
    }
  }

  get prev(): Snapshot {
    return this.prevSnapshot;
  }

  get curr(): Snapshot {
    return this.currSnapshot;
  }

  /** 0~1. 다음 틱이 늦어져도 1을 넘지 않는다 — 넘으면 유닛이 미래로 미끄러진다. */
  get alpha(): number {
    return Math.min(1, this.sinceTickMs / TICK_MS);
  }
}
