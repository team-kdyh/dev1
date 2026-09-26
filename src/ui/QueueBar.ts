import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { BalanceData, PlayerSnapshot } from '../sim/contracts';
import { findUnitDef } from '../data/placeholderBalance';
import { unitTexture } from '../render/textures';
import { COLOR, UI_MONO } from './theme';

const SLOT = 38;
const GAP = 4;

/**
 * 생산 큐. (명세 §4.2)
 * 유닛 바 위에 최대 5칸. 선두 항목에 진행도를 표시하고, 클릭하면 취소 커맨드를 보낸다.
 * 환불(80%)은 시뮬이 처리한다 — 프론트는 캐시를 건드리지 않는다.
 */
export class QueueBar {
  readonly root = new Container();
  private readonly slots: QueueSlot[] = [];
  private left = 0;
  private top = 0;

  constructor(
    private readonly balance: BalanceData,
    onCancel: (index: number) => void,
  ) {
    for (let i = 0; i < balance.queueMax; i += 1) {
      const slot = new QueueSlot(i, onCancel);
      this.slots.push(slot);
      this.root.addChild(slot.root);
    }
  }

  get barWidth(): number {
    return this.slots.length * SLOT + (this.slots.length - 1) * GAP;
  }

  get barHeight(): number {
    return SLOT;
  }

  layout(screenW: number, bottomY: number): void {
    this.left = Math.round((screenW - this.barWidth) / 2);
    this.top = Math.round(bottomY - SLOT);
    this.slots.forEach((slot, i) => {
      slot.root.position.set(this.left + i * (SLOT + GAP), this.top);
    });
  }

  update(player: PlayerSnapshot): void {
    this.slots.forEach((slot, i) => {
      const item = player.queue[i];
      if (!item) {
        slot.clear();
        return;
      }
      const def = findUnitDef(this.balance, item.defId);
      slot.show(def?.faction ?? 'blue', def?.tier ?? 1, i === 0 ? item.progress : 0);
    });
  }

  hitTest(x: number, y: number): boolean {
    return (
      x >= this.left && x <= this.left + this.barWidth && y >= this.top && y <= this.top + SLOT
    );
  }
}

class QueueSlot {
  readonly root = new Container();
  private readonly frame = new Graphics();
  private readonly icon = new Sprite();
  private readonly progressBg = new Sprite(Texture.WHITE);
  private readonly progressFill = new Sprite(Texture.WHITE);
  private readonly hint: Text;
  private filled = false;

  constructor(index: number, onCancel: (index: number) => void) {
    this.frame.roundRect(0, 0, SLOT, SLOT, 5).fill({ color: COLOR.panel, alpha: 0.85 });
    this.frame.roundRect(0, 0, SLOT, SLOT, 5).stroke({ width: 1, color: COLOR.panelEdge, alignment: 1 });

    this.icon.anchor.set(0.5, 1);
    this.icon.position.set(SLOT / 2, SLOT - 6);

    this.progressBg.tint = 0x000000;
    this.progressBg.alpha = 0.6;
    this.progressBg.width = SLOT - 8;
    this.progressBg.height = 4;
    this.progressBg.position.set(4, SLOT - 5);

    this.progressFill.tint = COLOR.ready;
    this.progressFill.height = 4;
    this.progressFill.position.set(4, SLOT - 5);

    this.hint = new Text({
      text: '×',
      style: { fontFamily: UI_MONO, fontSize: 12, fill: COLOR.danger },
    });
    this.hint.anchor.set(1, 0);
    this.hint.position.set(SLOT - 3, 1);
    this.hint.visible = false;

    this.root.addChild(this.frame, this.icon, this.progressBg, this.progressFill, this.hint);
    this.root.eventMode = 'static';
    this.root.cursor = 'pointer';
    this.root.on('pointerover', () => {
      if (this.filled) this.hint.visible = true;
    });
    this.root.on('pointerout', () => {
      this.hint.visible = false;
    });
    this.root.on('pointertap', () => {
      if (this.filled) onCancel(index);
    });
  }

  show(faction: string, tier: number, progress: number): void {
    this.filled = true;
    this.root.visible = true;
    this.icon.visible = true;
    this.icon.texture = unitTexture(faction, tier);
    const fit = Math.min(22 / this.icon.texture.height, 22 / this.icon.texture.width);
    this.icon.scale.set(fit);

    const showProgress = progress > 0;
    this.progressBg.visible = showProgress;
    this.progressFill.visible = showProgress;
    this.progressFill.width = (SLOT - 8) * Math.min(1, Math.max(0, progress));
  }

  clear(): void {
    this.filled = false;
    this.icon.visible = false;
    this.progressBg.visible = false;
    this.progressFill.visible = false;
    this.hint.visible = false;
    this.root.visible = true;
  }
}
