import { Container, Graphics } from 'pixi.js';
import { GROUND_Y, WORLD_WIDTH } from './coords';

const INK = 0x263b54;

function blendColor(from: number, to: number, ratio: number): number {
  const a = Math.max(0, Math.min(1, ratio));
  const channel = (shift: number) => Math.round(
    ((from >> shift) & 0xff) * (1 - a) + ((to >> shift) & 0xff) * a,
  );
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/** 하늘은 화면에 고정하고, 빌딩만 카메라에 따라 천천히 움직인다. */
export function buildSky(width: number, height: number): Graphics {
  const sky = new Graphics();
  drawSky(sky, width, height);
  return sky;
}

export function drawSky(sky: Graphics, width: number, height: number): void {
  sky.clear();
  const bands = 96;
  for (let band = 0; band < bands; band += 1) {
    const t = band / (bands - 1);
    const color = t < 0.6
      ? blendColor(0x416d99, 0x93b5c2, t / 0.6)
      : blendColor(0x93b5c2, 0xd3c4ad, (t - 0.6) / 0.4);
    sky.rect(0, height * band / bands, width, height / bands + 1).fill(color);
  }
  sky.rect(0, height * 0.54, width, height * 0.06)
    .fill({ color: 0xffcf9e, alpha: 0.11 });

  const sunX = width * 0.78;
  const sunY = height * 0.2;
  const radius = Math.min(width, height) * 0.085;
  sky.circle(sunX, sunY, radius + 31).fill({ color: 0xffe4aa, alpha: 0.1 });
  sky.circle(sunX, sunY, radius + 15).fill({ color: 0xffe4aa, alpha: 0.2 });
  sky.circle(sunX, sunY, radius).fill(0xffd78d);

  for (const [x, y, size] of [
    [0.16, 0.16, 1], [0.43, 0.26, 0.72], [0.64, 0.1, 0.6], [0.93, 0.31, 0.84],
  ] as const) {
    const cx = width * x;
    const cy = height * y;
    const w = 108 * size;
    const h = 26 * size;
    sky.roundRect(cx - w / 2, cy, w, h, h / 2).fill(0xdfecee);
    sky.circle(cx - w * 0.18, cy, h * 0.76).fill(0xdfecee);
    sky.circle(cx + w * 0.13, cy - h * 0.18, h * 0.9).fill(0xdfecee);
    sky.roundRect(cx - w * 0.27, cy + h + 4, w * 0.54, 3, 2)
      .fill({ color: 0x506e8c, alpha: 0.2 });
  }
}

export function buildFarLayer(): Container {
  const layer = new Container();
  const art = new Graphics();
  const random = seeded(7);
  const colors = [0x91aabe, 0x97afbb, 0x849eb4, 0x9fb4bf];

  for (let i = 0; i < 66; i += 1) {
    const width = 96 + random() * 96;
    const height = 150 + random() * 180;
    const x = -WORLD_WIDTH * 0.24 + i * (WORLD_WIDTH * 1.5) / 66;
    const y = GROUND_Y - height;
    art.roundRect(x, y, width, height, 8).fill(colors[i % colors.length]);
    art.rect(x + width * 0.44, y - 11, width * 0.12, 11)
      .fill({ color: 0x607f9b, alpha: 0.56 });
  }
  layer.addChild(art);
  return layer;
}

export function buildMidLayer(): Container {
  const layer = new Container();
  const art = new Graphics();
  const random = seeded(31);
  const colors = [0x8ba0aa, 0x718ba1, 0x98a8ac, 0x7889a0];

  for (let i = 0; i < 48; i += 1) {
    const width = 94 + random() * 88;
    const height = 95 + random() * 160;
    const x = -WORLD_WIDTH * 0.16 + i * (WORLD_WIDTH * 1.34) / 48;
    const y = GROUND_Y - height;
    art.roundRect(x, y, width, height + 3, 7)
      .fill(colors[i % colors.length])
      .stroke({ width: 2, color: INK, alpha: 0.36 });
    art.rect(x + 8, y + 17, width - 16, 4)
      .fill({ color: 0xe0eced, alpha: 0.36 });
    art.roundRect(x + width - 15, y + 29, 5, Math.min(47, height * 0.28), 3)
      .fill({ color: x < WORLD_WIDTH / 2 ? 0x65bfff : 0xff9c83, alpha: 0.83 });

    const columns = Math.max(2, Math.floor((width - 26) / 34));
    const rows = Math.max(1, Math.floor((height - 46) / 45));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const wx = x + 14 + column * ((width - 28) / columns);
        const wy = y + 36 + row * 44;
        art.roundRect(wx, wy, 19, 24, 3)
          .fill({ color: i % 3 === 0 ? 0xffdbad : 0xc1e3e6, alpha: 0.83 });
      }
    }
    if (i % 4 === 0) {
      art.moveTo(x + width / 2, y).lineTo(x + width / 2, y - 24)
        .stroke({ width: 2, color: INK, alpha: 0.65 });
      art.circle(x + width / 2, y - 28, 4).fill(0xff9d83);
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

  art.rect(left, GROUND_Y, width, 500).fill(0x3a5069);
  art.rect(left, GROUND_Y, width, 11).fill(0x243a55);
  art.rect(left, GROUND_Y, width, 3).fill(0xb1d3db);
  art.rect(left, GROUND_Y + 11, WORLD_WIDTH * 1.5, 3).fill(0x65bfff);
  art.rect(WORLD_WIDTH / 2, GROUND_Y + 11, WORLD_WIDTH * 1.5, 3).fill(0xff9c83);
  for (let x = left; x < left + width; x += 78) {
    art.roundRect(x + 10, GROUND_Y + 27, 36, 4, 2)
      .fill({ color: 0xc7d5d9, alpha: 0.33 });
    art.circle(x + 61, GROUND_Y + 48, 2).fill({ color: 0xd1e0e4, alpha: 0.25 });
  }
  layer.addChild(art);
  return layer;
}
