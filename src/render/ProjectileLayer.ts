import { Container, Graphics } from 'pixi.js';
import type { ProjectileSnapshot, ProjectileStyle } from '../sim/contracts';
import { FACTION_OF_PLAYER } from '../data/balanceData';
import { GROUND_Y, laneY, toPixel } from './coords';
import { FACTION_COLOR } from './textures';

interface ProjectileView {
  node: Graphics;
  style: ProjectileStyle;
}

/**
 * 실제 판정 위치는 시뮬레이션이 소유하고, 이 레이어는 투사체 종류별 비행 궤적만 그린다.
 * bullet=직선, shell=큰 포물선, pulse=낮은 곡선, skill=강조된 에너지탄이다.
 */
export class ProjectileLayer {
  private readonly free: Graphics[] = [];
  private readonly active = new Map<number, ProjectileView>();
  private readonly seen = new Set<number>();

  constructor(private readonly layer: Container) {}

  draw(projectiles: readonly ProjectileSnapshot[]): void {
    this.seen.clear();

    for (const projectile of projectiles) {
      this.seen.add(projectile.id);
      let view = this.active.get(projectile.id);
      if (!view) {
        const node = this.free.pop() ?? new Graphics();
        view = { node, style: projectile.style };
        this.drawShape(view.node, projectile.style);
        view.node.visible = true;
        this.layer.addChild(view.node);
        this.active.set(projectile.id, view);
      }
      if (view.style !== projectile.style) {
        view.style = projectile.style;
        this.drawShape(view.node, projectile.style);
      }

      const color = FACTION_COLOR[FACTION_OF_PLAYER[projectile.owner]] ?? 0xffffff;
      const p = Math.min(1, Math.max(0, projectile.progress));
      const startY = laneY(projectile.sourceUnitId) - 52;
      const endY = projectile.targetUnitId === undefined
        ? GROUND_Y - 74
        : laneY(projectile.targetUnitId) - 48;
      const arc = arcHeight(projectile.style) * 4 * p * (1 - p);
      const direction = projectile.owner === 0 ? 1 : -1;

      view.node.tint = color;
      view.node.position.set(toPixel(projectile.x), startY + (endY - startY) * p - arc);
      view.node.rotation = projectile.style === 'shell'
        ? direction * (p - 0.5) * 1.8
        : projectile.style === 'bullet'
          ? direction < 0 ? Math.PI : 0
          : 0;
      const pulse = projectile.style === 'skill' ? 1 + Math.sin(p * Math.PI * 8) * 0.16 : 1;
      view.node.scale.set(pulse);
    }

    for (const [id, view] of this.active) {
      if (this.seen.has(id)) continue;
      view.node.visible = false;
      this.layer.removeChild(view.node);
      this.active.delete(id);
      this.free.push(view.node);
    }
  }

  private drawShape(node: Graphics, style: ProjectileStyle): void {
    node.clear();
    if (style === 'bullet') {
      node.roundRect(-11, -2, 22, 4, 2).fill(0xffffff);
      node.circle(10, 0, 3).fill(0xffffff);
    } else if (style === 'shell') {
      node.roundRect(-7, -5, 14, 10, 4).fill(0xffffff);
      node.rect(-11, -2, 5, 4).fill({ color: 0xffffff, alpha: 0.55 });
    } else if (style === 'pulse') {
      node.circle(0, 0, 7).fill({ color: 0xffffff, alpha: 0.82 });
      node.circle(0, 0, 10).stroke({ width: 2, color: 0xffffff, alpha: 0.45 });
    } else {
      node.circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.9 });
      node.circle(0, 0, 16).stroke({ width: 3, color: 0xffffff, alpha: 0.55 });
      node.circle(0, 0, 21).stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
    }
  }
}

function arcHeight(style: ProjectileStyle): number {
  if (style === 'shell') return 125;
  if (style === 'skill') return 58;
  if (style === 'pulse') return 30;
  return 7;
}
