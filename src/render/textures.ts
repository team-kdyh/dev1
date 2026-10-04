import { Assets, Graphics, Rectangle, Texture, type Renderer } from 'pixi.js';
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

export async function initTextures(renderer: Renderer): Promise<void> {
  frames.clear();
  baseCache.clear();
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
  for (const faction of Object.keys(FACTION_COLOR)) {
    for (let age = 1; age <= 4; age++) {
      baseCache.set(faction + ':' + age, makeBaseTexture(renderer, faction, age));
    }
  }
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

export const pixelTexture = (): Texture => Texture.WHITE;

function makeBaseTexture(renderer: Renderer, faction: string, age: number): Texture {
  const color = faction === 'semicon' ? 0x4d7fe4 : 0xff987e;
  const shell = faction === 'semicon' ? 0xe8f3ff : 0xfff0e8;
  const ink = 0x253044;
  const w = 190;
  const h = 260;

  const g = new Graphics();
  g.ellipse(w / 2, h - 4, 91, 12).fill({ color: ink, alpha: 0.22 });
  g.roundRect(11, 42, w - 22, h - 44, 20).fill(shell).stroke({ width: 6, color: ink });
  g.roundRect(17, 47, w - 34, 61, 17).fill(color).stroke({ width: 4, color: ink });
  g.roundRect(40, 63, w - 80, 30, 12).fill(0xffffff).stroke({ width: 3, color: ink });
  g.circle(74, 78, 4).fill(ink);
  g.circle(116, 78, 4).fill(ink);
  g.moveTo(86, 86).quadraticCurveTo(95, 92, 104, 86).stroke({ width: 3, color: ink });
  g.roundRect(28, 120, w - 56, 110, 13).fill(0xffffff).stroke({ width: 4, color: ink });
  g.roundRect(57, 165, 76, 94, 10).fill(ink);
  g.roundRect(65, 172, 60, 87, 7).fill(color);
  g.circle(112, 213, 4).fill(0xffffff);
  g.circle(47, 140, 7).fill(0xffd875).stroke({ width: 2, color: ink });
  g.circle(143, 140, 7).fill(0xffd875).stroke({ width: 2, color: ink });
  g.roundRect(65, 24, 60, 22, 11).fill(ink);
  g.roundRect(72, 27, 46, 15, 7).fill(0xffe085);
  for (let level = 2; level <= age; level++) {
    const towerX = level % 2 === 0 ? 18 : 146;
    const towerY = 14 - level * 3;
    g.roundRect(towerX, towerY, 26, 48, 7).fill(color).stroke({ width: 4, color: ink });
    g.circle(towerX + 13, towerY + 14, 5).fill(0xffffff).stroke({ width: 2, color: ink });
  }

  const texture = renderer.generateTexture({ target: g, resolution: 1 });
  g.destroy();
  return texture;
}
