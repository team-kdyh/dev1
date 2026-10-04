import { Container, Sprite, Texture } from 'pixi.js';
import type { ProjectileSnapshot } from '../sim/contracts';
import { FACTION_OF_PLAYER } from '../data/gameData';
import { GROUND_Y, laneY, toPixel } from './coords';
import { FACTION_COLOR } from './textures';

/** 포물선 최고점 (px) */
const ARC_HEIGHT = 110;
const SHOT_MS = 180;

interface ImpactLine {
  node: Container;
  outer: Sprite;
  inner: Sprite;
  lifeMs: number;
}

/**
 * 투사체. (§2.3 레이어 6)
 *
 * 시뮬은 x와 progress(0~1)만 준다 — **포물선 Y는 프론트가 만든다**. (contracts 주석)
 * 스프라이트는 풀링하며 매 프레임 생성하지 않는다 (§2.4).
 */
export class ProjectileLayer {
  private readonly free: Sprite[] = [];
  private readonly active = new Map<number, Sprite>();
  private readonly seen = new Set<number>();
  private readonly freeLines: ImpactLine[] = [];
  private readonly lines: ImpactLine[] = [];

  constructor(private readonly layer: Container) {}

  draw(projectiles: readonly ProjectileSnapshot[]): void {
    this.seen.clear();

    for (const projectile of projectiles) {
      this.seen.add(projectile.id);
      let node = this.active.get(projectile.id);
      if (!node) {
        node = this.free.pop() ?? this.create();
        node.visible = true;
        this.layer.addChild(node);
        this.active.set(projectile.id, node);
      }
      const color = FACTION_COLOR[FACTION_OF_PLAYER[projectile.owner]] ?? 0xffffff;
      node.tint = color;
      node.x = toPixel(projectile.x);
      // 4 * p * (1 - p) 는 p=0.5에서 1인 포물선 — 발사/착탄 지점 높이가 같다
      const p = Math.min(1, Math.max(0, projectile.progress));
      node.y = GROUND_Y - 30 - ARC_HEIGHT * 4 * p * (1 - p);
      node.rotation = (p - 0.5) * 1.6;
    }

    for (const [id, node] of this.active) {
      if (this.seen.has(id)) continue;
      node.visible = false;
      this.layer.removeChild(node);
      this.active.delete(id);
      this.free.push(node);
    }
  }

  /** 즉시 판정 공격에 붙이는 짧은 전자광선. 판정은 시뮬 이벤트가 이미 끝냈다. */
  shoot(fromX: number, toX: number, owner: 0 | 1, unitId: number, kind: string): void {
    const line = this.freeLines.pop() ?? this.createLine();
    const startX = toPixel(fromX);
    const endX = toPixel(toX);
    const startY = laneY(unitId) - 66;
    const endY = GROUND_Y - 58;
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.max(12, Math.hypot(dx, dy));
    const factionColor = FACTION_COLOR[FACTION_OF_PLAYER[owner]] ?? 0xffffff;
    line.outer.tint = kind === 'siege' ? 0xffa12e : kind === 'magic' ? 0xb766ff : factionColor;
    line.outer.width = length;
    line.inner.width = length * 0.96;
    line.node.position.set((startX + endX) / 2, (startY + endY) / 2);
    line.node.rotation = Math.atan2(dy, dx);
    line.node.alpha = 1;
    line.node.scale.y = 1;
    line.lifeMs = SHOT_MS;
    this.layer.addChild(line.node);
    this.lines.push(line);
  }

  tick(deltaMs: number): void {
    for (let index = this.lines.length - 1; index >= 0; index--) {
      const line = this.lines[index];
      line.lifeMs -= deltaMs;
      if (line.lifeMs <= 0) {
        this.layer.removeChild(line.node);
        this.freeLines.push(line);
        this.lines.splice(index, 1);
      } else {
        const ratio = line.lifeMs / SHOT_MS;
        line.node.alpha = ratio * ratio;
        line.node.scale.y = 0.45 + ratio * 0.55;
      }
    }
  }

  private create(): Sprite {
    const node = new Sprite(Texture.WHITE);
    node.anchor.set(0.5);
    node.width = 12;
    node.height = 4;
    return node;
  }

  private createLine(): ImpactLine {
    const node = new Container();
    const outer = new Sprite(Texture.WHITE);
    const inner = new Sprite(Texture.WHITE);
    outer.anchor.set(0.5);
    inner.anchor.set(0.5);
    outer.height = 13;
    inner.height = 3;
    outer.alpha = 0.76;
    node.addChild(outer, inner);
    return { node, outer, inner, lifeMs: 0 };
  }
}
