import { Container, Graphics } from 'pixi.js';
import { GROUND_Y, WORLD_WIDTH } from './coords';

const INK = 0x253044;

function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/** 밝은 만화풍 하늘은 화면에 고정하고, 건물만 카메라에 따라 천천히 움직인다. */
export function buildSky(width: number, height: number): Graphics {
  const sky = new Graphics();
  drawSky(sky, width, height);
  return sky;
}

export function drawSky(sky: Graphics, width: number, height: number): void {
  sky.clear();
  sky.rect(0, 0, width, height).fill(0xbde7f3);
  sky.rect(0, height * 0.54, width, height * 0.46).fill({ color: 0xffeccb, alpha: 0.5 });

  const sunX = width * 0.78;
  const sunY = height * 0.2;
  const radius = Math.min(width, height) * 0.085;
  sky.circle(sunX, sunY, radius + 14).fill({ color: 0xffffff, alpha: 0.26 });
  sky.circle(sunX, sunY, radius).fill(0xffdc74).stroke({ width: 4, color: INK });

  for (const [x, y, size] of [
    [0.16, 0.16, 1], [0.43, 0.26, 0.72], [0.64, 0.1, 0.6], [0.93, 0.31, 0.84],
  ] as const) {
    const cx = width * x;
    const cy = height * y;
    const w = 108 * size;
    const h = 26 * size;
    sky.roundRect(cx - w / 2, cy, w, h, h / 2).fill(0xfffcf2);
    sky.circle(cx - w * 0.18, cy, h * 0.76).fill(0xfffcf2);
    sky.circle(cx + w * 0.13, cy - h * 0.18, h * 0.9).fill(0xfffcf2);
    sky.moveTo(cx - w / 2, cy + h).lineTo(cx + w / 2, cy + h)
      .stroke({ width: 3, color: INK, alpha: 0.42 });
  }
}

export function buildFarLayer(): Container {
  const layer = new Container();
  const art = new Graphics();
  const random = seeded(7);
  const colors = [0xc3d5dd, 0xbed4e5, 0xcfdce4, 0xb8cbd9];

  for (let i = 0; i < 66; i += 1) {
    const width = 96 + random() * 96;
    const height = 150 + random() * 180;
    const x = -WORLD_WIDTH * 0.24 + i * (WORLD_WIDTH * 1.5) / 66;
    const y = GROUND_Y - height;
    art.roundRect(x, y, width, height, 10)
      .fill(colors[i % colors.length])
      .stroke({ width: 3, color: INK, alpha: 0.38 });
    art.rect(x + width * 0.44, y - 11, width * 0.12, 11).fill(0x9fbac8);
  }
  layer.addChild(art);
  return layer;
}

export function buildMidLayer(): Container {
  const layer = new Container();
  const art = new Graphics();
  const random = seeded(31);
  const colors = [0xf5dec2, 0xd8e4d8, 0xf2d7cf, 0xd6dce7];

  for (let i = 0; i < 48; i += 1) {
    const width = 94 + random() * 88;
    const height = 95 + random() * 160;
    const x = -WORLD_WIDTH * 0.16 + i * (WORLD_WIDTH * 1.34) / 48;
    const y = GROUND_Y - height;
    art.roundRect(x, y, width, height + 3, 7)
      .fill(colors[i % colors.length])
      .stroke({ width: 4, color: INK, alpha: 0.72 });
    art.rect(x + 8, y + 17, width - 16, 6).fill({ color: 0xffffff, alpha: 0.48 });
    art.roundRect(x + width - 16, y + 29, 7, Math.min(47, height * 0.28), 3)
      .fill({ color: x < WORLD_WIDTH / 2 ? 0x4d7fe4 : 0xff987e, alpha: 0.7 });

    const columns = Math.max(2, Math.floor((width - 26) / 34));
    const rows = Math.max(1, Math.floor((height - 46) / 45));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const wx = x + 14 + column * ((width - 28) / columns);
        const wy = y + 36 + row * 44;
        art.roundRect(wx, wy, 19, 24, 4)
          .fill(i % 3 === 0 ? 0xfff8df : 0x9fc9d6)
          .stroke({ width: 2, color: INK, alpha: 0.6 });
      }
    }
    if (i % 4 === 0) {
      art.moveTo(x + width / 2, y).lineTo(x + width / 2, y - 24)
        .stroke({ width: 3, color: INK, alpha: 0.65 });
      art.circle(x + width / 2, y - 28, 5).fill(0xff9b80).stroke({ width: 2, color: INK });
    }
  }
  layer.addChild(art);
  return layer;
}

export function buildGroundLayer(): Container {
  const layer = new Container();
  const art = new Graphics();
  const left = -WORLD_WIDTH;
  const width = WORLD_WIDTH * 3;

  art.rect(left, GROUND_Y, width, 500).fill(0xf0dfbc);
  art.rect(left, GROUND_Y, width, 10).fill(0x6d8390);
  art.rect(left, GROUND_Y, width, 5).fill(INK);
  art.rect(left, GROUND_Y + 10, WORLD_WIDTH * 1.5, 4).fill(0x4d7fe4);
  art.rect(WORLD_WIDTH / 2, GROUND_Y + 10, WORLD_WIDTH * 1.5, 4).fill(0xff987e);
  for (let x = left; x < left + width; x += 78) {
    art.roundRect(x + 10, GROUND_Y + 23, 36, 6, 3).fill({ color: 0xbaa782, alpha: 0.65 });
    art.circle(x + 61, GROUND_Y + 48, 3).fill(0xc7b48d);
  }
  layer.addChild(art);
  return layer;
}
