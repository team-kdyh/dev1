import { Container, Graphics, Text } from 'pixi.js';
import type { BalanceData, RejectReason, Snapshot, UnitDef } from '../sim/contracts';
import { unitsOfFaction } from '../data/gameData';
import { BUTTON_GAP, BUTTON_H, BUTTON_W, COLOR, UI_MONO } from './theme';
import { UnitButton } from './UnitButton';

const PAGE_BUTTON_W = 44;
const LEFT_HUD_WIDTH = 250;
const RIGHT_HUD_WIDTH = 220;

/**
 * 유닛 버튼 바. (§4.1)
 * 비용·이름·인구는 전부 BalanceData에서 읽는다 — UI에 숫자를 적지 않는다.
 */
export class UnitBar {
  readonly root = new Container();
  private readonly buttons: UnitButton[] = [];
  private readonly previous = this.pageButton('‹', () => this.changePage(-1));
  private readonly next = this.pageButton('›', () => this.changePage(1));
  private width = 0;
  private pageStart = 0;
  private pageSize = 0;
  private screenW = 0;
  private screenH = 0;
  private bottomMargin = 0;

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
    this.width = defs.length > 0 ? defs.length * BUTTON_W + (defs.length - 1) * BUTTON_GAP : 0;
    this.root.addChild(this.previous, this.next);
  }

  get barWidth(): number {
    return this.width;
  }

  get barHeight(): number {
    return BUTTON_H;
  }

  layout(screenW: number, screenH: number, bottomMargin: number): void {
    this.screenW = screenW;
    this.screenH = screenH;
    this.bottomMargin = bottomMargin;
    const top = Math.round(screenH - BUTTON_H - bottomMargin);
    const safeLeft = screenW >= 650 ? LEFT_HUD_WIDTH : 12;
    const safeRight = screenW >= 650 ? screenW - RIGHT_HUD_WIDTH : screenW - 12;
    const available = safeRight - safeLeft;

    if (this.width <= available) {
      this.pageStart = 0;
      this.pageSize = this.buttons.length;
      this.previous.visible = false;
      this.next.visible = false;
      const left = Math.round((screenW - this.width) / 2);
      this.buttons.forEach((button, i) => {
        button.root.visible = true;
        button.setPosition(left + i * (BUTTON_W + BUTTON_GAP), top);
      });
      return;
    }

    this.pageSize = Math.max(
      1,
      Math.floor((available - 2 * PAGE_BUTTON_W - BUTTON_GAP) / (BUTTON_W + BUTTON_GAP)),
    );
    this.pageStart = Math.min(this.pageStart, Math.max(0, this.buttons.length - this.pageSize));
    const rowWidth = this.pageSize * BUTTON_W + (this.pageSize - 1) * BUTTON_GAP;
    const totalWidth = rowWidth + 2 * PAGE_BUTTON_W + 2 * BUTTON_GAP;
    const left = safeLeft + Math.round((available - totalWidth) / 2);
    const firstButtonX = left + PAGE_BUTTON_W + BUTTON_GAP;

    this.previous.visible = true;
    this.next.visible = true;
    this.previous.position.set(left, top);
    this.next.position.set(firstButtonX + rowWidth + BUTTON_GAP, top);
    this.previous.alpha = this.pageStart > 0 ? 1 : 0.4;
    this.next.alpha = this.pageStart + this.pageSize < this.buttons.length ? 1 : 0.4;
    this.buttons.forEach((button, i) => {
      const slot = i - this.pageStart;
      button.root.visible = slot >= 0 && slot < this.pageSize;
      if (button.root.visible) button.setPosition(firstButtonX + slot * (BUTTON_W + BUTTON_GAP), top);
    });
  }

  private changePage(direction: number): void {
    const lastStart = Math.max(0, this.buttons.length - this.pageSize);
    this.pageStart = Math.max(0, Math.min(lastStart, this.pageStart + direction * this.pageSize));
    this.layout(this.screenW, this.screenH, this.bottomMargin);
  }

  private pageButton(symbol: string, onPress: () => void): Container {
    const root = new Container();
    const background = new Graphics();
    background.roundRect(0, 0, PAGE_BUTTON_W, BUTTON_H, 8).fill(COLOR.panel);
    background.roundRect(0, 0, PAGE_BUTTON_W, BUTTON_H, 8).stroke({ width: 2, color: COLOR.panelEdge });
    const caption = new Text({
      text: symbol,
      style: { fontFamily: UI_MONO, fontSize: 24, fill: COLOR.text },
    });
    caption.anchor.set(0.5);
    caption.position.set(PAGE_BUTTON_W / 2, BUTTON_H / 2);
    root.addChild(background, caption);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.on('pointertap', onPress);
    root.visible = false;
    return root;
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
      if (!button.root.visible) continue;
      const bx = button.root.x;
      const by = button.root.y;
      if (x >= bx && x <= bx + BUTTON_W && y >= by && y <= by + BUTTON_H) return true;
    }
    for (const pager of [this.previous, this.next]) {
      if (!pager.visible) continue;
      if (x >= pager.x && x <= pager.x + PAGE_BUTTON_W && y >= pager.y && y <= pager.y + BUTTON_H)
        return true;
    }
    return false;
  }
}
