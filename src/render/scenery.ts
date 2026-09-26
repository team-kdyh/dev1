import { Container, Graphics } from 'pixi.js';
import { GROUND_Y, WORLD_WIDTH } from './coords';

/**
 * 배경·중경·지면. (§2.3 레이어 0~2)
 * 전부 정적이므로 한 번 만들고 다시 건드리지 않는다 — 패럴랙스는 컨테이너 x만 움직인다.
 */

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildFarLayer(): Container {
  const layer = new Container();
  const g = new Graphics();
  const rng = seeded(7);

  for (let i = 0; i < 90; i += 1) {
    const w = 60 + rng() * 130;
    const h = 120 + rng() * 300;
    const x = -WORLD_WIDTH * 0.2 + i * (WORLD_WIDTH * 1.4) / 90;
    g.rect(x, GROUND_Y - h, w, h).fill({ color: 0x1b2438, alpha: 0.9 });
  }
  layer.addChild(g);
  return layer;
}

export function buildMidLayer(): Container {
  const layer = new Container();
  const g = new Graphics();
  const rng = seeded(31);

  for (let i = 0; i < 60; i += 1) {
    const w = 90 + rng() * 150;
    const h = 90 + rng() * 210;
    const x = -WORLD_WIDTH * 0.1 + i * (WORLD_WIDTH * 1.2) / 60;
    g.rect(x, GROUND_Y - h, w, h).fill(0x232f49);
    const cols = Math.floor(w / 26);
    const rows = Math.floor(h / 30);
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (rng() < 0.42) continue;
        g.rect(x + 8 + c * 26, GROUND_Y - h + 12 + r * 30, 12, 16)
          .fill({ color: 0x8fb4ff, alpha: 0.18 + rng() * 0.25 });
      }
    }
  }
  layer.addChild(g);
  return layer;
}

export function buildGroundLayer(): Container {
  const layer = new Container();
  const g = new Graphics();

  g.rect(-WORLD_WIDTH, GROUND_Y, WORLD_WIDTH * 3, 500).fill(0x2a2f3d);
  g.rect(-WORLD_WIDTH, GROUND_Y, WORLD_WIDTH * 3, 4).fill(0x3d4658);

  // 100 논리 단위마다 눈금 — 전선 위치를 눈으로 가늠하기 위한 개발용 표식
  for (let i = 0; i <= 10; i += 1) {
    const x = (i / 10) * WORLD_WIDTH;
    g.rect(x - 1, GROUND_Y + 10, 2, i % 5 === 0 ? 26 : 14).fill({
      color: 0xffffff,
      alpha: 0.12,
    });
  }
  layer.addChild(g);
  return layer;
}

export function buildSky(width: number, height: number): Graphics {
  const g = new Graphics();
  g.rect(0, 0, width, height).fill(0x0d1220);
  return g;
}
