import { Container, Sprite, Texture } from 'pixi.js';
import type { ProjectileSnapshot } from '../sim/contracts';
import { FACTION_OF_PLAYER } from '../data/gameData';
import { GROUND_Y, toPixel } from './coords';
import { FACTION_COLOR } from './textures';

/** 포물선 최고점 (px) */
const ARC_HEIGHT = 110;

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

  private create(): Sprite {
    const node = new Sprite(Texture.WHITE);
    node.anchor.set(0.5);
    node.width = 12;
    node.height = 4;
    return node;
  }
}
