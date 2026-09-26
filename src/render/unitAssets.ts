import { Assets, Spritesheet, Texture, type SpritesheetData } from 'pixi.js';
import manifestSource from '../../assets/manifest.json';
import orchardT1T6Source from '../../assets/atlases/orchard_t1_t6.json';
import orchardT7T9Source from '../../assets/atlases/orchard_t7_t9.json';
import semiconT1T6Source from '../../assets/atlases/semicon_t1_t6.json';
import semiconT7T9Source from '../../assets/atlases/semicon_t7_t9.json';
import orchardT1T6Url from '../../assets/atlases/orchard_t1_t6.png?url';
import orchardT7T9Url from '../../assets/atlases/orchard_t7_t9.png?url';
import semiconT1T6Url from '../../assets/atlases/semicon_t1_t6.png?url';
import semiconT7T9Url from '../../assets/atlases/semicon_t7_t9.png?url';
import { resolveAssetUnitId } from '../data/assetMap';
import type { UnitState } from '../sim/contracts';

interface ManifestFrame {
  atlas: string;
  frame: string;
}

interface ManifestClip {
  fps: number;
  loop: boolean;
  frames: ManifestFrame[];
}

interface ManifestUnit {
  clips: Record<string, ManifestClip>;
}

interface AssetManifest {
  units: Record<string, ManifestUnit>;
}

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

interface AtlasData {
  frames: Record<string, AtlasFrame>;
  meta: { size: { w: number; h: number } };
}

interface AtlasDefinition {
  data: AtlasData;
  url: string;
}

export interface UnitAnimationClip {
  readonly textures: readonly Texture[];
  readonly fps: number;
  readonly loop: boolean;
}

export interface UnitPreviewFrame {
  readonly imageUrl: string;
  readonly frame: AtlasFrame['frame'];
  readonly spriteSourceSize: AtlasFrame['spriteSourceSize'];
  readonly sourceSize: AtlasFrame['sourceSize'];
}

const manifest = manifestSource as unknown as AssetManifest;
const atlases: Record<string, AtlasDefinition> = {
  'orchard_t1_t6.json': { data: orchardT1T6Source as AtlasData, url: orchardT1T6Url },
  'orchard_t7_t9.json': { data: orchardT7T9Source as AtlasData, url: orchardT7T9Url },
  'semicon_t1_t6.json': { data: semiconT1T6Source as AtlasData, url: semiconT1T6Url },
  'semicon_t7_t9.json': { data: semiconT7T9Source as AtlasData, url: semiconT7T9Url },
};

const clips = new Map<string, UnitAnimationClip>();
let loading: Promise<void> | undefined;

/** 네 개의 D 아틀라스를 한 번만 읽고 C의 게임플레이 ID로 애니메이션을 등록한다. */
export function initUnitAssets(): Promise<void> {
  loading ??= loadUnitAssets();
  return loading;
}

export function getUnitClip(gameplayId: string, state: UnitState | 'idle'): UnitAnimationClip | undefined {
  const requested = clips.get(clipKey(gameplayId, state));
  if (requested) return requested;

  // 일부 에셋에는 deploy/cast가 없으므로 표현이 끊기지 않게 전투 동작을 먼저 사용한다.
  if (state === 'deploy' || state === 'cast') {
    const action = clips.get(clipKey(gameplayId, 'attack'));
    if (action) return action;
  }
  return clips.get(clipKey(gameplayId, 'idle'));
}

export function getUnitTexture(gameplayId: string): Texture | undefined {
  return getUnitClip(gameplayId, 'idle')?.textures[0];
}

/** DOM 도감도 Pixi와 동일한 아틀라스의 idle 첫 프레임을 사용한다. */
export function getUnitPreviewFrame(gameplayId: string): UnitPreviewFrame | undefined {
  const assetId = resolveAssetUnitId(gameplayId);
  const idle = manifest.units[assetId]?.clips.idle;
  const reference = idle?.frames[0];
  if (!reference) return undefined;

  const atlas = atlases[reference.atlas];
  const frame = atlas?.data.frames[reference.frame];
  if (!atlas || !frame) return undefined;

  return {
    imageUrl: atlas.url,
    frame: frame.frame,
    spriteSourceSize: frame.spriteSourceSize,
    sourceSize: frame.sourceSize,
  };
}

async function loadUnitAssets(): Promise<void> {
  const sheets = new Map<string, Spritesheet>();
  await Promise.all(
    Object.entries(atlases).map(async ([name, atlas]) => {
      const texture = await Assets.load<Texture>(atlas.url);
      const sheet = new Spritesheet(texture, atlas.data as unknown as SpritesheetData);
      await sheet.parse();
      sheets.set(name, sheet);
    }),
  );

  for (const [assetId, unit] of Object.entries(manifest.units)) {
    for (const [state, clip] of Object.entries(unit.clips)) {
      const textures = clip.frames
        .map((reference) => sheets.get(reference.atlas)?.textures[reference.frame])
        .filter((texture): texture is Texture => texture !== undefined);
      if (textures.length === clip.frames.length && textures.length > 0) {
        clips.set(`${assetId}:${state}`, { textures, fps: clip.fps, loop: clip.loop });
      }
    }
  }
}

function clipKey(gameplayId: string, state: string): string {
  return `${resolveAssetUnitId(gameplayId)}:${state}`;
}
