import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { PlayerSnapshot, RejectReason, UnitDef } from '../sim/contracts';
import { unitTexture } from '../render/textures';
import { BUTTON_H, BUTTON_W, COLOR, UI_FONT, UI_MONO } from './theme';

const SHAKE_MS = 260;
const PRESS_MS = 110;

/**
 * 유닛 버튼 한 개. (§4.1)
 *
 * 버튼 활성 상태는 프론트가 계산하지만 **실제 거부는 시뮬이 한다**.
 * 그래서 여기서 계산한 reason은 표시용일 뿐이고, 어긋나면 경고만 남긴다.
 */
export class UnitButton {
  readonly root = new Container();

  private readonly bg = new Graphics();
  private readonly accent = new Graphics();
  private readonly icon = new Sprite();
  private readonly keyHint: Text;
  private readonly costText: Text;
  private readonly supplyText: Text;
  private readonly lock = new Graphics();
  private readonly cooldown = new Graphics();

  private shakeMs = 0;
  private pressMs = 0;
  private baseX = 0;
  private pulseMs = 0;

  /** 프론트가 계산한 현재 거부 사유. null이면 구매 가능. (§4.1) */
  reason: RejectReason | null = null;

  constructor(
    readonly def: UnitDef,
    hotkey: number,
    onPress: (def: UnitDef) => void,
  ) {
    this.bg.roundRect(0, 0, BUTTON_W, BUTTON_H, 8).fill(COLOR.panel);
    this.bg.roundRect(0, 0, BUTTON_W, BUTTON_H, 8).stroke({ width: 3, color: COLOR.panelEdge, alignment: 1 });
    this.accent.roundRect(7, 5, BUTTON_W - 14, 4, 2)
      .fill(def.faction === 'semicon' ? 0x4d7fe4 : 0xff987e);

    this.icon.texture = unitTexture(def.faction, def.tier);
    this.icon.anchor.set(0.5, 1);
    // 큰 원본 아틀라도 생산 카드 안에 들어오도록 맞춘다.
    const fit = Math.min(47 / this.icon.texture.height, 47 / this.icon.texture.width);
    this.icon.scale.set(fit);
    this.icon.position.set(BUTTON_W / 2, BUTTON_H - 16);

    this.keyHint = new Text({
      text: String(hotkey),
      style: { fontFamily: UI_MONO, fontSize: 10, fill: COLOR.textDim },
    });
    this.keyHint.position.set(4, 3);

    this.costText = new Text({
      text: String(def.cost),
      style: { fontFamily: UI_MONO, fontSize: 11, fontWeight: 'bold', fill: COLOR.cash },
    });
    this.costText.anchor.set(0.5, 1);
    this.costText.position.set(BUTTON_W / 2, BUTTON_H - 3);

    this.supplyText = new Text({
      text: `■${def.supply}`,
      style: { fontFamily: UI_MONO, fontSize: 9, fill: COLOR.supply },
    });
    this.supplyText.anchor.set(1, 0);
    this.supplyText.position.set(BUTTON_W - 4, 3);

    this.drawLock();

    this.root.addChild(
      this.bg,
      this.accent,
      this.icon,
      this.keyHint,
      this.costText,
      this.supplyText,
      this.cooldown,
      this.lock,
    );

    this.root.eventMode = 'static';
    this.root.cursor = 'pointer';
    // 반응성은 버튼 애니메이션으로 준다 — 낙관적 상태 변경은 하지 않는다 (§5)
    this.root.on('pointerdown', () => {
      this.pressMs = PRESS_MS;
    });
    // 판정과 무관하게 항상 보낸다 — 거부는 시뮬의 몫이고, 그래야 rejected 연출이 나온다
    this.root.on('pointertap', () => onPress(def));
  }

  setPosition(x: number, y: number): void {
    this.baseX = x;
    this.root.position.set(x, y);
  }

  /** §4.1 표의 판정. 순서는 시뮬의 거부 판정과 같아야 한다. */
  update(player: PlayerSnapshot, queueMax: number, gameOver: boolean, deltaMs: number): void {
    const locked = !player.unlockedTiers.includes(this.def.tier);
    const cdMs = player.cooldowns[this.def.id] ?? 0;

    this.reason = gameOver
      ? 'GAME_OVER'
      : locked
        ? 'LOCKED'
        : player.queue.length >= queueMax
          ? 'QUEUE_FULL'
          : cdMs > 0
            ? 'COOLDOWN'
            : player.cash < this.def.cost
              ? 'NO_CASH'
              : player.supply + this.def.supply > player.supplyMax
                ? 'NO_SUPPLY'
                : null;

    this.lock.visible = locked;
    this.icon.visible = !locked;

    // 흑백 / 컬러
    const grey = this.reason === 'NO_CASH' || this.reason === 'NO_SUPPLY';
    this.icon.tint = grey ? 0x6b7280 : 0xffffff;
    this.root.alpha = locked ? 0.55 : grey ? 0.8 : 1;

    // 비용 빨강 (캐시 부족)
    this.costText.style.fill = this.reason === 'NO_CASH' ? COLOR.danger : COLOR.cash;

    // 인구 아이콘 깜박임
    this.pulseMs += deltaMs;
    this.supplyText.alpha =
      this.reason === 'NO_SUPPLY' ? 0.35 + 0.65 * Math.abs(Math.sin(this.pulseMs * 0.006)) : 1;

    // 구매 가능하면 테두리 발광
    this.bg.tint = this.reason === null ? 0xffffff : 0xb9c2d6;
    this.bg.alpha = this.reason === null ? 1 : 0.9;

    // 쿨다운 원형 진행 오버레이 (§4.1). 반지름을 버튼 안에 맞춰 마스크 없이 그린다.
    // clear/재작성은 쿨다운 중인 버튼(최대 9개)에서만 일어난다.
    this.cooldown.clear();
    if (cdMs > 0 && this.def.cooldownMs > 0) {
      const ratio = Math.min(1, cdMs / this.def.cooldownMs);
      const cx = BUTTON_W / 2;
      const cy = BUTTON_H / 2;
      const radius = Math.min(BUTTON_W, BUTTON_H) / 2 - 1;
      const start = -Math.PI / 2;
      this.cooldown
        .moveTo(cx, cy)
        .arc(cx, cy, radius, start, start + Math.PI * 2 * ratio)
        .fill({ color: 0x000000, alpha: 0.6 });
    }

    if (this.shakeMs > 0) {
      this.shakeMs -= deltaMs;
      const t = Math.max(0, this.shakeMs / SHAKE_MS);
      this.root.x = this.baseX + Math.sin(this.shakeMs * 0.09) * 7 * t;
    } else {
      this.root.x = this.baseX;
    }

    // 누름 반응 (§5). pivot을 중앙에 두면 위치가 흔들리므로 scale만 살짝 준다.
    if (this.pressMs > 0) {
      this.pressMs -= deltaMs;
      const t = Math.max(0, this.pressMs / PRESS_MS);
      this.root.scale.set(1 - 0.06 * t);
    } else {
      this.root.scale.set(1);
    }
  }

  /** rejected 이벤트 수신 시 (§4.1) */
  shake(): void {
    this.shakeMs = SHAKE_MS;
  }

  private drawLock(): void {
    const cx = BUTTON_W / 2;
    const cy = BUTTON_H / 2 - 2;
    this.lock.rect(0, 0, BUTTON_W, BUTTON_H).fill({ color: 0x000000, alpha: 0.45 });
    this.lock.roundRect(cx - 11, cy, 22, 17, 3).fill(COLOR.textDim);
    this.lock
      .arc(cx, cy, 8, Math.PI, 0)
      .stroke({ width: 3, color: COLOR.textDim });
    this.lock.visible = false;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
