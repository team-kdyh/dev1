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
  const color = FACTION_COLOR[faction] ?? 0x888888;
  const w = 190;
  const h = 260;

  const g = new Graphics();
  g.roundRect(0, 30, w, h - 30, 10).fill(0x1a2030);
  g.roundRect(0, 30, w, h - 30, 10).stroke({ width: 3, color, alignment: 1 });
  g.rect(w / 2 - 34, h - 96, 68, 96).fill(0x0c101a);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      g.rect(24 + col * 52, 62 + row * 40, 34, 22).fill({ color, alpha: 0.35 });
    }
  }
  g.moveTo(0, 30).lineTo(w / 2, 0).lineTo(w, 30).fill(color);

  const texture = renderer.generateTexture({ target: g, resolution: 1 });
  g.destroy();
  return texture;
}
