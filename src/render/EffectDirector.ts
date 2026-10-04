import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { BalanceData, SimEvent } from '../sim/contracts';
import { LOGICAL_MAX, type SimAdapter } from '../adapter/SimAdapter';
import { FACTION_OF_PLAYER, findUnitDef } from '../data/gameData';
import type { BaseView } from './BaseView';
import type { Camera } from './Camera';
import { laneY, toPixel } from './coords';
import type { DamageTextPool, ParticlePool } from './pools';
import { FACTION_COLOR } from './textures';
import type { UnitView } from './UnitView';

/** T9 스폰 슬로우 (§3, §6) */
const T9_SLOW_SCALE = 0.35;
const T9_SLOW_MS = 500;
/** gameOver 슬로우모션 (§6) */
const OVER_SLOW_SCALE = 0.25;
const OVER_SLOW_MS = 1600;

interface Overlay {
  node: Container;
  lifeMs: number;
  totalMs: number;
}

/**
 * SimEvent → 연출. (명세 §6)
 *
 * 절대 원칙: 프론트는 전투 결과를 추측하지 않는다. 이 파일에 게임 판정은 한 줄도 없고,
 * 전부 "받은 이벤트를 그림으로 바꾸는" 코드뿐이다.
 */
export class EffectDirector {
  private slowRemainingMs = 0;
  private flashMs = 0;
  private readonly flash = new Sprite(Texture.WHITE);
  private readonly overlays: Overlay[] = [];

  constructor(
    private readonly balance: BalanceData,
    private readonly adapter: SimAdapter,
    private readonly camera: Camera,
    private readonly bases: readonly [BaseView, BaseView],
    private readonly damageText: DamageTextPool,
    private readonly particles: ParticlePool,
    private readonly viewOf: (unitId: number) => UnitView | undefined,
    /** 화면 고정 연출용 컨테이너 (§6 ageup 플래시, strategy 전면 오버레이) */
    private readonly screenLayer: Container,
  ) {
    this.flash.tint = 0xffffff;
    this.flash.alpha = 0;
    this.flash.visible = false;
    this.screenLayer.addChild(this.flash);
  }

  resize(width: number, height: number): void {
    this.flash.width = width;
    this.flash.height = height;
    for (const overlay of this.overlays) overlay.node.position.set(width / 2, height / 2);
  }

  handle(events: readonly SimEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'spawn': {
          // 등장 애니메이션은 UnitView.reset()이 재생한다. 여기선 T9 연출만 얹는다.
          const def = findUnitDef(this.balance, event.defId);
          if (def && def.tier >= 9) this.t9Spawn(toPixel(event.x));
          break;
        }
        case 'hit': {
          const view = this.viewOf(event.unitId);
          view?.flash();
          const x = view ? view.worldX : toPixel(event.x);
          this.damageText.spawn(x, laneY(event.unitId) - 64, event.amount, event.crit);
          break;
        }
        case 'kill': {
          const color = FACTION_COLOR[FACTION_OF_PLAYER[event.owner]] ?? 0xffffff;
          const def = findUnitDef(this.balance, event.defId);
          // 유닛별 파괴 이펙트 — 정식 이펙트시트가 오기 전이라 티어로 규모만 다르게 한다
          const count = 8 + (def?.tier ?? 1) * 2;
          this.particles.burst(toPixel(event.x), laneY(event.unitId), color, count);
          break;
        }
        case 'skill': {
          const view = this.viewOf(event.unitId);
          const x = view ? view.worldX : toPixel(event.x);
          this.skillEffect(x, laneY(event.unitId), event.skillId);
          break;
        }
        case 'ageup': {
          this.screenFlash(0.55);
          this.bases[event.owner].morph(event.age);
          break;
        }
        case 'baseHit': {
          this.camera.addShake(Math.min(12, event.amount * 0.45));
          this.bases[event.owner].hit();
          break;
        }
        case 'strategy': {
          const faction = FACTION_OF_PLAYER[event.owner];
          this.fullscreenOverlay(event.strategyId, FACTION_COLOR[faction] ?? 0xffffff);
          break;
        }
        case 'gameOver': {
          this.gameOver(event.winner);
          break;
        }
        case 'rejected':
          // 버튼 흔들림과 토스트는 HUD(§4.1)가 처리한다.
          break;
      }
    }
  }

  tick(deltaMs: number): void {
    if (this.slowRemainingMs > 0) {
      this.slowRemainingMs -= deltaMs;
      if (this.slowRemainingMs <= 0) this.adapter.setTimeScale?.(1);
    }

    if (this.flashMs > 0) {
      this.flashMs -= deltaMs;
      this.flash.alpha = Math.max(0, this.flashMs / 260) * 0.7;
      this.flash.visible = this.flash.alpha > 0.01;
    }

    for (let i = this.overlays.length - 1; i >= 0; i -= 1) {
      const overlay = this.overlays[i];
      overlay.lifeMs -= deltaMs;
      if (overlay.lifeMs <= 0) {
        this.screenLayer.removeChild(overlay.node);
        overlay.node.destroy({ children: true });
        this.overlays.splice(i, 1);
        continue;
      }
      const t = overlay.lifeMs / overlay.totalMs;
      overlay.node.alpha = t > 0.75 ? (1 - t) / 0.25 : t < 0.25 ? t / 0.25 : 1;
      overlay.node.scale.set(1 + (1 - t) * 0.08);
    }
  }

  /** §3: T9 스폰은 0.5초 슬로우와 팬 */
  private t9Spawn(worldX: number): void {
    this.camera.snapTo(worldX);
    this.slow(T9_SLOW_SCALE, T9_SLOW_MS);
    this.screenFlash(0.35);
  }

  /** §6: 슬로우모션 후 결과 화면 / §3: 게임 종료는 패배 본진 줌인 */
  private gameOver(winner: number | null): void {
    this.slow(OVER_SLOW_SCALE, OVER_SLOW_MS);
    if (winner === null) {
      this.camera.returnToAuto();
      return;
    }
    const loser = winner === 0 ? 1 : 0;
    this.camera.zoomTo(toPixel(loser === 0 ? 0 : LOGICAL_MAX), 1.45);
  }

  private slow(scale: number, durationMs: number): void {
    this.adapter.setTimeScale?.(scale);
    this.slowRemainingMs = Math.max(this.slowRemainingMs, durationMs);
  }

  private screenFlash(strength: number): void {
    this.flashMs = 260 * strength + 120;
    this.flash.visible = true;
  }

  private skillEffect(x: number, y: number, skillId: string): void {
    // skillId별 고유 이펙트는 D의 이펙트시트가 온 뒤. 지금은 색만 id에서 결정론적으로 뽑는다.
    let hash = 0;
    for (let i = 0; i < skillId.length; i += 1) hash = (hash * 31 + skillId.charCodeAt(i)) >>> 0;
    const color = 0x404040 | (hash & 0xbfbfbf);
    this.particles.burst(x, y, color, 22);
  }

  /** §6 strategy: 전면 오버레이 */
  private fullscreenOverlay(label: string, color: number): void {
    const node = new Container();

    const band = new Graphics();
    band.rect(-700, -46, 1400, 92).fill({ color: 0x05070d, alpha: 0.78 });
    band.rect(-700, -46, 1400, 3).fill(color);
    band.rect(-700, 43, 1400, 3).fill(color);

    const text = new Text({
      text: label,
      style: {
        fontFamily: ['Malgun Gothic', 'sans-serif'],
        fontSize: 40,
        fontWeight: 'bold',
        fill: color,
        stroke: { color: 0x05070d, width: 6 },
      },
    });
    text.anchor.set(0.5);

    node.addChild(band, text);
    node.alpha = 0;
    this.screenLayer.addChild(node);
    this.overlays.push({ node, lifeMs: 1400, totalMs: 1400 });
  }
}
