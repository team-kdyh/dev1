import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { UnitSnapshot } from '../sim/contracts';
import { laneY, lerp, toPixel } from './coords';
import { unitTexture } from './textures';

const HP_BAR_W = 34;
const HP_BAR_H = 4;
const FLASH_MS = 50; // 흰색 3프레임 (§6 hit)
const DEATH_MS = 400; // 스냅샷에서 사라져도 0.4초 유지 (§2.2)
const SPAWN_MS = 220; // 등장 애니메이션 (§6 spawn)

/**
 * 유닛 한 기의 화면 표현. 스냅샷을 절대 쓰지 않고 읽기만 한다. (§0-1)
 * 풀에서 재사용되므로 생성자는 가볍게, 상태 초기화는 reset()에서 한다.
 *
 * body는 레이어 5(유닛), HP 바는 레이어 8에 따로 올라간다 (§2.3).
 * 두 레이어를 오가는 텍스처 전환이 사라져 배칭도 같이 산다 (§2.4).
 */
export class UnitView {
  readonly root = new Container();
  /** 레이어 8에 올라가는 HP 바 — GameRenderer가 별도 컨테이너에 붙인다 */
  readonly bar = new Container();

  private readonly body = new Sprite();
  private readonly shadow = new Graphics();
  private readonly hpBg = new Sprite(Texture.WHITE);
  private readonly hpFill = new Sprite(Texture.WHITE);

  private flashMs = 0;
  private deathMs = -1;
  private spawnMs = 0;
  private baseTint = 0xffffff;
  private faction = '';
  private nativeOwner: 0 | 1 = 0;
  private tier = 1;
  private facing: 1 | -1 = 1;
  private visualState = 'idle';
  private stateElapsedMs = 0;
  private attackMs = 0;
  private attackTotalMs = 0;
  private attackState: 'attack' | 'cast' = 'attack';
  private hitRecoilMs = 0;

  /** 현재 이 뷰가 담당하는 유닛. 풀 반환 시 -1. */
  unitId = -1;
  /** 마지막으로 그려진 월드 x — 카메라/컬링이 참조 */
  worldX = 0;

  constructor() {
    this.body.anchor.set(0.5, 1); // 앵커 하단 중앙 (§8)
    this.shadow.ellipse(0, -3, 35, 8).fill({ color: 0x253044, alpha: 0.24 });
    this.root.addChild(this.shadow, this.body);

    this.hpBg.anchor.set(0.5, 0.5);
    this.hpBg.tint = 0x000000;
    this.hpBg.alpha = 0.55;
    this.hpBg.width = HP_BAR_W + 2;
    this.hpBg.height = HP_BAR_H + 2;
    // 왼쪽 고정으로 줄어들게 — Graphics 재생성 금지, Sprite 폭만 만진다 (§2.4)
    this.hpFill.anchor.set(0, 0.5);
    this.hpFill.height = HP_BAR_H;
    this.hpFill.x = -HP_BAR_W / 2;
    this.bar.addChild(this.hpBg, this.hpFill);
  }

  reset(unit: UnitSnapshot, faction: string): void {
    this.unitId = unit.id;
    this.faction = faction;
    this.nativeOwner = unit.owner;
    this.tier = unit.tier;
    this.facing = unit.facing;
    this.visualState = 'idle';
    this.stateElapsedMs = 0;
    this.body.texture = unitTexture(faction, unit.tier);
    this.shadow.scale.x = unit.tier >= 7 ? 1.7 : unit.tier >= 4 ? 1.3 : 1;
    this.body.tint = 0xffffff;
    this.baseTint = 0xffffff;
    this.body.alpha = 1;
    this.root.alpha = 1;
    this.root.scale.set(1);
    this.root.visible = true;
    this.bar.visible = true;
    this.bar.alpha = 1;
    this.flashMs = 0;
    this.attackMs = 0;
    this.hitRecoilMs = 0;
    this.deathMs = -1;
    this.spawnMs = SPAWN_MS;
  }

  /** prev가 없으면(신규 스폰) 보간 없이 즉시 배치 (§2.2) */
  apply(prev: UnitSnapshot | undefined, curr: UnitSnapshot, alpha: number): void {
    const logicalX = prev ? lerp(prev.x, curr.x, alpha) : curr.x;
    this.worldX = toPixel(logicalX);
    const y = laneY(curr.id);
    this.root.position.set(this.worldX, y);

    this.facing = curr.facing;
    const ownerTint = curr.owner === this.nativeOwner ? 0xffffff : 0x8dbaff;
    if (this.baseTint !== ownerTint) {
      this.baseTint = ownerTint;
      if (this.flashMs <= 0) this.body.tint = ownerTint;
    }
    if (curr.state !== this.visualState && this.deathMs < 0 && this.attackMs <= 0) {
      this.visualState = curr.state;
      this.stateElapsedMs = 0;
    }
    const size = curr.tier >= 7 ? 0.98 : curr.tier >= 4 ? 1.2 : 1.35;
    this.body.scale.set(curr.facing * size, size);
    this.body.y = 0;
    this.body.rotation = 0;

    const ratio = curr.maxHp > 0 ? Math.max(0, curr.hp / curr.maxHp) : 0;
    const barY = y - this.body.height - 10;
    this.hpFill.width = HP_BAR_W * ratio;
    this.hpFill.tint = ratio > 0.5 ? 0x5ddc7a : ratio > 0.25 ? 0xf0c040 : 0xe6483c;
    this.bar.position.set(this.worldX, barY);
    this.bar.visible = ratio < 1 && this.deathMs < 0;

    this.body.x = 0;
  }

  flash(): void {
    this.flashMs = FLASH_MS;
    this.hitRecoilMs = 150;
    this.attackMs = 0;
    this.body.tint = 0xff8b84;
  }

  /** 실제 공격 이벤트에 맞춰 짧은 준비·타격·복귀 동작을 재생한다. */
  playAttack(skill = false): void {
    if (this.deathMs >= 0) return;
    this.attackState = skill ? 'cast' : 'attack';
    this.attackTotalMs = skill ? 470 : 340;
    this.attackMs = this.attackTotalMs;
    this.stateElapsedMs = 0;
  }

  startDeath(): void {
    if (this.deathMs < 0) {
      this.deathMs = 0;
      this.visualState = 'die';
      this.stateElapsedMs = 0;
      this.attackMs = 0;
      this.hitRecoilMs = 0;
    }
  }

  get isDying(): boolean {
    return this.deathMs >= 0;
  }

  /** 컬링 (§2.4) — body와 HP 바를 같이 끈다 */
  setVisible(visible: boolean): void {
    this.root.visible = visible;
    if (!visible) this.bar.visible = false;
  }

  /** @returns true면 연출이 끝나 풀로 돌려보내도 된다. */
  tick(deltaMs: number): boolean {
    this.stateElapsedMs += deltaMs;
    this.body.texture = unitTexture(this.faction, this.tier,
      this.attackMs > 0 ? this.attackState : this.visualState, this.stateElapsedMs);
    if (this.attackMs > 0) {
      this.attackMs = Math.max(0, this.attackMs - deltaMs);
      const progress = 1 - this.attackMs / this.attackTotalMs;
      const windup = Math.min(1, progress / 0.28);
      const strike = Math.min(1, Math.max(0, (progress - 0.28) / 0.27));
      const recover = Math.min(1, Math.max(0, (progress - 0.55) / 0.45));
      const advance = progress < 0.28 ? -6 * windup
        : progress < 0.55 ? -6 + 23 * strike : 17 * (1 - recover);
      this.body.x = this.facing * advance;
      this.body.y = -Math.sin(Math.PI * progress) * 7;
      this.body.rotation = this.facing * (-0.09 * (1 - strike) + 0.15 * strike) * (1 - recover);
    }
    if (this.hitRecoilMs > 0) {
      this.hitRecoilMs = Math.max(0, this.hitRecoilMs - deltaMs);
      const remaining = this.hitRecoilMs / 150;
      this.body.x = -this.facing * 11 * remaining;
      this.body.rotation = -this.facing * 0.12 * remaining;
    }
    if (this.flashMs > 0) {
      this.flashMs -= deltaMs;
      if (this.flashMs <= 0) this.body.tint = this.baseTint;
    }
    if (this.spawnMs > 0) {
      this.spawnMs -= deltaMs;
      const t = 1 - Math.max(0, this.spawnMs / SPAWN_MS);
      this.root.scale.set(0.7 + t * 0.3, 0.55 + t * 0.45);
      this.root.alpha = 0.35 + t * 0.65;
    }
    if (this.deathMs >= 0) {
      this.deathMs += deltaMs;
      const t = Math.min(1, this.deathMs / DEATH_MS);
      this.root.alpha = 1 - t;
      this.root.y += deltaMs * 0.02;
      this.root.scale.set(1 - t * 0.25, 1 - t * 0.55);
      this.bar.visible = false;
      return t >= 1;
    }
    return false;
  }

  destroy(): void {
    this.root.destroy({ children: true });
    this.bar.destroy({ children: true });
  }
}
