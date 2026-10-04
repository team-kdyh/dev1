import { Container, Graphics } from 'pixi.js';
import { GROUND_Y, WORLD_WIDTH } from './coords';
import { FACTION_ORDER, factionTheme, mix, shade, type FactionTheme } from './factionTheme';

/**
 * 배경·중경·지면. (§2.3 레이어 0~2)
 *
 * 전장은 좌우로 두 진영의 영토다. 왼쪽 본진 진영(세미콘)은 각진 반도체 팹과
 * 회로 기판, 오른쪽 본진 진영(오차드)은 둥근 유리 캠퍼스와 미니멀한 패널로 그린다.
 * 가운데는 두 영토가 섞이는 전선이다.
 *
 * 색은 전부 `factionTheme`(= C의 factions.json)에서 온다 — 여기에 색을 적지 않는다.
 * 전부 정적이므로 한 번 만들고 다시 건드리지 않는다. 패럴랙스는 컨테이너 x만 움직인다.
 */

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LEFT = () => factionTheme(FACTION_ORDER[0] ?? 'semicon');
const RIGHT = () => factionTheme(FACTION_ORDER[1] ?? 'orchard');

/** 월드 x에서 오른쪽 진영의 지분(0~1). 가운데 25% 구간에서 섞인다. */
function rightShare(x: number): number {
  const t = (x / WORLD_WIDTH - 0.375) / 0.25;
  return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
}

function themeAt(x: number): FactionTheme {
  return rightShare(x) < 0.5 ? LEFT() : RIGHT();
}

// ---------------------------------------------------------------------------
// 원경 — 스카이라인 (패럴랙스 0.2)
// ---------------------------------------------------------------------------

export function buildFarLayer(): Container {
  const layer = new Container();
  const g = new Graphics();
  const rng = seeded(7);

  const spanStart = -WORLD_WIDTH * 0.25;
  const spanWidth = WORLD_WIDTH * 1.5;
  const count = 84;

  for (let i = 0; i < count; i += 1) {
    const x = spanStart + (i * spanWidth) / count;
    const theme = themeAt(x);
    const w = 58 + rng() * 120;
    const h = 130 + rng() * 300;
    const top = GROUND_Y - h;

    if (theme.angular) {
      // 세미콘: 각진 팹 타워 + 굴뚝 + 옥상 설비
      g.rect(x, top, w, h).fill({ color: theme.far, alpha: 0.95 });
      g.rect(x, top, w, 3).fill({ color: theme.glow, alpha: 0.28 });
      if (rng() < 0.45) {
        const sw = 8 + rng() * 10;
        g.rect(x + w * 0.62, top - 40 - rng() * 60, sw, 70).fill({ color: theme.far, alpha: 0.95 });
      }
    } else {
      // 오차드: 둥근 유리 타워
      const r = Math.min(w / 2, 26);
      g.roundRect(x, top, w, h + r, r).fill({ color: theme.far, alpha: 0.95 });
      g.roundRect(x + 6, top + 8, w - 12, 3, 2).fill({ color: theme.glow, alpha: 0.3 });
    }
  }

  // 오른쪽 진영 상징 — 캠퍼스 링 (애플 파크 모티브)
  const right = RIGHT();
  const ringX = WORLD_WIDTH * 0.9;
  const ringY = GROUND_Y - 250;
  g.circle(ringX, ringY, 150).stroke({ width: 16, color: right.far, alpha: 0.9 });
  g.circle(ringX, ringY, 150).stroke({ width: 3, color: right.glow, alpha: 0.35 });

  // 왼쪽 진영 상징 — 웨이퍼 원판과 격자 (실리콘 팹 모티브)
  const left = LEFT();
  const waferX = WORLD_WIDTH * 0.08;
  const waferY = GROUND_Y - 300;
  g.circle(waferX, waferY, 92).fill({ color: left.far, alpha: 0.9 });
  g.circle(waferX, waferY, 92).stroke({ width: 3, color: left.glow, alpha: 0.4 });
  for (let i = -4; i <= 4; i += 1) {
    const o = i * 20;
    const half = Math.sqrt(Math.max(0, 92 * 92 - o * o));
    g.rect(waferX - half, waferY + o - 1, half * 2, 1.5).fill({ color: left.glow, alpha: 0.2 });
  }

  layer.addChild(g);
  return layer;
}

// ---------------------------------------------------------------------------
// 중경 — 회로 기판(좌) / 유리 패널(우) (패럴랙스 0.5)
// ---------------------------------------------------------------------------

export function buildMidLayer(): Container {
  const layer = new Container();
  const g = new Graphics();
  const rng = seeded(31);

  const spanStart = -WORLD_WIDTH * 0.15;
  const spanWidth = WORLD_WIDTH * 1.3;
  const count = 54;

  for (let i = 0; i < count; i += 1) {
    const x = spanStart + (i * spanWidth) / count;
    const theme = themeAt(x);
    const w = 92 + rng() * 140;
    const h = 100 + rng() * 210;
    const top = GROUND_Y - h;

    if (theme.angular) {
      // 세미콘: 칩 패키지처럼 생긴 건물 — 본체 + 양옆 핀 + 창문 격자
      g.rect(x, top, w, h).fill(theme.mid);
      const pins = Math.floor(h / 34);
      for (let p = 0; p < pins; p += 1) {
        const py = top + 16 + p * 34;
        g.rect(x - 7, py, 7, 8).fill({ color: theme.groundEdge, alpha: 0.5 });
        g.rect(x + w, py, 7, 8).fill({ color: theme.groundEdge, alpha: 0.5 });
      }
      const cols = Math.floor(w / 26);
      const rows = Math.floor(h / 30);
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (rng() < 0.42) continue;
          g.rect(x + 9 + c * 26, top + 14 + r * 30, 11, 15).fill({
            color: theme.light,
            alpha: 0.18 + rng() * 0.28,
          });
        }
      }
    } else {
      // 오차드: 모서리가 둥근 유리판 — 얇은 가로 슬릿과 상단 노치
      g.roundRect(x, top, w, h + 18, 18).fill(theme.mid);
      g.roundRect(x + w * 0.34, top - 7, w * 0.32, 14, 7).fill(theme.mid);
      const rows = Math.floor(h / 30);
      for (let r = 0; r < rows; r += 1) {
        if (rng() < 0.3) continue;
        g.roundRect(x + 12, top + 18 + r * 30, w - 24, 10, 5).fill({
          color: theme.light,
          alpha: 0.12 + rng() * 0.2,
        });
      }
    }
  }

  // 세미콘 쪽 지면 근처 회로 트레이스
  const left = LEFT();
  const traceRng = seeded(103);
  for (let i = 0; i < 26; i += 1) {
    const x = -WORLD_WIDTH * 0.1 + traceRng() * WORLD_WIDTH * 0.55;
    if (rightShare(x) > 0.35) continue;
    const y = GROUND_Y - 18 - traceRng() * 70;
    const len = 60 + traceRng() * 190;
    g.rect(x, y, len, 2).fill({ color: left.glow, alpha: 0.2 });
    g.rect(x + len, y - 26, 2, 28).fill({ color: left.glow, alpha: 0.2 });
    g.circle(x + len, y - 28, 3.5).fill({ color: left.glow, alpha: 0.35 });
  }

  layer.addChild(g);
  return layer;
}

// ---------------------------------------------------------------------------
// 지면 — 좌: 공업 금속판 / 우: 밝은 콘크리트
// ---------------------------------------------------------------------------

export function buildGroundLayer(): Container {
  const layer = new Container();
  const g = new Graphics();

  const left = LEFT();
  const right = RIGHT();

  // 좌→우로 지면 색이 넘어가게 띠를 잘라 칠한다
  const bands = 96;
  const startX = -WORLD_WIDTH;
  const totalW = WORLD_WIDTH * 3;
  const bandW = totalW / bands;
  for (let i = 0; i < bands; i += 1) {
    const x = startX + i * bandW;
    const t = rightShare(x + bandW / 2);
    g.rect(x, GROUND_Y, bandW + 1, 500).fill(mix(left.ground, right.ground, t));
    g.rect(x, GROUND_Y, bandW + 1, 3).fill({
      color: mix(left.groundEdge, right.groundEdge, t),
      alpha: 0.85,
    });
  }

  // 세미콘 지면: 금속 이음새
  for (let i = 0; i < 40; i += 1) {
    const x = -WORLD_WIDTH * 0.2 + i * 64;
    if (rightShare(x) > 0.4) continue;
    g.rect(x, GROUND_Y + 6, 2, 26).fill({ color: left.glow, alpha: 0.12 });
  }

  // 오차드 지면: 넓은 타일 눈금
  for (let i = 0; i < 30; i += 1) {
    const x = WORLD_WIDTH * 0.55 + i * 96;
    if (rightShare(x) < 0.6) continue;
    g.rect(x, GROUND_Y + 8, 60, 1.5).fill({ color: right.groundEdge, alpha: 0.18 });
  }

  // 전선 기준선 — 100 논리 단위마다 (전선 위치를 눈으로 가늠하는 표식)
  for (let i = 0; i <= 10; i += 1) {
    const x = (i / 10) * WORLD_WIDTH;
    const t = rightShare(x);
    g.rect(x - 1, GROUND_Y + 12, 2, i % 5 === 0 ? 24 : 12).fill({
      color: mix(left.groundEdge, right.groundEdge, t),
      alpha: 0.3,
    });
  }

  layer.addChild(g);
  return layer;
}

// ---------------------------------------------------------------------------
// 하늘 — 화면 고정. 위는 밤, 아래는 양 진영 색이 번지는 지평선
// ---------------------------------------------------------------------------

export function buildSky(width: number, height: number): Graphics {
  const g = new Graphics();
  paintSky(g, width, height);
  return g;
}

export function paintSky(g: Graphics, width: number, height: number): void {
  g.clear();

  const left = LEFT();
  const right = RIGHT();
  const top = shade(mix(left.primary, right.secondary, 0.5), -0.88);

  // 세로 그라디언트를 띠로 만든다 (FillGradient 대신 — 버전 의존성을 피한다)
  const rows = 28;
  for (let i = 0; i < rows; i += 1) {
    const t = i / (rows - 1);
    const y = (height * i) / rows;
    g.rect(0, y, width, height / rows + 1).fill(mix(top, shade(top, 0.14), t * t));
  }

  // 지평선 발광 — 왼쪽은 세미콘, 오른쪽은 오차드 색
  const glowTop = height * 0.55;
  const glowH = height - glowTop;
  const cols = 40;
  for (let c = 0; c < cols; c += 1) {
    const t = c / (cols - 1);
    const color = mix(left.glow, right.glow, t);
    for (let i = 0; i < 6; i += 1) {
      const k = i / 5;
      g.rect(
        (width * c) / cols,
        glowTop + glowH * k * 0.9,
        width / cols + 1,
        glowH * 0.2,
      ).fill({ color, alpha: 0.03 + k * 0.05 });
    }
  }
}
