import { AnimatedSprite, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { UnitSnapshot, UnitState } from '../sim/contracts';
import { laneY, lerp, toPixel } from './coords';
import { getUnitClip, type UnitAnimationState } from './unitAssets';
import { unitTexture } from './textures';

const HP_BAR_W = 34;
const HP_BAR_H = 4;
const FLASH_MS = 50; // 흰색 3프레임 (§6 hit)
const DEATH_MS = 400; // 스냅샷에서 사라져도 0.4초 유지 (§2.2)
const SPAWN_MS = 220; // 등장 애니메이션 (§6 spawn)
const BLOCK_MS = 280;
const HIT_RECOIL_MS = 150;

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

  private readonly body = new AnimatedSprite([Texture.WHITE]);
  private readonly shield = new Graphics();
  private readonly hpBg = new Sprite(Texture.WHITE);
  private readonly hpFill = new Sprite(Texture.WHITE);

  private flashMs = 0;
  private deathMs = -1;
  private spawnMs = 0;
  private baseTint = 0xffffff;
  private currentDefId = '';
  private currentState: UnitAnimationState | '' = '';
  private logicalState: UnitState = 'idle';
  private currentTier = 1;
  private bodyScale = 1;
  private displayHeight = 64;
  private facing: 1 | -1 = 1;
  private reactionMs = 0;
  private reactionTotalMs = 0;
  private blocking = false;

  /** 현재 이 뷰가 담당하는 유닛. 풀 반환 시 -1. */
  unitId = -1;
  /** 마지막으로 그려진 월드 x — 카메라/컬링이 참조 */
  worldX = 0;

  constructor() {
    this.body.updateAnchor = true;
    this.body.anchor.set(0.5, 1); // 앵커 하단 중앙 (§8)
    this.shield.circle(0, 0, 27).fill({ color: 0x83c9ff, alpha: 0.12 });
    this.shield.circle(0, 0, 30).stroke({ width: 3, color: 0xbce5ff, alpha: 0.9 });
    this.shield.visible = false;
    this.root.addChild(this.body, this.shield);

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
    this.currentDefId = unit.defId;
    this.currentState = '';
    this.logicalState = unit.state;
    this.currentTier = unit.tier;
    this.bodyScale = characterScale(unit.tier);
    this.displayHeight = (64 + unit.tier * 7);
    this.body.stop();
    this.body.textures = [unitTexture(unit.defId, faction, unit.tier)];
    this.setAnimation(unit.defId, unit.state, unit.tier);
    this.body.tint = 0xffffff;
    this.baseTint = 0xffffff;
    this.body.alpha = 1;
    this.body.rotation = 0;
    this.root.alpha = 1;
    this.root.scale.set(1);
    this.root.visible = true;
    this.bar.visible = true;
    this.bar.alpha = 1;
    this.flashMs = 0;
    this.deathMs = -1;
    this.spawnMs = SPAWN_MS;
    this.reactionMs = 0;
    this.reactionTotalMs = 0;
    this.blocking = false;
    this.shield.visible = false;
    this.shield.alpha = 1;
    this.shield.scale.set(1);
  }

  /** prev가 없으면(신규 스폰) 보간 없이 즉시 배치 (§2.2) */
  apply(prev: UnitSnapshot | undefined, curr: UnitSnapshot, alpha: number): void {
    const logicalX = prev ? lerp(prev.x, curr.x, alpha) : curr.x;
    this.worldX = toPixel(logicalX);
    const y = laneY(curr.id);
    this.root.position.set(this.worldX, y);

    this.logicalState = curr.state;
    this.facing = curr.facing;
    if (this.reactionMs <= 0) this.setAnimation(curr.defId, curr.state, curr.tier);
    this.body.scale.set(curr.facing * this.bodyScale, this.bodyScale);
    this.body.y = 0;
    this.body.rotation = 0;

    const ratio = curr.maxHp > 0 ? Math.max(0, curr.hp / curr.maxHp) : 0;
    const barY = y - this.displayHeight - 10;
    this.hpFill.width = HP_BAR_W * ratio;
    this.hpFill.tint = ratio > 0.5 ? 0x5ddc7a : ratio > 0.25 ? 0xf0c040 : 0xe6483c;
    this.bar.position.set(this.worldX, barY);
    this.bar.visible = (ratio < 1 || curr.state === 'attack') && this.deathMs < 0;

    // 공격 클립의 전진감을 조금 더 보강한다.
    this.body.x = curr.state === 'attack' ? curr.facing * 3 : 0;
    this.shield.position.set(curr.facing * 8, -this.displayHeight * 0.52);
  }

  flash(): void {
    this.flashMs = FLASH_MS;
    this.body.tint = 0xffffff;
  }

  /** 공격 이벤트마다 비순환 attack/cast 클립을 첫 프레임부터 다시 재생한다. */
  playAttack(skill: boolean): void {
    if (this.deathMs >= 0) return;
    this.currentState = '';
    this.setAnimation(this.currentDefId, skill ? 'cast' : 'attack', this.currentTier);
  }

  /** 피격은 뒤로 밀리고, 방어 성공 시에는 방패 링과 folded 클립을 사용한다. */
  reactToHit(blocked: boolean): void {
    if (this.deathMs >= 0) return;
    this.blocking = blocked;
    this.reactionTotalMs = blocked ? BLOCK_MS : HIT_RECOIL_MS;
    this.reactionMs = this.reactionTotalMs;
    this.flashMs = blocked ? 0 : FLASH_MS;
    this.shield.visible = blocked;
    if (blocked) {
      this.body.tint = 0xb7e5ff;
      this.currentState = '';
      this.setAnimation(this.currentDefId, 'folded', this.currentTier);
    } else {
      this.body.tint = 0xff7b7b;
    }
  }

  startDeath(): void {
    if (this.deathMs < 0) {
      this.deathMs = 0;
      this.reactionMs = 0;
      this.shield.visible = false;
      this.setAnimation(this.currentDefId, 'die', this.currentTier);
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
    if (this.reactionMs > 0) {
      this.reactionMs -= deltaMs;
      const t = Math.max(0, this.reactionMs / this.reactionTotalMs);
      if (this.blocking) {
        this.body.x = -this.facing * (2 + t * 3);
        this.body.rotation = -this.facing * 0.07 * t;
        this.shield.alpha = 0.3 + t * 0.7;
        this.shield.scale.set(1 + (1 - t) * 0.24);
      } else {
        this.body.x = -this.facing * 9 * t;
        this.body.rotation = -this.facing * 0.12 * t;
      }
      if (this.reactionMs <= 0) {
        this.shield.visible = false;
        this.body.x = 0;
        this.body.rotation = 0;
        this.body.tint = this.baseTint;
        this.currentState = '';
        this.setAnimation(this.currentDefId, this.logicalState, this.currentTier);
      }
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
    this.body.stop();
    this.root.destroy({ children: true });
    this.bar.destroy({ children: true });
  }

  private setAnimation(defId: string, state: UnitAnimationState, tier: number): void {
    if (this.currentDefId === defId && this.currentState === state) return;
    const clip = getUnitClip(defId, state);
    if (!clip) return;

    this.currentDefId = defId;
    this.currentState = state;
    this.currentTier = tier;
    this.bodyScale = characterScale(tier);
    this.displayHeight = 64 + tier * 7;
    this.body.textures = [...clip.textures];
    this.body.animationSpeed = clip.fps / 60;
    this.body.loop = clip.loop;
    this.body.gotoAndPlay(0);
  }
}

function characterScale(tier: number): number {
  const sourceSize = tier >= 7 ? 192 : 128;
  return (64 + tier * 7) / sourceSize;
}
