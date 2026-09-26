import { Container } from 'pixi.js';
import type { BalanceData, RejectReason, Snapshot, UnitDef } from '../sim/contracts';
import { unitsOfFaction } from '../data/placeholderBalance';
import { BUTTON_GAP, BUTTON_H, BUTTON_W } from './theme';
import { UnitButton } from './UnitButton';

/**
 * 유닛 버튼 바. (§4.1)
 * 비용·이름·인구는 전부 BalanceData에서 읽는다 — UI에 숫자를 적지 않는다.
 */
export class UnitBar {
  readonly root = new Container();
  private readonly buttons: UnitButton[] = [];
  private width = 0;

  constructor(
    balance: BalanceData,
    faction: string,
    private readonly queueMax: number,
    onPress: (def: UnitDef) => void,
  ) {
    const defs = unitsOfFaction(balance, faction);
    defs.forEach((def, i) => {
      const button = new UnitButton(def, i + 1, onPress);
      this.buttons.push(button);
      this.root.addChild(button.root);
    });
    this.width = defs.length * BUTTON_W + (defs.length - 1) * BUTTON_GAP;
  }

  get barWidth(): number {
    return this.width;
  }

  get barHeight(): number {
    return BUTTON_H;
  }

  layout(screenW: number, screenH: number, bottomMargin: number): void {
    const left = Math.round((screenW - this.width) / 2);
    const top = Math.round(screenH - BUTTON_H - bottomMargin);
    this.root.position.set(0, 0);
    this.buttons.forEach((button, i) => {
      button.setPosition(left + i * (BUTTON_W + BUTTON_GAP), top);
    });
  }

  update(snapshot: Snapshot, deltaMs: number): void {
    const player = snapshot.players[snapshot.me];
    const gameOver = snapshot.phase === 'over';
    for (const button of this.buttons) {
      button.update(player, this.queueMax, gameOver, deltaMs);
    }
  }

  /**
   * rejected 이벤트 처리. 버튼을 흔들고, 프론트 판정과 시뮬 판정이
   * 어긋나면 콘솔 경고를 남긴다. (§4.1)
   */
  onRejected(defId: string, reason: RejectReason): void {
    const button = this.buttons.find((b) => b.def.id === defId);
    if (!button) return;
    button.shake();
    if (button.reason !== reason) {
      console.warn(
        `[§4.1 판정 불일치] ${defId}: 프론트=${button.reason ?? '구매가능'} / 시뮬=${reason}`,
      );
    }
  }

  /** 카메라 드래그가 버튼 위에서 시작되지 않게 (HUD는 입력을 먼저 가져간다) */
  hitTest(x: number, y: number): boolean {
    for (const button of this.buttons) {
      const bx = button.root.x;
      const by = button.root.y;
      if (x >= bx && x <= bx + BUTTON_W && y >= by && y <= by + BUTTON_H) return true;
    }
    return false;
  }
}
