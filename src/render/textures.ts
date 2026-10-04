import { Assets, Rectangle, Texture } from 'pixi.js';
import manifest from '../../assets/manifest.json';
import { assetUrl } from '../assets/assetUrl';
import factionsSource from '../data/balance/factions.json' with { type: 'json' };

/**
 * 진영 색. **C의 `factions.json`에서 읽는다** — 코드에 적지 않는다.
 * 전에는 `semicon: 0x1428a0` 처럼 박혀 있었는데, 같은 값이 데이터에도 있어
 * C가 색을 바꾸면 조용히 어긋났다.
 */
export const FACTION_COLOR: Record<string, number> = Object.fromEntries(
  (factionsSource.factions as { id: string; colorPrimary: string }[]).map((faction) => [
    faction.id,
    Number.parseInt(faction.colorPrimary.replace('#', ''), 16),
  ]),
);

type FrameRef = { atlas: string; frame: string };
type Clip = { fps: number; loop: boolean; frames: FrameRef[] };
type ArtUnit = { faction: string; tier: number; clips: Record<string, Clip> };
type AtlasFrame = { frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number } };
type Atlas = { meta: { image: string }; frames: Record<string, AtlasFrame> };

const units = manifest.units as Record<string, ArtUnit>;
const unitByTier = new Map<string, ArtUnit>();
for (const unit of Object.values(units)) unitByTier.set(unit.faction + ':' + unit.tier, unit);
const frames = new Map<string, Texture>();
const baseCache = new Map<string, Texture>();
const unitCardCache = new Map<string, Texture>();

export async function initTextures(): Promise<void> {
  frames.clear();
  baseCache.clear();
  unitCardCache.clear();
  await Promise.all(manifest.atlases.map(async (atlasName) => {
    const response = await fetch(assetUrl('atlases/' + atlasName));
    if (!response.ok) throw new Error('Atlas metadata failed: ' + atlasName);
    const atlas = await response.json() as Atlas;
    const image = await Assets.load<Texture>(assetUrl('atlases/' + atlas.meta.image));
    for (const [name, entry] of Object.entries(atlas.frames)) {
      const { x, y, w, h } = entry.frame;
      frames.set(atlasName + ':' + name, new Texture({
        source: image.source,
        frame: new Rectangle(x, y, w, h),
        orig: new Rectangle(0, 0, entry.sourceSize.w, entry.sourceSize.h),
        trim: new Rectangle(entry.spriteSourceSize.x, entry.spriteSourceSize.y, w, h),
        defaultAnchor: { x: 0.5, y: 1 },
      }));
    }
  }));
  for (const unit of Object.values(units)) {
    for (const clip of Object.values(unit.clips)) {
      for (const ref of clip.frames) {
        if (!frames.has(ref.atlas + ':' + ref.frame)) throw new Error('Missing animation frame ' + ref.frame);
      }
    }
  }
  await Promise.all(Object.keys(FACTION_COLOR).map(async (faction) => {
    const [base, card] = await Promise.all([
      Assets.load<Texture>(assetUrl(`game-ui/${faction}-base.png`)),
      Assets.load<Texture>(assetUrl(`game-ui/${faction}-unit-card.png`)),
    ]);
    for (let age = 1; age <= 4; age++) baseCache.set(faction + ':' + age, base);
    // 생성 이미지의 투명 바깥 여백을 프레임에서 제외한다. 버튼 전체가
    // 터치 영역과 일치하고 작은 모바일 화면에서도 카드가 선명하게 보인다.
    unitCardCache.set(faction, new Texture({
      source: card.source,
      frame: new Rectangle(177, 109, 820, 1121),
    }));
  }));
}

export function unitTexture(faction: string, tier: number, state = 'idle', elapsedMs = 0): Texture {
  const unit = unitByTier.get(faction + ':' + tier);
  const clip = unit?.clips[state] ?? unit?.clips.idle;
  if (!clip) return Texture.WHITE;
  const index = Math.floor(elapsedMs * clip.fps / 1000);
  const frame = clip.frames[clip.loop ? index % clip.frames.length : Math.min(index, clip.frames.length - 1)];
  return frames.get(frame.atlas + ':' + frame.frame) ?? Texture.WHITE;
}

export function baseTexture(faction: string, age = 1): Texture {
  return baseCache.get(faction + ':' + age) ?? Texture.WHITE;
}

export function unitCardTexture(faction: string): Texture {
  return unitCardCache.get(faction) ?? Texture.WHITE;
}

export const pixelTexture = (): Texture => Texture.WHITE;
