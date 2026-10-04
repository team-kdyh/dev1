import type { Container } from 'pixi.js';
import { GROUND_Y, WORLD_WIDTH, clamp, lerp } from './coords';

const FOLLOW_LERP = 0.08;
const AUTO_RETURN_MS = 4000;
const SHAKE_DECAY_PER_MS = 0.006;
const MAX_SHAKE = 26;

export type CameraMode = 'auto' | 'manual';

/**
 * 카메라. (명세 §3)
 *
 * 월드 컨테이너의 x/y를 움직일 뿐, 어떤 게임 상태도 갖지 않는다.
 * "무엇을 따라갈지"는 GameRenderer가 스냅샷을 보고 setAutoTarget()으로 알려준다.
 */
export class Camera {
  mode: CameraMode = 'auto';
  scale = 1;

  /** 화면 중앙이 바라보는 월드 x (픽셀) */
  private x = WORLD_WIDTH / 2;
  private autoTargetX = WORLD_WIDTH / 2;
  private idleMs = 0;

  /** 화면 크기에서 계산한 기본 배율. zoom은 여기에 곱해진다. */
  private fitScale = 1;
  private zoom = 1;
  private zoomTarget = 1;

  private shake = 0;
  private shakeSeed = 0;

  private screenW = 0;
  private screenH = 0;

  /**
   * 움직일 대상은 GameRenderer가 만든다. GameRenderer는 생성 시 카메라가 필요하므로
   * (컬링·패럴랙스) 순환을 피하려고 컨테이너는 나중에 붙인다.
   */
  private world: Container | null = null;

  attach(world: Container): void {
    this.world = world;
    this.world.scale.set(this.scale);
  }

  resize(width: number, height: number): void {
    this.screenW = width;
    this.screenH = height;
    this.fitScale = clamp(height / 780, 0.45, 1.25);
    this.scale = this.fitScale * this.zoom;
    this.world?.scale.set(this.scale);
  }

  /** 화면 x → 월드 x. 유닛 정보 팝업(§5)의 히트 테스트가 쓴다. */
  screenToWorldX(screenX: number): number {
    return this.x + (screenX - this.screenW / 2) / this.scale;
  }

  /** 화면 중앙이 보고 있는 월드 x — 패럴랙스 계산이 쓴다. */
  get centerX(): number {
    return this.x;
  }

  /** 카메라가 보고 있는 월드 x 범위 — 컬링(§2.4)이 쓴다. */
  get viewLeft(): number {
    return this.x - this.screenW / (2 * this.scale);
  }

  get viewRight(): number {
    return this.x + this.screenW / (2 * this.scale);
  }

  setAutoTarget(worldX: number): void {
    this.autoTargetX = worldX;
  }

  /** 연출이 카메라를 가로챌 때 (T9 스폰 등). 자동 추적보다 우선. */
  snapTo(worldX: number): void {
    this.mode = 'manual';
    this.idleMs = 0;
    this.x = worldX;
  }

  panBy(deltaWorldX: number): void {
    this.mode = 'manual';
    this.idleMs = 0;
    this.x += deltaWorldX;
  }

  returnToAuto(): void {
    this.mode = 'auto';
    this.idleMs = 0;
  }

  /** §3 연출: 게임 종료 시 패배 본진 줌인 */
  zoomTo(worldX: number, zoom: number): void {
    this.snapTo(worldX);
    this.zoomTarget = zoom;
  }

  resetZoom(): void {
    this.zoomTarget = 1;
  }

  /** 강도는 피해량 비례, 상한 있음 (§3) */
  addShake(magnitude: number): void {
    this.shake = Math.min(MAX_SHAKE, this.shake + magnitude);
  }

  update(deltaMs: number): void {
    if (Math.abs(this.zoom - this.zoomTarget) > 0.001) {
      const z = 1 - Math.pow(1 - 0.06, deltaMs / 16.67);
      this.zoom = lerp(this.zoom, this.zoomTarget, z);
      this.scale = this.fitScale * this.zoom;
      this.world?.scale.set(this.scale);
    }

    if (this.mode === 'manual') {
      this.idleMs += deltaMs;
      if (this.idleMs >= AUTO_RETURN_MS) this.returnToAuto();
    } else {
      // deltaMs 보정: lerp 0.08은 60fps 한 프레임 기준
      const t = 1 - Math.pow(1 - FOLLOW_LERP, deltaMs / 16.67);
      this.x = lerp(this.x, this.autoTargetX, t);
    }

    const half = this.screenW / (2 * this.scale);
    // 본진이 화면 가장자리에서 잘리지 않도록 양쪽에 조금 여백을 둔다.
    const basePadding = 104 / this.scale;
    this.x =
      WORLD_WIDTH <= half * 2
        ? WORLD_WIDTH / 2
        : clamp(this.x, half - basePadding, WORLD_WIDTH - half + basePadding);

    let shakeX = 0;
    let shakeY = 0;
    if (this.shake > 0.2) {
      this.shakeSeed += deltaMs;
      shakeX = Math.sin(this.shakeSeed * 0.08) * this.shake;
      shakeY = Math.cos(this.shakeSeed * 0.113) * this.shake * 0.5;
      this.shake *= Math.max(0, 1 - SHAKE_DECAY_PER_MS * deltaMs);
    } else {
      this.shake = 0;
    }

    if (!this.world) return;
    this.world.x = this.screenW / 2 - this.x * this.scale + shakeX;
    this.world.y = this.screenH * 0.86 - GROUND_Y * this.scale + shakeY;
  }
}
