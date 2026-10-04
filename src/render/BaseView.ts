import { Container, Sprite, Text, Texture } from 'pixi.js';
import { GROUND_Y } from './coords';
import { baseTexture } from './textures';

const BASE_W = 240;
const BASE_H = 285;
const BAR_W = 190;
const BAR_H = 9;
const HIT_FLASH_MS = 90;
const MORPH_MS = 600;

/** 양측 본진. 생성된 진영별 성 스프라이트 위에 정확한 진영명과 HP를 표시한다. */
export class BaseView {
  readonly root = new Container();
  private readonly body = new Sprite();
  private readonly factionLabel: Text;
  private readonly barBg = new Sprite(Texture.WHITE);
  private readonly barFill = new Sprite(Texture.WHITE);
  private bodyScaleX = 1;
  private bodyScaleY = 1;

  private hitMs = 0;
  /** 0 = 멀쩡, 1 = 파괴 직전 */
  private damage = 0;
  /** §6 ageup 본진 모핑 */
  private morphMs = 0;
  private ageScale = 1;

  constructor(private readonly faction: string, worldX: number) {
    this.body.texture = baseTexture(faction);
    this.body.anchor.set(0.5, 1);
    this.body.y = GROUND_Y;
    this.bodyScaleX = BASE_W / this.body.texture.width;
    this.bodyScaleY = BASE_H / this.body.texture.height;

    const isSemicon = faction === 'semicon';
    this.factionLabel = new Text({
      text: isSemicon ? 'SAMSUNG' : 'APPLE',
      style: {
        fontFamily: ['Arial Black', 'Apple SD Gothic Neo', 'sans-serif'],
        fontSize: 18, fontWeight: '900', letterSpacing: 2,
        fill: isSemicon ? 0x8ad3ff : 0xffb9a7,
        stroke: { color: 0x101b2e, width: 4 },
      },
    });
    this.factionLabel.anchor.set(0.5, 1);

    this.barBg.anchor.set(0.5, 0.5);
    this.barBg.tint = 0x000000;
    this.barBg.alpha = 0.6;
    this.barBg.width = BAR_W + 3;
    this.barBg.height = BAR_H + 3;
    this.barBg.y = GROUND_Y - BASE_H - 13;

    // 왼쪽 고정 — Graphics 재생성 금지 (§2.4)
    this.barFill.anchor.set(0, 0.5);
    this.barFill.height = BAR_H;
    this.barFill.x = -BAR_W / 2;
    this.barFill.y = this.barBg.y;

    this.root.x = worldX;
    this.root.addChild(this.body, this.factionLabel, this.barBg, this.barFill);
    this.positionHeader();
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
    this.ageScale = 1 + (age - 1) * 0.055;
    this.body.texture = baseTexture(this.faction, age);
    this.bodyScaleX = BASE_W / this.body.texture.width;
    this.bodyScaleY = BASE_H / this.body.texture.height;
  }

  tick(deltaMs: number): void {
    if (this.morphMs > 0) {
      this.morphMs -= deltaMs;
      const t = 1 - Math.max(0, this.morphMs / MORPH_MS);
      // 살짝 눌렸다 펴지는 모핑
      const squash = Math.sin(t * Math.PI) * 0.12;
      this.body.scale.set(this.bodyScaleX * (this.ageScale + squash),
        this.bodyScaleY * (this.ageScale - squash));
    } else {
      this.body.scale.set(this.bodyScaleX * this.ageScale, this.bodyScaleY * this.ageScale);
    }
    this.positionHeader();

    if (this.hitMs > 0) {
      this.hitMs -= deltaMs;
      this.body.tint = 0xffc2ad;
      return;
    }
    // 피해가 쌓일수록 어둡고 붉게
    const g = Math.round(255 - this.damage * 130);
    const b = Math.round(255 - this.damage * 150);
    this.body.tint = (255 << 16) | (g << 8) | b;
  }

  private positionHeader(): void {
    const top = GROUND_Y - BASE_H * this.ageScale;
    this.barBg.y = top - 11;
    this.barFill.y = this.barBg.y;
    this.factionLabel.y = top - 22;
  }
}
