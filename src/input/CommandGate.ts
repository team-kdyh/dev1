import type { Command } from '../sim/contracts';
import type { SimAdapter } from '../adapter/SimAdapter';

/** 동일 커맨드 중복 전송 차단 (§5) */
const DUPLICATE_BLOCK_MS = 100;

/**
 * 프론트 → 시뮬로 나가는 **유일한 출구**.
 *
 * 키보드와 유닛 버튼이 같은 커맨드를 내므로 차단 창도 공유해야 한다.
 * 각자 따로 갖고 있으면 "버튼 클릭 + 숫자키"가 100ms 안에 두 번 나간다.
 */
export class CommandGate {
  private readonly lastSent = new Map<string, number>();

  constructor(private readonly adapter: SimAdapter) {}

  /** @returns 실제로 보냈으면 true, 중복 차단됐으면 false */
  send(cmd: Command): boolean {
    const key = JSON.stringify(cmd);
    const now = performance.now();
    const last = this.lastSent.get(key);
    if (last !== undefined && now - last < DUPLICATE_BLOCK_MS) return false;
    this.lastSent.set(key, now);
    this.adapter.send(cmd);
    return true;
  }
}
