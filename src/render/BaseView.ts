import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GROUND_Y } from './coords';
import { baseTexture } from './textures';

const BAR_W = 200;
const BAR_H = 9;
const HIT_FLASH_MS = 90;
const MORPH_MS = 600;

/**
 * 양측 본진. (§2.3 레이어 4)
 *
 * 정식 에셋이 오기 전이라 "균열"은 피해량에 따른 tint 어두워짐으로 대신한다.
 * D의 본진 스프라이트(시대별 4단계 + 균열 오버레이)가 오면 여기만 고친다.
 */
export class BaseView {
  readonly root = new Container();
  private readonly body = new Sprite();
  private readonly core = new Graphics();
  private readonly warning = new Graphics();
  private readonly barBg = new Sprite(Texture.WHITE);
  private readonly barFill = new Sprite(Texture.WHITE);

  private hitMs = 0;
  /** 0 = 멀쩡, 1 = 파괴 직전 */
  private damage = 0;
  /** §6 ageup 본진 모핑 — 정식 시대별 스프라이트가 오기 전까지 크기로 표현한다 */
  private morphMs = 0;
  private ageScale = 1;
  private corePhase = 0;

  constructor(private readonly faction: string, worldX: number) {
    this.body.texture = baseTexture(faction);
    this.body.anchor.set(0.5, 1);
    this.body.y = GROUND_Y;

    this.barBg.anchor.set(0.5, 0.5);
    this.barBg.tint = 0x000000;
    this.barBg.alpha = 0.6;
    this.barBg.width = BAR_W + 3;
    this.barBg.height = BAR_H + 3;
    this.barBg.y = GROUND_Y - 300;

    // 왼쪽 고정 — Graphics 재생성 금지 (§2.4)
    this.barFill.anchor.set(0, 0.5);
    this.barFill.height = BAR_H;
    this.barFill.x = -BAR_W / 2;
    this.barFill.y = this.barBg.y;

    if (faction === 'semicon') {
      this.core.circle(0, 0, 18).stroke({ width: 3, color: 0x76c6ff, alpha: 0.9 });
      this.core.circle(0, 0, 28).stroke({ width: 2, color: 0xffffff, alpha: 0.45 });
      this.core.moveTo(-34, 0).lineTo(34, 0).moveTo(0, -34).lineTo(0, 34)
        .stroke({ width: 2, color: 0x4a9eff, alpha: 0.5 });
      this.warning.moveTo(-48, -174).lineTo(-25, -157).lineTo(-37, -135).lineTo(-9, -112)
        .stroke({ width: 5, color: 0xff4d55, alpha: 0.9 });
      this.warning.moveTo(34, -194).lineTo(19, -169).lineTo(43, -149).lineTo(26, -126)
        .stroke({ width: 4, color: 0xffa34d, alpha: 0.8 });
    } else {
      this.core.circle(0, 0, 13).stroke({ width: 4, color: 0xff7c70, alpha: 0.9 });
      this.core.circle(0, 0, 24).stroke({ width: 3, color: 0xffffff, alpha: 0.75 });
      this.core.arc(0, 0, 33, -2.65, -0.45).stroke({ width: 4, color: 0xff7c70, alpha: 0.75 });
      this.core.arc(0, 0, 33, 0.5, 2.7).stroke({ width: 4, color: 0x9edcff, alpha: 0.75 });
      this.warning.roundRect(-34, -119, 68, 34, 8).fill({ color: 0x111827, alpha: 0.9 });
      this.warning.roundRect(-34, -119, 68, 34, 8).stroke({ width: 4, color: 0xffffff });
      this.warning.rect(35, -109, 7, 14).fill(0xffffff);
      this.warning.roundRect(-27, -112, 18, 20, 4).fill(0xff554d);
      this.warning.rect(5, -111, 4, 13).fill(0xff554d);
      this.warning.circle(7, -93, 3).fill(0xff554d);
    }
    this.core.position.set(0, GROUND_Y - 210);
    this.warning.position.set(0, GROUND_Y);
    this.warning.alpha = 0;

    this.root.x = worldX;
    this.root.addChild(this.body, this.core, this.warning, this.barBg, this.barFill);
  }

  setHp(hp: number, maxHp: number): void {
    const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
    this.damage = 1 - ratio;
    this.barFill.width = BAR_W * ratio;
    this.barFill.tint = ratio > 0.5 ? 0x5ddc7a : ratio > 0.25 ? 0xf0c040 : 0xe6483c;
  }

  /** baseHit 이벤트 (§6) */
  hit(): void {
    this.hitMs = HIT_FLASH_MS;
  }

  /** ageup 이벤트 — 본진 모핑 (§6) */
  morph(age: number): void {
    this.morphMs = MORPH_MS;
    this.ageScale = 1 + age * 0.08;
  }

  tick(deltaMs: number): void {
    this.corePhase += deltaMs * 0.003;
    this.core.rotation += deltaMs * (this.faction === 'semicon' ? 0.00075 : -0.00055);
    const corePulse = this.ageScale * (1 + Math.sin(this.corePhase) * 0.08);
    this.core.scale.set(corePulse);
    this.core.alpha = (0.72 + Math.sin(this.corePhase * 1.3) * 0.18) * (1 - this.damage * 0.4);
    this.warning.alpha = Math.max(0, (this.damage - 0.2) / 0.8) * (0.7 + Math.sin(this.corePhase * 2.2) * 0.25);

    if (this.morphMs > 0) {
      this.morphMs -= deltaMs;
      const t = 1 - Math.max(0, this.morphMs / MORPH_MS);
      // 살짝 눌렸다 펴지는 모핑
      const squash = Math.sin(t * Math.PI) * 0.12;
      this.body.scale.set(this.ageScale + squash, this.ageScale - squash);
    } else {
      this.body.scale.set(this.ageScale);
    }

    if (this.hitMs > 0) {
      this.hitMs -= deltaMs;
      this.body.tint = 0xffffff;
      return;
    }
    // 피해가 쌓일수록 어둡고 붉게
    const g = Math.round(255 - this.damage * 130);
    const b = Math.round(255 - this.damage * 150);
    this.body.tint = (255 << 16) | (g << 8) | b;
  }
}
