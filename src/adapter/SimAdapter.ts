import type { Command, SimEvent, Snapshot } from '../sim/contracts';

/**
 * 계약 상수의 A측 사본.
 *
 * §10은 `contracts.ts`에서 **타입만** import하라고 못박았다. 상수는 값이므로
 * 여기에 복제한다. B가 TICK_HZ나 논리 좌표계 상한을 바꾸면 이 값도 같이 고쳐야 한다.
 * (M0 3일차 계약 회의 안건: 상수도 계약에 포함시킬지)
 */
export const TICK_HZ = 30;
export const TICK_MS = 1000 / TICK_HZ;
export const LOGICAL_MAX = 1000;

/** 명세 §1의 인터페이스. 여기에 메서드를 늘리지 않는다. */
export interface SimAdapter {
  getSnapshot(): Snapshot;
  send(cmd: Command): void;
  start(): void;
  stop(): void;
  onEvents(cb: (events: SimEvent[]) => void): void;
  /**
   * §3의 "T9 스폰은 0.5초 슬로우"와 §6 gameOver 슬로우모션을 위해 필요하다.
   * §1 인터페이스에는 없는 항목이라 optional로 둔다 — 미지원 어댑터는 무시해도 된다.
   */
  setTimeScale?(scale: number): void;
}

/**
 * 누적 시간 기반 고정 스텝 루프. (명세 §1.2)
 * setInterval을 쓰지 않는 이유는 브라우저가 탭 비활성 시 interval을 늘려 틱이 밀리기 때문.
 */
export class FixedStepLoop {
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;
  timeScale = 1;

  /** 한 프레임에 따라잡을 수 있는 최대 틱 수 — 스파이럴 오브 데스 방지 */
  private readonly maxCatchUp = 5;

  constructor(
    private readonly tickMs: number,
    private readonly onStep: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      this.advance(now - this.lastTime);
      this.lastTime = now;
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private advance(deltaTime: number): void {
    // 탭 복귀 등으로 델타가 폭발하면 잘라낸다.
    this.accumulator += Math.min(deltaTime, 250) * this.timeScale;
    let steps = 0;
    while (this.accumulator >= this.tickMs && steps < this.maxCatchUp) {
      this.onStep();
      this.accumulator -= this.tickMs;
      steps += 1;
    }
    if (steps === this.maxCatchUp) this.accumulator = 0;
  }
}
