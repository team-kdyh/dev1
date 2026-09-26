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
 * 단순 총알뿐 아니라 워치 심박, 폰 데이터, 카메라 빔, 펜, 노트북 열파처럼
 * 제품 정체성이 읽히는 궤적을 그린다.
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
      view.node.rotation = spinningStyle(projectile.style)
        ? direction * (p - 0.5) * 1.8
        : directionalStyle(projectile.style)
          ? direction < 0 ? Math.PI : 0
          : 0;
      const pulse = pulsingStyle(projectile.style) ? 1 + Math.sin(p * Math.PI * 8) * 0.16 : 1;
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
    } else if (style === 'skill') {
      node.circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.9 });
      node.circle(0, 0, 16).stroke({ width: 3, color: 0xffffff, alpha: 0.55 });
      node.circle(0, 0, 21).stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
    } else if (style === 'heart') {
      node.circle(-4, -3, 5).fill(0xffffff);
      node.circle(4, -3, 5).fill(0xffffff);
      node.poly([-9, -2, 0, 10, 9, -2]).fill(0xffffff);
      node.moveTo(-15, 0).lineTo(-10, 0).lineTo(-7, -5).lineTo(-3, 5).lineTo(1, 0).lineTo(15, 0)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.55 });
    } else if (style === 'data') {
      node.roundRect(-12, -8, 20, 16, 4).fill({ color: 0xffffff, alpha: 0.35 });
      node.roundRect(-12, -8, 20, 16, 4).stroke({ width: 2, color: 0xffffff });
      node.rect(-7, -3, 4, 4).fill(0xffffff);
      node.rect(0, -3, 4, 4).fill(0xffffff);
      node.rect(10, -1, 7, 2).fill({ color: 0xffffff, alpha: 0.55 });
    } else if (style === 'camera') {
      node.rect(-18, -2, 30, 4).fill({ color: 0xffffff, alpha: 0.35 });
      node.circle(11, 0, 6).stroke({ width: 2, color: 0xffffff });
      node.circle(11, 0, 2).fill(0xffffff);
      node.circle(-17, 0, 3).fill({ color: 0xffffff, alpha: 0.65 });
    } else if (style === 'pen') {
      node.roundRect(-17, -3, 28, 6, 3).fill(0xffffff);
      node.poly([11, -3, 19, 0, 11, 3]).fill(0xffffff);
      node.rect(-20, -2, 4, 4).fill({ color: 0xffffff, alpha: 0.55 });
    } else if (style === 'window') {
      node.roundRect(-10, -10, 20, 20, 3).fill({ color: 0xffffff, alpha: 0.28 });
      node.roundRect(-10, -10, 20, 20, 3).stroke({ width: 2, color: 0xffffff });
      node.moveTo(0, -8).lineTo(0, 8).moveTo(-8, 0).lineTo(8, 0)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.75 });
    } else if (style === 'ai') {
      node.moveTo(-8, 5).lineTo(0, -7).lineTo(9, 4).lineTo(-8, 5)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
      node.circle(-8, 5, 4).fill(0xffffff);
      node.circle(0, -7, 4).fill(0xffffff);
      node.circle(9, 4, 4).fill(0xffffff);
    } else if (style === 'command') {
      node.poly([-15, -8, -3, 0, -15, 8, -9, 8, 3, 0, -9, -8]).fill({ color: 0xffffff, alpha: 0.55 });
      node.poly([-2, -8, 10, 0, -2, 8, 4, 8, 16, 0, 4, -8]).fill(0xffffff);
    } else if (style === 'rings') {
      node.circle(0, 0, 4).fill(0xffffff);
      node.circle(0, 0, 8).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
      node.circle(0, 0, 13).stroke({ width: 2, color: 0xffffff, alpha: 0.45 });
    } else if (style === 'ecosystem') {
      node.circle(0, 0, 6).fill(0xffffff);
      node.circle(0, 0, 12).stroke({ width: 1, color: 0xffffff, alpha: 0.55 });
      node.circle(-11, -5, 3).fill({ color: 0xffffff, alpha: 0.75 });
      node.circle(10, 6, 3).fill({ color: 0xffffff, alpha: 0.75 });
    } else if (style === 'lens') {
      node.rect(-18, -1, 27, 2).fill({ color: 0xffffff, alpha: 0.45 });
      node.circle(9, 0, 8).stroke({ width: 3, color: 0xffffff });
      node.circle(9, 0, 3).fill(0xffffff);
    } else if (style === 'spatial') {
      node.roundRect(-14, -7, 28, 14, 7).fill({ color: 0xffffff, alpha: 0.3 });
      node.roundRect(-14, -7, 28, 14, 7).stroke({ width: 2, color: 0xffffff });
      node.circle(-6, 0, 3).fill(0xffffff);
      node.circle(6, 0, 3).fill(0xffffff);
    } else if (style === 'air') {
      node.poly([-16, -7, 17, 0, -16, 7, -6, 0]).fill({ color: 0xffffff, alpha: 0.9 });
      node.moveTo(-6, 0).lineTo(11, 0).stroke({ width: 2, color: 0xffffff, alpha: 0.55 });
    } else if (style === 'thermal') {
      node.circle(7, 0, 7).fill({ color: 0xffffff, alpha: 0.9 });
      node.circle(-2, 0, 5).fill({ color: 0xffffff, alpha: 0.58 });
      node.circle(-10, 0, 3).fill({ color: 0xffffff, alpha: 0.3 });
    } else if (style === 'keynote') {
      node.roundRect(-12, -9, 24, 18, 4).fill({ color: 0xffffff, alpha: 0.35 });
      node.roundRect(-12, -9, 24, 18, 4).stroke({ width: 2, color: 0xffffff });
      node.rect(-1, -6, 2, 8).fill(0xffffff);
      node.circle(0, 5, 2).fill(0xffffff);
    }
  }
}

function arcHeight(style: ProjectileStyle): number {
  if (['shell', 'pen', 'air', 'thermal'].includes(style)) return 82;
  if (style === 'skill') return 58;
  if (['pulse', 'heart', 'ai', 'rings', 'ecosystem', 'spatial', 'keynote'].includes(style)) return 24;
  return 7;
}

function spinningStyle(style: ProjectileStyle): boolean {
  return ['shell', 'pen', 'air'].includes(style);
}

function directionalStyle(style: ProjectileStyle): boolean {
  return ['bullet', 'data', 'camera', 'lens', 'thermal', 'command', 'keynote'].includes(style);
}

function pulsingStyle(style: ProjectileStyle): boolean {
  return ['skill', 'heart', 'ai', 'rings', 'ecosystem', 'spatial', 'thermal'].includes(style);
}
