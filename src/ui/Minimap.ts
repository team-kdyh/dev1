import { Container, Graphics } from 'pixi.js';
import type { Snapshot } from '../sim/contracts';
import { LOGICAL_MAX } from '../adapter/SimAdapter';
import type { Camera } from '../render/Camera';
import { WORLD_WIDTH, clamp, toLogical } from '../render/coords';
import { COLOR } from './theme';

/** 전체 라인을 200px로 압축 (§4.3) */
const MAP_W = 200;
const MAP_H = 34;

/**
 * 미니맵. (명세 §4.3)
 * 아군 파랑 / 적 빨강, 점 크기는 티어 비례, 현재 카메라 영역은 흰 프레임,
 * 클릭하면 해당 위치로 점프한다.
 */
export class Minimap {
  readonly root = new Container();

  private readonly frame = new Graphics();
  private readonly dots = new Graphics();
  private readonly viewport = new Graphics();
  private x = 0;
  private y = 0;

  constructor(private readonly camera: Camera) {
    this.frame.roundRect(0, 0, MAP_W, MAP_H, 4).fill({ color: 0x05070d, alpha: 0.8 });
    this.frame.roundRect(0, 0, MAP_W, MAP_H, 4).stroke({ width: 1, color: COLOR.panelEdge, alignment: 1 });
    this.frame.rect(0, MAP_H / 2, MAP_W, 1).fill({ color: COLOR.panelEdge, alpha: 0.7 });

    this.root.addChild(this.frame, this.dots, this.viewport);
    this.root.eventMode = 'static';
    this.root.cursor = 'pointer';
    this.root.on('pointertap', (e) => {
      const local = this.root.toLocal(e.global);
      const logical = clamp((local.x / MAP_W) * LOGICAL_MAX, 0, LOGICAL_MAX);
      this.camera.snapTo((logical / LOGICAL_MAX) * WORLD_WIDTH);
    });
  }

  get mapWidth(): number {
    return MAP_W;
  }

  get mapHeight(): number {
    return MAP_H;
  }

  layout(screenW: number, screenH: number, bottomMargin: number): void {
    this.x = screenW - MAP_W - 14;
    this.y = screenH - MAP_H - bottomMargin;
    this.root.position.set(this.x, this.y);
  }

  update(snapshot: Snapshot): void {
    this.dots.clear();
    const me = snapshot.me;

    for (const unit of snapshot.units) {
      const px = (unit.x / LOGICAL_MAX) * MAP_W;
      const size = 1.5 + unit.tier * 0.35; // 점 크기는 티어에 비례 (§4.3)
      const color = unit.owner === me ? 0x4a9eff : 0xff5a4a;
      const py = MAP_H / 2 + (unit.owner === me ? 4 : -4);
      this.dots.circle(px, py, size).fill(color);
    }

    // 본진 표식
    this.dots.rect(0, MAP_H / 2 - 7, 3, 14).fill(0x4a9eff);
    this.dots.rect(MAP_W - 3, MAP_H / 2 - 7, 3, 14).fill(0xff5a4a);

    // 현재 카메라 영역을 흰 프레임으로 (§4.3)
    const left = (toLogical(this.camera.viewLeft) / LOGICAL_MAX) * MAP_W;
    const right = (toLogical(this.camera.viewRight) / LOGICAL_MAX) * MAP_W;
    const clampedLeft = clamp(left, 0, MAP_W);
    const clampedRight = clamp(right, 0, MAP_W);
    this.viewport.clear();
    this.viewport
      .rect(clampedLeft, 1, Math.max(2, clampedRight - clampedLeft), MAP_H - 2)
      .stroke({ width: 1, color: 0xffffff, alpha: 0.85, alignment: 0 });
  }

  hitTest(x: number, y: number): boolean {
    return x >= this.x && x <= this.x + MAP_W && y >= this.y && y <= this.y + MAP_H;
  }
}
