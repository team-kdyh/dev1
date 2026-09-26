import { Container, Graphics, Text, Texture, type Renderer } from 'pixi.js';
import { getUnitTexture, initUnitAssets } from './unitAssets';

/**
 * D의 정식 아틀라스가 오기 전까지 쓰는 플레이스홀더. (명세 §0-5, §8)
 *
 * 핵심은 "(진영, 티어)당 텍스처 1장을 만들어 모든 스프라이트가 공유한다"는 것.
 * M2에서 Assets.load()로 아틀라스를 읽어오는 형태로 바뀌어도
 * 바깥 코드는 unitTexture()만 계속 부르면 된다.
 */

export const FACTION_COLOR: Record<string, number> = {
  semicon: 0x4a9eff,
  orchard: 0xff5a4a,
};

const cache = new Map<string, Texture>();

export async function initTextures(renderer: Renderer): Promise<void> {
  cache.clear();
  for (const faction of Object.keys(FACTION_COLOR)) {
    for (let tier = 1; tier <= 9; tier += 1) {
      cache.set(`unit:${faction}:${tier}`, makeUnitTexture(renderer, faction, tier));
    }
    cache.set(`base:${faction}`, makeBaseTexture(renderer, faction));
  }
  try {
    await initUnitAssets();
  } catch (error) {
    // 배포 중 개별 에셋이 깨져도 전투 자체는 기존 도형 텍스처로 부팅한다.
    console.warn('캐릭터 아틀라스를 읽지 못해 대체 텍스처를 사용합니다.', error);
  }
}

export function unitTexture(defId: string, faction: string, tier: number): Texture {
  const character = getUnitTexture(defId);
  if (character) return character;
  return cache.get(`unit:${faction}:${tier}`) ?? Texture.WHITE;
}

export function baseTexture(faction: string): Texture {
  return cache.get(`base:${faction}`) ?? Texture.WHITE;
}

/** HP 바·플래시·파티클처럼 tint + scale만 쓰는 것들은 전부 이 1x1을 공유한다. */
export const pixelTexture = (): Texture => Texture.WHITE;

function makeUnitTexture(renderer: Renderer, faction: string, tier: number): Texture {
  const color = FACTION_COLOR[faction] ?? 0x888888;
  const w = 30 + tier * 4;
  const h = 40 + tier * 9;

  const box = new Container();
  const g = new Graphics();
  g.roundRect(0, 0, w, h, 5).fill(color);
  g.roundRect(0, 0, w, h, 5).stroke({ width: 2, color: 0x0c101a, alignment: 1 });
  // 머리 쪽 밝은 띠 — 방향/티어를 눈으로 구분하기 위한 최소 장치
  g.rect(3, 4, w - 6, 6).fill({ color: 0xffffff, alpha: 0.45 });
  box.addChild(g);

  const label = new Text({
    text: `T${tier}`,
    style: { fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: 0x0c101a },
  });
  label.anchor.set(0.5);
  label.position.set(w / 2, h / 2 + 4);
  box.addChild(label);

  const texture = renderer.generateTexture({ target: box, resolution: 2 });
  box.destroy({ children: true });
  return texture;
}

function makeBaseTexture(renderer: Renderer, faction: string): Texture {
  const w = 240;
  const h = 280;
  const box = new Container();
  const g = new Graphics();
  if (faction === 'semicon') drawGalaxyFab(g, w, h);
  else drawInfiniteLoop(g, w, h);
  box.addChild(g);

  const title = new Text({
    text: faction === 'semicon' ? 'GALAXY  FAB' : 'INFINITE  LOOP',
    style: {
      fontFamily: 'monospace',
      fontSize: faction === 'semicon' ? 13 : 12,
      fontWeight: 'bold',
      letterSpacing: 2,
      fill: faction === 'semicon' ? 0x8fd7ff : 0xffffff,
    },
  });
  title.anchor.set(0.5);
  title.position.set(w / 2, faction === 'semicon' ? 268 : 245);
  box.addChild(title);

  const texture = renderer.generateTexture({ target: box, resolution: 2 });
  box.destroy({ children: true });
  return texture;
}

/** 세미콘: 폴더블 성문, 반도체 회로, 웨이퍼 코어, S펜 포대를 쌓은 공장 요새. */
function drawGalaxyFab(g: Graphics, w: number, h: number): void {
  const blue = 0x4a9eff;
  g.roundRect(9, h - 28, w - 18, 28, 7).fill(0x0a101d);
  g.roundRect(18, 55, w - 36, h - 75, 14).fill(0x121b2d);
  g.roundRect(18, 55, w - 36, h - 75, 14).stroke({ width: 4, color: blue, alpha: 0.9 });

  // 비대칭 팹 타워와 안테나
  g.roundRect(31, 30, 48, 190, 8).fill(0x1d2d49);
  g.roundRect(161, 42, 49, 178, 8).fill(0x1a2841);
  g.rect(43, 17, 5, 18).fill(0x8fd7ff);
  g.circle(45, 13, 6).stroke({ width: 2, color: 0x8fd7ff });
  g.moveTo(182, 42).lineTo(201, 17).stroke({ width: 7, color: 0xb9dcff });
  g.poly([198, 14, 211, 9, 203, 22]).fill(0xffffff);

  // 중앙 폴더블 성문 — 두 화면과 힌지가 맞물린다.
  g.roundRect(76, 111, 88, 145, 10).fill(0x070b14);
  g.roundRect(78, 113, 41, 141, 8).fill({ color: blue, alpha: 0.18 });
  g.roundRect(121, 113, 41, 141, 8).fill({ color: 0x86e6ff, alpha: 0.12 });
  g.moveTo(120, 116).lineTo(120, 251).stroke({ width: 4, color: 0xa7dcff, alpha: 0.8 });
  g.roundRect(76, 111, 88, 145, 10).stroke({ width: 3, color: 0x679dff });

  // 회로 패턴과 웨이퍼 발전기
  for (let y = 103; y <= 197; y += 31) {
    g.rect(40, y, 17, 7).fill({ color: blue, alpha: 0.55 });
    g.moveTo(57, y + 3).lineTo(71, y + 3).lineTo(71, y + 13)
      .stroke({ width: 2, color: blue, alpha: 0.45 });
    g.rect(181, y + 8, 17, 7).fill({ color: 0x86e6ff, alpha: 0.45 });
    g.moveTo(168, y + 11).lineTo(181, y + 11).stroke({ width: 2, color: blue, alpha: 0.4 });
  }
  g.circle(120, 76, 22).fill({ color: 0x0a162b, alpha: 0.9 });
  g.circle(120, 76, 22).stroke({ width: 4, color: blue });
  g.circle(120, 76, 12).stroke({ width: 2, color: 0xb8efff, alpha: 0.75 });
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    const x1 = 120 + Math.cos(angle) * 13;
    const y1 = 76 + Math.sin(angle) * 13;
    const x2 = 120 + Math.cos(angle) * 20;
    const y2 = 76 + Math.sin(angle) * 20;
    g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 2, color: 0x8fd7ff, alpha: 0.8 });
  }
}

/** 오차드: 원형 캠퍼스, 유리 큐브, MagSafe 링을 결합한 미니멀 성채. */
function drawInfiniteLoop(g: Graphics, w: number, h: number): void {
  const coral = 0xff6f61;
  g.roundRect(8, h - 26, w - 16, 26, 13).fill(0x10131b);

  // 원형 캠퍼스 본체
  g.circle(w / 2, 154, 103).fill(0xe7edf5);
  g.circle(w / 2, 154, 103).stroke({ width: 5, color: 0xffffff, alpha: 0.95 });
  g.circle(w / 2, 154, 73).fill(0x17202d);
  g.circle(w / 2, 154, 73).stroke({ width: 4, color: 0xaec5d8, alpha: 0.85 });
  g.arc(w / 2, 154, 88, -2.7, -0.4).stroke({ width: 8, color: coral, alpha: 0.82 });
  g.arc(w / 2, 154, 88, 0.35, 2.45).stroke({ width: 8, color: 0x9edcff, alpha: 0.75 });

  // 유리 큐브 입구
  g.roundRect(75, 91, 90, 164, 12).fill({ color: 0xbfeaff, alpha: 0.22 });
  g.roundRect(75, 91, 90, 164, 12).stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
  g.moveTo(105, 93).lineTo(105, 252).moveTo(135, 93).lineTo(135, 252)
    .stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
  g.moveTo(77, 142).lineTo(163, 142).moveTo(77, 198).lineTo(163, 198)
    .stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
  g.roundRect(101, 195, 38, 60, 19).fill(0x101621);

  // MagSafe 코어와 프레젠테이션 비콘
  g.circle(120, 70, 25).fill({ color: 0x111827, alpha: 0.88 });
  g.circle(120, 70, 22).stroke({ width: 5, color: 0xffffff });
  g.circle(120, 70, 12).stroke({ width: 3, color: coral, alpha: 0.9 });
  g.rect(117, 20, 6, 27).fill(0xffffff);
  g.circle(120, 15, 8).fill({ color: coral, alpha: 0.95 });
  g.circle(120, 15, 14).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
}
